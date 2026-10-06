"use client";

/**
 * The design of a landing page in the studio (issue #65): the same header as
 * a gallery (layout, header image, logo, overlay, fonts, colours, footer)
 * plus what only a page has (how the galleries are shown, a header button).
 *
 * Like the gallery's design editor, every field saves on its own as soon as
 * it changes; text fields are debounced. The building blocks come from
 * GalleryHeaderEditor so both editors look and behave the same.
 *
 * A header image from a gallery can only come from a gallery that is on this
 * page, shown there and without a password. The API enforces that, this
 * editor only offers those photos.
 */
import { useEffect, useRef, useState } from "react";
import {
  api,
  type LandingPageDesign as Design,
  type PageGalleryLayout,
  type PageHeroCandidates,
  type StudioLandingPage,
} from "@/lib/api";
import {
  Field,
  FileInputButton,
  FontSelect,
  HeroLayoutPicker,
  MarkdownField,
  RgbPicker,
  RgbaPicker,
} from "@/components/studio/GalleryHeaderEditor";
import { BlurLevelPicker } from "@/components/studio/BlurLevelPicker";
import { useErrorText } from "@/lib/error-i18n";
import { useT } from "@/lib/i18n";

interface Props {
  page: StudioLandingPage;
  /** Reload the page from the server after a save. */
  onSaved: () => Promise<void>;
}

export function LandingPageDesign({ page, onSaved }: Props) {
  const t = useT();
  const errText = useErrorText();
  const d = page.design;
  const preview = page.designPreview;
  const [error, setError] = useState<string | null>(null);

  async function patch(p: Partial<Design>) {
    setError(null);
    try {
      await api.updatePage(page.id, p);
      await onSaved();
    } catch (err) {
      setError(errText(err, t("pages.saveFailed")));
    }
  }

  async function upload(kind: "logo" | "hero", file: File) {
    setError(null);
    try {
      const { storageKey } = await api.uploadPageAsset(page.id, kind, file);
      await patch(kind === "logo" ? { eventLogoUrl: storageKey } : { heroUrl: storageKey });
    } catch (err) {
      setError(errText(err, t("pages.saveFailed")));
    }
  }

  const hasHero = !!(d.heroUrl || d.heroFileId);
  const logoHeight =
    d.eventLogoSize === "large" ? "h-16" : d.eventLogoSize === "small" ? "h-8" : "h-12";

  return (
    <section className="rounded-lg border border-line-subtle bg-surface-raised p-4 space-y-6">
      <div>
        <h2 className="text-sm font-medium">{t("pages.design.heading")}</h2>
        <p className="text-xs text-ink-tertiary mt-0.5">{t("pages.design.hint")}</p>
      </div>

      {error && <p className="text-sm text-semantic-danger">{error}</p>}

      {/* Header layout */}
      <Field label={t("studio.heroLayout")} hint={t("pages.design.layoutHint")}>
        <HeroLayoutPicker value={d.heroLayout} onChange={(v) => patch({ heroLayout: v })} />
      </Field>

      {/* Header image */}
      <Field label={t("pages.design.heroImage")} hint={t("pages.design.heroImageHint")}>
        <div className="space-y-3">
          {preview?.heroPreviewUrl && (
            <div className="relative w-full aspect-[3/1] rounded overflow-hidden bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.heroPreviewUrl} alt="" className="w-full h-full object-cover" />
              {(d.heroOverlayColor || d.heroOverlayBlur) && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundColor: d.heroOverlayColor ?? undefined,
                    backdropFilter: d.heroOverlayBlur ? `blur(${d.heroOverlayBlur}px)` : undefined,
                    WebkitBackdropFilter: d.heroOverlayBlur
                      ? `blur(${d.heroOverlayBlur}px)`
                      : undefined,
                  }}
                />
              )}
            </div>
          )}
          {preview?.heroFileProblem && (
            <div className="rounded-md bg-semantic-warning/10 border border-semantic-warning/30 px-3 py-2 text-xs text-ink-secondary leading-relaxed">
              {t(
                preview.heroFileProblem === "gallery_protected"
                  ? "pages.design.heroProblemProtected"
                  : "pages.design.heroProblemHidden"
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 items-center">
            <FileInputButton
              accept="image/*"
              label={t("studio.heroUpload")}
              onChange={(file) => upload("hero", file)}
            />
            <HeroFromPageGalleries
              pageId={page.id}
              currentFileId={d.heroFileId}
              onChoose={(fileId) => patch({ heroFileId: fileId })}
            />
            {hasHero && (
              <button
                type="button"
                onClick={() => patch({ heroFileId: null, heroUrl: null })}
                className="text-ui-sm text-semantic-danger hover:underline"
              >
                {t("studio.removeHero")}
              </button>
            )}
          </div>
        </div>
      </Field>

      {hasHero ? (
        <>
          <Field label={t("studio.heroOverlay")} hint={t("studio.heroOverlayHint")}>
            <RgbaPicker
              value={d.heroOverlayColor}
              onChange={(v) => patch({ heroOverlayColor: v })}
            />
          </Field>
          <Field label={t("studio.heroBlur")} hint={t("studio.heroBlurHint")}>
            <BlurLevelPicker
              value={d.heroOverlayBlur ?? 0}
              onChange={(px) => void patch({ heroOverlayBlur: px || null })}
            />
          </Field>
        </>
      ) : (
        <Field label={t("studio.heroBackground")} hint={t("studio.heroBackgroundHint")}>
          <RgbPicker
            value={d.heroBackgroundColor}
            onChange={(v) => patch({ heroBackgroundColor: v })}
          />
        </Field>
      )}

      {/* Logo */}
      <Field label={t("pages.design.logo")} hint={t("pages.design.logoHint")}>
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            {preview?.logoPreviewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.logoPreviewUrl}
                alt=""
                className={`${logoHeight} w-auto max-w-[160px] object-contain bg-surface-sunken rounded p-1`}
              />
            )}
            <FileInputButton
              accept="image/*"
              label={d.eventLogoUrl ? t("studio.replace") : t("studio.uploadLogo")}
              onChange={(file) => upload("logo", file)}
            />
            {d.eventLogoUrl && (
              <button
                type="button"
                onClick={() => patch({ eventLogoUrl: null })}
                className="text-ui-sm text-semantic-danger hover:underline"
              >
                {t("studio.remove")}
              </button>
            )}
          </div>
          {d.eventLogoUrl && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-ui-xs text-ink-tertiary">{t("studio.logoSize")}:</span>
              {(["small", "medium", "large"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => patch({ eventLogoSize: s })}
                  aria-pressed={d.eventLogoSize === s}
                  className={`text-ui-xs px-2.5 h-7 rounded border transition-colors duration-motion ${
                    d.eventLogoSize === s
                      ? "bg-accent border-accent text-accent-contrast"
                      : "border-line-strong text-ink-secondary hover:bg-surface-sunken"
                  }`}
                >
                  {t(`studio.logoSize_${s}` as const)}
                </button>
              ))}
            </div>
          )}
        </div>
      </Field>

      {/* Header button */}
      <CtaFields page={page} onSave={patch} />

      {/* How the galleries are shown */}
      <Field label={t("pages.design.galleryLayout")} hint={t("pages.design.galleryLayoutHint")}>
        <div className="space-y-3">
          <GalleryLayoutPicker
            value={d.galleryLayout}
            onChange={(v) => patch({ galleryLayout: v })}
          />
          <div className="space-y-2">
            <Toggle
              checked={d.cardTitleOnImage}
              onChange={(v) => patch({ cardTitleOnImage: v })}
              label={t("pages.design.titleOnImage")}
            />
            <Toggle
              checked={d.cardShowDate}
              onChange={(v) => patch({ cardShowDate: v })}
              label={t("pages.design.showDate")}
            />
            <Toggle
              checked={d.cardShowCount}
              onChange={(v) => patch({ cardShowCount: v })}
              label={t("pages.design.showCount")}
            />
          </div>
        </div>
      </Field>

      {/* Footer */}
      <MarkdownField
        label={t("studio.footerMarkdown")}
        hint={t("pages.design.footerHint")}
        placeholder={t("studio.footerMarkdownPlaceholder")}
        emptyPreviewHint={t("studio.welcomeMarkdownEmpty")}
        value={d.footerMarkdown}
        onSave={(v) => patch({ footerMarkdown: v })}
      />

      {/* Fonts */}
      <div className="rounded border border-line-subtle bg-surface-sunken/40 p-4 space-y-3">
        <div>
          <h3 className="text-ui-sm font-medium text-ink-secondary">{t("pages.design.fonts")}</h3>
          <p className="text-ui-xs text-ink-tertiary mt-0.5">{t("pages.design.fontsHint")}</p>
        </div>
        <Field label={t("studio.fontHeading")}>
          <FontSelect value={d.fontHeading} onChange={(v) => patch({ fontHeading: v })} />
        </Field>
        <Field label={t("studio.fontBody")}>
          <FontSelect value={d.fontBody} onChange={(v) => patch({ fontBody: v })} />
        </Field>
      </div>

      {/* Colours */}
      <div className="rounded border border-line-subtle bg-surface-sunken/40 p-4 space-y-3">
        <div>
          <h3 className="text-ui-sm font-medium text-ink-secondary">{t("pages.design.colors")}</h3>
          <p className="text-ui-xs text-ink-tertiary mt-0.5">{t("pages.design.colorsHint")}</p>
        </div>
        <Field label={t("studio.colorBackground")}>
          <RgbPicker value={d.colorBackground} onChange={(v) => patch({ colorBackground: v })} />
        </Field>
        <Field label={t("studio.colorAccent")}>
          <RgbPicker value={d.colorAccent} onChange={(v) => patch({ colorAccent: v })} />
        </Field>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Header button: label + link, saved together on blur
// ---------------------------------------------------------------------------
function CtaFields({
  page,
  onSave,
}: {
  page: StudioLandingPage;
  onSave: (p: Partial<Design>) => Promise<void>;
}) {
  const t = useT();
  const [label, setLabel] = useState(page.design.ctaLabel ?? "");
  const [url, setUrl] = useState(page.design.ctaUrl ?? "");
  useEffect(() => setLabel(page.design.ctaLabel ?? ""), [page.design.ctaLabel]);
  useEffect(() => setUrl(page.design.ctaUrl ?? ""), [page.design.ctaUrl]);

  const urlOk = url.trim() === "" || isAllowedLink(url.trim());
  const dirty =
    label.trim() !== (page.design.ctaLabel ?? "") || url.trim() !== (page.design.ctaUrl ?? "");

  function save() {
    if (!dirty || !urlOk) return;
    void onSave({ ctaLabel: label.trim() || null, ctaUrl: url.trim() || null });
  }

  const input =
    "w-full rounded-md border border-line-subtle bg-surface-base px-3 py-2 text-sm";
  return (
    <Field label={t("pages.design.cta")} hint={t("pages.design.ctaHint")}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={save}
          maxLength={60}
          placeholder={t("pages.design.ctaLabelPlaceholder")}
          aria-label={t("pages.design.ctaLabel")}
          className={input}
        />
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={save}
          maxLength={500}
          placeholder="https://… · mailto:… · tel:…"
          aria-label={t("pages.design.ctaUrl")}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={input}
        />
      </div>
      {!urlOk && <p className="mt-1 text-xs text-semantic-danger">{t("pages.design.ctaUrlInvalid")}</p>}
      {urlOk && label.trim() !== "" && url.trim() === "" && (
        <p className="mt-1 text-xs text-ink-tertiary">{t("pages.design.ctaNeedsBoth")}</p>
      )}
    </Field>
  );
}

/** Mirrors the API rule: http(s), mailto: or tel:. */
function isAllowedLink(u: string): boolean {
  if (/^mailto:[^\s]+$/i.test(u) || /^tel:[+0-9 ()/-]+$/i.test(u)) return true;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Header image from a gallery on this page
// ---------------------------------------------------------------------------
function HeroFromPageGalleries({
  pageId,
  currentFileId,
  onChoose,
}: {
  pageId: string;
  currentFileId: string | null;
  onChoose: (fileId: string) => Promise<void>;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PageHeroCandidates | null>(null);
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setFailed(false);
    api
      .getPageHeroCandidates(pageId)
      .then((r) => alive && setData(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [open, pageId]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const usable = data?.galleries.filter((g) => g.usable && g.files.length > 0) ?? [];
  const protectedCount = data?.galleries.filter((g) => g.protected).length ?? 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        className="h-8 px-3 rounded border border-line-strong text-ui-sm text-ink-secondary hover:text-ink-primary hover:bg-surface-overlay transition-colors duration-motion"
      >
        {t("pages.design.heroFromGalleries")}
      </button>
      {open && (
        <div className="absolute z-10 mt-1 left-0 w-80 max-w-[18rem] max-h-96 overflow-y-auto rounded-md border border-line-strong bg-surface-raised shadow-elev-3 p-2 space-y-3">
          {!data && !failed && (
            <p className="text-ui-xs text-ink-tertiary p-2">{t("common.loading")}</p>
          )}
          {failed && (
            <p className="text-ui-xs text-semantic-danger p-2">{t("pages.loadFailed")}</p>
          )}
          {data && usable.length === 0 && (
            <p className="text-ui-xs text-ink-tertiary p-2 leading-relaxed">
              {t("pages.design.heroNoCandidates")}
            </p>
          )}
          {usable.map((g) => (
            <div key={g.galleryId} className="space-y-1.5">
              <div className="text-ui-xs font-medium text-ink-secondary px-0.5 truncate">
                {g.title}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {g.files.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    title={f.filename}
                    onClick={async () => {
                      await onChoose(f.id);
                      setOpen(false);
                    }}
                    className={`relative rounded overflow-hidden hover:ring-2 hover:ring-accent transition-shadow duration-motion ${
                      f.id === currentFileId ? "ring-2 ring-accent" : ""
                    }`}
                  >
                    <div className="aspect-square w-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={f.thumbUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
          {data && protectedCount > 0 && (
            <p className="text-ui-xs text-ink-tertiary px-0.5 leading-relaxed">
              {t("pages.design.heroProtectedSkipped")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gallery display: grid, editorial, bands
// ---------------------------------------------------------------------------
function GalleryLayoutPicker({
  value,
  onChange,
}: {
  value: PageGalleryLayout;
  onChange: (v: PageGalleryLayout) => void;
}) {
  const t = useT();
  const block = "rounded-sm bg-ink-primary/25";
  const options: { id: PageGalleryLayout; label: string; sketch: React.ReactNode }[] = [
    {
      id: "grid",
      label: t("pages.design.layoutGrid"),
      sketch: (
        <div className="w-full h-full p-1.5 flex flex-col gap-1">
          <div className="flex gap-1 flex-1">
            <div className={`${block} flex-[3]`} />
            <div className={`${block} flex-[2]`} />
            <div className={`${block} flex-[3]`} />
          </div>
          <div className="flex gap-1 flex-1">
            <div className={`${block} flex-[2]`} />
            <div className={`${block} flex-[4]`} />
          </div>
        </div>
      ),
    },
    {
      id: "editorial",
      label: t("pages.design.layoutEditorial"),
      sketch: (
        <div className="w-full h-full p-1.5 flex flex-col gap-1">
          <div className={`${block} flex-[3]`} />
          <div className="flex gap-1 flex-[2]">
            <div className={`${block} flex-1`} />
            <div className={`${block} flex-1`} />
            <div className={`${block} flex-1`} />
          </div>
        </div>
      ),
    },
    {
      id: "bands",
      label: t("pages.design.layoutBands"),
      sketch: (
        <div className="w-full h-full py-1.5 flex flex-col gap-1">
          <div className="flex-1 bg-ink-primary/25" />
          <div className="flex-1 bg-ink-primary/25" />
          <div className="flex-1 bg-ink-primary/25" />
        </div>
      ),
    },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`rounded border p-2 text-left transition-colors duration-motion ${
              active
                ? "border-accent bg-accent/10"
                : "border-line-subtle bg-surface-sunken hover:border-line-strong"
            }`}
          >
            <div className="aspect-[4/3] w-full rounded-sm bg-surface-overlay/40 overflow-hidden">
              {opt.sketch}
            </div>
            <div className="mt-2 text-ui-xs font-medium text-ink-primary">{opt.label}</div>
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
