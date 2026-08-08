-- CreateTable
CREATE TABLE IF NOT EXISTS "expenses" (
    "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
    "branchId"      UUID         NOT NULL,
    "date"          DATE         NOT NULL DEFAULT CURRENT_DATE,
    "category"      TEXT         NOT NULL,
    "description"   TEXT,
    "amount"        DECIMAL(12,2) NOT NULL,
    "gstAmount"     DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gstRate"       INTEGER      NOT NULL DEFAULT 0,
    "paymentMode"   TEXT         NOT NULL DEFAULT 'cash',
    "partyId"       UUID,
    "referenceNo"   TEXT,
    "notes"         TEXT,
    "attachmentUrl" TEXT,
    "isRecurring"   BOOLEAN      NOT NULL DEFAULT false,
    "recurrence"    TEXT,
    "createdBy"     UUID         NOT NULL,
    "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expenses_branchId_date_idx" ON "expenses"("branchId", "date" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expenses_branchId_category_idx" ON "expenses"("branchId", "category");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "expenses_branchId_partyId_idx" ON "expenses"("branchId", "partyId");
