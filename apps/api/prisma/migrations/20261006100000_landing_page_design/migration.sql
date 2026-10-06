-- =============================================================================
-- Landing pages: design options (issue #65)
-- =============================================================================
-- Header, fonts, colours, footer and gallery display for pages, mirroring the
-- gallery header. Purely additive with defaults: existing pages look as before.

ALTER TABLE "landing_pages"
    ADD COLUMN "heroLayout" TEXT NOT NULL DEFAULT 'minimal',
    ADD COLUMN "heroFileId" UUID,
    ADD COLUMN "heroUrl" TEXT,
    ADD COLUMN "heroOverlayColor" VARCHAR(9),
    ADD COLUMN "heroOverlayBlur" INTEGER,
    ADD COLUMN "heroBackgroundColor" VARCHAR(7),
    ADD COLUMN "eventLogoUrl" TEXT,
    ADD COLUMN "eventLogoSize" TEXT NOT NULL DEFAULT 'medium',
    ADD COLUMN "fontHeading" VARCHAR(40),
    ADD COLUMN "fontBody" VARCHAR(40),
    ADD COLUMN "colorBackground" VARCHAR(7),
    ADD COLUMN "colorAccent" VARCHAR(7),
    ADD COLUMN "footerMarkdown" TEXT,
    ADD COLUMN "galleryLayout" TEXT NOT NULL DEFAULT 'grid',
    ADD COLUMN "cardTitleOnImage" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "cardShowDate" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "cardShowCount" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "ctaLabel" TEXT,
    ADD COLUMN "ctaUrl" TEXT,
    ADD COLUMN "showHeaderWhenLocked" BOOLEAN NOT NULL DEFAULT false;
