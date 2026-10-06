import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Design of a landing page (issue #65): the rules that keep a header image,
 * a logo or a header button from showing something the studio did not mean to
 * make public.
 */
const findFirst = vi.hoisted(() => vi.fn());
vi.mock("../db.js", () => ({ prisma: { file: { findFirst } } }));

import {
  isAllowedCtaUrl,
  isPageAssetKey,
  pageAssetPrefix,
  pageDesignData,
  pageDesignSchema,
  resolvePageHeroFile,
} from "./landing-page-design.js";

const T = "11111111-1111-1111-1111-111111111111";
const P = "22222222-2222-2222-2222-222222222222";

describe("isAllowedCtaUrl", () => {
  it.each([
    "https://example.com/booking",
    "http://example.com",
    "mailto:hello@studio.example",
    "tel:+49 30 1234567",
  ])("allows %s", (url) => expect(isAllowedCtaUrl(url)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,<b>x</b>",
    "ftp://example.com",
    "/relative/path",
    "example.com",
    "tel:call-me",
  ])("refuses %s", (url) => expect(isAllowedCtaUrl(url)).toBe(false));

  it("is enforced by the PATCH schema, empty string means reset", () => {
    expect(pageDesignSchema.safeParse({ ctaUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(pageDesignSchema.safeParse({ ctaUrl: "" }).success).toBe(true);
    expect(pageDesignSchema.safeParse({ ctaUrl: null }).success).toBe(true);
  });
});

describe("isPageAssetKey", () => {
  it("accepts keys under the page's own prefix", () => {
    expect(isPageAssetKey(T, P, `${pageAssetPrefix(T, P)}hero-abc.jpg`)).toBe(true);
  });

  it("refuses keys of another page, a gallery or another studio", () => {
    expect(isPageAssetKey(T, P, `t/${T}/pages/other/assets/hero-abc.jpg`)).toBe(false);
    expect(isPageAssetKey(T, P, `t/${T}/galleries/g1/assets/hero-abc.jpg`)).toBe(false);
    expect(isPageAssetKey(T, P, `t/other/pages/${P}/assets/hero-abc.jpg`)).toBe(false);
    expect(isPageAssetKey(T, P, `${pageAssetPrefix(T, P)}../../x.jpg`)).toBe(false);
    expect(isPageAssetKey(T, P, pageAssetPrefix(T, P))).toBe(false);
  });
});

describe("pageDesignData", () => {
  it("takes only design keys from a whole PATCH body", () => {
    const body = { title: "x", access: "public", galleryLayout: "bands" } as never;
    expect(pageDesignData(body)).toEqual({ galleryLayout: "bands" });
  });

  it("turns empty strings into null (reset)", () => {
    expect(pageDesignData({ ctaLabel: "  ", footerMarkdown: "" })).toEqual({
      ctaLabel: null,
      footerMarkdown: null,
    });
  });

  it("an upload and a gallery photo exclude each other", () => {
    expect(pageDesignData({ heroFileId: P })).toEqual({ heroFileId: P, heroUrl: null });
    expect(pageDesignData({ heroUrl: "k" })).toEqual({ heroUrl: "k", heroFileId: null });
  });
});

describe("resolvePageHeroFile", () => {
  const page = { id: P, tenantId: T, heroFileId: "33333333-3333-3333-3333-333333333333" };
  const gallery = (over: Record<string, unknown> = {}) => ({
    status: "live",
    expiresAt: null,
    publicAccess: true,
    passwordHash: null,
    landingPages: [{ landingPageId: P }],
    ...over,
  });
  const file = (g = gallery()) => ({
    gallery: g,
    renditions: [
      { kind: "web", storageKey: "web.webp", width: 1, height: 1 },
      { kind: "web_jpeg", storageKey: "web.jpg", width: 1, height: 1 },
    ],
  });

  beforeEach(() => findFirst.mockReset());

  it("returns the web_jpeg rendition of a photo from an open gallery on the page", async () => {
    findFirst.mockResolvedValue(file());
    expect(await resolvePageHeroFile(page)).toMatchObject({ ok: true, storageKey: "web.jpg" });
    // Only ready, visible images of this studio are considered at all.
    expect(findFirst.mock.calls[0][0].where).toMatchObject({
      status: "ready",
      publicVisibility: "visible",
      kind: "image",
      gallery: { tenantId: T },
    });
  });

  it("refuses a gallery with a password", async () => {
    findFirst.mockResolvedValue(file(gallery({ passwordHash: "argon2..." })));
    expect(await resolvePageHeroFile(page)).toEqual({ ok: false, problem: "gallery_protected" });
  });

  it("refuses a gallery that is not on this page", async () => {
    findFirst.mockResolvedValue(file(gallery({ landingPages: [] })));
    expect(await resolvePageHeroFile(page)).toEqual({ ok: false, problem: "not_on_page" });
  });

  it("refuses a gallery the page does not render (draft, expired, links only)", async () => {
    for (const over of [
      { status: "draft" },
      { expiresAt: new Date("2000-01-01") },
      { publicAccess: false },
    ]) {
      findFirst.mockResolvedValue(file(gallery(over)));
      expect(await resolvePageHeroFile(page)).toEqual({ ok: false, problem: "gallery_hidden" });
    }
  });

  it("refuses a missing file or one without a web rendition", async () => {
    findFirst.mockResolvedValue(null);
    expect(await resolvePageHeroFile(page)).toEqual({ ok: false, problem: "not_found" });
    findFirst.mockResolvedValue({ gallery: gallery(), renditions: [] });
    expect(await resolvePageHeroFile(page)).toEqual({ ok: false, problem: "not_found" });
  });
});
