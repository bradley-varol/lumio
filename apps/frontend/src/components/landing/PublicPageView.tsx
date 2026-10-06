"use client";

/**
 * A landing page as a visitor sees it: /p/<slug>, and the studio's start page
 * on "/".
 *
 * Themed by the same GalleryShell as the client galleries, so the studio's
 * delivered content keeps one look. A page LISTS galleries: a card links to
 * /g/<slug> and that gallery decides for itself who may open it (password,
 * expiry, ...). What a card shows is decided by the API; this component only
 * draws what it is given.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import {
  api,
  ApiError,
  type PublicGalleryMeta,
  type PublicLandingPage,
  type PublicPageCard,
} from "@/lib/api";
import { GalleryShell } from "@/components/gallery/GalleryShell";
import { GalleryHero } from "@/components/gallery/GalleryHero";
import { useFormat, useT } from "@/lib/i18n";

/** Height of a card's picture. Width follows the aspect ratio, like the
 *  justified grid inside a gallery. */
const ROW_HEIGHT = 240;
/** Aspect ratio of a card without a picture. */
const PLACEHOLDER_RATIO = 3 / 2;

interface Props {
  slug: string;
  /** Data already fetched on the server (the start page). Without it the
   *  component fetches on mount. */
  initial?: PublicLandingPage | null;
}

export function PublicPageView({ slug, initial }: Props) {
  const t = useT();
  const [data, setData] = useState<PublicLandingPage | null>(initial ?? null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "unavailable">(
    initial ? "ready" : "loading"
  );

  const load = useCallback(async () => {
    try {
      setData(await api.getPublicPage(slug));
      setStatus("ready");
    } catch (err) {
      setStatus(err instanceof ApiError && err.status === 503 ? "unavailable" : "notfound");
    }
  }, [slug]);

  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  if (status !== "ready" || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-canvas px-6">
        <div className="text-ui text-ink-tertiary text-center">
          {status === "loading"
            ? t("common.loading")
            : status === "unavailable"
              ? t("publicPage.unavailable")
              : t("publicPage.notFound")}
        </div>
      </div>
    );
  }

  const { page, galleries } = data;
  // The API always sends a header once the page is unlocked. The fallback only
  // covers a page served by an older API during a rolling deploy.
  const header = page.header ?? (page.locked ? null : defaultHeader(page.introMarkdown));

  return (
    <GalleryShell
      branding={page.branding}
      faviconUrl={page.faviconUrl}
      overrides={{
        colorBackground: page.colors?.background ?? null,
        colorAccent: page.colors?.accent ?? null,
        footerMarkdown: page.footerMarkdown ?? null,
        fontHeading: page.fonts?.heading ?? null,
        fontBody: page.fonts?.body ?? null,
        // The page logo sits in the header: no second logo strip above it.
        hideHeaderLogo: !!header?.eventLogoUrl,
      }}
      footerExtra={
        page.isDefault ? (
          <Link href="/login" className="hover:underline shrink-0">
            {t("publicPage.studioLogin")}
          </Link>
        ) : null
      }
    >
      {page.locked ? (
        header ? (
          // The studio chose to show header image, logo and title before
          // unlocking: the password field sits where the button would.
          <GalleryHero meta={{ title: page.title, header, demoteWelcomeHeadings: true }}>
            <UnlockForm slug={slug} onUnlocked={load} />
          </GalleryHero>
        ) : (
          <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
            <UnlockForm slug={slug} onUnlocked={load} />
          </div>
        )
      ) : (
        <>
          {header && (
            <GalleryHero meta={{ title: page.title, header, demoteWelcomeHeadings: true }}>
              {page.cta && <CtaButton cta={page.cta} />}
            </GalleryHero>
          )}
          {galleries.length === 0 ? (
            <p
              className="text-center text-ui py-16 px-4"
              style={{ color: "var(--brand-fg-subtle)" }}
            >
              {t("publicPage.empty")}
            </p>
          ) : (
            <GalleryList
              cards={galleries}
              display={page.display ?? DEFAULT_DISPLAY}
            />
          )}
        </>
      )}
    </GalleryShell>
  );
}

const DEFAULT_DISPLAY: PublicLandingPage["page"]["display"] = {
  layout: "grid",
  titleOnImage: false,
  showDate: true,
  showCount: true,
};

function defaultHeader(intro: string | null): PublicGalleryMeta["header"] {
  return {
    layout: "minimal",
    heroImageUrl: null,
    overlayColor: null,
    overlayBlur: null,
    backgroundColor: null,
    eventLogoUrl: null,
    eventLogoSize: "medium",
    welcomeMarkdown: intro,
  };
}

// ---------------------------------------------------------------------------
// Header button
// ---------------------------------------------------------------------------
function CtaButton({ cta }: { cta: { label: string; url: string } }) {
  const external = /^https?:\/\//i.test(cta.url);
  return (
    <div className="mt-8">
      <a
        href={cta.url}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-brand-accent text-brand-accent-contrast text-ui font-medium hover:opacity-90 transition-opacity duration-motion"
        style={{ textShadow: "none" }}
      >
        {cta.label}
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The galleries: grid, editorial or bands
// ---------------------------------------------------------------------------
type Display = PublicLandingPage["page"]["display"];

function GalleryList({ cards, display }: { cards: PublicPageCard[]; display: Display }) {
  if (display.layout === "bands") {
    // Full width, one gallery per band.
    return (
      <div className="pt-10 sm:pt-14 pb-6 flex flex-col gap-4 sm:gap-6">
        {cards.map((card) => (
          <Card key={card.slug} card={card} display={display} variant="band" />
        ))}
      </div>
    );
  }
  if (display.layout === "editorial") {
    // The first gallery large across the full width, the others in columns.
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-10 sm:pt-14 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-9">
        {cards.map((card, i) => (
          <Card
            key={card.slug}
            card={card}
            display={display}
            variant={i === 0 ? "lead" : "column"}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 pt-10 sm:pt-14 pb-6 flex flex-wrap gap-x-3 gap-y-8">
      {cards.map((card) => (
        <Card key={card.slug} card={card} display={display} variant="row" />
      ))}
      {/* Keeps the last row from stretching across the full width: it
          takes almost all of the free space there. */}
      <i className="block" style={{ flexGrow: 10000 }} aria-hidden="true" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// A gallery card
// ---------------------------------------------------------------------------
type CardVariant = "row" | "lead" | "column" | "band";

function Card({
  card,
  display,
  variant,
}: {
  card: PublicPageCard;
  display: Display;
  variant: CardVariant;
}) {
  const t = useT();
  const fmt = useFormat();

  const meta = [
    display.showDate ? fmt.date(card.createdAt) : null,
    display.showCount && card.fileCount !== null
      ? t(card.fileCount === 1 ? "pages.filesSg" : "pages.filesPl", {
          count: card.fileCount,
        })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Picture size per variant. "row" is the justified grid: fixed height,
  // width from the aspect ratio, clamped so that a panorama or a very tall
  // picture does not make a row absurdly wide or narrow.
  const raw =
    card.cover?.width && card.cover?.height
      ? card.cover.width / card.cover.height
      : PLACEHOLDER_RATIO;
  const ratio = Math.min(2.4, Math.max(0.6, raw));
  const linkStyle: React.CSSProperties | undefined =
    variant === "row"
      ? // flex-grow is scaled up: with the sum of the grow factors of a row
        // below 1, the browser hands out only that fraction of the free
        // space, so a lone portrait card would not fill its row on a narrow
        // screen.
        { flexBasis: `${ROW_HEIGHT * ratio}px`, flexGrow: ratio * 100 }
      : undefined;
  const boxClass =
    variant === "lead"
      ? "aspect-[4/3] sm:aspect-[21/9] rounded"
      : variant === "column"
        ? "aspect-[4/5] rounded"
        : variant === "band"
          ? "aspect-[16/10] sm:aspect-[21/8]"
          : "rounded";
  const titleSize =
    variant === "band"
      ? "text-display sm:text-display-lg"
      : variant === "lead"
        ? "text-display-sm sm:text-display"
        : "text-ui-lg";
  const capPad = variant === "band" ? "px-4 sm:px-6 md:px-12" : "";
  const over = display.titleOnImage;

  const title = (
    <div
      className={`${titleSize} font-medium leading-tight ${over ? "" : "truncate"}`}
      style={{ fontFamily: "var(--gallery-font-heading)" }}
    >
      {card.title}
      {card.protected && (
        <span className="sr-only"> ({t("publicPage.protectedLabel")})</span>
      )}
    </div>
  );

  return (
    <Link
      href={`/g/${card.slug}`}
      prefetch={false}
      className={`group block min-w-0 ${variant === "lead" ? "sm:col-span-2 lg:col-span-3" : ""}`}
      style={linkStyle}
    >
      <div
        className={`relative overflow-hidden ${boxClass}`}
        style={{
          ...(variant === "row" ? { height: ROW_HEIGHT } : {}),
          background: "var(--brand-surface)",
        }}
      >
        {card.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.cover.url}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : card.protected ? (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ color: "var(--brand-fg-subtle)" }}
          >
            <LockIcon className="w-10 h-10" />
          </div>
        ) : null}
        {card.protected && card.cover && (
          <span
            className="absolute top-2 right-2 rounded-full p-1.5 bg-black/55 text-white"
            title={t("publicPage.protectedLabel")}
          >
            <LockIcon className="w-3.5 h-3.5" />
          </span>
        )}
        {over && (
          <div
            className={`absolute inset-x-0 bottom-0 pt-14 pb-4 ${capPad || "px-4"} text-white space-y-0.5`}
            style={{ background: "linear-gradient(180deg, transparent, rgba(10,10,10,0.72))" }}
          >
            {title}
            {meta && <div className="text-ui-xs text-white/80">{meta}</div>}
          </div>
        )}
      </div>

      {!over && (
        <div className={`pt-2.5 space-y-0.5 ${capPad}`}>
          {title}
          {meta && (
            <div className="text-ui-xs" style={{ color: "var(--brand-fg-subtle)" }}>
              {meta}
            </div>
          )}
          {card.description && (
            <p
              className="text-ui-xs line-clamp-2 leading-relaxed"
              style={{ color: "var(--brand-fg-muted)" }}
            >
              {card.description}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="4" y="10.5" width="16" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Password page
// ---------------------------------------------------------------------------
function UnlockForm({
  slug,
  onUnlocked,
}: {
  slug: string;
  onUnlocked: () => Promise<void>;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.unlockPage(slug, password);
      await onUnlocked();
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === "invalid_password"
          ? t("gallery.passwordIncorrect")
          : t("gallery.requestFailed")
      );
    } finally {
      setPending(false);
    }
  }

  // Colours follow the surrounding text (currentColor), so the form reads on
  // a light or dark page and on top of a header image alike.
  const line = "color-mix(in srgb, currentColor 22%, transparent)";
  return (
    <div className="w-full max-w-md mt-8 animate-fade-in" style={{ textShadow: "none" }}>
      <form
        onSubmit={onSubmit}
        className="w-full space-y-5 rounded-md p-7 backdrop-blur text-left"
        style={{
          border: `1px solid ${line}`,
          background: "color-mix(in srgb, currentColor 5%, transparent)",
        }}
      >
        <div className="text-ui-sm opacity-75">{t("publicPage.locked")}</div>
        <div className="space-y-1.5">
          <label htmlFor="page-pw" className="text-ui-sm font-medium opacity-90 block">
            {t("gallery.password")}
          </label>
          <input
            id="page-pw"
            type="password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("gallery.passwordPlaceholder")}
            className="w-full rounded bg-transparent px-3 h-10 text-ui placeholder:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-accent transition-colors duration-motion"
            style={{ border: `1px solid ${line}`, color: "inherit" }}
          />
        </div>
        {error && (
          <div className="text-ui-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-sm px-3 py-2">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full h-10 bg-brand-accent text-brand-accent-contrast text-ui font-medium rounded hover:opacity-90 disabled:opacity-50 transition-opacity duration-motion"
        >
          {pending ? t("gallery.unlockChecking") : t("publicPage.open")}
        </button>
      </form>
    </div>
  );
}
