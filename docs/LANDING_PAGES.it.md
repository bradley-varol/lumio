[English](LANDING_PAGES.md) · [Deutsch](LANDING_PAGES.de.md) · **Italiano**

# Pagine

Una **pagina** è un elenco curato e ordinato di gallerie sotto un link tutto suo. Usala per un portfolio pubblico, oppure per un singolo cliente che deve trovare tutte le sue gallerie in un posto solo. Una galleria può stare in un numero qualsiasi di pagine.

Le pagine si gestiscono sotto **Pagine** nella navigazione dello studio. Solo proprietari e admin.

## In breve

- **Sei tu** a scegliere quali gallerie stanno in una pagina e in che ordine. Niente ci finisce da solo: né per tag, né per filtro.
- Una pagina **elenca** le gallerie, non le apre. Una scheda porta alla galleria, e la galleria applica le sue regole (password, scadenza, link di condivisione). Sbloccare una pagina con password non sblocca le gallerie al suo interno.
- Una nuova pagina è **solo con link**. Diventa pubblica solo quando la rendi pubblica.
- Una pagina pubblica può essere la **pagina iniziale** del tuo studio: viene mostrata su `/` invece del reindirizzamento all'accesso.

## Creare una pagina

1. **Pagine → Nuova pagina**, inserisci un titolo. La pagina è raggiungibile solo tramite il suo link e ai motori di ricerca viene detto di non indicizzarla.
2. **Aggiungi galleria** ci mette le gallerie. Trascina la maniglia (o usa la tastiera su di essa) per cambiare l'ordine. Le nuove gallerie vanno in fondo.
3. Sotto **Chi può aprire questa pagina** scegli l'accesso (sotto) e, se vuoi, rendila la tua pagina iniziale.
4. Copia il link sotto **URL della pagina** e invialo.

Da una galleria, **Condividi → Pagine → Aggiungi a una pagina** fa lo stesso in un passo, e *Nuova pagina* lì crea una pagina solo con link e ci mette subito la galleria.

## Chi può aprire una pagina

| Accesso | Chi può aprirla | Motori di ricerca | Può essere la pagina iniziale |
|---|---|---|---|
| **Pubblica** | Chiunque | Possono indicizzarla | Sì |
| **Solo con link** (predefinito) | Chi ha il link | Viene detto di non farlo (`noindex`) | No |
| **Password** | Chi ha il link e la password | Viene detto di non farlo (`noindex`) | No |

Finché una pagina con password non è sbloccata, introduzione, pulsante dell'intestazione e gallerie non vengono inviati al browser. Per impostazione predefinita i visitatori vedono solo il campo password. Con **Mostra l'intestazione prima dello sblocco** (in *Chi può aprire questa pagina*) immagine di intestazione, logo e titolo compaiono sopra di esso. La password è indipendente da quelle delle gallerie al suo interno.

## Cosa vedono i visitatori

Una scheda mostra la copertina, il titolo, la data di creazione, il numero di file, la descrizione e, per una galleria con password, un lucchetto. Come sono disposte le schede e cosa mostrano si imposta in **Aspetto** (vedi sotto).

**Quali gallerie vengono elencate.** Una galleria compare in una pagina solo finché è **attiva**, **non scaduta** e può essere **aperta senza link di condivisione** (accesso pubblico attivo). Altrimenti viene saltata, e nell'editor è indicato il motivo («Non visibile: bozza / archiviata / scaduta / richiede link di condivisione»). Il suo posto nella pagina viene conservato, quindi torna dov'era.

Le **gallerie con password** vengono elencate, con un lucchetto. Per impostazione predefinita mostrano solo **titolo e data**: niente copertina, niente descrizione, niente numero di foto. Attiva **Mostra l'anteprima pubblicamente** per una galleria in una pagina per rivelare queste tre cose. Le gallerie **senza** password mostrano sempre copertina, descrizione e numero di foto, perché il loro contenuto è comunque aperto.

Questo si decide quando la pagina viene caricata, non quando aggiungi la galleria: una galleria che riceve una password in seguito perde da sola la copertina nella pagina.

> **Prima di pubblicare:** la descrizione di una galleria diventa pubblica in una pagina. Se ci tieni note interne, lasciala vuota o usa *Titolo su questa pagina* per il nome.

### Le copertine restano private nello storage

Le copertine non sono collegate direttamente allo storage. Si caricano tramite `/api/v1/p/<pagina>/covers/<galleria>`, che verifica le regole di cui sopra a ogni richiesta e poi reindirizza a un link valido per cinque minuti. Disattivare un'anteprima ha quindi effetto entro pochi minuti, e il bucket resta privato come descritto in [STORAGE.it.md](STORAGE.it.md). Immagine di intestazione, logo e una foto di intestazione presa da una galleria si caricano allo stesso modo, tramite `/api/v1/p/<pagina>/assets/hero|logo`. Quando il link della pagina viene condiviso, l'immagine di anteprima è quella di intestazione; senza, la prima copertina.

## La pagina iniziale (`/`)

Rendi una pagina **pubblica** la tua pagina iniziale (*Chi può aprire questa pagina → Usa come mia pagina iniziale*) e viene mostrata all'indirizzo principale del tuo studio invece di reindirizzare all'accesso.

- Il tuo accesso resta su **`/login`**, e il piè di pagina della pagina iniziale ha un piccolo link *Accesso studio*. I segnalibri su `/login` continuano a funzionare.
- L'indirizzo `/p/<slug>` della pagina iniziale reindirizza a `/`.
- Uno studio ha al massimo una pagina iniziale. Impostarne un'altra la sostituisce.
- Se elimini la pagina iniziale, non la rendi più pubblica o rinunci al flag, `/` torna a reindirizzare all'accesso. Vale anche per uno studio che non ne ha mai impostata una: non cambia nulla finché non lo fai. Se l'API non è raggiungibile, anche `/` ripiega sull'accesso.
- Gli studi che condividono un'installazione hanno ciascuno la propria: la radice di `studio-a.example.com` mostra la pagina iniziale dello studio A e nulla dello studio B. Sul dominio apex di un'installazione multi-tenant `/` resta la scelta dello studio. Vedi [MULTI_TENANT.it.md](MULTI_TENANT.it.md).

## URL della pagina

Lo slug di una pagina è casuale per impostazione predefinita (`/p/k3m9x4tqzr7a`) e si può cambiare sotto **URL della pagina**. Valgono le regole degli slug delle gallerie: da 3 a 60 caratteri, lettere minuscole, cifre e trattini, nessuna parola riservata. È univoco per studio (su tutta l'installazione in una a studio singolo). Dopo una modifica il link precedente smette di funzionare, anche nei link già inviati.

## Aspetto

Una pagina può sembrare una landing page, non solo un elenco. La sezione **Aspetto** dell'editor ha le stesse opzioni di intestazione di una galleria, e ogni modifica viene salvata subito:

- **Layout dell'intestazione:** Minimal, Splash (schermo intero), Affiancato o Centrato. Titolo e introduzione (Markdown) vengono da *Dettagli*.
- **Immagine di intestazione:** caricane una tua o prendi una foto da una galleria di questa pagina. Solo le gallerie mostrate nella pagina e **senza password** possono fornire una foto. Viene verificato a ogni visita: se quella galleria in seguito riceve una password o lascia la pagina, la foto sparisce dall'intestazione e l'editor lo segnala.
- **Colore di sovrapposizione e sfocatura** sopra l'immagine, oppure un **colore di sfondo** senza immagine.
- **Logo** nell'intestazione, in tre dimensioni. Sostituisce la fascia del logo del branding in alto.
- **Pulsante nell'intestazione**, ad es. *Prenota un servizio*, con link a un sito, un'email (`mailto:`) o un numero di telefono (`tel:`). Appare solo quando la pagina è aperta.
- **Gallerie:** *Griglia* (righe justified, come prima), *Editoriale* (la prima galleria grande, le altre in colonne) o *Fasce* (una fascia a tutta larghezza per galleria); titolo sull'immagine o sotto; data e numero di foto attivabili.
- **Footer** (Markdown), **caratteri** e **colori** solo per questa pagina.

Senza queste impostazioni una pagina appare come prima. Il profilo di branding (logo, colori, carattere) si sceglie sempre in **Dettagli → Profilo di branding**; l'aspetto lo sovrascrive per questa pagina.

## Archiviare ed eliminare gallerie

- **Archiviare** una galleria che sta in delle pagine chiede prima conferma e le nomina. Lì viene nascosta e torna al suo posto quando la riattivi. Una galleria che non sta in nessuna pagina viene archiviata subito, come prima.
- **Eliminare** una galleria nomina le pagine da cui sparirà.
- **Eliminare una pagina** lascia intatte le sue gallerie.

## Limiti e cosa non c'è

- Al massimo **200 gallerie per pagina**, nessuna paginazione.
- Nessuna scadenza o pianificazione per le pagine, nessuna sitemap.
- Le pagine sono per proprietari e admin; un member non le vede, e un admin può aggiungere solo gallerie a cui ha accesso lui stesso.

## Per chi gestisce l'istanza

La funzione sta dietro il flag `landing_pages`, **attivo per impostazione predefinita**. Su un'istanza multi-tenant il gestore può disattivarlo per studio nell'interfaccia super admin, come per gli altri feature flag (vedi [SELFHOSTING.it.md](SELFHOSTING.it.md)); uno studio con il flag spento non ha la voce *Pagine*, e il suo `/` e `/p/*` si comportano come se le pagine non esistessero. Su un'istanza self-hosted a studio singolo non succede nulla finché non si crea una pagina.

Ogni modifica è registrata nel registro di audit: `page.create`, `page.update` (quali campi e la modalità di accesso; mai una password), `page.delete`, `page.set_default`, `page.unset_default`, `page.gallery_add`, `page.gallery_remove`, `page.gallery_update` (l'opt-in dell'anteprima), `page.unlock` e `page.unlock.failed`. Lo sblocco con password ha un limite di frequenza come quello di una galleria.

### API

Studio (con accesso come proprietario o admin):

| | |
|---|---|
| `GET/POST /pages` | elenco, creazione (`{title, galleryId?}`) |
| `GET/PATCH/DELETE /pages/:id` | pagina e sue gallerie; titolo, introduzione, slug, accesso, password, branding, pagina iniziale, aspetto |
| `POST /pages/:id/assets/presign` | URL di caricamento per immagine di intestazione o logo (`{kind, contentType, contentLength}`) |
| `GET /pages/:id/hero-candidates` | foto utilizzabili come immagine di intestazione |
| `POST /pages/:id/galleries` | mettere una galleria in una pagina (`{galleryId}`) |
| `PATCH/DELETE /pages/:id/galleries/:galleryId` | titolo su questa pagina, opt-in dell'anteprima; rimozione |
| `POST /pages/:id/galleries/reorder` | `{order: [galleryId, …]}` |
| `GET /galleries/:id/pages` | tutte le pagine e se contengono questa galleria |

Pubblico (senza accesso; lo studio viene dall'host della richiesta, come per `/g/:slug`): `GET /p` (pagina iniziale), `GET /p/:slug`, `POST /p/:slug/unlock`, `GET /p/:slug/covers/:gallerySlug`, `GET /p/:slug/assets/hero|logo`.
