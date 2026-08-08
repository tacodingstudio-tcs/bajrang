-- Migration: job_cards, job_card_parts, subscriptions, delivery_logs, nozzle_readings
-- Applied manually (non-interactive environment); registered in _prisma_migrations.

-- ── job_cards ─────────────────────────────────────────────────────────────────
CREATE TABLE "job_cards" (
    "id"                  UUID           NOT NULL DEFAULT gen_random_uuid(),
    "branchId"            UUID           NOT NULL,
    "jobNo"               TEXT           NOT NULL,
    "status"              TEXT           NOT NULL DEFAULT 'received',
    "deviceType"          TEXT           NOT NULL,
    "deviceBrand"         TEXT           NOT NULL,
    "deviceModel"         TEXT           NOT NULL,
    "serialNo"            TEXT,
    "imei"                TEXT,
    "color"               TEXT,
    "problemReported"     TEXT           NOT NULL,
    "diagnosis"           TEXT,
    "estimatedCost"       DECIMAL(12,2),
    "advanceReceived"     DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "partyId"             UUID,
    "assignedTo"          UUID,
    "estimatedDelivery"   DATE,
    "deliveredAt"         TIMESTAMPTZ,
    "warrantyDays"        INTEGER        NOT NULL DEFAULT 0,
    "warrantyExpiresAt"   DATE,
    "invoiceId"           UUID,
    "accessories"         JSONB          NOT NULL DEFAULT '[]',
    "photos"              JSONB          NOT NULL DEFAULT '[]',
    "notes"               TEXT,
    "createdAt"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "job_cards_branchId_jobNo_key"     ON "job_cards"("branchId", "jobNo");
CREATE INDEX "job_cards_branchId_status_idx"           ON "job_cards"("branchId", "status");
CREATE INDEX "job_cards_branchId_partyId_idx"          ON "job_cards"("branchId", "partyId");

-- ── job_card_parts ────────────────────────────────────────────────────────────
CREATE TABLE "job_card_parts" (
    "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
    "jobCardId"   UUID           NOT NULL,
    "productId"   UUID,
    "description" TEXT           NOT NULL,
    "qty"         DECIMAL(10,3)  NOT NULL,
    "rate"        DECIMAL(12,2)  NOT NULL,
    "total"       DECIMAL(12,2)  NOT NULL,
    CONSTRAINT "job_card_parts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_card_parts_jobCardId_idx" ON "job_card_parts"("jobCardId");
ALTER TABLE "job_card_parts" ADD CONSTRAINT "job_card_parts_jobCardId_fkey"
    FOREIGN KEY ("jobCardId") REFERENCES "job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_card_parts" ADD CONSTRAINT "job_card_parts_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE "subscriptions" (
    "id"                UUID           NOT NULL DEFAULT gen_random_uuid(),
    "branchId"          UUID           NOT NULL,
    "subNo"             TEXT           NOT NULL,
    "partyId"           UUID           NOT NULL,
    "planName"          TEXT           NOT NULL,
    "mealType"          TEXT           NOT NULL DEFAULT 'veg',
    "tiffinSize"        TEXT           NOT NULL DEFAULT 'full',
    "deliveriesPerDay"  INTEGER        NOT NULL DEFAULT 1,
    "pricePerDay"       DECIMAL(10,2)  NOT NULL,
    "pricePerMonth"     DECIMAL(10,2),
    "startDate"         DATE           NOT NULL,
    "endDate"           DATE,
    "status"            TEXT           NOT NULL DEFAULT 'active',
    "pausedFrom"        DATE,
    "pausedUntil"       DATE,
    "routeArea"         TEXT,
    "deliveryAddress"   TEXT,
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_branchId_subNo_key"    ON "subscriptions"("branchId", "subNo");
CREATE INDEX "subscriptions_branchId_status_idx"          ON "subscriptions"("branchId", "status");
CREATE INDEX "subscriptions_branchId_partyId_idx"         ON "subscriptions"("branchId", "partyId");
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── delivery_logs ─────────────────────────────────────────────────────────────
CREATE TABLE "delivery_logs" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "branchId"        UUID         NOT NULL,
    "subscriptionId"  UUID         NOT NULL,
    "deliveryDate"    DATE         NOT NULL,
    "mealSlot"        TEXT         NOT NULL DEFAULT 'lunch',
    "status"          TEXT         NOT NULL DEFAULT 'delivered',
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "delivery_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "delivery_logs_subscriptionId_deliveryDate_mealSlot_key"
    ON "delivery_logs"("subscriptionId", "deliveryDate", "mealSlot");
CREATE INDEX "delivery_logs_branchId_deliveryDate_idx" ON "delivery_logs"("branchId", "deliveryDate");
ALTER TABLE "delivery_logs" ADD CONSTRAINT "delivery_logs_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── nozzle_readings ───────────────────────────────────────────────────────────
CREATE TABLE "nozzle_readings" (
    "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
    "branchId"         UUID           NOT NULL,
    "readingDate"      DATE           NOT NULL,
    "shift"            TEXT           NOT NULL,
    "nozzleNo"         TEXT           NOT NULL,
    "fuelType"         TEXT           NOT NULL,
    "openingReading"   DECIMAL(12,3)  NOT NULL,
    "closingReading"   DECIMAL(12,3)  NOT NULL,
    "testLitres"       DECIMAL(10,3)  NOT NULL DEFAULT 0,
    "soldLitres"       DECIMAL(12,3)  NOT NULL,
    "ratePerLitre"     DECIMAL(8,2)   NOT NULL,
    "saleAmount"       DECIMAL(12,2)  NOT NULL,
    "cashReceived"     DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "cardReceived"     DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "creditAmount"     DECIMAL(12,2)  NOT NULL DEFAULT 0,
    "shortageExcess"   DECIMAL(10,3)  NOT NULL DEFAULT 0,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "nozzle_readings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nozzle_readings_branchId_readingDate_shift_nozzleNo_key"
    ON "nozzle_readings"("branchId", "readingDate", "shift", "nozzleNo");
CREATE INDEX "nozzle_readings_branchId_readingDate_idx" ON "nozzle_readings"("branchId", "readingDate");

-- Foreign keys on job_cards (added after both referenced tables exist)
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_cards" ADD CONSTRAINT "job_cards_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
