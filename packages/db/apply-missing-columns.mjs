import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

// All columns missing from products table (added to schema but never migrated)
const STATEMENTS = [
  // General retail
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weightGrams" DECIMAL(10,3)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "packSize" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "minOrderQty" DECIMAL(10,3)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reorderQty" DECIMAL(10,3)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shelfLocation" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "altUnit" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "altUnitFactor" DECIMAL(10,4)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "taxCategory" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "hasVariants" BOOLEAN NOT NULL DEFAULT false`,
  // Pharmacy
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "drugSchedule" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "requiresPrescription" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "genericName" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "manufacturer" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "form" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "strengthDosage" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "stripQty" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "storageCondition" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isNarcotic" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dlNumber" TEXT`,
  // Electronics
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "modelNumber" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "compatibleModels" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSpare" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "warrantyMonths" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "colorOptions" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "storageOptions" JSONB NOT NULL DEFAULT '[]'`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "taxClass" TEXT`,
  // Tiffin / Food
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "mealType" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "cuisineType" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allergens" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "caloriesPer100g" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "portionSizeGrams" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isAvailableBreakfast" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isAvailableLunch" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isAvailableDinner" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "preparationTimeMin" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isSeasonalItem" BOOLEAN NOT NULL DEFAULT false`,
  // Petrol pump
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "fuelGrade" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tankId" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "densityKgL" DECIMAL(6,4)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "octaneRating" INTEGER`,
  // Gym
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "servingSizeG" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "servingsPerPack" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "flavour" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "proteinPer100g" DECIMAL(5,2)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isConsumable" BOOLEAN NOT NULL DEFAULT true`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "equipmentCondition" TEXT`,
  // Diagnostic lab
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "testCode" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sampleType" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "turnaroundHours" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "requiresFasting" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "referenceRange" JSONB`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "methodology" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isHomeCollectionAvailable" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "panelTests" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "nablAccredited" BOOLEAN NOT NULL DEFAULT false`,
  // Pest control
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "activeIngredient" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "concentrationPct" DECIMAL(6,4)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "applicationMethod" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "targetPest" TEXT[] NOT NULL DEFAULT '{}'`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "toxicityLevel" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dilutionRatio" TEXT`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dosePerSqft" DECIMAL(8,4)`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "chemShelfLifeDays" INTEGER`,
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isCertifiedSafe" BOOLEAN NOT NULL DEFAULT false`,
  // Domain attrs (catch-all JSON)
  `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "domainAttrs" JSONB NOT NULL DEFAULT '{}'`,
  // invoice_items
  `ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "itemMeta" JSONB NOT NULL DEFAULT '{}'`,
]

const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

console.log(`Applying ${STATEMENTS.length} column additions to ${schemas.length} tenant schemas...`)

for (const { schema_name } of schemas) {
  const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema_name}` } } })
  let ok = 0, skip = 0, fail = 0
  for (const stmt of STATEMENTS) {
    try {
      await db.$executeRawUnsafe(stmt)
      ok++
    } catch (e) {
      if (e.message?.includes('already exists') || e.message?.includes('42701')) skip++
      else fail++
    }
  }
  console.log(`  ✓ ${schema_name} — added:${ok} skipped:${skip} failed:${fail}`)
  await db.$disconnect()
}

console.log('Done.')
