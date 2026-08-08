-- Nozzle readings for petrol pump domain
-- Tracks daily opening/closing meter readings per nozzle per shift.
-- saleAmount is derived from (closingReading - openingReading) * ratePerLitre
-- but stored here so analytics can query without joining products every time.

CREATE TABLE IF NOT EXISTS "nozzle_readings" (
  "id"            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "branchId"      UUID        NOT NULL,
  "nozzleNo"      TEXT        NOT NULL,
  "fuelType"      TEXT        NOT NULL DEFAULT 'petrol',   -- petrol | diesel | cng
  "readingDate"   DATE        NOT NULL,
  "shift"         TEXT        NOT NULL DEFAULT 'morning',  -- morning | evening | night
  "openingReading" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "closingReading" NUMERIC(12,2) NOT NULL DEFAULT 0,
  "soldLitres"    NUMERIC(10,3) GENERATED ALWAYS AS ("closingReading" - "openingReading") STORED,
  "ratePerLitre"  NUMERIC(8,2) NOT NULL DEFAULT 0,
  "saleAmount"    NUMERIC(12,2) GENERATED ALWAYS AS (("closingReading" - "openingReading") * "ratePerLitre") STORED,
  "notes"         TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "nozzle_readings_branchId_readingDate_idx"
  ON "nozzle_readings" ("branchId", "readingDate");
