#!/usr/bin/env bash
# =============================================================================
# Lumio — Umzug des mitgelieferten Speichers von MinIO auf RustFS
# Lumio — move the bundled storage from MinIO to RustFS
# =============================================================================
#
# Aufruf im Lumio-Ordner (dort, wo docker-compose.yml und .env liegen):
# Run inside the Lumio folder (where docker-compose.yml and .env are):
#
#     ./scripts/migrate-minio-to-rustfs.sh
#
# Was passiert / what it does:
#   1. Prüft, dass MinIO läuft und die Installation noch nicht umgezogen ist.
#   2. Stoppt API, Worker und Frontend (keine neuen Uploads während der Kopie).
#   3. Startet RustFS vorübergehend mit einem neuen, leeren Volume.
#   4. Kopiert alle Dateien aus dem MinIO-Bucket nach RustFS und vergleicht
#      Anzahl und Größe.
#   5. Trägt COMPOSE_FILE=docker-compose.yml:docker-compose.rustfs.yml in die
#      .env ein (vorher wird eine Sicherung .env.bak-<zeitpunkt> angelegt).
#   6. Startet Lumio mit RustFS.
#
# Die MinIO-Daten (Volume minio_data) bleiben unverändert erhalten. Zurück zu
# MinIO: die COMPOSE_FILE-Zeile aus der .env entfernen, `docker compose up -d`.
# Details: docs/STORAGE.md, "Moving from MinIO to RustFS".
#
# Optionen: --yes   ohne Rückfrage ausführen / run without asking
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
die()  { printf '\n\033[31mFEHLER / ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

ASSUME_YES=false
[ "${1:-}" = "--yes" ] && ASSUME_YES=true

# --- Voraussetzungen ---------------------------------------------------------
[ -f docker-compose.yml ] && [ -f docker-compose.rustfs.yml ] \
  || die "docker-compose.yml / docker-compose.rustfs.yml nicht gefunden. Bitte im Lumio-Ordner ausführen, nach 'git pull'."
[ -f .env ] || die ".env nicht gefunden."
if grep -Eq '^COMPOSE_FILE=.*docker-compose\.rustfs\.yml' .env; then
  die "Diese Installation nutzt bereits RustFS (COMPOSE_FILE in .env). Nichts zu tun."
fi

env_value() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"; }
S3_ACCESS_KEY="$(env_value S3_ACCESS_KEY)"
S3_SECRET_KEY="$(env_value S3_SECRET_KEY)"
S3_BUCKET="$(env_value S3_BUCKET)"; S3_BUCKET="${S3_BUCKET:-lumio}"
S3_ENDPOINT="$(env_value S3_ENDPOINT)"
[ -n "$S3_ACCESS_KEY" ] && [ -n "$S3_SECRET_KEY" ] || die "S3_ACCESS_KEY / S3_SECRET_KEY fehlen in der .env."
case "$S3_ENDPOINT" in
  ""|http://minio:9000*) ;;
  *) die "S3_ENDPOINT zeigt nicht auf den mitgelieferten MinIO ($S3_ENDPOINT). Mit externem S3 ist kein Umzug nötig." ;;
esac

docker inspect lumio_minio >/dev/null 2>&1 \
  || die "Container lumio_minio läuft nicht. Bitte Lumio zuerst normal starten ('docker compose up -d')."
[ "$(docker inspect -f '{{.State.Running}}' lumio_minio)" = "true" ] \
  || die "Container lumio_minio ist gestoppt. Bitte zuerst 'docker compose up -d minio'."

PROJECT="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' lumio_minio)"
NETWORK="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' lumio_minio | awk '{print $1}')"
CONFIG_FILES="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.config_files"}}' lumio_minio)"
VOLUME="${PROJECT}_rustfs_data"

# Images aus den Compose-Dateien lesen, damit Skript und Compose immer
# dieselben Versionen nutzen.
RUSTFS_IMAGE="$(grep -E '^\s*image:\s*ghcr.io/rustfs/rustfs' docker-compose.rustfs.yml | head -1 | awk '{print $2}')"
MC_IMAGE="$(grep -E '^\s*image:\s*ghcr.io/markusthiel/lumio-mc' docker-compose.yml | head -1 | awk '{print $2}')"
[ -n "$RUSTFS_IMAGE" ] && [ -n "$MC_IMAGE" ] || die "Images in den Compose-Dateien nicht gefunden."

if docker volume inspect "$VOLUME" >/dev/null 2>&1; then
  die "Volume $VOLUME existiert schon (abgebrochener Versuch?). Prüfen und ggf. mit 'docker volume rm $VOLUME' entfernen, dann erneut starten."
fi

# Mit eigenen -f-Dateien gestartet? Dann am Ende nicht selbst starten, sondern
# den passenden Befehl anzeigen.
CUSTOM_FILES=false
case "$CONFIG_FILES" in
  *,*) CUSTOM_FILES=true ;;
esac

say "Umzug MinIO → RustFS / Moving MinIO → RustFS"
cat <<EOF
  Compose-Projekt:   $PROJECT
  Bucket:            $S3_BUCKET
  Neues Volume:      $VOLUME
  RustFS-Image:      $RUSTFS_IMAGE

  Lumio ist während der Kopie nicht erreichbar (API, Worker, Frontend werden
  gestoppt). Die MinIO-Daten bleiben unverändert erhalten.
  Lumio is offline while copying. Your MinIO data stays untouched.
EOF
if ! $ASSUME_YES; then
  printf '\nFortfahren? / Continue? [y/N] '
  read -r answer
  case "$answer" in y|Y|j|J|yes|ja) ;; *) echo "Abgebrochen. Nothing changed."; exit 0 ;; esac
fi

DONE=false
cleanup() {
  docker rm -f lumio_rustfs_migration >/dev/null 2>&1 || true
  # Abgebrochen: das neue, unfertige Volume wieder entfernen, damit ein
  # zweiter Versuch sauber startet. MinIO-Daten sind davon nicht betroffen.
  $DONE || docker volume rm "$VOLUME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

say "1/5  Lumio anhalten (API, Worker, Frontend)"
docker compose -p "$PROJECT" stop api worker frontend >/dev/null 2>&1 || true

say "2/5  RustFS vorübergehend starten"
docker volume create \
  --label "com.docker.compose.project=$PROJECT" \
  --label "com.docker.compose.volume=rustfs_data" \
  "$VOLUME" >/dev/null
docker run -d --name lumio_rustfs_migration --network "$NETWORK" --network-alias rustfs-migration \
  --user 10001:10001 -v "$VOLUME:/data" \
  -e RUSTFS_ACCESS_KEY="$S3_ACCESS_KEY" -e RUSTFS_SECRET_KEY="$S3_SECRET_KEY" \
  -e RUSTFS_VOLUMES=/data \
  "$RUSTFS_IMAGE" >/dev/null
for i in $(seq 1 60); do
  docker exec lumio_rustfs_migration curl -fsS http://localhost:9000/health >/dev/null 2>&1 && break
  [ "$i" = 60 ] && die "RustFS ist nicht gestartet. Log: docker logs lumio_rustfs_migration"
  sleep 2
done

say "3/5  Dateien kopieren (kann bei vielen Daten dauern)"
docker run --rm --network "$NETWORK" --entrypoint sh \
  -e AK="$S3_ACCESS_KEY" -e SK="$S3_SECRET_KEY" -e B="$S3_BUCKET" \
  "$MC_IMAGE" -c '
    set -e
    mc alias set src http://minio:9000 "$AK" "$SK" >/dev/null
    mc alias set dst http://rustfs-migration:9000 "$AK" "$SK" >/dev/null
    mc mb --ignore-existing "dst/$B" >/dev/null
    mc mirror --overwrite --preserve "src/$B" "dst/$B"
    count() { mc ls --recursive --summarize "$1" | awk "/Total Objects:/ {o=\$3} /Total Size:/ {s=\$3\" \"\$4} END {print o\" objects, \"s}"; }
    SRC="$(count "src/$B")"; DST="$(count "dst/$B")"
    echo "  MinIO:  $SRC"
    echo "  RustFS: $DST"
    [ "$SRC" = "$DST" ] || { echo "Anzahl/Größe weichen ab — Umzug abgebrochen, nichts umgestellt."; exit 1; }
  ' || die "Kopie unvollständig. Lumio läuft wieder mit MinIO: 'docker compose up -d'."

docker rm -f lumio_rustfs_migration >/dev/null
DONE=true

say "4/5  .env umstellen"
BACKUP=".env.bak-$(date +%Y%m%d-%H%M%S)"
cp .env "$BACKUP"
{
  printf '\n# Speicher: RustFS (umgezogen am %s, Sicherung: %s)\n' "$(date +%F)" "$BACKUP"
  grep -q '^COMPOSE_PATH_SEPARATOR=' .env || printf 'COMPOSE_PATH_SEPARATOR=:\n'
  printf 'COMPOSE_FILE=docker-compose.yml:docker-compose.rustfs.yml\n'
} >> .env
echo "  Sicherung: $BACKUP"

say "5/5  Lumio mit RustFS starten"
if $CUSTOM_FILES; then
  FILES_ARGS=""
  IFS=',' read -ra F <<< "$CONFIG_FILES"
  for f in "${F[@]}"; do
    base="$(basename "$f")"
    FILES_ARGS="$FILES_ARGS -f $base"
    [ "$base" = "docker-compose.yml" ] && FILES_ARGS="$FILES_ARGS -f docker-compose.rustfs.yml"
  done
  cat <<EOF

  Du startest Lumio mit eigenen Compose-Dateien. Bitte jetzt mit deinem
  gewohnten Befehl starten und dabei docker-compose.rustfs.yml ergänzen, z.B.:
  You start Lumio with your own Compose files. Start it now with your usual
  command, adding docker-compose.rustfs.yml, e.g.:

      docker compose$FILES_ARGS up -d

  Künftig immer mit "-f docker-compose.rustfs.yml" direkt nach
  "-f docker-compose.yml" starten. Ohne startet MinIO absichtlich nicht.
EOF
else
  docker compose up -d
  say "Fertig / Done."
  cat <<EOF
  Lumio läuft jetzt mit RustFS. Bitte kurz prüfen: eine Galerie öffnen,
  ein Bild hochladen.
  Lumio now runs on RustFS. Please check: open a gallery, upload an image.

  Die alten MinIO-Daten liegen weiter im Volume ${PROJECT}_minio_data.
  Zurück zu MinIO: COMPOSE_FILE-Zeile aus .env entfernen, 'docker compose up -d'.
  Wenn alles passt, kann das alte Volume später gelöscht werden:
      docker volume rm ${PROJECT}_minio_data
EOF
fi
