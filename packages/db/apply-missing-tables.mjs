import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function run() {
  const schemas = await prisma.$queryRaw`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%' ORDER BY schema_name
  `
  console.log(`Found ${schemas.length} tenant schemas`)

  for (const { schema_name } of schemas) {
    try {
      // ── deliveries ──────────────────────────────────────────────────────────
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schema_name}".deliveries (
          id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          "branchId"        UUID        NOT NULL,
          "invoiceId"       UUID,
          "partyId"         UUID,
          "deliveryAddress" JSONB,
          "contactName"     TEXT,
          "contactPhone"    TEXT,
          status            TEXT        NOT NULL DEFAULT 'pending',
          "scheduledDate"   DATE,
          "dispatchedAt"    TIMESTAMPTZ,
          "deliveredAt"     TIMESTAMPTZ,
          "driverName"      TEXT,
          "vehicleNo"       TEXT,
          notes             TEXT,
          "createdBy"       UUID,
          "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      // ── bank_accounts ───────────────────────────────────────────────────────
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schema_name}".bank_accounts (
          id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          "branchId"        UUID        NOT NULL,
          name              TEXT        NOT NULL,
          "bankName"        TEXT,
          "accountNumber"   TEXT,
          "ifscCode"        TEXT,
          "openingBalance"  DECIMAL(14,2) NOT NULL DEFAULT 0,
          "currentBalance"  DECIMAL(14,2) NOT NULL DEFAULT 0,
          "isActive"        BOOLEAN     NOT NULL DEFAULT true,
          "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      // ── bank_reconciliation_entries ─────────────────────────────────────────
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "${schema_name}".bank_reconciliation_entries (
          id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
          "bankAccountId" UUID        NOT NULL,
          "branchId"      UUID        NOT NULL,
          "entryDate"     DATE        NOT NULL,
          description     TEXT,
          amount          DECIMAL(14,2) NOT NULL,
          type            TEXT        NOT NULL DEFAULT 'credit',
          "paymentId"     UUID,
          "isReconciled"  BOOLEAN     NOT NULL DEFAULT false,
          "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `)

      console.log(`✓ ${schema_name}`)
    } catch (err) {
      console.error(`✗ ${schema_name}:`, err.message)
    }
  }

  console.log('Missing tables migration complete')
  await prisma.$disconnect()
}

run().catch(console.error)
