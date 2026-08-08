// Apply all pending column migrations to all 27 tenant schemas
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

async function main() {
  const schemas = await db.$queryRaw<Array<{ schema_name: string }>>`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name LIKE 't_%' ORDER BY schema_name
  `

  for (const { schema_name: s } of schemas) {
    // payment enhancements
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".payments
        ADD COLUMN IF NOT EXISTS type text DEFAULT 'receipt',
        ADD COLUMN IF NOT EXISTS status text DEFAULT 'cleared',
        ADD COLUMN IF NOT EXISTS "voidedAt" timestamptz,
        ADD COLUMN IF NOT EXISTS "voidReason" text
    `)
    // notifications table
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}".notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid,
        type text NOT NULL,
        title text NOT NULL,
        body text,
        data jsonb DEFAULT '{}',
        read boolean DEFAULT false,
        "createdAt" timestamptz DEFAULT now()
      )
    `)
    // invoice linkedInvoiceId
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".invoices
        ADD COLUMN IF NOT EXISTS "linkedInvoiceId" uuid
    `)
    // batches branchId (added to schema but missing from init migration)
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".batches
        ADD COLUMN IF NOT EXISTS "branchId" uuid
    `)
    await db.$executeRawUnsafe(`
      UPDATE "${s}".batches b
      SET "branchId" = p."branchId"
      FROM "${s}".products p
      WHERE p.id = b."productId"
        AND b."branchId" IS NULL
        AND p."branchId" IS NOT NULL
    `)
    await db.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "batches_branchId_expDate_idx"
      ON "${s}".batches("branchId", "expDate")
    `)
    // ── Coaching-only migrations (skip non-coaching schemas) ─────────────────
    const isCoaching = await db.$queryRaw<Array<{exists: boolean}>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = ${s} AND table_name = 'coaching_monthly_plans'
      ) AS exists
    `.then(r => r[0]?.exists).catch(() => false)

    if (isCoaching) {
    // coaching topic notes (AI-generated study notes per topic)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}".coaching_topic_notes (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"   UUID        NOT NULL,
        subject      TEXT        NOT NULL,
        topic        TEXT        NOT NULL,
        content      JSONB       NOT NULL DEFAULT '{}',
        "rawText"    TEXT,
        "generatedBy" TEXT       NOT NULL DEFAULT 'gemini',
        "createdBy"  UUID        NOT NULL,
        "createdAt"  TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt"  TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE ("branchId", subject, topic)
      )
    `).catch(() => null)
    // per-question marks + AI analysis on exam scores (coaching tenants only)
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".student_exams
        ADD COLUMN IF NOT EXISTS questions       jsonb NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS "weekId"        uuid,
        ADD COLUMN IF NOT EXISTS "generatedPaper" jsonb NOT NULL DEFAULT '{}'
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".student_exam_scores
        ADD COLUMN IF NOT EXISTS "questionMarks" jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "errorTypes"    jsonb NOT NULL DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS "aiNotes"       text
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".coaching_topic_notes
        ADD COLUMN IF NOT EXISTS board     TEXT,
        ADD COLUMN IF NOT EXISTS standard  TEXT
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}".robotics_projects (
        "id"             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"       UUID        NOT NULL,
        "title"          TEXT        NOT NULL,
        "description"    TEXT,
        "category"       TEXT        NOT NULL DEFAULT 'Mixed',
        "batchName"      TEXT,
        "standard"       TEXT,
        "targetEvent"    TEXT,
        "eventDate"      TIMESTAMPTZ,
        "phases"         JSONB       NOT NULL DEFAULT '[]',
        "phaseChecklist" JSONB       NOT NULL DEFAULT '{}',
        "status"         TEXT        NOT NULL DEFAULT 'active',
        "createdBy"      UUID        NOT NULL,
        "createdAt"      TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt"      TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}".student_robotics_progress (
        "id"           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"     UUID    NOT NULL,
        "projectId"    UUID    NOT NULL,
        "partyId"      UUID    NOT NULL,
        "teamName"     TEXT,
        "currentPhase" INTEGER NOT NULL DEFAULT 0,
        "phaseChecks"  JSONB   NOT NULL DEFAULT '{}',
        "components"   JSONB   NOT NULL DEFAULT '{}',
        "ratings"      JSONB   NOT NULL DEFAULT '{}',
        "presentation" JSONB   NOT NULL DEFAULT '{}',
        "tutorNotes"   TEXT,
        "createdAt"    TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt"    TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE ("projectId", "partyId")
      )
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}".robotics_components (
        "id"        UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"  UUID    NOT NULL,
        "name"      TEXT    NOT NULL,
        "category"  TEXT,
        "totalQty"  INTEGER NOT NULL DEFAULT 1,
        "notes"     TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE ("branchId", "name")
      )
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "${s}".coaching_experiment_prep (
        "id"          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        "branchId"    UUID        NOT NULL,
        "weekId"      UUID        NOT NULL,
        "subject"     TEXT        NOT NULL,
        "topic"       TEXT        NOT NULL,
        "itemStatus"  JSONB       NOT NULL DEFAULT '{}',
        "prepDone"    BOOLEAN     NOT NULL DEFAULT false,
        "prepNotes"   TEXT,
        "createdAt"   TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt"   TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE ("branchId", "weekId", "topic")
      )
    `).catch(() => null)
    await db.$executeRawUnsafe(`
      ALTER TABLE "${s}".robotics_projects
        ADD COLUMN IF NOT EXISTS "planId"    UUID,
        ADD COLUMN IF NOT EXISTS "phaseKits" JSONB NOT NULL DEFAULT '{}'
    `).catch(() => null)
    } // end isCoaching
    console.log(`✓ ${s}`)
  }
  console.log(`Done — ${schemas.length} schemas updated`)
}

main().catch(console.error).finally(() => db.$disconnect())
