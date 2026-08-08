-- Migration: memberships, attendance_logs, lab_reports, service_visits
-- Applied manually; registered in _prisma_migrations.

-- ── memberships ───────────────────────────────────────────────────────────────
CREATE TABLE "memberships" (
    "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
    "branchId"      UUID           NOT NULL,
    "memberId"      TEXT           NOT NULL,
    "partyId"       UUID           NOT NULL,
    "planName"      TEXT           NOT NULL,
    "planType"      TEXT           NOT NULL DEFAULT 'monthly',
    "startDate"     DATE           NOT NULL,
    "endDate"       DATE           NOT NULL,
    "status"        TEXT           NOT NULL DEFAULT 'active',
    "feeAmount"     DECIMAL(10,2)  NOT NULL,
    "admissionFee"  DECIMAL(10,2)  NOT NULL DEFAULT 0,
    "lockerNo"      TEXT,
    "biometricId"   TEXT,
    "trainerName"   TEXT,
    "invoiceId"     UUID,
    "renewedFrom"   UUID,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "memberships_branchId_memberId_key"  ON "memberships"("branchId", "memberId");
CREATE INDEX        "memberships_branchId_status_idx"    ON "memberships"("branchId", "status");
CREATE INDEX        "memberships_branchId_endDate_idx"   ON "memberships"("branchId", "endDate");
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── attendance_logs ────────────────────────────────────────────────────────────
CREATE TABLE "attendance_logs" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "branchId"     UUID         NOT NULL,
    "partyId"      UUID         NOT NULL,
    "membershipId" UUID,
    "checkinAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "checkoutAt"   TIMESTAMPTZ,
    "source"       TEXT         NOT NULL DEFAULT 'manual',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "attendance_logs_branchId_checkinAt_idx" ON "attendance_logs"("branchId", "checkinAt");
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_membershipId_fkey"
    FOREIGN KEY ("membershipId") REFERENCES "memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── lab_reports ───────────────────────────────────────────────────────────────
CREATE TABLE "lab_reports" (
    "id"                  UUID         NOT NULL DEFAULT gen_random_uuid(),
    "branchId"            UUID         NOT NULL,
    "invoiceId"           UUID         NOT NULL,
    "invoiceItemId"       UUID,
    "sampleId"            TEXT         NOT NULL,
    "patientName"         TEXT         NOT NULL,
    "patientAge"          INTEGER,
    "patientGender"       TEXT,
    "refDoctor"           TEXT,
    "testName"            TEXT         NOT NULL,
    "status"              TEXT         NOT NULL DEFAULT 'pending',
    "collectedAt"         TIMESTAMPTZ,
    "reportExpectedAt"    TIMESTAMPTZ,
    "reportReadyAt"       TIMESTAMPTZ,
    "reportUrl"           TEXT,
    "results"             JSONB        NOT NULL DEFAULT '{}',
    "homeCollection"      BOOLEAN      NOT NULL DEFAULT FALSE,
    "collectionAddress"   TEXT,
    "urgent"              BOOLEAN      NOT NULL DEFAULT FALSE,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lab_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "lab_reports_branchId_status_idx"   ON "lab_reports"("branchId", "status");
CREATE INDEX "lab_reports_branchId_sampleId_idx" ON "lab_reports"("branchId", "sampleId");
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lab_reports" ADD CONSTRAINT "lab_reports_invoiceItemId_fkey"
    FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── service_visits ────────────────────────────────────────────────────────────
CREATE TABLE "service_visits" (
    "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
    "branchId"         UUID           NOT NULL,
    "invoiceId"        UUID,
    "partyId"          UUID           NOT NULL,
    "visitNo"          INTEGER        NOT NULL DEFAULT 1,
    "serviceType"      TEXT           NOT NULL,
    "serviceAddress"   TEXT           NOT NULL,
    "scheduledDate"    DATE           NOT NULL,
    "completedAt"      TIMESTAMPTZ,
    "status"           TEXT           NOT NULL DEFAULT 'scheduled',
    "technicianName"   TEXT,
    "chemicalUsed"     TEXT,
    "chemicalQtyMl"    DECIMAL(10,2),
    "areaSqft"         DECIMAL(10,2),
    "nextVisitDate"    DATE,
    "warrantyCardNo"   TEXT,
    "serviceReport"    TEXT,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "service_visits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "service_visits_branchId_scheduledDate_idx" ON "service_visits"("branchId", "scheduledDate");
CREATE INDEX "service_visits_branchId_partyId_idx"       ON "service_visits"("branchId", "partyId");
ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_partyId_fkey"
    FOREIGN KEY ("partyId") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_visits" ADD CONSTRAINT "service_visits_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
