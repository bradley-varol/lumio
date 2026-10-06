/**
 * Lumio API — design of a landing page (issue #65)
 *
 * A page has the same header options as a gallery (layout, header image, logo,
 * overlay, fonts, colours, footer) plus a few of its own (how the galleries are
 * shown, a header button, and whether a password page shows its header before
 * it is unlocked).
 *
 * The rules that matter for privacy live here, so the studio PATCH, the public
 * page and the asset endpoint cannot drift apart:
 *
 *   - A header image taken from a gallery is only allowed from a gallery that
 *     is on this page, rendered there, and has no password. Checked when it is
 *     chosen AND on every request: a gallery that gets a password later, or is
 *     taken off the page, stops lending its photo on its own.
 *   - Uploaded assets (header image, logo) must live under the page's own
 *     storage prefix. A key from another page, gallery or studio is refused.
 *   - The header button only links to http(s), mailto: or tel:.
 */
import { z } from "zod";

import { prisma } from "../db.js";
import { galleryIneligibleReason, isGalleryProtected } from "./landing-pages.js";

export const PAGE_HERO_LAYOUTS = ["minimal", "splash", "side_by_side", "centered"] as const;
export const PAGE_GALLERY_LAYOUTS = ["grid", "editorial", "bands"] as const;
export const PAGE_LOGO_SIZES = ["small", "medium", "large"] as const;

export const PAGE_CTA_LABEL_MAX_LENGTH = 60;
export const PAGE_CTA_URL_MAX_LENGTH = 500;
export const PAGE_FOOTER_MAX_LENGTH = 20_000;

const HEX_RGB = /^#[0-9a-fA-F]{6}$/;
const HEX_RGBA = /^#[0-9a-fA-F]{8}$/;

/** Links a header button may point to. No javascript:, data: and the like. */
export function isAllowedCtaUrl(url: string): boolean {
  const u = url.trim();
  if (/^mailto:[^\s]+$/i.test(u) || /^tel:[+0-9 ()/-]+$/i.test(u)) return true;
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** The design fields a studio PATCH may change. All optional, null resets. */
export const pageDesignSchema = z.object({
  heroLayout: z.enum(PAGE_HERO_LAYOUTS).optional(),
  heroFileId: z.string().uuid().nullable().optional(),
  heroUrl: z.string().max(500).nullable().optional(),
  heroOverlayColor: z.string().regex(HEX_RGBA, "must be #RRGGBBAA").nullable().optional(),
  heroOverlayBlur: z.number().int().min(0).max(40).nullable().optional(),
  heroBackgroundColor: z.string().regex(HEX_RGB, "must be #RRGGBB").nullable().optional(),
  eventLogoUrl: z.string().max(500).nullable().optional(),
  eventLogoSize: z.enum(PAGE_LOGO_SIZES).optional(),
  fontHeading: z.string().max(40).nullable().optional(),
  fontBody: z.string().max(40).nullable().optional(),
  colorBackground: z.string().regex(HEX_RGB, "must be #RRGGBB").nullable().optional(),
  colorAccent: z.string().regex(HEX_RGB, "must be #RRGGBB").nullable().optional(),
  footerMarkdown: z.string().max(PAGE_FOOTER_MAX_LENGTH).nullable().optional(),
  galleryLayout: z.enum(PAGE_GALLERY_LAYOUTS).optional(),
  cardTitleOnImage: z.boolean().optional(),
  cardShowDate: z.boolean().optional(),
  cardShowCount: z.boolean().optional(),
  ctaLabel: z.string().trim().max(PAGE_CTA_LABEL_MAX_LENGTH).nullable().optional(),
  ctaUrl: z
    .string()
    .trim()
    .max(PAGE_CTA_URL_MAX_LENGTH)
    .refine((v) => v === "" || isAllowedCtaUrl(v), "must be http(s), mailto: or tel:")
    .nullable()
    .optional(),
  showHeaderWhenLocked: z.boolean().optional(),
});

export type PageDesignInput = z.infer<typeof pageDesignSchema>;

/** Every design column, for Prisma selects. */
export const PAGE_DESIGN_SELECT = {
  heroLayout: true,
  heroFileId: true,
  heroUrl: true,
  heroOverlayColor: true,
  heroOverlayBlur: true,
  heroBackgroundColor: true,
  eventLogoUrl: true,
  eventLogoSize: true,
  fontHeading: true,
  fontBody: true,
  colorBackground: true,
  colorAccent: true,
  footerMarkdown: true,
  galleryLayout: true,
  cardTitleOnImage: true,
  cardShowDate: true,
  cardShowCount: true,
  ctaLabel: true,
  ctaUrl: true,
  showHeaderWhenLocked: true,
} as const;

/** Storage prefix of a page's uploaded assets. */
export function pageAssetPrefix(tenantId: string, pageId: string): string {
  return `t/${tenantId}/pages/${pageId}/assets/`;
}

/** Whether a storage key is one of this page's own uploads. */
export function isPageAssetKey(tenantId: string, pageId: string, key: string): boolean {
  const prefix = pageAssetPrefix(tenantId, pageId);
  return key.startsWith(prefix) && !key.includes("..") && key.length > prefix.length;
}

/**
 * Normalises the design part of a PATCH into Prisma data. Empty strings mean
 * "reset". Header image upload and gallery photo exclude each other: setting
 * one clears the other.
 */
export function pageDesignData(body: PageDesignInput): Record<string, unknown> {
  const blankToNull = (v: string | null | undefined) =>
    v === undefined ? undefined : v && v.trim() ? v : null;
  const data: Record<string, unknown> = {};
  // Only the design keys: the caller may pass its whole PATCH body.
  for (const k of Object.keys(pageDesignSchema.shape) as (keyof PageDesignInput)[]) {
    const v = body[k];
    if (v === undefined) continue;
    data[k] = typeof v === "string" ? blankToNull(v) : v;
  }
  if (body.heroFileId) data.heroUrl = null;
  else if (body.heroUrl) data.heroFileId = null;
  return data;
}

export type HeroFileProblem = "not_found" | "not_on_page" | "gallery_hidden" | "gallery_protected";

/**
 * Checks that a file may serve as the header image of a page, and returns the
 * storage key of its web rendition. Used when the studio picks it and on every
 * public request.
 */
export async function resolvePageHeroFile(page: {
  id: string;
  tenantId: string;
  heroFileId: string | null;
}): Promise<
  | { ok: true; storageKey: string; width: number | null; height: number | null }
  | { ok: false; problem: HeroFileProblem }
> {
  if (!page.heroFileId) return { ok: false, problem: "not_found" };
  const file = await prisma.file.findFirst({
    where: {
      id: page.heroFileId,
      status: "ready",
      publicVisibility: "visible",
      kind: "image",
      gallery: { tenantId: page.tenantId },
    },
    select: {
      gallery: {
        select: {
          status: true,
          expiresAt: true,
          publicAccess: true,
          passwordHash: true,
          landingPages: { where: { landingPageId: page.id }, select: { landingPageId: true } },
        },
      },
      renditions: {
        where: { kind: { in: ["web_jpeg", "web"] } },
        select: { kind: true, storageKey: true, width: true, height: true },
      },
    },
  });
  if (!file || file.renditions.length === 0) return { ok: false, problem: "not_found" };
  const g = file.gallery;
  if (g.landingPages.length === 0) return { ok: false, problem: "not_on_page" };
  if (galleryIneligibleReason(g) !== null) return { ok: false, problem: "gallery_hidden" };
  if (isGalleryProtected(g)) return { ok: false, problem: "gallery_protected" };
  const r = file.renditions.find((x) => x.kind === "web_jpeg") ?? file.renditions[0];
  return { ok: true, storageKey: r.storageKey, width: r.width, height: r.height };
}
