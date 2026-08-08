-- product_images
CREATE TABLE IF NOT EXISTS "product_images" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "productId"   UUID         NOT NULL,
  "url"         TEXT,
  "data"        BYTEA,
  "mime"        TEXT,
  "alt"         TEXT,
  "sortOrder"   INTEGER      NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "product_images_productId_idx" ON "product_images"("productId");

-- product_variants
CREATE TABLE IF NOT EXISTS "product_variants" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "productId"     UUID         NOT NULL,
  "sku"           TEXT,
  "barcode"       TEXT,
  "name"          TEXT         NOT NULL,
  "attributes"    JSONB        NOT NULL DEFAULT '{}',
  "domainAttrs"   JSONB        NOT NULL DEFAULT '{}',
  "purchasePrice" DECIMAL(12,2),
  "salePrice"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "mrp"           DECIMAL(12,2),
  "isActive"      BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "product_variants_productId_idx" ON "product_variants"("productId");

-- product_price_history
CREATE TABLE IF NOT EXISTS "product_price_history" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "productId"     UUID         NOT NULL,
  "purchasePrice" DECIMAL(12,2),
  "salePrice"     DECIMAL(12,2),
  "mrp"           DECIMAL(12,2),
  "changedBy"     UUID,
  "changedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "reason"        TEXT,
  CONSTRAINT "product_price_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "product_price_history_productId_idx" ON "product_price_history"("productId");

-- suppliers
CREATE TABLE IF NOT EXISTS "suppliers" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "branchId"    UUID         NOT NULL,
  "name"        TEXT         NOT NULL,
  "contactName" TEXT,
  "phone"       TEXT,
  "email"       TEXT,
  "gstin"       TEXT,
  "address"     TEXT,
  "city"        TEXT,
  "state"       TEXT,
  "pincode"     TEXT,
  "creditDays"  INTEGER      NOT NULL DEFAULT 0,
  "notes"       TEXT,
  "isActive"    BOOLEAN      NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "suppliers_branchId_idx" ON "suppliers"("branchId");

-- product_suppliers
CREATE TABLE IF NOT EXISTS "product_suppliers" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "productId"       UUID         NOT NULL,
  "supplierId"      UUID         NOT NULL,
  "supplierSku"     TEXT,
  "lastCost"        DECIMAL(12,4),
  "moq"             DECIMAL(10,3) NOT NULL DEFAULT 1,
  "leadDays"        INTEGER      NOT NULL DEFAULT 0,
  "isPrimary"       BOOLEAN      NOT NULL DEFAULT false,
  "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "product_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_suppliers_productId_supplierId_key" UNIQUE ("productId", "supplierId")
);
CREATE INDEX IF NOT EXISTS "product_suppliers_productId_idx" ON "product_suppliers"("productId");
CREATE INDEX IF NOT EXISTS "product_suppliers_supplierId_idx" ON "product_suppliers"("supplierId");

-- purchase_orders
CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "branchId"     UUID         NOT NULL,
  "supplierId"   UUID,
  "poNo"         TEXT         NOT NULL,
  "poDate"       DATE         NOT NULL,
  "expectedDate" DATE,
  "status"       TEXT         NOT NULL DEFAULT 'draft',
  "subtotal"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxableAmt"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cgstTotal"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgstTotal"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igstTotal"    DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  "paidAmt"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes"        TEXT,
  "createdBy"    UUID         NOT NULL,
  "createdAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_branchId_poNo_key" UNIQUE ("branchId", "poNo")
);
CREATE INDEX IF NOT EXISTS "purchase_orders_branchId_status_idx" ON "purchase_orders"("branchId", "status");
CREATE INDEX IF NOT EXISTS "purchase_orders_branchId_poDate_idx" ON "purchase_orders"("branchId", "poDate" DESC);
CREATE INDEX IF NOT EXISTS "purchase_orders_supplierId_idx" ON "purchase_orders"("supplierId");

-- purchase_order_items
CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "purchaseOrderId" UUID         NOT NULL,
  "productId"       UUID,
  "description"     TEXT         NOT NULL,
  "hsnSacCode"      TEXT,
  "orderedQty"      DECIMAL(10,3) NOT NULL,
  "receivedQty"     DECIMAL(10,3) NOT NULL DEFAULT 0,
  "unit"            TEXT         NOT NULL DEFAULT 'pcs',
  "rate"            DECIMAL(12,4) NOT NULL,
  "discountPct"     DECIMAL(5,2) NOT NULL DEFAULT 0,
  "discountAmt"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxableAmt"      DECIMAL(12,2) NOT NULL,
  "gstRate"         DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cgstAmt"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgstAmt"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igstAmt"         DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total"           DECIMAL(12,2) NOT NULL,
  "sortOrder"       INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- goods_receipts
CREATE TABLE IF NOT EXISTS "goods_receipts" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "branchId"        UUID         NOT NULL,
  "purchaseOrderId" UUID,
  "supplierId"      UUID,
  "grnNo"           TEXT         NOT NULL,
  "grnDate"         DATE         NOT NULL,
  "invoiceNo"       TEXT,
  "invoiceDate"     DATE,
  "status"          TEXT         NOT NULL DEFAULT 'draft',
  "subtotal"        DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxableAmt"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "cgstTotal"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgstTotal"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igstTotal"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal"      DECIMAL(12,2) NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "createdBy"       UUID         NOT NULL,
  "createdAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipts_branchId_grnNo_key" UNIQUE ("branchId", "grnNo")
);
CREATE INDEX IF NOT EXISTS "goods_receipts_branchId_idx" ON "goods_receipts"("branchId");
CREATE INDEX IF NOT EXISTS "goods_receipts_purchaseOrderId_idx" ON "goods_receipts"("purchaseOrderId");

-- goods_receipt_items
CREATE TABLE IF NOT EXISTS "goods_receipt_items" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "goodsReceiptId"    UUID         NOT NULL,
  "purchaseOrderItemId" UUID,
  "productId"         UUID,
  "description"       TEXT         NOT NULL,
  "receivedQty"       DECIMAL(10,3) NOT NULL,
  "acceptedQty"       DECIMAL(10,3) NOT NULL,
  "rejectedQty"       DECIMAL(10,3) NOT NULL DEFAULT 0,
  "unit"              TEXT         NOT NULL DEFAULT 'pcs',
  "rate"              DECIMAL(12,4) NOT NULL,
  "taxableAmt"        DECIMAL(12,2) NOT NULL,
  "gstRate"           DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cgstAmt"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "sgstAmt"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "igstAmt"           DECIMAL(12,2) NOT NULL DEFAULT 0,
  "total"             DECIMAL(12,2) NOT NULL,
  "batchNo"           TEXT,
  "expDate"           DATE,
  "sortOrder"         INTEGER      NOT NULL DEFAULT 0,
  CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "goods_receipt_items_goodsReceiptId_idx" ON "goods_receipt_items"("goodsReceiptId");
CREATE INDEX IF NOT EXISTS "goods_receipt_items_productId_idx" ON "goods_receipt_items"("productId");

-- stock_adjustments
CREATE TABLE IF NOT EXISTS "stock_adjustments" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "branchId"    UUID         NOT NULL,
  "adjNo"       TEXT         NOT NULL,
  "adjDate"     DATE         NOT NULL,
  "reason"      TEXT         NOT NULL,
  "notes"       TEXT,
  "status"      TEXT         NOT NULL DEFAULT 'draft',
  "createdBy"   UUID         NOT NULL,
  "approvedBy"  UUID,
  "createdAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "stock_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_adjustments_branchId_adjNo_key" UNIQUE ("branchId", "adjNo")
);
CREATE INDEX IF NOT EXISTS "stock_adjustments_branchId_idx" ON "stock_adjustments"("branchId");

-- stock_adjustment_items
CREATE TABLE IF NOT EXISTS "stock_adjustment_items" (
  "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
  "stockAdjustmentId" UUID         NOT NULL,
  "productId"         UUID         NOT NULL,
  "variantId"         UUID,
  "batchId"           UUID,
  "systemQty"         DECIMAL(10,3) NOT NULL,
  "physicalQty"       DECIMAL(10,3) NOT NULL,
  "differenceQty"     DECIMAL(10,3) NOT NULL,
  "unit"              TEXT         NOT NULL DEFAULT 'pcs',
  "costRate"          DECIMAL(12,4),
  "notes"             TEXT,
  CONSTRAINT "stock_adjustment_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_adjustment_items_stockAdjustmentId_idx" ON "stock_adjustment_items"("stockAdjustmentId");
CREATE INDEX IF NOT EXISTS "stock_adjustment_items_productId_idx" ON "stock_adjustment_items"("productId");

-- stock_transfers
CREATE TABLE IF NOT EXISTS "stock_transfers" (
  "id"            UUID         NOT NULL DEFAULT gen_random_uuid(),
  "fromBranchId"  UUID         NOT NULL,
  "toBranchId"    UUID         NOT NULL,
  "transferNo"    TEXT         NOT NULL,
  "transferDate"  DATE         NOT NULL,
  "status"        TEXT         NOT NULL DEFAULT 'draft',
  "notes"         TEXT,
  "createdBy"     UUID         NOT NULL,
  "createdAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updatedAt"     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_transfers_fromBranchId_idx" ON "stock_transfers"("fromBranchId");
CREATE INDEX IF NOT EXISTS "stock_transfers_toBranchId_idx" ON "stock_transfers"("toBranchId");

-- stock_transfer_items
CREATE TABLE IF NOT EXISTS "stock_transfer_items" (
  "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
  "stockTransferId" UUID         NOT NULL,
  "productId"       UUID         NOT NULL,
  "variantId"       UUID,
  "qty"             DECIMAL(10,3) NOT NULL,
  "unit"            TEXT         NOT NULL DEFAULT 'pcs',
  "costRate"        DECIMAL(12,4),
  CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stock_transfer_items_stockTransferId_idx" ON "stock_transfer_items"("stockTransferId");

-- stock_summary
CREATE TABLE IF NOT EXISTS "stock_summary" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "branchId"    UUID         NOT NULL,
  "productId"   UUID         NOT NULL,
  "variantId"   UUID,
  "currentQty"  DECIMAL(10,3) NOT NULL DEFAULT 0,
  "reservedQty" DECIMAL(10,3) NOT NULL DEFAULT 0,
  "updatedAt"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "stock_summary_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_summary_branchId_productId_variantId_key" UNIQUE ("branchId", "productId", "variantId")
);
CREATE INDEX IF NOT EXISTS "stock_summary_branchId_idx" ON "stock_summary"("branchId");
