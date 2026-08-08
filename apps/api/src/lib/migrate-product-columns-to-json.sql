-- =============================================================================
-- migrate-product-columns-to-json.sql
--
-- Run once per tenant schema to move all domain-specific product columns into
-- the domainAttrs JSONB column, then drop the now-redundant columns.
--
-- Usage (psql):
--   SET search_path TO t_your_tenant;
--   \i migrate-product-columns-to-json.sql
--
-- Or use the TypeScript runner:
--   npx tsx apps/api/src/lib/run-product-migration.ts
-- =============================================================================

-- Step 1: Migrate scalar + boolean columns → domainAttrs
-- jsonb_strip_nulls removes keys where value is null so we don't pollute the JSON.
UPDATE products
SET "domainAttrs" = "domainAttrs" || jsonb_strip_nulls(jsonb_build_object(
  -- General Retail
  'weightGrams',    "weightGrams",
  'packSize',       "packSize",
  'minOrderQty',    "minOrderQty",
  'reorderQty',     "reorderQty",
  'shelfLocation',  "shelfLocation",
  'altUnit',        "altUnit",
  'altUnitFactor',  "altUnitFactor",
  'taxCategory',    "taxCategory",

  -- Pharmacy
  'drugSchedule',         "drugSchedule",
  'requiresPrescription', "requiresPrescription",
  'genericName',          "genericName",
  'manufacturer',         "manufacturer",
  'form',                 "form",
  'strengthDosage',       "strengthDosage",
  'stripQty',             "stripQty",
  'storageCondition',     "storageCondition",
  'isNarcotic',           "isNarcotic",
  'dlNumber',             "dlNumber",

  -- Electronics
  'modelNumber',    "modelNumber",
  'isSpare',        "isSpare",
  'warrantyMonths', "warrantyMonths",
  'taxClass',       "taxClass",

  -- Tiffin / Food
  'mealType',             "mealType",
  'cuisineType',          "cuisineType",
  'caloriesPer100g',      "caloriesPer100g",
  'portionSizeGrams',     "portionSizeGrams",
  'isAvailableBreakfast', "isAvailableBreakfast",
  'isAvailableLunch',     "isAvailableLunch",
  'isAvailableDinner',    "isAvailableDinner",
  'preparationTimeMin',   "preparationTimeMin",
  'isSeasonalItem',       "isSeasonalItem",

  -- Petrol Pump
  'fuelGrade',    "fuelGrade",
  'tankId',       "tankId",
  'densityKgL',   "densityKgL",
  'octaneRating', "octaneRating",

  -- Gym / Fitness
  'servingSizeG',       "servingSizeG",
  'servingsPerPack',    "servingsPerPack",
  'flavour',            "flavour",
  'proteinPer100g',     "proteinPer100g",
  'isConsumable',       "isConsumable",
  'equipmentCondition', "equipmentCondition",

  -- Diagnostic Lab
  'testCode',                  "testCode",
  'sampleType',                "sampleType",
  'turnaroundHours',           "turnaroundHours",
  'requiresFasting',           "requiresFasting",
  'methodology',               "methodology",
  'isHomeCollectionAvailable', "isHomeCollectionAvailable",
  'nablAccredited',            "nablAccredited",

  -- Pest Control
  'activeIngredient',  "activeIngredient",
  'concentrationPct',  "concentrationPct",
  'applicationMethod', "applicationMethod",
  'toxicityLevel',     "toxicityLevel",
  'dilutionRatio',     "dilutionRatio",
  'dosePerSqft',       "dosePerSqft",
  'chemShelfLifeDays', "chemShelfLifeDays",
  'isCertifiedSafe',   "isCertifiedSafe"
));

-- Step 2: Migrate array columns (String[]) — skip if empty
UPDATE products
SET "domainAttrs" = "domainAttrs"
  || CASE WHEN array_length("compatibleModels", 1) > 0
       THEN jsonb_build_object('compatibleModels', to_jsonb("compatibleModels"))
       ELSE '{}'::jsonb END
  || CASE WHEN array_length("allergens", 1) > 0
       THEN jsonb_build_object('allergens', to_jsonb("allergens"))
       ELSE '{}'::jsonb END
  || CASE WHEN array_length("targetPest", 1) > 0
       THEN jsonb_build_object('targetPest', to_jsonb("targetPest"))
       ELSE '{}'::jsonb END
  || CASE WHEN array_length("panelTests", 1) > 0
       THEN jsonb_build_object('panelTests', to_jsonb("panelTests"))
       ELSE '{}'::jsonb END;

-- Step 3: Migrate Json columns — skip if empty / null
UPDATE products
SET "domainAttrs" = "domainAttrs"
  || CASE WHEN "colorOptions"::text  <> '[]' THEN jsonb_build_object('colorOptions',   "colorOptions")  ELSE '{}'::jsonb END
  || CASE WHEN "storageOptions"::text <> '[]' THEN jsonb_build_object('storageOptions', "storageOptions") ELSE '{}'::jsonb END
  || CASE WHEN "referenceRange" IS NOT NULL    THEN jsonb_build_object('referenceRange', "referenceRange") ELSE '{}'::jsonb END;

-- Step 4: Drop all columns that have been migrated to domainAttrs
ALTER TABLE products
  -- General Retail
  DROP COLUMN IF EXISTS "weightGrams",
  DROP COLUMN IF EXISTS "packSize",
  DROP COLUMN IF EXISTS "minOrderQty",
  DROP COLUMN IF EXISTS "reorderQty",
  DROP COLUMN IF EXISTS "shelfLocation",
  DROP COLUMN IF EXISTS "altUnit",
  DROP COLUMN IF EXISTS "altUnitFactor",
  DROP COLUMN IF EXISTS "taxCategory",
  -- Pharmacy
  DROP COLUMN IF EXISTS "drugSchedule",
  DROP COLUMN IF EXISTS "requiresPrescription",
  DROP COLUMN IF EXISTS "genericName",
  DROP COLUMN IF EXISTS "manufacturer",
  DROP COLUMN IF EXISTS "form",
  DROP COLUMN IF EXISTS "strengthDosage",
  DROP COLUMN IF EXISTS "stripQty",
  DROP COLUMN IF EXISTS "storageCondition",
  DROP COLUMN IF EXISTS "isNarcotic",
  DROP COLUMN IF EXISTS "dlNumber",
  -- Electronics
  DROP COLUMN IF EXISTS "modelNumber",
  DROP COLUMN IF EXISTS "compatibleModels",
  DROP COLUMN IF EXISTS "isSpare",
  DROP COLUMN IF EXISTS "warrantyMonths",
  DROP COLUMN IF EXISTS "colorOptions",
  DROP COLUMN IF EXISTS "storageOptions",
  DROP COLUMN IF EXISTS "taxClass",
  -- Tiffin / Food
  DROP COLUMN IF EXISTS "mealType",
  DROP COLUMN IF EXISTS "cuisineType",
  DROP COLUMN IF EXISTS "allergens",
  DROP COLUMN IF EXISTS "caloriesPer100g",
  DROP COLUMN IF EXISTS "portionSizeGrams",
  DROP COLUMN IF EXISTS "isAvailableBreakfast",
  DROP COLUMN IF EXISTS "isAvailableLunch",
  DROP COLUMN IF EXISTS "isAvailableDinner",
  DROP COLUMN IF EXISTS "preparationTimeMin",
  DROP COLUMN IF EXISTS "isSeasonalItem",
  -- Petrol Pump
  DROP COLUMN IF EXISTS "fuelGrade",
  DROP COLUMN IF EXISTS "tankId",
  DROP COLUMN IF EXISTS "densityKgL",
  DROP COLUMN IF EXISTS "octaneRating",
  -- Gym / Fitness
  DROP COLUMN IF EXISTS "servingSizeG",
  DROP COLUMN IF EXISTS "servingsPerPack",
  DROP COLUMN IF EXISTS "flavour",
  DROP COLUMN IF EXISTS "proteinPer100g",
  DROP COLUMN IF EXISTS "isConsumable",
  DROP COLUMN IF EXISTS "equipmentCondition",
  -- Diagnostic Lab
  DROP COLUMN IF EXISTS "testCode",
  DROP COLUMN IF EXISTS "sampleType",
  DROP COLUMN IF EXISTS "turnaroundHours",
  DROP COLUMN IF EXISTS "requiresFasting",
  DROP COLUMN IF EXISTS "referenceRange",
  DROP COLUMN IF EXISTS "methodology",
  DROP COLUMN IF EXISTS "isHomeCollectionAvailable",
  DROP COLUMN IF EXISTS "panelTests",
  DROP COLUMN IF EXISTS "nablAccredited",
  -- Pest Control
  DROP COLUMN IF EXISTS "activeIngredient",
  DROP COLUMN IF EXISTS "concentrationPct",
  DROP COLUMN IF EXISTS "applicationMethod",
  DROP COLUMN IF EXISTS "targetPest",
  DROP COLUMN IF EXISTS "toxicityLevel",
  DROP COLUMN IF EXISTS "dilutionRatio",
  DROP COLUMN IF EXISTS "dosePerSqft",
  DROP COLUMN IF EXISTS "chemShelfLifeDays",
  DROP COLUMN IF EXISTS "isCertifiedSafe";
