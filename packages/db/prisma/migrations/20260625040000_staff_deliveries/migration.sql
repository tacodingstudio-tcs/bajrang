-- Migration: staff_shifts, staff_attendance, deliveries

-- ─── staff_shifts ─────────────────────────────────────────────────────────────
-- Planned shifts for staff members. One row per user per date per shift.
CREATE TABLE IF NOT EXISTS staff_shifts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId"    UUID        NOT NULL,
  "userId"      UUID        NOT NULL,
  date          DATE        NOT NULL,
  "shiftType"   TEXT        NOT NULL DEFAULT 'full_day', -- morning|evening|night|full_day
  "shiftStart"  TIME,
  "shiftEnd"    TIME,
  notes         TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_branch_date
  ON staff_shifts ("branchId", date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_user
  ON staff_shifts ("branchId", "userId", date DESC);

-- ─── staff_attendance ─────────────────────────────────────────────────────────
-- Actual attendance record: one row per user per date.
CREATE TABLE IF NOT EXISTS staff_attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId"    UUID        NOT NULL,
  "userId"      UUID        NOT NULL,
  date          DATE        NOT NULL,
  "clockIn"     TIMESTAMPTZ,
  "clockOut"    TIMESTAMPTZ,
  "hoursWorked" NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN "clockIn" IS NOT NULL AND "clockOut" IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM ("clockOut" - "clockIn")) / 3600.0, 2)
      ELSE NULL
    END
  ) STORED,
  status        TEXT        NOT NULL DEFAULT 'present', -- present|absent|late|half_day|holiday
  notes         TEXT,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("branchId", "userId", date)
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch_date
  ON staff_attendance ("branchId", date DESC);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_user
  ON staff_attendance ("branchId", "userId", date DESC);

-- ─── deliveries ───────────────────────────────────────────────────────────────
-- Delivery order linked to a sale invoice.
-- Tracks dispatch, assignment, and completion of physical deliveries.
CREATE TABLE IF NOT EXISTS deliveries (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "branchId"            UUID        NOT NULL,
  "invoiceId"           UUID,                                -- nullable: can create before invoice
  "partyId"             UUID,
  "deliveryAddress"     JSONB       NOT NULL DEFAULT '{}',  -- { line1, city, pincode, landmark }
  "deliveryPersonName"  TEXT,
  "deliveryPersonPhone" TEXT,
  status                TEXT        NOT NULL DEFAULT 'pending',
    -- pending | dispatched | out_for_delivery | delivered | failed | cancelled
  notes                 TEXT,
  "scheduledAt"         TIMESTAMPTZ,
  "dispatchedAt"        TIMESTAMPTZ,
  "deliveredAt"         TIMESTAMPTZ,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deliveries_branch_status
  ON deliveries ("branchId", status, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_invoice
  ON deliveries ("invoiceId") WHERE "invoiceId" IS NOT NULL;
