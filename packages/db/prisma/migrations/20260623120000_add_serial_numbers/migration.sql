-- CreateTable: serial_numbers
-- One row per physical unit sold or in stock.
-- Used for IMEI/serial tracking, warranty management, and unit-level traceability.

CREATE TABLE "serial_numbers" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "branchId"         UUID        NOT NULL,
    "productId"        UUID        NOT NULL,
    "serialNo"         TEXT        NOT NULL,
    "imei"             TEXT,
    "imei2"            TEXT,
    "status"           TEXT        NOT NULL DEFAULT 'in_stock',
    "invoiceItemId"    UUID,
    "soldAt"           DATE,
    "warrantyMonths"   INTEGER,
    "warrantyExpiresAt" DATE,
    "customerName"     TEXT,
    "customerPhone"    TEXT,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "serial_numbers_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX "serial_numbers_serialNo_key" ON "serial_numbers"("serialNo");
CREATE UNIQUE INDEX "serial_numbers_imei_key"     ON "serial_numbers"("imei");

-- Indexes for common queries
CREATE INDEX "serial_numbers_productId_status_idx" ON "serial_numbers"("productId", "status");
CREATE INDEX "serial_numbers_branchId_status_idx"  ON "serial_numbers"("branchId",  "status");

-- Foreign keys
ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "serial_numbers" ADD CONSTRAINT "serial_numbers_invoiceItemId_fkey"
    FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
