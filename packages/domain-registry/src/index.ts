// packages/domain-registry/src/index.ts
// =============================================================================
// DOMAIN REGISTRY — single source of truth for all domain types.
//
// Adding a new domain:
//   1. Create a new file: src/domains/newdomain.ts
//   2. Export productAttrsSchema, invoiceDataSchema, itemMetaSchema
//   3. Add an entry in DOMAIN_REGISTRY below
//   4. Zero changes to core tables, routes, or GST engine
// =============================================================================

import { z } from 'zod'

// ── Retail / Kirana ──────────────────────────────────────────────────────────
const RetailProductAttrs = z.object({
  brand:                z.string().max(100).optional(),
  pack_size:            z.string().max(50).optional(),
  reorder_qty:          z.number().nonnegative().optional(),
  reorder_to_qty:       z.number().nonnegative().optional(),
  preferred_supplier_id:z.string().uuid().optional(),
  supplier_sku:         z.string().optional(),
  weight_per_unit_g:    z.number().nonnegative().optional(),
}).strict()

const RetailInvoiceData = z.object({
  is_udhaar:             z.boolean().default(false),
  udhaar_promised_date:  z.string().optional(),
  source:                z.enum(['pos','voice','whatsapp_order','manual','online_order']).default('pos'),
  delivery_address:      z.string().max(300).optional(),
  delivery_boy_name:     z.string().max(100).optional(),
}).strict()

const RetailItemMeta = z.object({
  free_qty:      z.number().nonnegative().default(0),    // buy-2-get-1 free items
  alt_unit_qty:  z.number().positive().optional(),        // qty in alt unit (e.g. 500g when stock unit is kg)
  alt_unit:      z.string().max(20).optional(),           // 'g', 'ml', 'pcs'
}).strict()

// ── Restaurant ───────────────────────────────────────────────────────────────
const RestaurantProductAttrs = z.object({
  is_veg:             z.boolean().default(true),
  is_jain:            z.boolean().default(false),
  prep_time_min:      z.number().int().min(1).max(180).default(15),
  station:            z.enum(['hot_kitchen','cold','bar','tandoor','bakery','grill']).optional(),
  allergens:          z.array(z.enum(['gluten','dairy','nuts','eggs','soy','shellfish'])).default([]),
  available_in:       z.array(z.enum(['breakfast','lunch','dinner','all_day'])).default(['all_day']),
  portion_sizes:      z.array(z.object({ name: z.string(), price: z.number().min(0) })).max(4).default([]),
  modifiers_group_id: z.string().uuid().optional(),
}).strict()

const RestaurantInvoiceData = z.object({
  table_id:           z.string().uuid().optional(),
  cover_count:        z.number().int().min(1).optional(),
  kot_ids:            z.array(z.string().uuid()).default([]),
  order_type:         z.enum(['dine_in','takeaway','delivery','zomato','swiggy','room_service']).default('dine_in'),
  service_charge_pct: z.number().min(0).max(20).default(0),
  packaging_charges:  z.number().nonnegative().default(0),  // mandatory separate line on Zomato/Swiggy bills
  captain_id:         z.string().uuid().optional(),          // waiter/captain who took the order
  delivery_partner:   z.string().optional(),
}).strict()

const RestaurantItemMeta = z.object({
  kot_id:           z.string().uuid().optional(),
  station:          z.string().optional(),
  modifiers:        z.array(z.object({ name: z.string(), price: z.number() })).default([]),
  portion:          z.string().optional(),
  is_complementary: z.boolean().default(false),   // free item (papad, water) — ₹0 on bill but tracked
}).strict()

// ── Pharmacy ─────────────────────────────────────────────────────────────────
const PharmacyProductAttrs = z.object({
  salt_composition:     z.string().max(500).optional(),
  schedule:             z.enum(['OTC','G','H','H1','X']).default('OTC'),
  requires_rx:          z.boolean().default(false),
  is_narcotic:          z.boolean().default(false),      // Schedule X — separate narcotic register required
  is_ayurvedic:         z.boolean().default(false),      // AYUSH products — different licence type
  manufacturer:         z.string().max(100).optional(),
  storage_condition:    z.enum(['room_temp','cool_dry','refrigerated']).default('room_temp'),
  drug_type:            z.enum(['tablet','capsule','syrup','injection','topical','drops','other']).optional(),
  pack_size:            z.string().max(50).optional(),
  generic_substitutes:  z.array(z.string().uuid()).max(5).default([]),
}).strict()

const PharmacyInvoiceData = z.object({
  prescription_id: z.string().uuid().optional(),
  patient_name:    z.string().max(100).optional(),
  patient_mobile:  z.string().max(13).optional(),   // required for Schedule H prescription audit trail
  doctor_name:     z.string().max(100).optional(),
  dl_number:       z.string().max(50).optional(),   // Drug Licence No — must print on H/H1 invoices (Drugs & Cosmetics Act)
  rx_required:     z.boolean().default(false),
}).strict()

const PharmacyItemMeta = z.object({
  batch_id:   z.string().uuid().optional(),
  batch_no:   z.string().optional(),
  exp_date:   z.string().optional(),
  is_generic: z.boolean().default(false),
}).strict()

// ── Salon ─────────────────────────────────────────────────────────────────────
const SalonProductAttrs = z.object({
  duration_min:          z.number().int().min(5).max(480).optional(),
  gender:                z.enum(['male','female','unisex']).default('unisex'),
  staff_level_required:  z.enum(['junior','senior','expert']).optional(),
  commission_type:       z.enum(['pct','fixed']).default('pct'),
  commission_value:      z.number().nonnegative().default(10),
  requires_booking:      z.boolean().default(false),
  category_display:      z.string().optional(),
  product_consumed_ml:   z.number().nonnegative().optional(),  // product used per service — for stock deduction
}).strict()

const SalonInvoiceData = z.object({
  appointment_id:       z.string().uuid().optional(),
  membership_id:        z.string().uuid().optional(),   // prepaid membership being redeemed
  tip_amount:           z.number().nonnegative().default(0),  // separate from service charge — for staff payout
  loyalty_points_used:  z.number().int().nonnegative().default(0),
}).strict()

const SalonItemMeta = z.object({
  staff_id:       z.string().uuid().optional(),
  commission_amt: z.number().nonnegative().optional(),
  duration_min:   z.number().int().optional(),
}).strict()

// ── Wholesale ─────────────────────────────────────────────────────────────────
const WholesaleProductAttrs = z.object({
  case_qty:          z.number().positive().optional(),
  min_order_qty:     z.number().positive().optional(),
  lead_time_days:    z.number().int().min(0).optional(),
  price_tiers:       z.array(z.object({
                       min_qty: z.number().positive(),
                       rate:    z.number().positive(),
                     })).default([]),
  weight_per_case_kg: z.number().nonnegative().optional(),
}).strict()

const WholesaleInvoiceData = z.object({
  eway_bill_no:       z.string().optional(),
  delivery_challan_id:z.string().uuid().optional(),
  lr_number:          z.string().optional(),    // Lorry Receipt — required for transport insurance claims
  dispatch_date:      z.string().optional(),
  payment_terms:      z.enum(['immediate','7_days','15_days','30_days','45_days','60_days']).default('immediate'),
  credit_days:        z.number().int().min(0).max(180).default(0),
  salesman_id:        z.string().uuid().optional(),
  vehicle_no:         z.string().optional(),
  transporter_name:   z.string().optional(),
}).strict()

const WholesaleItemMeta = z.object({
  cases_qty:   z.number().optional(),
  loose_qty:   z.number().optional(),
}).strict()

// ── Sweet shop ────────────────────────────────────────────────────────────────
const SweetShopProductAttrs = z.object({
  sold_by:          z.enum(['weight','piece','box']).default('weight'),
  rate_per_unit:    z.enum(['kg','100g','piece']).default('kg'),
  shelf_life_hrs:   z.number().int().positive().optional(),
  production_unit:  z.enum(['kg','batch','piece']).default('kg'),
  box_eligible:     z.boolean().default(true),
  festive_only:     z.boolean().default(false),
  contains_dairy:   z.boolean().default(true),    // allergy labelling
  contains_nuts:    z.boolean().default(false),
  ingredients:      z.array(z.string()).default([]),
}).strict()

const SweetShopInvoiceData = z.object({
  is_advance_order:      z.boolean().default(false),
  occasion:              z.enum(['diwali','eid','wedding','birthday','holi','other','none']).default('none'),
  is_gift_wrapped:       z.boolean().default(false),
  delivery_date:         z.string().optional(),
  advance_paid:          z.number().nonnegative().default(0),
}).strict()

const SweetShopItemMeta = z.object({
  gross_weight_g:        z.number().positive().optional(),
  tare_weight_g:         z.number().min(0).default(0),
  net_weight_g:          z.number().positive().optional(),
  scale_reading:         z.string().optional(),
  production_batch_time: z.string().optional(),
}).strict().refine(
  (d) => {
    if (d.gross_weight_g && d.net_weight_g) {
      return Math.abs(d.net_weight_g - (d.gross_weight_g - d.tare_weight_g)) < 0.01
    }
    return true
  },
  { message: 'net_weight_g must equal gross_weight_g minus tare_weight_g' }
)

// ── Electronics ───────────────────────────────────────────────────────────────
const ElectronicsProductAttrs = z.object({
  brand:              z.string().max(100).optional(),
  model_no:           z.string().max(100).optional(),
  warranty_months:    z.number().int().min(0).max(120).default(0),
  serial_trackable:   z.boolean().default(false),
  has_imei:           z.boolean().default(false),
  has_mac_address:    z.boolean().default(false),
  voltage_spec:       z.string().max(50).optional(),          // e.g. "230V AC 50Hz"
  color_variants:     z.array(z.string()).default([]),
  storage_variants:   z.array(z.string()).default([]),         // e.g. ["64GB","128GB"]
  category:           z.enum([
                        'mobile', 'laptop', 'tablet', 'tv', 'appliance',
                        'accessories', 'networking', 'printer', 'camera', 'other'
                      ]).default('other'),
  country_of_origin:  z.string().max(50).optional(),
  hsn_code:           z.string().max(8).optional(),
}).strict()

const ElectronicsInvoiceData = z.object({
  is_demo_unit:         z.boolean().default(false),
  extended_warranty:    z.boolean().default(false),
  insurance_opted:      z.boolean().default(false),
  old_device_exchange:  z.boolean().default(false),   // trade-in offer
  exchange_device_desc: z.string().max(200).optional(),
  exchange_value:       z.number().nonnegative().default(0),
  activation_done:      z.boolean().default(false),   // SIM/device activation completed in-store
}).strict()

const ElectronicsItemMeta = z.object({
  serial_numbers:   z.array(z.string()).default([]),   // one per qty sold
  imei_numbers:     z.array(z.string()).default([]),
  mac_addresses:    z.array(z.string()).default([]),
  warranty_card_no: z.string().optional(),
  warranty_expiry:  z.string().optional(),             // ISO date
  color:            z.string().optional(),
  storage:          z.string().optional(),
}).strict()

// ── Clinic / Doctor / Diagnostic ─────────────────────────────────────────────
const ClinicProductAttrs = z.object({
  service_type:       z.enum(['consultation','procedure','lab_test','imaging','vaccination','other']).default('consultation'),
  duration_min:       z.number().int().min(5).max(240).optional(),
  requires_doctor:    z.boolean().default(true),
  department:         z.enum(['general','dental','eye','ortho','gynec','paeds','derm','physio','other']).default('general'),
  lab_report_hrs:     z.number().int().min(0).optional(),  // TAT for lab tests
  fasting_required:   z.boolean().default(false),
}).strict()

const ClinicInvoiceData = z.object({
  patient_id:           z.string().uuid().optional(),
  patient_name:         z.string().max(100).optional(),
  patient_age:          z.number().int().min(0).max(150).optional(),
  patient_gender:       z.enum(['M','F','O']).optional(),
  doctor_id:            z.string().uuid().optional(),
  visit_type:           z.enum(['opd','ipd','emergency','teleconsult','follow_up']).default('opd'),
  follow_up_date:       z.string().optional(),              // printed on receipt — patients expect it
  insurance_provider:   z.string().max(100).optional(),
  insurance_policy_no:  z.string().optional(),
  cashless_insurance:   z.boolean().default(false),         // TPA cashless claim — different billing workflow
  tpa_name:             z.string().max(100).optional(),
  referral_doctor:      z.string().max(100).optional(),
  diagnosis_notes:      z.string().max(500).optional(),
}).strict()

const ClinicItemMeta = z.object({
  conducted_by:       z.string().uuid().optional(),   // staff/doctor who performed
  report_ready:       z.boolean().default(false),
  report_url:         z.string().optional(),
}).strict()

// ── Optical / Eyewear store ───────────────────────────────────────────────────
const OpticalProductAttrs = z.object({
  product_type:       z.enum(['frame','lens','contact_lens','solution','accessory']).default('frame'),
  brand:              z.string().max(100).optional(),
  material:           z.string().max(50).optional(),       // e.g. acetate, TR90, titanium
  frame_shape:        z.string().max(50).optional(),
  frame_color:        z.string().max(50).optional(),
  lens_type:          z.enum(['single_vision','bifocal','progressive','photochromic','blue_cut']).optional(),
  di_value:           z.enum(['1.50','1.56','1.61','1.67','1.74']).optional(),  // refractive index — determines price and thickness
  coating:            z.array(z.string()).default([]),      // e.g. AR, UV400, scratch-resistant
  size:               z.string().max(30).optional(),       // e.g. 52-18-140
  warranty_months:    z.number().int().min(0).default(12),
}).strict()

const OpticalInvoiceData = z.object({
  prescription_id:    z.string().uuid().optional(),
  patient_name:       z.string().max(100).optional(),
  right_sph:          z.number().optional(),
  right_cyl:          z.number().optional(),
  right_axis:         z.number().int().min(0).max(180).optional(),
  right_add:          z.number().optional(),
  left_sph:           z.number().optional(),
  left_cyl:           z.number().optional(),
  left_axis:          z.number().int().min(0).max(180).optional(),
  left_add:           z.number().optional(),
  pd:                 z.string().max(20).optional(),      // distance pupillary distance
  near_pd:            z.string().max(20).optional(),      // near PD — required for bifocal/progressive lenses
  frame_trial_done:   z.boolean().default(false),         // liability protection
  optometrist_id:     z.string().uuid().optional(),
  delivery_date:      z.string().optional(),
  advance_paid:       z.number().nonnegative().default(0),
}).strict()

const OpticalItemMeta = z.object({
  lens_power_r:       z.string().optional(),
  lens_power_l:       z.string().optional(),
  fitting_notes:      z.string().optional(),
}).strict()

// ── Jewellery ─────────────────────────────────────────────────────────────────
const JewelleryProductAttrs = z.object({
  metal:              z.enum(['gold','silver','platinum','diamond','other']).default('gold'),
  purity:             z.string().max(20).optional(),   // e.g. 22K, 18K, 925 silver
  hsn_code:           z.string().max(8).optional(),    // 7113/7114/7116 — affects GST rate
  category:           z.enum(['necklace','ring','earring','bracelet','bangle','pendant','chain','other']).default('other'),
  gross_weight_g:     z.number().nonnegative().optional(),
  net_weight_g:       z.number().nonnegative().optional(),
  stone_weight_ct:    z.number().nonnegative().optional(),
  stone_type:         z.string().max(50).optional(),
  stone_certificate_no: z.string().optional(),         // GIA/IGI cert for diamonds ≥0.5ct
  bis_hallmark_uid:   z.string().max(10).optional(),   // BIS HUID — mandatory since June 2021
  hallmark_no:        z.string().optional(),
  is_studded:         z.boolean().default(false),
  making_charge_type: z.enum(['per_gram','pct','fixed']).default('per_gram'),
  making_charge_value:z.number().nonnegative().default(0),
}).strict()

const JewelleryInvoiceData = z.object({
  gold_rate_today:    z.number().positive().optional(),   // per gram on date of sale
  silver_rate_today:  z.number().positive().optional(),
  is_old_gold_exchange: z.boolean().default(false),
  old_gold_weight_g:  z.number().nonnegative().default(0),
  old_gold_rate:      z.number().nonnegative().default(0),
  old_gold_deduction: z.number().nonnegative().default(0),
  hallmarking_charges:z.number().nonnegative().default(0),
  is_repair:          z.boolean().default(false),         // repair billing: GST only on making, not on gold
  karigar_name:       z.string().max(100).optional(),
  is_advance_order:   z.boolean().default(false),
  delivery_date:      z.string().optional(),
  advance_paid:       z.number().nonnegative().default(0),
}).strict()

const JewelleryItemMeta = z.object({
  tag_no:             z.string().optional(),
  gross_weight_g:     z.number().nonnegative().optional(),
  net_weight_g:       z.number().nonnegative().optional(),
  stone_weight_ct:    z.number().nonnegative().optional(),
  making_charge_amt:  z.number().nonnegative().optional(),
  wastage_pct:        z.number().min(0).max(20).default(0),
}).strict()

// ── Automobile Workshop / Garage ──────────────────────────────────────────────
const AutomobileProductAttrs = z.object({
  part_type:          z.enum(['spare_part','consumable','tyre','battery','oil','labour','service_package','other']).default('spare_part'),
  brand:              z.string().max(100).optional(),
  oem_part_no:        z.string().optional(),
  compatible_models:  z.array(z.string()).default([]),
  vehicle_type:       z.enum(['car','bike','truck','bus','three_wheeler','tractor','other']).optional(),
  warranty_months:    z.number().int().min(0).default(0),
  is_labour:          z.boolean().default(false),
}).strict()

const AutomobileInvoiceData = z.object({
  customer_vehicle_id:z.string().uuid().optional(),    // link to vehicles table for service history
  vehicle_reg_no:     z.string().max(20).optional(),
  vehicle_make:       z.string().max(50).optional(),
  vehicle_model:      z.string().max(50).optional(),
  vehicle_year:       z.number().int().min(1990).max(2030).optional(),
  fuel_type:          z.enum(['petrol','diesel','cng','electric','hybrid']).optional(),
  odometer_in:        z.number().int().nonnegative().optional(),
  odometer_out:       z.number().int().nonnegative().optional(),
  job_card_no:        z.string().optional(),
  technician_id:      z.string().uuid().optional(),
  next_service_km:    z.number().int().optional(),
  next_service_date:  z.string().optional(),
  insurance_claim:    z.boolean().default(false),
  insurance_company:  z.string().optional(),
  claim_no:           z.string().optional(),
}).strict()

const AutomobileItemMeta = z.object({
  part_serial_no:     z.string().optional(),
  old_part_returned:  z.boolean().default(false),
  labour_hrs:         z.number().nonnegative().optional(),
  technician_id:      z.string().uuid().optional(),
}).strict()

// ── Textile / Fabric store ────────────────────────────────────────────────────
const TextileProductAttrs = z.object({
  fabric_type:        z.enum(['cotton','silk','polyester','wool','linen','rayon','blended','other']).default('cotton'),
  sold_by:            z.enum(['meter','yard','piece','kg']).default('meter'),
  width_cm:           z.number().positive().optional(),
  gsm:                z.number().int().positive().optional(),   // grams per square meter
  color:              z.string().max(100).optional(),
  pattern:            z.enum(['plain','printed','embroidered','checked','striped','other']).default('plain'),
  shrinkage_pct:      z.number().min(0).max(30).optional(),    // cotton shrinks 3–5% — affects how much to buy
  care_instructions:  z.string().max(200).optional(),
  design_code:        z.string().max(50).optional(),
  lot_no:             z.string().optional(),
  country_of_origin:  z.string().max(50).optional(),
}).strict()

const TextileInvoiceData = z.object({
  is_job_work:        z.boolean().default(false),  // e.g. stitching, embroidery job
  stitching_charges:  z.number().nonnegative().default(0),  // stitching alongside fabric sale — separate line
  delivery_date:      z.string().optional(),
  is_wholesale:       z.boolean().default(false),
  piece_count:        z.number().int().positive().optional(),
}).strict()

const TextileItemMeta = z.object({
  meters_sold:        z.number().positive().optional(),
  cut_length_m:       z.number().positive().optional(),
  cutting_waste_m:    z.number().nonnegative().optional(),  // tail ends/offcuts — needed for stock reconciliation
  roll_no:            z.string().optional(),
  shade_no:           z.string().optional(),
}).strict()

// ── Hotel / Lodge / Guesthouse ────────────────────────────────────────────────
const HotelProductAttrs = z.object({
  room_category:      z.enum(['standard','deluxe','super_deluxe','suite','dormitory','cottage','villa']).optional(),
  bed_type:           z.enum(['single','double','twin','triple','quad']).optional(),
  floor_no:           z.number().int().min(0).optional(),
  max_occupancy:      z.number().int().min(1).max(10).default(2),
  has_ac:             z.boolean().default(false),
  has_geyser:         z.boolean().default(true),
  has_tv:             z.boolean().default(true),
  meal_plan:          z.enum(['EP','CP','MAP','AP']).default('EP'),  // European/Continental/Modified American/American
  amenities:          z.array(z.string()).default([]),
  service_type:       z.enum(['room','restaurant','laundry','minibar','spa','conference','other']).default('room'),
}).strict()

const HotelInvoiceData = z.object({
  folio_no:           z.string().optional(),
  check_in:           z.string().optional(),   // ISO datetime
  check_out:          z.string().optional(),
  room_no:            z.string().optional(),
  guest_name:         z.string().max(100).optional(),
  nationality:        z.string().max(60).optional(),    // Foreigners Act 1946 — Form C mandatory for foreign nationals
  form_c_filed:       z.boolean().default(false),       // Form C submitted to local police station
  id_type:            z.enum(['aadhar','passport','driving_license','voter_id','other']).optional(),
  id_number:          z.string().optional(),
  adults:             z.number().int().min(1).default(1),
  children:           z.number().int().min(0).default(0),
  booking_source:     z.enum(['walk_in','phone','ota_makemytrip','ota_goibibo','ota_booking','ota_agoda','corporate','direct_web']).default('walk_in'),
  booking_ref:        z.string().optional(),
  gst_category:       z.enum(['exempt','12_pct','18_pct']).optional(),  // determined by room tariff; overrides auto-calc if set
  state_of_supply:    z.string().max(2).optional(),     // 2-char state code — drives IGST vs CGST+SGST split
  advance_paid:       z.number().nonnegative().default(0),
}).strict()

const HotelItemMeta = z.object({
  night_count:        z.number().int().positive().optional(),
  date:               z.string().optional(),  // for day-wise charges
}).strict()

// ── Catering / Event billing ──────────────────────────────────────────────────
const CateringProductAttrs = z.object({
  menu_type:          z.enum(['veg','non_veg','jain','vegan','mixed']).default('veg'),
  service_type:       z.enum(['full_catering','snacks','beverages','desserts','setup','decoration','staff','other']).default('full_catering'),
  cuisine:            z.string().max(50).optional(),
  min_plates:         z.number().int().positive().optional(),
  per_head_rate:      z.number().nonnegative().optional(),   // caterers price by head count
  items_per_head:     z.array(z.string()).default([]),        // list of dishes included
  has_service_staff:  z.boolean().default(false),
}).strict()

const CateringInvoiceData = z.object({
  event_type:         z.enum(['wedding','birthday','corporate','pooja','social','conference','other']).default('social'),
  event_date:         z.string().optional(),
  event_venue:        z.string().max(200).optional(),
  pax_count:          z.number().int().positive().optional(),   // number of plates/people
  advance_paid:       z.number().nonnegative().default(0),
  balance_due_date:   z.string().optional(),
  crockery_deposit:   z.number().nonnegative().default(0),     // refundable, not taxable
  delivery_date:      z.string().optional(),
  setup_time:         z.string().optional(),
  is_outdoor:         z.boolean().default(false),
  requires_generator: z.boolean().default(false),
}).strict()

const CateringItemMeta = z.object({
  pax_served:         z.number().int().nonnegative().optional(),
  extra_plates:       z.number().int().nonnegative().default(0),
}).strict()

// ── Coaching center / Tuition ─────────────────────────────────────────────────
const CoachingProductAttrs = z.object({
  course_type:        z.enum(['tuition','crash_course','test_series','workshop','online','competitive','language','other']).default('tuition'),
  subject:            z.string().max(100).optional(),
  standard:           z.string().max(20).optional(),   // e.g. "Class 10", "JEE", "UPSC"
  exam_target:        z.string().max(100).optional(),  // 'JEE Main','JEE Advanced','NEET','UPSC','CA','CET' — more specific than standard
  board:              z.enum(['CBSE','ICSE','SSC','GSEB','RBSE','IB','other']).optional(),
  duration_months:    z.number().int().min(1).optional(),
  sessions_per_week:  z.number().int().min(1).max(7).optional(),
  batch_timing:       z.string().max(100).optional(),   // e.g. "7:00 AM - 9:00 AM"
  medium:             z.enum(['english','hindi','gujarati','marathi','other']).default('english'),
  mode:               z.enum(['offline','online','hybrid']).default('offline'),
}).strict()

const CoachingInvoiceData = z.object({
  student_id:         z.string().uuid().optional(),
  student_name:       z.string().max(100).optional(),
  parent_name:        z.string().max(100).optional(),   // coaching centres bill parents, not students
  parent_phone:       z.string().max(13).optional(),
  batch_id:           z.string().uuid().optional(),
  enrollment_date:    z.string().optional(),
  fee_month:          z.string().optional(),    // e.g. "2024-06" for monthly fees
  installment_no:     z.number().int().positive().optional(),
  total_installments: z.number().int().positive().optional(),
  scholarship_applied:z.boolean().default(false),
  scholarship_pct:    z.number().min(0).max(100).default(0),
  discount_reason:    z.string().optional(),
}).strict()

const CoachingItemMeta = z.object({
  sessions_covered:   z.number().int().nonnegative().optional(),
  period_from:        z.string().optional(),
  period_to:          z.string().optional(),
}).strict()

// ── Printing press / Stationery ───────────────────────────────────────────────
const PrintingProductAttrs = z.object({
  print_type:         z.enum(['offset','digital','screen','flex','branding','packaging','book','notebook','other']).default('digital'),
  paper_gsm:          z.number().int().positive().optional(),
  paper_size:         z.enum(['A4','A3','A2','A1','A0','letter','legal','custom']).default('A4'),
  color_mode:         z.enum(['black_white','single_color','four_color','full_color']).default('full_color'),
  finish:             z.enum(['matte','glossy','laminated','uv_coated','uncoated']).optional(),
  binding:            z.enum(['saddle','perfect','spiral','hardbound','loose']).optional(),
  min_quantity:       z.number().int().positive().optional(),
  is_job_work:        z.boolean().default(false),
}).strict()

const PrintingInvoiceData = z.object({
  job_order_no:       z.string().optional(),
  delivery_date:      z.string().optional(),
  artwork_approved:   z.boolean().default(false),
  proof_approved:     z.boolean().default(false),
  customer_design:    z.boolean().default(true),   // customer provided design
  advance_paid:       z.number().nonnegative().default(0),
  urgency:            z.enum(['normal','urgent','super_urgent']).default('normal'),
}).strict()

const PrintingItemMeta = z.object({
  quantity_ordered:   z.number().int().positive().optional(),
  quantity_delivered: z.number().int().nonnegative().optional(),
  plates_used:        z.number().int().nonnegative().optional(),
  wastage_pct:        z.number().min(0).max(20).default(5),
}).strict()

// ── Laundry / Dry cleaning ────────────────────────────────────────────────────
const LaundryProductAttrs = z.object({
  service_type:       z.enum(['wash','wash_iron','dry_clean','iron','steam','stain_removal','shoe_cleaning','carpet']).default('wash_iron'),
  garment_category:   z.enum(['shirt','trouser','suit','saree','kurta','bedsheet','curtain','blanket','jacket','other']).optional(),
  pricing_mode:       z.enum(['per_piece','per_kg','per_pair']).default('per_piece'),
  express_available:  z.boolean().default(true),
  machine_safe:       z.boolean().default(true),
}).strict()

const LaundryInvoiceData = z.object({
  pickup_date:        z.string().optional(),
  delivery_date:      z.string().optional(),
  pickup_address:     z.string().optional(),
  is_express:         z.boolean().default(false),
  express_surcharge_pct: z.number().min(0).max(100).default(50),
  bag_no:             z.string().optional(),
  total_pieces:       z.number().int().nonnegative().optional(),
  total_weight_kg:    z.number().nonnegative().optional(),
  special_instructions: z.string().max(300).optional(),
}).strict()

const LaundryItemMeta = z.object({
  garment_condition:  z.enum(['good','stained','damaged','minor_damage']).default('good'),
  stain_type:         z.string().optional(),
  pre_existing_damage:z.boolean().default(false),
  tag_id:             z.string().optional(),
}).strict()

// ── Distributor / Enterprise ──────────────────────────────────────────────────
const EnterpriseProductAttrs = z.object({
  hsn_code:              z.string().max(8).optional(),
  brand:                 z.string().max(100).optional(),
  pack_size:             z.string().max(50).optional(),
  case_qty:              z.number().positive().optional(),
  min_order_qty:         z.number().positive().optional(),
  lead_time_days:        z.number().int().min(0).optional(),
  price_tiers:           z.array(z.object({
                           min_qty: z.number().positive(),
                           rate:    z.number().positive(),
                         })).default([]),
  preferred_supplier_id: z.string().uuid().optional(),
  warehouse_location:    z.string().optional(),
  reorder_qty:           z.number().nonnegative().optional(),
  weight_per_unit_kg:    z.number().nonnegative().optional(),
}).strict()

const EnterpriseInvoiceData = z.object({
  po_number:            z.string().optional(),
  eway_bill_no:         z.string().optional(),
  delivery_challan_id:  z.string().uuid().optional(),
  credit_days:          z.number().int().min(0).max(365).default(30),
  salesman_id:          z.string().uuid().optional(),
  vehicle_no:           z.string().optional(),
  transporter_name:     z.string().optional(),
  lr_number:            z.string().optional(),
  dispatch_date:        z.string().optional(),
  payment_terms:        z.enum(['immediate','7_days','15_days','30_days','45_days','60_days']).default('30_days'),
  billing_address_id:   z.string().uuid().optional(),
  shipping_address_id:  z.string().uuid().optional(),
}).strict()

const EnterpriseItemMeta = z.object({
  cases_qty:      z.number().optional(),
  loose_qty:      z.number().optional(),
  batch_no:       z.string().optional(),
  free_qty:       z.number().nonnegative().default(0),
  scheme_disc_pct:z.number().min(0).max(100).default(0),
}).strict()

// ── Tailoring shop ────────────────────────────────────────────────────────────
const TailoringProductAttrs = z.object({
  garment_type:       z.enum(['shirt','trouser','suit','kurta','salwar_kameez','blouse','lehenga','saree_blouse','coat','jacket','other']).optional(),
  fabric_provided_by: z.enum(['customer','shop']).default('customer'),
  lining_required:    z.boolean().default(false),
  interlining_type:   z.enum(['none','light','medium','heavy']).default('none'),
  embroidery:         z.boolean().default(false),
  standard_time_days: z.number().int().positive().optional(),  // typical delivery time for this garment
}).strict()

const TailoringInvoiceData = z.object({
  customer_measurement_id: z.string().uuid().optional(),  // link to saved measurements
  trial_date:              z.string().optional(),          // fitting/trial appointment date
  delivery_date:           z.string().optional(),
  advance_paid:            z.number().nonnegative().default(0),
  fabric_received:         z.boolean().default(false),     // has customer dropped the fabric
  fabric_meters:           z.number().positive().optional(),
  special_instructions:    z.string().max(500).optional(),
}).strict()

const TailoringItemMeta = z.object({
  chest_in:       z.number().positive().optional(),
  waist_in:       z.number().positive().optional(),
  hip_in:         z.number().positive().optional(),
  length_in:      z.number().positive().optional(),
  shoulder_in:    z.number().positive().optional(),
  sleeve_in:      z.number().positive().optional(),
  neck_in:        z.number().positive().optional(),
  inseam_in:      z.number().positive().optional(),
  trial_done:     z.boolean().default(false),
  alteration_note:z.string().max(300).optional(),
}).strict()

// ── CA / Professional services firm ──────────────────────────────────────────
const CAFirmProductAttrs = z.object({
  service_type:   z.enum([
    'itr_filing','gst_filing','gst_registration','tds_return','audit','company_registration',
    'llp_registration','trademark','msme_registration','accounting','payroll','consultation','other'
  ]).optional(),
  billing_mode:   z.enum(['fixed','hourly','retainer']).default('fixed'),
  govt_fee_included: z.boolean().default(false),  // if service price includes govt portal fee
  requires_dsc:   z.boolean().default(false),      // Digital Signature Certificate needed
}).strict()

const CAFirmInvoiceData = z.object({
  client_pan:      z.string().max(10).optional(),
  client_gstin:    z.string().max(15).optional(),
  financial_year:  z.string().max(10).optional(),   // e.g. "2024-25"
  period_from:     z.string().optional(),
  period_to:       z.string().optional(),
  govt_fee_paid:   z.number().nonnegative().default(0),   // portal/MCA/trademark fee paid on behalf of client
  tds_applicable:  z.boolean().default(true),             // Section 194J — 10% TDS on professional fees
  tds_rate_pct:    z.number().min(0).max(30).default(10),
  retainer_month:  z.string().optional(),                 // e.g. "2024-06" for monthly retainer billing
}).strict()

const CAFirmItemMeta = z.object({
  hours_spent:    z.number().positive().optional(),
  staff_name:     z.string().max(100).optional(),   // who handled this task
  ack_number:     z.string().max(50).optional(),    // ITR/GST acknowledgement number — proof of filing
}).strict()

// ── Gas agency / LPG distributor ─────────────────────────────────────────────
const GasAgencyProductAttrs = z.object({
  gas_type:         z.enum(['domestic_lpg','commercial_lpg','png','industrial_gas','auto_lpg']).default('domestic_lpg'),
  cylinder_capacity:z.enum(['5kg','14.2kg','19kg','35kg','47.5kg']).optional(),
  is_refill:        z.boolean().default(true),     // refill vs new connection with cylinder
  omc:              z.enum(['iocl','bpcl','hpcl','other']).optional(),  // oil marketing company
  deposit_amount:   z.number().nonnegative().default(0),  // security deposit per cylinder
}).strict()

const GasAgencyInvoiceData = z.object({
  consumer_no:      z.string().max(20).optional(),    // OMC consumer number
  registered_mobile:z.string().max(13).optional(),    // mobile linked to gas connection
  delivery_boy_name:z.string().max(100).optional(),
  cylinders_qty:    z.number().int().positive().default(1),
  is_new_connection:z.boolean().default(false),
  subsidy_linked:   z.boolean().default(false),       // PAHAL / DBT subsidy active
  advance_booking_id:z.string().optional(),           // OMC booking reference number
  delivery_date:    z.string().optional(),
}).strict()

const GasAgencyItemMeta = z.object({
  cylinder_serial_no: z.string().optional(),   // cylinder barcode / serial
  empty_returned:     z.boolean().default(false),
  tare_weight_kg:     z.number().positive().optional(),  // for commercial — weight-based billing
  net_weight_kg:      z.number().positive().optional(),
}).strict()

// ── Event management / Wedding planner ───────────────────────────────────────
const EventMgmtProductAttrs = z.object({
  service_type:   z.enum([
    'stage','lighting','sound','decoration','photography_coord','venue_booking',
    'catering_coord','mehendi','band','dj','invitation','anchor','other'
  ]).optional(),
  is_rental:      z.boolean().default(false),    // rental equipment vs service
  rental_days:    z.number().int().positive().optional(),
  setup_hrs:      z.number().positive().optional(),
  requires_power: z.boolean().default(false),
  power_kw:       z.number().positive().optional(),
}).strict()

const EventMgmtInvoiceData = z.object({
  event_name:         z.string().max(100).optional(),   // "Sharma Wedding" — for client reference
  event_type:         z.enum(['wedding','reception','engagement','birthday','corporate','pooja','conference','product_launch','other']).default('wedding'),
  event_date:         z.string().optional(),
  event_venue:        z.string().max(200).optional(),
  pax_count:          z.number().int().positive().optional(),
  setup_date:         z.string().optional(),           // one day before event usually
  dismantling_date:   z.string().optional(),
  advance_paid:       z.number().nonnegative().default(0),
  balance_due_date:   z.string().optional(),
  equipment_deposit:  z.number().nonnegative().default(0),  // refundable damage deposit on rental equipment
  coordinator_name:   z.string().max(100).optional(),
  vendor_refs:        z.array(z.string()).default([]),   // other vendors coordinated for this event
}).strict()

const EventMgmtItemMeta = z.object({
  rental_from:        z.string().optional(),   // ISO date
  rental_to:          z.string().optional(),
  damage_noted:       z.boolean().default(false),
  damage_description: z.string().max(300).optional(),
}).strict()

// ── Veterinary clinic / Pet store ─────────────────────────────────────────────
const VeterinaryProductAttrs = z.object({
  service_type:   z.enum([
    'consultation','vaccination','surgery','grooming','deworming','dental',
    'x_ray','blood_test','microchipping','boarding','food','medicine','accessory','other'
  ]).optional(),
  species:        z.enum(['dog','cat','bird','rabbit','fish','cattle','horse','other']).optional(),
  requires_rx:    z.boolean().default(false),   // prescription medicines for animals
  vaccine_brand:  z.string().max(100).optional(),
  dose_per_kg:    z.number().positive().optional(),  // weight-based dosing for medicines
}).strict()

const VeterinaryInvoiceData = z.object({
  patient_name:     z.string().max(100).optional(),   // pet name
  species:          z.enum(['dog','cat','bird','rabbit','fish','cattle','horse','other']).optional(),
  breed:            z.string().max(100).optional(),
  age_years:        z.number().min(0).optional(),
  weight_kg:        z.number().positive().optional(),  // needed for dose calculation
  owner_name:       z.string().max(100).optional(),
  owner_phone:      z.string().max(13).optional(),
  vet_name:         z.string().max(100).optional(),
  next_visit_date:  z.string().optional(),             // next vaccination / checkup date
  diagnosis:        z.string().max(500).optional(),
  vaccination_card_no: z.string().max(50).optional(),
}).strict()

const VeterinaryItemMeta = z.object({
  dose_given_mg:    z.number().positive().optional(),
  batch_no:         z.string().optional(),             // vaccine batch — traceability
  exp_date:         z.string().optional(),
  site_of_injection:z.string().max(50).optional(),     // 'left_hindquarter', 'subcutaneous' etc.
}).strict()

// ── Milk dairy / Daily milk delivery ─────────────────────────────────────────
const MilkDairyProductAttrs = z.object({
  milk_type:      z.enum(['cow','buffalo','toned','double_toned','skimmed','a2','goat','mixed','curd','paneer','ghee','buttermilk','deposit','other']).default('cow'),
  fat_pct:        z.number().min(0).max(10).optional(),    // e.g. 3.5 for toned
  snf_pct:        z.number().min(0).max(15).optional(),    // Solids-Not-Fat
  pack_type:      z.enum(['loose','pouch','bottle_glass','bottle_plastic','tetra']).default('loose'),
  available_slots:z.array(z.enum(['morning','evening'])).default(['morning']),
  price_per_litre:z.number().positive().optional(),
}).strict()

const MilkDairyInvoiceData = z.object({
  subscription_id:     z.string().uuid().optional(),
  billing_month:       z.string().optional(),              // e.g. "2024-06"
  morning_qty_l:       z.number().nonnegative().optional(),
  evening_qty_l:       z.number().nonnegative().optional(),
  delivered_days:      z.number().int().min(0).optional(),
  paused_days:         z.number().int().min(0).default(0),
  bottle_deposit:      z.number().nonnegative().default(0), // refundable — not revenue, do not apply GST
  bottles_issued:      z.number().int().nonnegative().default(0),
  bottles_returned:    z.number().int().nonnegative().default(0),
  advance_paid:        z.number().nonnegative().default(0),
  delivery_address:    z.string().max(300).optional(),
  delivery_boy_name:   z.string().max(100).optional(),
  route_area:          z.string().max(100).optional(),
}).strict()

const MilkDairyItemMeta = z.object({
  slot:            z.enum(['morning','evening']).optional(),
  delivery_date:   z.string().optional(),
  quantity_ml:     z.number().positive().optional(),
  bottle_returned: z.boolean().default(false),
  not_delivered:   z.boolean().default(false),  // holiday / customer absent
}).strict()

// ── Banquet hall / Marriage hall / Party plot ─────────────────────────────────
const BanquetHallProductAttrs = z.object({
  hall_name:          z.string().max(100).optional(),
  capacity_pax:       z.number().int().positive().optional(),
  area_sqft:          z.number().positive().optional(),
  has_ac:             z.boolean().default(false),
  has_parking:        z.boolean().default(true),
  has_kitchen:        z.boolean().default(false),
  power_backup_kva:   z.number().nonnegative().optional(),
  slot_type:          z.enum(['morning','evening','full_day','night','custom']).default('full_day'),
  outside_caterer_allowed: z.boolean().default(true),
  outside_dj_allowed: z.boolean().default(true),
  alcohol_allowed:    z.boolean().default(false),
}).strict()

const BanquetHallInvoiceData = z.object({
  event_type:              z.enum(['wedding','reception','engagement','birthday','corporate','pooja','conference','other']).default('wedding'),
  event_date:              z.string().optional(),
  slot:                    z.enum(['morning','evening','full_day','night','custom']).default('full_day'),
  slot_from:               z.string().optional(),   // time e.g. "09:00"
  slot_to:                 z.string().optional(),
  pax_count:               z.number().int().positive().optional(),
  advance_paid:            z.number().nonnegative().default(0),
  balance_due_date:        z.string().optional(),
  security_deposit:        z.number().nonnegative().default(0),   // refundable damage deposit
  cancellation_policy_days:z.number().int().min(0).optional(),    // forfeit advance if cancelled within these many days
  catering_package_id:     z.string().uuid().optional(),          // if in-house catering is bundled
  add_ons:                 z.array(z.object({
    name:  z.string(),
    price: z.number().nonnegative(),
  })).default([]),   // generator, extra parking, stage, projector etc.
}).strict()

const BanquetHallItemMeta = z.object({
  hall_id:          z.string().uuid().optional(),   // which specific hall if venue has multiple
  add_on_type:      z.string().max(50).optional(),  // 'generator','extra_time','changing_room'
  hours_used:       z.number().positive().optional(),
}).strict()

// ── Real estate / Property rental / Broker ────────────────────────────────────
const RealEstateProductAttrs = z.object({
  property_type:    z.enum(['flat','house','plot','shop','office','warehouse','villa','pg','other']).optional(),
  listing_type:     z.enum(['sale','rent','lease','pg']).default('rent'),
  area_sqft:        z.number().positive().optional(),
  area_unit:        z.enum(['sqft','sqyd','acre','gunta','marla']).default('sqft'),
  floor_no:         z.number().int().min(-2).optional(),
  facing:           z.enum(['north','south','east','west','north_east','north_west','south_east','south_west']).optional(),
  furnished:        z.enum(['unfurnished','semi_furnished','fully_furnished']).default('unfurnished'),
  bhk:              z.string().max(10).optional(),   // "2BHK", "3BHK", "Studio"
  locality:         z.string().max(200).optional(),
}).strict()

const RealEstateInvoiceData = z.object({
  billing_mode:        z.enum(['brokerage','rent','maintenance','lease']).default('rent'),
  property_address:    z.string().max(300).optional(),
  landlord_name:       z.string().max(100).optional(),
  tenant_name:         z.string().max(100).optional(),
  tenant_gstin:        z.string().max(15).optional(),
  billing_month:       z.string().optional(),              // "2024-06" for rent invoices
  agreement_from:      z.string().optional(),
  agreement_to:        z.string().optional(),
  // Rent billing
  monthly_rent:        z.number().nonnegative().optional(),
  maintenance_charges: z.number().nonnegative().default(0),
  late_fee:            z.number().nonnegative().default(0),
  // TDS — Section 194I: tenant deducts 10% if monthly rent > ₹50,000
  tds_applicable:      z.boolean().default(false),
  tds_rate_pct:        z.number().min(0).max(30).default(10),
  tds_amount:          z.number().nonnegative().default(0), // TDS deducted by tenant — reduce from payable
  // Brokerage
  commission_pct:      z.number().min(0).max(5).optional(),
  commission_amount:   z.number().nonnegative().optional(),
  // Non-revenue (never apply GST on these)
  security_deposit:    z.number().nonnegative().default(0),
  security_deposit_returned: z.boolean().default(false),
}).strict()

const RealEstateItemMeta = z.object({
  property_ref_no:   z.string().max(50).optional(),
  registration_no:   z.string().max(50).optional(),   // sale deed / lease registration number
  stamp_duty_paid:   z.number().nonnegative().optional(),
  cheque_no:         z.string().max(30).optional(),   // rent is often paid by cheque
}).strict()

// ── Water supplier / RO water / Tanker ───────────────────────────────────────
const WaterSupplierProductAttrs = z.object({
  water_type:       z.enum(['ro','mineral','plain','alkaline']).default('ro'),
  can_capacity_l:   z.enum(['5','10','20','25']).optional(),
  dispensing_type:  z.enum(['can','tanker','pipeline']).default('can'),
  tds_ppm:          z.number().int().nonnegative().optional(),  // TDS level — selling point for RO
  deposit_per_can:  z.number().nonnegative().default(0),
}).strict()

const WaterSupplierInvoiceData = z.object({
  subscription_id:  z.string().uuid().optional(),
  billing_month:    z.string().optional(),
  cans_delivered:   z.number().int().nonnegative().optional(),
  cans_returned:    z.number().int().nonnegative().optional(),
  can_deposit:      z.number().nonnegative().default(0),   // refundable — not revenue
  tanker_litres:    z.number().positive().optional(),       // for tanker delivery
  delivery_address: z.string().max(300).optional(),
  delivery_boy_name:z.string().max(100).optional(),
  route_area:       z.string().max(100).optional(),
  advance_paid:     z.number().nonnegative().default(0),
}).strict()

const WaterSupplierItemMeta = z.object({
  delivery_date:    z.string().optional(),
  can_serial_no:    z.string().optional(),
  empty_returned:   z.boolean().default(false),
  not_delivered:    z.boolean().default(false),
}).strict()

// ── Driving school ────────────────────────────────────────────────────────────
const DrivingSchoolProductAttrs = z.object({
  course_type:          z.enum(['4wheeler','2wheeler','heavy_vehicle','learner_licence','refresher','defensive']).optional(),
  vehicle_type:         z.enum(['car','bike','scooter','truck','bus','auto']).optional(),
  sessions_count:       z.number().int().positive().optional(),
  duration_days:        z.number().int().positive().optional(),
  includes_rto_assist:  z.boolean().default(false),   // RTO form filling and test escort
  includes_ll:          z.boolean().default(false),   // Learner's Licence fee included
}).strict()

const DrivingSchoolInvoiceData = z.object({
  student_name:     z.string().max(100).optional(),
  student_dob:      z.string().optional(),
  aadhar_no:        z.string().max(12).optional(),  // required for DL application
  instructor_name:  z.string().max(100).optional(),
  vehicle_no:       z.string().max(20).optional(),  // training vehicle registration
  ll_no:            z.string().max(30).optional(),  // Learner's Licence number
  dl_test_date:     z.string().optional(),
  dl_obtained:      z.boolean().default(false),
  advance_paid:     z.number().nonnegative().default(0),
}).strict()

const DrivingSchoolItemMeta = z.object({
  session_date:       z.string().optional(),
  session_duration_min:z.number().int().positive().optional(),
  area_covered:       z.string().max(100).optional(),  // 'highway','city','parking' etc.
  remarks:            z.string().max(200).optional(),
}).strict()

// ── Interior contractor / Renovation ─────────────────────────────────────────
const InteriorContractorProductAttrs = z.object({
  work_type:    z.enum(['civil','electrical','plumbing','carpentry','painting','false_ceiling','flooring','tiling','glass','full_interior','other']).optional(),
  billing_mode: z.enum(['per_sqft','lumpsum','boq','milestone']).default('lumpsum'),
  material_included: z.boolean().default(true),   // labour+material vs labour only
}).strict()

const InteriorContractorInvoiceData = z.object({
  project_name:         z.string().max(100).optional(),
  site_address:         z.string().max(300).optional(),
  architect_name:       z.string().max(100).optional(),
  total_project_value:  z.number().positive().optional(),
  milestone_no:         z.number().int().positive().optional(),
  milestone_name:       z.string().max(100).optional(),   // e.g. "Slab casting complete"
  work_completion_pct:  z.number().min(0).max(100).optional(),
  retention_pct:        z.number().min(0).max(20).default(0),  // % held back until full completion
  tds_applicable:       z.boolean().default(true),   // Section 194C — 1% individual, 2% company
  tds_rate_pct:         z.number().min(0).max(10).default(1),
  advance_paid:         z.number().nonnegative().default(0),
  balance_due_date:     z.string().optional(),
}).strict()

const InteriorContractorItemMeta = z.object({
  boq_item_code:  z.string().max(30).optional(),
  area_sqft:      z.number().positive().optional(),
  unit:           z.string().max(20).optional(),   // sqft, rft, nos, kg
  rate_per_unit:  z.number().positive().optional(),
}).strict()

// ── Packers and movers ────────────────────────────────────────────────────────
const PackersMoversProductAttrs = z.object({
  service_type:   z.enum(['packing','loading','transport','unloading','unpacking','storage','full_service','bike_carrier']).optional(),
  vehicle_type:   z.enum(['mini_tempo','tempo','truck_14ft','truck_17ft','truck_20ft','container','other']).optional(),
  move_type:      z.enum(['local','intercity','interstate','international']).default('local'),
}).strict()

const PackersMoversInvoiceData = z.object({
  from_address:         z.string().max(300).optional(),
  to_address:           z.string().max(300).optional(),
  from_city:            z.string().max(100).optional(),
  to_city:              z.string().max(100).optional(),
  move_date:            z.string().optional(),
  distance_km:          z.number().positive().optional(),
  goods_description:    z.string().max(300).optional(),
  insurance_value:      z.number().nonnegative().default(0),   // declared value for transit insurance
  insurance_premium:    z.number().nonnegative().default(0),
  toll_charges:         z.number().nonnegative().default(0),
  packing_material_charges: z.number().nonnegative().default(0),
  loading_charges:      z.number().nonnegative().default(0),
  storage_days:         z.number().int().nonnegative().optional(),
  advance_paid:         z.number().nonnegative().default(0),
}).strict()

const PackersMoversItemMeta = z.object({
  item_description: z.string().max(100).optional(),
  quantity:         z.number().int().positive().optional(),
  is_fragile:       z.boolean().default(false),
  packing_type:     z.enum(['standard','bubble_wrap','wooden_crate','custom']).default('standard'),
  damage_noted:     z.boolean().default(false),
}).strict()

// ── Security agency ───────────────────────────────────────────────────────────
const SecurityAgencyProductAttrs = z.object({
  service_type:   z.enum(['static_guard','mobile_patrol','cctv_monitoring','event_security','lady_guard','armed_guard','dog_squad']).optional(),
  shift_hours:    z.enum(['8','12','24']).default('8'),
  armed:          z.boolean().default(false),
  ex_serviceman:  z.boolean().default(false),
}).strict()

const SecurityAgencyInvoiceData = z.object({
  client_site:            z.string().max(200).optional(),
  billing_month:          z.string().optional(),
  guards_deployed:        z.number().int().positive().optional(),
  shifts_per_guard:       z.number().int().positive().default(1),
  attendance_days:        z.number().int().min(0).optional(),
  overtime_hrs:           z.number().nonnegative().default(0),
  esic_pf_included:       z.boolean().default(true),   // statutory — ESIC + PF on wages
  management_charges_pct: z.number().min(0).max(30).default(10),
  leave_deduction:        z.number().nonnegative().default(0),
  advance_paid:           z.number().nonnegative().default(0),
}).strict()

const SecurityAgencyItemMeta = z.object({
  guard_name:       z.string().max(100).optional(),
  post:             z.string().max(100).optional(),   // 'Main Gate', 'Parking', 'Night Patrol'
  shift:            z.enum(['day','night','general']).optional(),
  attendance_days:  z.number().int().min(0).optional(),
}).strict()

// ── Crèche / Daycare ─────────────────────────────────────────────────────────
const CrecheDaycareProductAttrs = z.object({
  service_type:   z.enum(['full_day','half_day','hourly','after_school','holiday_camp','playgroup']).optional(),
  age_group:      z.enum(['infant_0_1','toddler_1_3','preschool_3_5','school_age_5_12']).optional(),
  includes_meals: z.boolean().default(true),
  includes_transport: z.boolean().default(false),
  curriculum:     z.enum(['play_based','montessori','activity_based','none']).default('play_based'),
}).strict()

const CrecheDaycareInvoiceData = z.object({
  child_name:       z.string().max(100).optional(),
  child_dob:        z.string().optional(),
  parent_name:      z.string().max(100).optional(),
  parent_phone:     z.string().max(13).optional(),
  emergency_contact:z.string().max(13).optional(),
  billing_month:    z.string().optional(),
  attendance_days:  z.number().int().min(0).optional(),
  meal_charges:     z.number().nonnegative().default(0),
  transport_charges:z.number().nonnegative().default(0),
  late_pickup_fee:  z.number().nonnegative().default(0),
  advance_paid:     z.number().nonnegative().default(0),
  annual_fee:       z.number().nonnegative().default(0),   // one-time admission / annual charges
}).strict()

const CrecheDaycareItemMeta = z.object({
  date:           z.string().optional(),
  check_in:       z.string().optional(),
  check_out:      z.string().optional(),
  meal_provided:  z.boolean().default(true),
  activity_note:  z.string().max(200).optional(),
}).strict()

// ── Dance / Music school ──────────────────────────────────────────────────────
const DanceMusicSchoolProductAttrs = z.object({
  art_form:       z.enum([
    'bharatnatyam','kathak','classical_vocal','hindustani','carnatic','guitar','keyboard',
    'tabla','violin','flute','western_dance','hip_hop','ballet','drawing','other'
  ]).optional(),
  exam_board:     z.enum(['trinity','abrsm','bharatnatyam_board','rcm','none']).default('none'),
  grade_level:    z.string().max(20).optional(),   // Grade 1, Visharad, Intermediate
  sessions_per_week:z.number().int().min(1).max(7).optional(),
  session_min:    z.number().int().min(15).max(120).optional(),
  mode:           z.enum(['offline','online','hybrid']).default('offline'),
}).strict()

const DanceMusicSchoolInvoiceData = z.object({
  student_name:         z.string().max(100).optional(),
  parent_name:          z.string().max(100).optional(),
  parent_phone:         z.string().max(13).optional(),
  batch_id:             z.string().uuid().optional(),
  fee_month:            z.string().optional(),
  installment_no:       z.number().int().positive().optional(),
  exam_fee:             z.number().nonnegative().default(0),
  costume_charges:      z.number().nonnegative().default(0),
  instrument_rental:    z.number().nonnegative().default(0),
  recital_participation:z.boolean().default(false),
  annual_day_fee:       z.number().nonnegative().default(0),
  advance_paid:         z.number().nonnegative().default(0),
}).strict()

const DanceMusicSchoolItemMeta = z.object({
  sessions_attended:  z.number().int().nonnegative().optional(),
  period_from:        z.string().optional(),
  period_to:          z.string().optional(),
}).strict()

// ── Footwear / Shoe store ─────────────────────────────────────────────────────
const FootwearProductAttrs = z.object({
  brand:        z.string().max(100).optional(),
  style:        z.enum(['formal','casual','sports','sandal','slipper','heel','ethnic','boots','kids','safety']).optional(),
  material:     z.enum(['leather','synthetic','canvas','rubber','suede','mesh','other']).optional(),
  size_system:  z.enum(['uk','us','eu','indian']).default('uk'),
  gender:       z.enum(['male','female','kids','unisex']).default('unisex'),
  sole_type:    z.enum(['rubber','leather','tpr','eva','pu','other']).optional(),
  closure:      z.enum(['lace','velcro','slip_on','buckle','zip']).optional(),
  waterproof:   z.boolean().default(false),
}).strict()

const FootwearInvoiceData = z.object({
  is_exchange:      z.boolean().default(false),
  exchange_value:   z.number().nonnegative().default(0),
  source:           z.enum(['pos','online_order','manual']).default('pos'),
}).strict()

const FootwearItemMeta = z.object({
  size:         z.string().max(10).optional(),   // "7", "7.5", "EU 41"
  color:        z.string().max(50).optional(),
  width:        z.enum(['narrow','regular','wide']).default('regular'),
  pair_count:   z.number().int().positive().default(1),
}).strict()

// ── Tent house / Party equipment rental ──────────────────────────────────────
const TentHouseProductAttrs = z.object({
  item_type:    z.enum(['tent','shamiana','chair','table','sofa','lighting','stage','generator','crockery','cooler','heater','carpet','flower_decoration','backdrop','other']).optional(),
  material:     z.string().max(50).optional(),
  capacity_pax: z.number().int().positive().optional(),  // for tents/shamianas
  power_kva:    z.number().positive().optional(),         // for generators
  is_consumable:z.boolean().default(false),               // flowers, disposables — not returned
}).strict()

const TentHouseInvoiceData = z.object({
  event_type:         z.enum(['wedding','birthday','corporate','pooja','political','other']).default('wedding'),
  event_date:         z.string().optional(),
  delivery_date:      z.string().optional(),
  return_date:        z.string().optional(),
  event_address:      z.string().max(300).optional(),
  distance_km:        z.number().nonnegative().optional(),
  setup_required:     z.boolean().default(true),
  dismantling_required:z.boolean().default(true),
  transport_charges:  z.number().nonnegative().default(0),
  labour_charges:     z.number().nonnegative().default(0),
  damage_deposit:     z.number().nonnegative().default(0),  // refundable
  advance_paid:       z.number().nonnegative().default(0),
}).strict()

const TentHouseItemMeta = z.object({
  quantity_issued:    z.number().int().positive().optional(),
  quantity_returned:  z.number().int().nonnegative().optional(),
  quantity_damaged:   z.number().int().nonnegative().default(0),
  damage_description: z.string().max(300).optional(),
  damage_charge:      z.number().nonnegative().default(0),
}).strict()

// =============================================================================
// DOMAIN REGISTRY — the single config object all layers read from
// =============================================================================
export const DOMAIN_REGISTRY = {
  retail: {
    label:              'Retail / Kirana / General store',
    productAttrsSchema: RetailProductAttrs,
    invoiceDataSchema:  RetailInvoiceData,
    itemMetaSchema:     RetailItemMeta,
    defaultDomainConfig: {
      udhaar_enabled:    true,
      barcode_scan_first:true,
      quick_billing_mode:true,
      low_stock_alert:   true,
      offline_first:     true,
    },
    extensionTables: [] as string[],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
      hasLoyalty:       true,
      hasHomeDelivery:  true,
    },
  },

  restaurant: {
    label:              'Restaurant / QSR / Cloud kitchen',
    productAttrsSchema: RestaurantProductAttrs,
    invoiceDataSchema:  RestaurantInvoiceData,
    itemMetaSchema:     RestaurantItemMeta,
    defaultDomainConfig: {
      has_tables:       true,
      table_count:      10,
      has_kot:          true,
      kot_stations:     ['hot_kitchen','cold','drinks'],
      gst_rate_dine_in: 5,
      has_takeaway:     true,
    },
    extensionTables: ['kot_orders','restaurant_tables','modifier_groups'],
    features: {
      hasBatches:        false,
      hasAppointments:   false,
      hasKOT:            true,
      hasWeightBilling:  false,
      hasUdhaar:         false,
      hasEwayBill:       false,
      hasCommission:     false,
      hasShiftReport:    true,
      hasJobCard:        false,
      hasSubscription:   false,
      hasNozzleReading:  false,
      hasBrands:         false,
      hasLoyalty:        true,
      hasHomeDelivery:   true,
      hasParcelCharges:  true,
    },
  },

  pharmacy: {
    label:              'Pharmacy / Medical store',
    productAttrsSchema: PharmacyProductAttrs,
    invoiceDataSchema:  PharmacyInvoiceData,
    itemMetaSchema:     PharmacyItemMeta,
    defaultDomainConfig: {
      track_batches:             true,
      enforce_fefo:              true,
      require_rx_for_schedule_h: true,
      mrp_cap_enabled:           true,
      suggest_generics:          true,
      expiry_alert_days:         30,
    },
    extensionTables: ['batches','pharmacy_prescriptions'],
    features: {
      hasBatches:           true,
      hasAppointments:      false,
      hasKOT:               false,
      hasWeightBilling:     false,
      hasUdhaar:            true,
      hasEwayBill:          false,
      hasCommission:        false,
      hasShiftReport:       false,
      hasJobCard:           false,
      hasSubscription:      false,
      hasNozzleReading:     false,
      hasBrands:            true,
      hasNarcoticsRegister: true,   // Schedule X drugs require separate narcotic register
      hasLoyalty:           false,
      hasHomeDelivery:      false,
    },
  },

  salon: {
    label:              'Salon / Spa / Beauty parlour',
    productAttrsSchema: SalonProductAttrs,
    invoiceDataSchema:  SalonInvoiceData,
    itemMetaSchema:     SalonItemMeta,
    defaultDomainConfig: {
      has_appointments:  true,
      slot_duration_min: 15,
      commission_enabled:true,
      default_commission_pct: 10,
      has_membership:    true,
    },
    extensionTables: ['appointments','staff','memberships'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    true,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  true,   // prepaid membership = subscription pattern
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       true,
      hasHomeDelivery:  false,
    },
  },

  wholesale: {
    label:              'Wholesale / Distributor / B2B',
    productAttrsSchema: WholesaleProductAttrs,
    invoiceDataSchema:  WholesaleInvoiceData,
    itemMetaSchema:     WholesaleItemMeta,
    defaultDomainConfig: {
      eway_bill:         true,
      credit_terms:      true,
      default_credit_days: 30,
      has_salesman:      true,
    },
    extensionTables: ['delivery_challans','eway_bills'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      true,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  electronics: {
    label:              'Electronics / Mobile / Appliance store',
    productAttrsSchema: ElectronicsProductAttrs,
    invoiceDataSchema:  ElectronicsInvoiceData,
    itemMetaSchema:     ElectronicsItemMeta,
    defaultDomainConfig: {
      serial_tracking:        true,
      imei_tracking:          true,
      warranty_tracking:      true,
      barcode_scan_first:     true,
      low_stock_alert:        true,
      invoice_prefix:         'EL',
    },
    extensionTables: ['serial_numbers', 'warranty_claims'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      true,
      hasCommission:    true,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
      hasExchange:      true,   // device trade-in / exchange offers
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  enterprise: {
    label:              'Distributor / Enterprise / B2B',
    productAttrsSchema: EnterpriseProductAttrs,
    invoiceDataSchema:  EnterpriseInvoiceData,
    itemMetaSchema:     EnterpriseItemMeta,
    defaultDomainConfig: {
      eway_bill:              true,
      credit_terms:           true,
      default_credit_days:    30,
      has_salesman:           true,
      multi_warehouse:        true,
      po_required:            false,
      price_tiers_enabled:    true,
      payment_terms_enabled:  true,
      tds_enabled:            true,
    },
    extensionTables: ['delivery_challans','eway_bills','purchase_orders','warehouses'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      true,
      hasCommission:    true,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  sweet: {
    label:              'Sweet shop / Mithai / Bakery',
    productAttrsSchema: SweetShopProductAttrs,
    invoiceDataSchema:  SweetShopInvoiceData,
    itemMetaSchema:     SweetShopItemMeta,
    defaultDomainConfig: {
      sold_by_weight:    true,
      has_advance_orders:true,
      perishable_alerts: true,
    },
    extensionTables: ['advance_orders','production_plan'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  true,
    },
  },

  clinic: {
    label:              'Clinic / Doctor / Diagnostic center',
    productAttrsSchema: ClinicProductAttrs,
    invoiceDataSchema:  ClinicInvoiceData,
    itemMetaSchema:     ClinicItemMeta,
    defaultDomainConfig: {
      has_patients:        true,
      has_prescriptions:   true,
      has_appointments:    true,
      slot_duration_min:   15,
      has_lab_reports:     true,
      insurance_billing:   false,
      gst_exempt_services: true,   // healthcare services often exempt
    },
    extensionTables: ['patients','appointments','prescriptions','lab_reports'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasIPD:           true,   // in-patient admission billing
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  optical: {
    label:              'Optical / Eyewear store',
    productAttrsSchema: OpticalProductAttrs,
    invoiceDataSchema:  OpticalInvoiceData,
    itemMetaSchema:     OpticalItemMeta,
    defaultDomainConfig: {
      has_prescriptions:   true,
      has_fitting:         true,
      has_advance_orders:  true,
      warranty_tracking:   true,
      default_advance_pct: 50,
    },
    extensionTables: ['eye_prescriptions','optical_orders'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    true,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  jewellery: {
    label:              'Jewellery / Gold / Silver store',
    productAttrsSchema: JewelleryProductAttrs,
    invoiceDataSchema:  JewelleryInvoiceData,
    itemMetaSchema:     JewelleryItemMeta,
    defaultDomainConfig: {
      live_gold_rate:      true,
      hallmark_required:   true,
      old_gold_exchange:   true,
      making_charges:      true,
      weight_billing:      true,
      has_advance_orders:  true,
    },
    extensionTables: ['gold_rates','hallmark_certs','advance_orders'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    true,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  automobile: {
    label:              'Automobile workshop / Garage / Service center',
    productAttrsSchema: AutomobileProductAttrs,
    invoiceDataSchema:  AutomobileInvoiceData,
    itemMetaSchema:     AutomobileItemMeta,
    defaultDomainConfig: {
      job_card_enabled:    true,
      vehicle_tracking:    true,
      has_technicians:     true,
      spare_parts_stock:   true,
      next_service_reminder: true,
      insurance_claim:     false,
    },
    extensionTables: ['job_cards','vehicles','technicians'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    true,
      hasShiftReport:   true,
      hasJobCard:       true,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
      hasPUC:           true,   // Pollution Under Control certificate reminder upsell
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  textile: {
    label:              'Textile / Fabric / Cloth store',
    productAttrsSchema: TextileProductAttrs,
    invoiceDataSchema:  TextileInvoiceData,
    itemMetaSchema:     TextileItemMeta,
    defaultDomainConfig: {
      sold_by_meter:       true,
      has_job_work:        true,
      lot_tracking:        true,
      barcode_scan_first:  true,
      low_stock_alert:     true,
    },
    extensionTables: ['fabric_lots'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        true,
      hasEwayBill:      true,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  hotel: {
    label:              'Hotel / Lodge / Guesthouse',
    productAttrsSchema: HotelProductAttrs,
    invoiceDataSchema:  HotelInvoiceData,
    itemMetaSchema:     HotelItemMeta,
    defaultDomainConfig: {
      has_rooms:           true,
      has_folio:           true,
      has_restaurant:      true,
      advance_required:    true,
      default_advance_pct: 30,
      gst_rate_ac:         12,    // 12% GST for AC rooms, 0% below ₹1000
      gst_rate_non_ac:     0,
      checkout_time:       '11:00',
    },
    extensionTables: ['rooms','folios','guest_registry','housekeeping'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           true,   // room-service / restaurant
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasGRC:           true,   // Guest Registration Card (Form C for foreign nationals)
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  catering: {
    label:              'Catering / Event / Tiffin service',
    productAttrsSchema: CateringProductAttrs,
    invoiceDataSchema:  CateringInvoiceData,
    itemMetaSchema:     CateringItemMeta,
    defaultDomainConfig: {
      has_advance_orders:  true,
      pax_based_billing:   true,
      default_advance_pct: 50,
      has_event_calendar:  true,
      gst_rate:            5,    // 5% GST on catering
    },
    extensionTables: ['event_bookings','production_plan'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },

  coaching: {
    label:              'Coaching center / Tuition / Institute',
    productAttrsSchema: CoachingProductAttrs,
    invoiceDataSchema:  CoachingInvoiceData,
    itemMetaSchema:     CoachingItemMeta,
    defaultDomainConfig: {
      has_students:        true,
      has_batches:         true,
      installment_billing: true,
      attendance_tracking: true,
      has_test_results:    false,
      gst_exempt:          true,   // educational services exempt up to threshold
    },
    extensionTables: ['students','batches','enrollments','attendance'],
    features: {
      hasBatches:       false,    // product batches — not applicable
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  true,   // installment billing = subscription pattern
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },

  printing: {
    label:              'Printing press / Flex / Packaging',
    productAttrsSchema: PrintingProductAttrs,
    invoiceDataSchema:  PrintingInvoiceData,
    itemMetaSchema:     PrintingItemMeta,
    defaultDomainConfig: {
      job_order_enabled:   true,
      artwork_approval:    true,
      has_advance_orders:  true,
      default_advance_pct: 50,
      paper_stock_tracking:true,
    },
    extensionTables: ['job_orders','artwork_files'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },

  laundry: {
    label:              'Laundry / Dry cleaning',
    productAttrsSchema: LaundryProductAttrs,
    invoiceDataSchema:  LaundryInvoiceData,
    itemMetaSchema:     LaundryItemMeta,
    defaultDomainConfig: {
      has_pickup_delivery: true,
      has_express:         true,
      garment_tagging:     true,
      express_surcharge_pct: 50,
      sms_on_ready:        true,
    },
    extensionTables: ['garment_tags','pickup_slots'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },
  // ── Hardware store ─────────────────────────────────────────────────────────
  hardware: {
    label:              'Hardware / Building materials / Sanitary store',
    productAttrsSchema: z.object({
      brand:             z.string().max(100).optional(),
      material:          z.string().max(100).optional(),  // steel, pvc, brass, copper
      size:              z.string().max(50).optional(),    // 1/2", 20mm, 4x8ft
      grade:             z.string().max(50).optional(),    // IS:1239, Grade A
      color:             z.string().max(50).optional(),
      // Unit conversions — e.g. sell in feet but stock in metres
      unit_conversions:  z.array(z.object({
        from_unit: z.string(), to_unit: z.string(), factor: z.number().positive(),
      })).default([]),
      // For items sold by weight (nails, screws in bulk)
      sold_by:           z.enum(['piece','length','weight','box','bundle']).default('piece'),
      weight_per_unit_kg: z.number().nonnegative().optional(),
    }).strict(),
    invoiceDataSchema: z.object({
      delivery_required:     z.boolean().default(false),
      delivery_site:         z.string().max(200).optional(),
      contractor_name:       z.string().max(100).optional(),
      site_engineer:         z.string().max(100).optional(),
      po_number:             z.string().max(50).optional(),    // contractor PO reference
      delivery_challan_no:   z.string().max(50).optional(),
      vehicle_no:            z.string().max(20).optional(),
      eway_bill_no:          z.string().optional(),
      credit_days:           z.number().int().min(0).max(180).default(0),
      load_unload_charges:   z.number().min(0).default(0),    // freight + loading
      cutting_charges:       z.number().min(0).default(0),    // cutting pipes/rods to length — separate charge
    }).strict(),
    itemMetaSchema: z.object({
      sold_in_unit:  z.string().optional(),  // feet, kg — if different from stock unit
      converted_qty: z.number().positive().optional(),
      lot_no:        z.string().optional(),  // cement/steel batch no — quality traceability
      hsn_code:      z.string().max(8).optional(),
    }).strict(),
    defaultDomainConfig: {
      udhaar_enabled:       true,
      contractor_credit:    true,
      unit_conversion:      true,
      low_stock_alert:      true,
      barcode_scan:         false,
      delivery_challan:     true,
    },
    extensionTables: ['delivery_challans'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        true,
      hasEwayBill:      true,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  // ── Iron & Steel Trading ───────────────────────────────────────────────────
  iron_steel: {
    label:              'Iron & Steel Trading / TMT bars / Structural steel',
    productAttrsSchema: z.object({
      grade:             z.string().max(50).optional(),    // Fe415, Fe500, Fe500D, Fe550, IS2062, IS513
      shape:             z.enum(['tmt_bar','rod','sheet','plate','pipe','angle','channel','i_beam','h_beam','chequered_plate','flat_bar','square_bar','wire_rod','other']).optional(),
      diameter_mm:       z.number().positive().optional(),  // 8, 10, 12, 16, 20, 25, 32 mm
      length_ft:         z.number().positive().optional(),  // standard 40ft, 12m
      thickness_mm:      z.number().positive().optional(),  // for sheets/plates
      width_mm:          z.number().positive().optional(),  // for sheets/plates
      finish:            z.enum(['hot_rolled','cold_rolled','galvanized','coated','polished']).optional(),
      weight_per_unit_kg: z.number().positive().optional(), // kg per piece/rod
      sold_by:           z.enum(['kg','mt','quintal','piece','bundle','coil']).default('kg'),
      mill:              z.string().max(100).optional(),    // SAIL, Tata, JSW, Essar, Jindal
      is_test_cert_required: z.boolean().default(false),    // MTC / Mill Test Certificate
    }).strict(),
    invoiceDataSchema: z.object({
      eway_bill_no:        z.string().optional(),
      vehicle_no:          z.string().max(20).optional(),
      do_number:           z.string().max(50).optional(),   // Delivery Order number
      lr_number:           z.string().max(50).optional(),   // Lorry Receipt
      transporter_name:    z.string().max(100).optional(),
      loading_weight_kg:   z.number().positive().optional(),
      tare_weight_kg:      z.number().nonnegative().optional(),
      net_weight_kg:       z.number().positive().optional(),
      destination:         z.string().max(200).optional(),
      site_name:           z.string().max(100).optional(),  // construction site / project name
      payment_terms:       z.enum(['immediate','7_days','15_days','30_days','45_days','60_days']).default('immediate'),
      credit_days:         z.number().int().min(0).max(90).default(0),
    }).strict(),
    itemMetaSchema: z.object({
      bundle_no:           z.string().optional(),   // physical bundle tag
      heat_no:             z.string().optional(),   // heat / melt number for traceability
      pieces:              z.number().int().positive().optional(),  // pieces per bundle
      unit_weight_kg:      z.number().positive().optional(),
    }).strict(),
    defaultDomainConfig: {
      eway_bill:           true,
      weight_billing:      true,
      credit_terms:        true,
      default_credit_days: 15,
      do_number_required:  true,
      vehicle_capture:     true,
    },
    extensionTables: ['delivery_challans', 'eway_bills'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        true,
      hasEwayBill:      true,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  // ── Petrol pump ────────────────────────────────────────────────────────────
  petrol_pump: {
    label:              'Petrol pump / Fuel station / CNG station',
    productAttrsSchema: z.object({
      fuel_type:          z.enum(['petrol','diesel','premium_petrol','cng','lpg']).optional(),
      no_itc:             z.boolean().default(true),   // petrol/diesel have no ITC
      density_kg_per_l:   z.number().positive().optional(),
      nozzle_nos:         z.array(z.string()).default([]),
      tank_no:            z.string().max(10).optional(),  // underground tank (one per fuel type)
    }).strict(),
    invoiceDataSchema: z.object({
      vehicle_no:         z.string().max(20).optional(),
      vehicle_type:       z.enum(['2w','4w','hcv','lcv','auto']).optional(),
      fleet_account_id:   z.string().uuid().optional(),
      fleet_card_no:      z.string().max(30).optional(),   // IOCL/BPCL/HPCL fleet card
      shift:              z.enum(['day','night']).default('day'),
      nozzle_no:          z.string().optional(),
      du_meter_open:      z.number().nonnegative().optional(),   // Dispensing Unit meter reading at shift open — required for OMC audit
      du_meter_close:     z.number().nonnegative().optional(),   // meter reading at shift close
      testing_qty_l:      z.number().nonnegative().optional(),   // fuel used for density testing — non-saleable
      payment_mode:       z.enum(['cash','card','upi','fleet_credit','fastag']).default('cash'),
      dip_reading_litres: z.number().nonnegative().optional(),  // physical tank dip measurement
    }).strict(),
    itemMetaSchema: z.object({
      nozzle_no:          z.string().optional(),
      litre_rate:         z.number().positive().optional(),
    }).strict(),
    defaultDomainConfig: {
      daily_meter_reading:  true,
      shift_management:     true,
      fleet_accounts:       true,
      lubrication_stock:    true,
      shift_report:         true,
      dsr_enabled:          true,  // Daily Sales Report
    },
    extensionTables: ['nozzle_readings'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: true,
      hasBrands:        true,
      hasDSR:           true,   // Daily Sales Report — mandatory for OMC reporting
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  // ── Agri inputs / Fertilizer / Pesticide store ─────────────────────────────
  agri: {
    label:              'Agri inputs / Fertiliser / Seeds / Pesticide store',
    productAttrsSchema: z.object({
      product_type:       z.enum(['fertilizer','pesticide','seed','equipment','other']).optional(),
      fertilizer_type:    z.enum(['urea','dap','mop','npk','ssp','organic','bio','other']).optional(),
      active_ingredient:  z.string().max(200).optional(),   // e.g. "Urea 46% N"
      crop_suitability:   z.array(z.string()).default([]),   // ['wheat','cotton','rice']
      lot_no:             z.string().max(50).optional(),     // fertilizer bag lot (DBT traceability)
      licence_required:   z.boolean().default(false),        // Schedule II pesticides
      subsidy_eligible:   z.boolean().default(false),
      subsidy_rate_pct:   z.number().min(0).max(100).optional(),
      pack_sizes:         z.array(z.object({
        size: z.string(), unit: z.string(), sku_suffix: z.string(),
      })).default([]),
      season:             z.enum(['kharif','rabi','zaid','all']).default('all'),
      shelf_life_months:  z.number().int().positive().optional(),
    }).strict(),
    invoiceDataSchema: z.object({
      kisan_id:           z.string().optional(),            // farmer ID / KCC no.
      pm_kisan_id:        z.string().optional(),            // PM-KISAN beneficiary ID
      crop_name:          z.string().max(100).optional(),
      land_area_acres:    z.number().positive().optional(),
      village:            z.string().max(100).optional(),   // required for DBT subsidy reporting
      taluka:             z.string().max(100).optional(),
      district:           z.string().max(100).optional(),
      subsidy_applied:    z.boolean().default(false),
      poison_licence_no:  z.string().max(50).optional(),   // CIB/PCB licence for Schedule II pesticides
      credit_days:        z.number().int().min(0).max(365).default(0),
      season:             z.enum(['kharif','rabi','zaid']).optional(),
    }).strict(),
    itemMetaSchema: z.object({
      subsidy_amt:        z.number().nonnegative().optional(),
      is_subsidised:      z.boolean().default(false),
    }).strict(),
    defaultDomainConfig: {
      kisan_khata:          true,    // farmer credit ledger
      seasonal_alerts:      true,
      licence_check:        true,
      subsidy_tracking:     true,
      batch_tracking:       true,
      expiry_alert_days:    60,
    },
    extensionTables: ['batches'],
    features: {
      hasBatches:       true,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: true,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
      hasKisanKhata:    true,   // farmer credit ledger — kisan khata book
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  // ── Mobile / laptop repair shop ────────────────────────────────────────────
  repair: {
    label:              'Mobile / Laptop / Electronics repair shop',
    productAttrsSchema: z.object({
      part_type:          z.enum(['display','battery','motherboard','camera','charging_port',
                                  'speaker','back_cover','keyboard','ram','ssd','other']).optional(),
      compatible_models:  z.array(z.string()).default([]),
      is_oem:             z.boolean().default(false),
      is_labour:          z.boolean().default(false),
      warranty_days:      z.number().int().min(0).optional(),
    }).strict(),
    invoiceDataSchema: z.object({
      job_card_id:                z.string().uuid().optional(),
      device_type:                z.enum(['mobile','laptop','tablet','smartwatch','tv','ac','other']).optional(),
      device_brand:               z.string().max(50).optional(),
      device_model:               z.string().max(100).optional(),
      imei:                       z.string().max(20).optional(),
      problem_reported:           z.string().max(500).optional(),
      physical_condition:         z.enum(['good','scratched','cracked','water_damage','dead']).optional(),
      device_unlocked_for_repair: z.boolean().default(false),  // never store actual passcode
      customer_approval_obtained: z.boolean().default(false),
      estimated_cost:             z.number().nonnegative().optional(),
      accessories_received:       z.array(z.string()).default([]),  // ['charger','case','earphones']
      advance_amount:             z.number().min(0).default(0),
      technician_name:            z.string().max(100).optional(),
    }).strict(),
    itemMetaSchema: z.object({
      is_labour:          z.boolean().default(false),
      part_serial_no:     z.string().optional(),
      replaced_part_returned: z.boolean().default(false),
    }).strict(),
    defaultDomainConfig: {
      job_card_enabled:       true,
      imei_capture:           true,
      warranty_on_repair:     true,
      default_warranty_days:  30,
      advance_collection:     true,
      accessory_checklist:    true,
    },
    extensionTables: ['job_cards','job_card_parts'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       true,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
    },
  },

  // ── Tiffin / Meal subscription ─────────────────────────────────────────────
  tiffin: {
    label:              'Tiffin service / Meal subscription',
    productAttrsSchema: z.object({
      meal_type:          z.enum(['veg','non_veg','jain','vegan']).default('veg'),
      tiffin_size:        z.enum(['half','full','xl']).default('full'),
      items_included:     z.array(z.string()).default([]),  // ['dal','sabji','roti','rice']
      available_slots:    z.array(z.enum(['breakfast','lunch','dinner'])).default(['lunch']),
      is_subscription:    z.boolean().default(true),
      price_per_day:      z.number().positive().optional(),
      min_days:           z.number().int().min(1).optional(),
      special_diet:       z.enum(['regular','diabetic','low_salt','high_protein','weight_loss','none']).default('none'),
    }).strict(),
    invoiceDataSchema: z.object({
      subscription_id:    z.string().uuid().optional(),
      billing_period_from:z.string().optional(),  // YYYY-MM-DD
      billing_period_to:  z.string().optional(),
      delivered_days:     z.number().int().min(0).optional(),
      paused_days:        z.number().int().min(0).default(0),
      container_deposit:  z.number().nonnegative().default(0),  // refundable tiffin box deposit — not taxable
      route_area:         z.string().max(100).optional(),
      delivery_address:   z.string().max(300).optional(),
      delivery_boy_name:  z.string().max(100).optional(),
    }).strict(),
    itemMetaSchema: z.object({
      delivery_date:      z.string().optional(),
      meal_slot:          z.enum(['breakfast','lunch','dinner']).optional(),
      route_stop:         z.number().int().optional(),
    }).strict(),
    defaultDomainConfig: {
      subscription_billing:   true,
      pause_resume:           true,
      route_management:       true,
      monthly_invoice:        true,
      delivery_tracking:      true,
      advance_collection:     true,
    },
    extensionTables: ['subscriptions','delivery_logs'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  true,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  true,
    },
  },

  // ── Gym / Fitness center ───────────────────────────────────────────────────
  gym: {
    label:              'Gym / Fitness center / Yoga studio / CrossFit',
    productAttrsSchema: z.object({
      service_type:       z.enum(['membership','personal_training','group_class','diet_plan','supplements','equipment_rental']).optional(),
      duration_months:    z.number().int().min(1).max(24).optional(),  // membership duration
      sessions_total:     z.number().int().positive().optional(),       // for PT packages
      is_renewable:       z.boolean().default(true),
      gender:             z.enum(['male','female','unisex']).default('unisex'),
      batch_time:         z.string().max(20).optional(),               // "6:00 AM"
      trainer_name:       z.string().max(100).optional(),
    }).strict(),
    invoiceDataSchema: z.object({
      member_id:            z.string().max(50).optional(),
      membership_from:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      membership_to:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      biometric_id:         z.string().max(50).optional(),
      admission_fee:        z.number().min(0).default(0),
      locker_no:            z.string().max(10).optional(),
      freeze_start:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),  // medical hold
      freeze_end:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      pt_sessions_pkg:      z.number().int().positive().optional(),  // PT sessions in this package
      referral_member_id:   z.string().uuid().optional(),            // member referral — 1 month free
      is_guest_pass:        z.boolean().default(false),              // day pass / trial visit
      body_assessment_done: z.boolean().default(false),              // BMI / fitness assessment
    }).strict(),
    itemMetaSchema: z.object({
      sessions_used:      z.number().int().min(0).optional(),
      sessions_remaining: z.number().int().min(0).optional(),
    }).strict(),
    defaultDomainConfig: {
      membership_billing:     true,
      auto_renewal_alerts:    true,
      biometric_integration:  false,
      attendance_tracking:    true,
      locker_management:      true,
      pt_session_tracking:    true,
    },
    extensionTables: ['memberships','attendance_logs'],
    features: {
      hasBatches:          false,
      hasAppointments:     true,
      hasKOT:              false,
      hasWeightBilling:    false,
      hasUdhaar:           false,
      hasEwayBill:         false,
      hasCommission:       true,
      hasShiftReport:      true,
      hasJobCard:          false,
      hasSubscription:     true,
      hasNozzleReading:    false,
      hasBrands:           false,
      hasBodyAssessment:   true,   // BMI/fitness assessment as billable service
      hasLoyalty:          false,
      hasHomeDelivery:     false,
    },
  },

  // ── Diagnostic lab / Pathology ─────────────────────────────────────────────
  diagnostic_lab: {
    label:              'Diagnostic lab / Pathology / Radiology center',
    productAttrsSchema: z.object({
      test_category:    z.enum(['blood','urine','culture','imaging','ecg','other']).optional(),
      sample_type:      z.enum(['blood','urine','stool','swab','biopsy','none']).optional(),
      report_tat_hours: z.number().int().positive().optional(),       // turnaround time
      fasting_required: z.boolean().default(false),
      home_collection:  z.boolean().default(false),
      nabl_accredited:  z.boolean().default(false),
      reference_range:  z.string().max(500).optional(),              // normal range description
      machine_code:     z.string().max(50).optional(),               // analyser ID
      commission_pct:   z.number().min(0).max(50).default(0),        // doctor referral commission %
      panel_code:       z.string().max(20).optional(),               // test panel / LOINC code
    }).strict(),
    invoiceDataSchema: z.object({
      patient_name:     z.string().min(1).max(100),
      patient_age:      z.number().int().min(0).max(120).optional(),
      patient_gender:   z.enum(['M','F','O']).optional(),
      ref_doctor:       z.string().max(100).optional(),              // referring doctor
      accession_no:     z.string().max(30).optional(),               // lab sample accession ID
      sample_collected_at: z.string().optional(),
      home_collection:  z.boolean().default(false),
      collection_address: z.string().max(300).optional(),
      report_expected_at: z.string().optional(),
      urgent:           z.boolean().default(false),
    }).strict(),
    itemMetaSchema: z.object({
      report_ready:              z.boolean().default(false),
      report_url:                z.string().optional(),
      sample_id:                 z.string().max(50).optional(),
      barcode_label_count:       z.number().int().positive().default(1),  // tubes to label — for automated label printing
      sample_rejection_reason:   z.string().optional(),                    // haemolysed, insufficient volume etc.
    }).strict(),
    defaultDomainConfig: {
      sample_tracking:          true,
      home_collection:          true,
      report_sms_notify:        true,
      referring_doctor_ledger:  true,
      daily_collection_report:  true,
      nabl_header:              false,
    },
    extensionTables: ['lab_reports'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    true,   // referral commission to doctors
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },

  // ── Pest control / Fumigation ──────────────────────────────────────────────
  pest_control: {
    label:              'Pest control / Fumigation / Termite treatment',
    productAttrsSchema: z.object({
      service_type:       z.enum(['general_pest','termite','rodent','mosquito','bedbug','fumigation','amc']).optional(),
      chemical_used:      z.string().max(200).optional(),
      application_method: z.enum(['spray','gel','baiting','fumigation','herbal']).optional(),
      is_amc:             z.boolean().default(false),
      amc_visits:         z.number().int().positive().optional(),
      warranty_months:    z.number().int().min(0).optional(),
    }).strict(),
    invoiceDataSchema: z.object({
      service_address:              z.string().min(1).max(300),
      property_type:                z.enum(['residential','commercial','industrial','restaurant','hospital']).optional(),
      area_sqft:                    z.number().positive().optional(),
      pest_type:                    z.string().max(100).optional(),
      pre_treatment_infestation:    z.enum(['none','low','medium','high','severe']).optional(), // for warranty disputes
      treatment_date:               z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      technician_name:              z.string().max(100).optional(),
      pco_licence_no:               z.string().max(50).optional(),    // PCO registration (legally mandatory)
      amc_start:                    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      amc_end:                      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      next_visit_date:              z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      warranty_card_no:             z.string().max(50).optional(),
      customer_signature_obtained:  z.boolean().default(false),
    }).strict(),
    itemMetaSchema: z.object({
      area_covered_sqft:              z.number().positive().optional(),
      chemical_qty_ml:                z.number().positive().optional(),
      dilution_ratio:                 z.string().max(20).optional(),   // e.g. "1:10" — regulatory compliance
      visit_no:                       z.number().int().min(1).optional(),
      pre_treatment_infestation_level:z.enum(['none','low','medium','high','severe']).optional(), // for warranty dispute resolution
    }).strict(),
    defaultDomainConfig: {
      amc_tracking:           true,
      warranty_management:    true,
      technician_assignment:  true,
      service_report:         true,
      chemical_consumption:   true,
      next_visit_reminder:    true,
    },
    extensionTables: ['service_visits'],
    features: {
      hasBatches:       true,   // chemical stock batch tracking
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    true,   // technician commission
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  true,   // AMC = subscription
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },

  // ── Photography studio / Videography ──────────────────────────────────────
  water_supplier: {
    label:              'Water supplier / RO water / Tanker delivery',
    productAttrsSchema: WaterSupplierProductAttrs,
    invoiceDataSchema:  WaterSupplierInvoiceData,
    itemMetaSchema:     WaterSupplierItemMeta,
    defaultDomainConfig: {
      can_deposit_tracking: true,
      subscription_billing: true,
      route_management:     true,
      advance_collection:   true,
      monthly_billing:      true,
    },
    extensionTables: ['subscriptions','delivery_logs','can_register'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  true,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  true,
    },
  },

  driving_school: {
    label:              'Driving school / Motor training institute',
    productAttrsSchema: DrivingSchoolProductAttrs,
    invoiceDataSchema:  DrivingSchoolInvoiceData,
    itemMetaSchema:     DrivingSchoolItemMeta,
    defaultDomainConfig: {
      student_register:   true,
      session_tracking:   true,
      dl_tracking:        true,
      rto_assist:         true,
    },
    extensionTables: ['students','sessions'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  interior_contractor: {
    label:              'Interior contractor / Renovation / Civil works',
    productAttrsSchema: InteriorContractorProductAttrs,
    invoiceDataSchema:  InteriorContractorInvoiceData,
    itemMetaSchema:     InteriorContractorItemMeta,
    defaultDomainConfig: {
      milestone_billing:    true,
      boq_support:          true,
      tds_applicable:       true,   // Section 194C
      retention_money:      true,
      project_tracking:     true,
    },
    extensionTables: ['projects','boq_items'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      true,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       true,   // each project = a job
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  packers_movers: {
    label:              'Packers and movers / Relocation services',
    productAttrsSchema: PackersMoversProductAttrs,
    invoiceDataSchema:  PackersMoversInvoiceData,
    itemMetaSchema:     PackersMoversItemMeta,
    defaultDomainConfig: {
      transit_insurance:  true,
      damage_register:    true,
      advance_required:   true,
      default_advance_pct:50,
      route_tracking:     true,
    },
    extensionTables: ['moves','inventory_lists'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      true,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       true,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  security_agency: {
    label:              'Security agency / Guard services / Manpower supply',
    productAttrsSchema: SecurityAgencyProductAttrs,
    invoiceDataSchema:  SecurityAgencyInvoiceData,
    itemMetaSchema:     SecurityAgencyItemMeta,
    defaultDomainConfig: {
      monthly_billing:        true,
      attendance_tracking:    true,
      esic_pf_compliance:     true,
      guard_register:         true,
      management_charges:     true,
    },
    extensionTables: ['guards','deployments','attendance_logs'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  true,   // monthly deployment contract
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  creche_daycare: {
    label:              'Crèche / Daycare / Play school',
    productAttrsSchema: CrecheDaycareProductAttrs,
    invoiceDataSchema:  CrecheDaycareInvoiceData,
    itemMetaSchema:     CrecheDaycareItemMeta,
    defaultDomainConfig: {
      child_profiles:       true,
      attendance_tracking:  true,
      monthly_billing:      true,
      meal_tracking:        true,
      parent_app_notify:    false,
    },
    extensionTables: ['children','attendance_logs'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  true,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  dance_music_school: {
    label:              'Dance / Music / Art school',
    productAttrsSchema: DanceMusicSchoolProductAttrs,
    invoiceDataSchema:  DanceMusicSchoolInvoiceData,
    itemMetaSchema:     DanceMusicSchoolItemMeta,
    defaultDomainConfig: {
      student_register:     true,
      batch_management:     true,
      exam_tracking:        true,
      costume_tracking:     true,
      installment_billing:  true,
    },
    extensionTables: ['students','batches','enrollments'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  true,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  footwear: {
    label:              'Footwear / Shoe store',
    productAttrsSchema: FootwearProductAttrs,
    invoiceDataSchema:  FootwearInvoiceData,
    itemMetaSchema:     FootwearItemMeta,
    defaultDomainConfig: {
      size_variant_billing: true,
      barcode_scan_first:   true,
      exchange_policy:      true,
      low_stock_alert:      true,
    },
    extensionTables: [] as string[],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
      hasExchange:      true,
      hasLoyalty:       true,
      hasHomeDelivery:  false,
    },
  },

  tent_house: {
    label:              'Tent house / Party equipment rental',
    productAttrsSchema: TentHouseProductAttrs,
    invoiceDataSchema:  TentHouseInvoiceData,
    itemMetaSchema:     TentHouseItemMeta,
    defaultDomainConfig: {
      rental_tracking:      true,
      damage_deposit:       true,
      advance_required:     true,
      default_advance_pct:  50,
      inventory_on_return:  true,
    },
    extensionTables: ['rental_inventory','bookings'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  milk_dairy: {
    label:              'Milk dairy / Daily milk delivery',
    productAttrsSchema: MilkDairyProductAttrs,
    invoiceDataSchema:  MilkDairyInvoiceData,
    itemMetaSchema:     MilkDairyItemMeta,
    defaultDomainConfig: {
      twice_daily_delivery:   true,
      bottle_deposit_tracking:true,
      monthly_billing:        true,
      pause_resume:           true,
      advance_collection:     true,
      route_management:       true,
    },
    extensionTables: ['subscriptions','delivery_logs','bottle_register'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  true,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  true,
    },
  },

  banquet_hall: {
    label:              'Banquet hall / Marriage hall / Party plot',
    productAttrsSchema: BanquetHallProductAttrs,
    invoiceDataSchema:  BanquetHallInvoiceData,
    itemMetaSchema:     BanquetHallItemMeta,
    defaultDomainConfig: {
      advance_required:        true,
      default_advance_pct:     50,
      security_deposit:        true,
      booking_calendar:        true,
      cancellation_policy:     true,
      multiple_halls:          false,
    },
    extensionTables: ['bookings','halls'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  real_estate: {
    label:              'Real estate / Property rental / Broker',
    productAttrsSchema: RealEstateProductAttrs,
    invoiceDataSchema:  RealEstateInvoiceData,
    itemMetaSchema:     RealEstateItemMeta,
    defaultDomainConfig: {
      tds_tracking:       true,   // Section 194I — tenant deducts TDS on rent > ₹50,000/month
      security_deposit:   true,
      agreement_mgmt:     true,
      monthly_rent_invoice:true,
      brokerage_mode:     false,  // toggle between rental management and brokerage
    },
    extensionTables: ['properties','agreements','tenants'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    true,   // brokerage commission
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  true,   // monthly rent = recurring billing
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  tailoring: {
    label:              'Tailoring shop / Boutique / Stitching center',
    productAttrsSchema: TailoringProductAttrs,
    invoiceDataSchema:  TailoringInvoiceData,
    itemMetaSchema:     TailoringItemMeta,
    defaultDomainConfig: {
      save_measurements:    true,
      trial_reminders:      true,
      delivery_reminders:   true,
      advance_required:     true,
      default_advance_pct:  50,
    },
    extensionTables: ['measurements','trial_appointments'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       true,   // each garment order is essentially a job card
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  ca_firm: {
    label:              'CA firm / Accountant / Professional services',
    productAttrsSchema: CAFirmProductAttrs,
    invoiceDataSchema:  CAFirmInvoiceData,
    itemMetaSchema:     CAFirmItemMeta,
    defaultDomainConfig: {
      tds_applicable:       true,
      retainer_billing:     true,
      client_portal:        false,
      financial_year_based: true,
      govt_fee_passthrough: true,
    },
    extensionTables: ['clients','filings'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  true,   // retainer = recurring billing
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  gas_agency: {
    label:              'Gas agency / LPG distributor',
    productAttrsSchema: GasAgencyProductAttrs,
    invoiceDataSchema:  GasAgencyInvoiceData,
    itemMetaSchema:     GasAgencyItemMeta,
    defaultDomainConfig: {
      consumer_register:    true,
      cylinder_tracking:    true,
      subsidy_tracking:     true,
      delivery_route:       true,
      advance_booking_only: true,   // OMC mandates booking before delivery
    },
    extensionTables: ['consumers','cylinder_stock','delivery_routes'],
    features: {
      hasBatches:       false,
      hasAppointments:  false,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        true,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   true,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  true,
    },
  },

  event_management: {
    label:              'Event management / Wedding planner / Decorator',
    productAttrsSchema: EventMgmtProductAttrs,
    invoiceDataSchema:  EventMgmtInvoiceData,
    itemMetaSchema:     EventMgmtItemMeta,
    defaultDomainConfig: {
      advance_required:     true,
      default_advance_pct:  50,
      equipment_deposit:    true,
      vendor_coordination:  true,
      event_calendar:       true,
    },
    extensionTables: ['events','rental_inventory','vendors'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    true,   // vendor coordination commission
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  veterinary: {
    label:              'Veterinary clinic / Pet store / Pet grooming',
    productAttrsSchema: VeterinaryProductAttrs,
    invoiceDataSchema:  VeterinaryInvoiceData,
    itemMetaSchema:     VeterinaryItemMeta,
    defaultDomainConfig: {
      pet_profiles:         true,
      vaccination_schedule: true,
      weight_based_dosing:  true,
      next_visit_reminder:  true,
      prescription_required:true,
    },
    extensionTables: ['pets','vaccination_records','prescriptions'],
    features: {
      hasBatches:       true,   // vaccine batch tracking
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    false,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        true,
      hasLoyalty:       false,
      hasHomeDelivery:  false,
    },
  },

  photography: {
    label:              'Photography studio / Videography / Photo printing',
    productAttrsSchema: z.object({
      service_type:       z.enum(['event_photography','studio_shoot','videography','photo_printing','album','drone','reels','product_shoot']).optional(),
      event_type:         z.enum(['wedding','pre_wedding','birthday','corporate','maternity','newborn','passport','other']).optional(),
      delivery_days:      z.number().int().positive().optional(),
      photos_count:       z.number().int().positive().optional(),
      reels_count:        z.number().int().nonnegative().optional(),  // Instagram/YouTube reels — primary deliverable now
      video_duration_min: z.number().positive().optional(),
      includes_album:     z.boolean().default(false),
      includes_drone:     z.boolean().default(false),
      raw_files:          z.boolean().default(false),
    }).strict(),
    invoiceDataSchema: z.object({
      event_date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      event_venue:         z.string().max(200).optional(),
      photographer_name:   z.string().max(100).optional(),
      second_photographer: z.string().max(100).optional(),
      shoot_hours:         z.number().positive().optional(),
      travel_km:           z.number().nonnegative().default(0),       // for travel surcharge
      outsourced_vendor:   z.string().max(100).optional(),            // if outsourced to another studio
      editing_style:       z.string().max(50).optional(),             // 'VSCO','moody','bright','cinematic' — client preference
      advance_pct:         z.number().min(0).max(100).default(50),
      delivery_date:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      gdrive_link:         z.string().max(500).optional(),
      client_approval:     z.boolean().default(false),
    }).strict(),
    itemMetaSchema: z.object({
      size:               z.string().max(20).optional(),
      paper_type:         z.enum(['glossy','matte','canvas','metallic']).optional(),
      quantity:           z.number().int().positive().optional(),
    }).strict(),
    defaultDomainConfig: {
      advance_booking:      true,
      advance_pct:          50,
      event_scheduling:     true,
      delivery_tracking:    true,
      package_billing:      true,
      outsourcing_enabled:  true,
    },
    extensionTables: ['event_bookings'],
    features: {
      hasBatches:       false,
      hasAppointments:  true,
      hasKOT:           false,
      hasWeightBilling: false,
      hasUdhaar:        false,
      hasEwayBill:      false,
      hasCommission:    true,
      hasShiftReport:   false,
      hasJobCard:       false,
      hasSubscription:  false,
      hasNozzleReading: false,
      hasBrands:        false,
    },
  },

} as const

// =============================================================================
// EXPENSE CATEGORIES
// =============================================================================

export interface ExpenseCategory {
  code:         string
  label:        string
  icon:         string
  affectsStock: boolean   // true = buying inventory (purchases), affects COGS
}

const UNIVERSAL: ExpenseCategory[] = [
  { code: 'rent',         label: 'Rent',              icon: '🏪', affectsStock: false },
  { code: 'electricity',  label: 'Electricity',       icon: '⚡', affectsStock: false },
  { code: 'internet',     label: 'Internet / Phone',  icon: '📶', affectsStock: false },
  { code: 'staff',        label: 'Staff Salary',      icon: '👤', affectsStock: false },
  { code: 'transport',    label: 'Transport',         icon: '🚛', affectsStock: false },
  { code: 'maintenance',  label: 'Maintenance',       icon: '🔧', affectsStock: false },
  { code: 'misc',         label: 'Miscellaneous',     icon: '📎', affectsStock: false },
]

const DOMAIN_EXPENSE_CATEGORIES: Record<string, ExpenseCategory[]> = {
  retail: [
    { code: 'purchases',   label: 'Supplier Purchases', icon: '🛒', affectsStock: true  },
    { code: 'packaging',   label: 'Packaging Material', icon: '📦', affectsStock: false },
    { code: 'loading',     label: 'Loading / Unloading',icon: '🏋', affectsStock: false },
  ],
  restaurant: [
    { code: 'raw_material',label: 'Raw Material',       icon: '🥦', affectsStock: true  },
    { code: 'gas_lpg',     label: 'Gas / LPG',          icon: '🔥', affectsStock: false },
    { code: 'packaging',   label: 'Packaging',          icon: '📦', affectsStock: false },
    { code: 'aggregator',  label: 'Aggregator Commission', icon: '📱', affectsStock: false },
    { code: 'equipment',   label: 'Kitchen Equipment',  icon: '🍳', affectsStock: false },
  ],
  pharmacy: [
    { code: 'drug_purchase',label: 'Drug Purchases',    icon: '💊', affectsStock: true  },
    { code: 'cold_storage', label: 'Cold Storage',      icon: '❄️', affectsStock: false },
    { code: 'licence',      label: 'Licence / Renewal', icon: '📋', affectsStock: false },
    { code: 'wastage',      label: 'Expired / Wastage', icon: '🗑️', affectsStock: false },
  ],
  salon: [
    { code: 'product_purchase', label: 'Product Purchases', icon: '💈', affectsStock: true  },
    { code: 'commission',       label: 'Staff Commission',  icon: '💰', affectsStock: false },
    { code: 'equipment',        label: 'Equipment / Tools', icon: '✂️', affectsStock: false },
  ],
  wholesale: [
    { code: 'purchases',   label: 'Supplier Purchases', icon: '🛒', affectsStock: true  },
    { code: 'freight',     label: 'Freight / Courier',  icon: '🚚', affectsStock: false },
    { code: 'loading',     label: 'Loading / Unloading',icon: '🏋', affectsStock: false },
    { code: 'eway_bill',   label: 'E-Way Bill Charges', icon: '📄', affectsStock: false },
  ],
  electronics: [
    { code: 'purchases',   label: 'Stock Purchases',    icon: '🛒', affectsStock: true  },
    { code: 'warranty',    label: 'Warranty Claims',    icon: '🛡️', affectsStock: false },
    { code: 'demo_units',  label: 'Demo Units',         icon: '📺', affectsStock: false },
  ],
  enterprise: [
    { code: 'purchases',   label: 'Supplier Purchases', icon: '🛒', affectsStock: true  },
    { code: 'freight',     label: 'Freight / Logistics',icon: '🚚', affectsStock: false },
    { code: 'warehouse',   label: 'Warehouse Charges',  icon: '🏭', affectsStock: false },
    { code: 'tds',         label: 'TDS / Tax Payments', icon: '🏦', affectsStock: false },
  ],
  sweet: [
    { code: 'raw_material',label: 'Raw Material',       icon: '🥛', affectsStock: true  },
    { code: 'gas_lpg',     label: 'Gas / LPG',          icon: '🔥', affectsStock: false },
    { code: 'packaging',   label: 'Packaging / Boxes',  icon: '📦', affectsStock: false },
    { code: 'wastage',     label: 'Wastage / Spoilage', icon: '🗑️', affectsStock: false },
  ],
  clinic: [
    { code: 'medical_supplies', label: 'Medical Supplies', icon: '🩺', affectsStock: true  },
    { code: 'equipment',        label: 'Equipment / Instruments', icon: '⚕️', affectsStock: false },
    { code: 'lab_outsource',    label: 'Lab Outsourcing', icon: '🔬', affectsStock: false },
    { code: 'licence',          label: 'Licence / Registration', icon: '📋', affectsStock: false },
  ],
  optical: [
    { code: 'lens_purchase',  label: 'Lens / Frame Purchases', icon: '👓', affectsStock: true  },
    { code: 'lab_charges',    label: 'Lab Grinding Charges',   icon: '🔬', affectsStock: false },
  ],
  jewellery: [
    { code: 'gold_purchase',  label: 'Gold / Silver Purchase', icon: '🥇', affectsStock: true  },
    { code: 'making_charges', label: 'Making / Karigar Charges',icon: '💍', affectsStock: false },
    { code: 'hallmark',       label: 'Hallmarking Charges',    icon: '🏅', affectsStock: false },
    { code: 'insurance',      label: 'Jewellery Insurance',    icon: '🛡️', affectsStock: false },
  ],
  automobile: [
    { code: 'parts_purchase', label: 'Parts / Spares Purchase',icon: '🔩', affectsStock: true  },
    { code: 'consumables',    label: 'Consumables / Oils',     icon: '🛢️', affectsStock: true  },
    { code: 'equipment',      label: 'Equipment / Machinery',  icon: '🔧', affectsStock: false },
    { code: 'technician',     label: 'Technician Payment',     icon: '👨‍🔧', affectsStock: false },
  ],
  textile: [
    { code: 'fabric_purchase',label: 'Fabric Purchase',        icon: '🧵', affectsStock: true  },
    { code: 'dyeing',         label: 'Dyeing / Processing',    icon: '🎨', affectsStock: false },
    { code: 'job_work',       label: 'Job Work / Stitching',   icon: '🪡', affectsStock: false },
  ],
  hotel: [
    { code: 'housekeeping',   label: 'Housekeeping Supplies',  icon: '🛏️', affectsStock: true  },
    { code: 'amenities',      label: 'Guest Amenities',        icon: '🧴', affectsStock: true  },
    { code: 'ota_commission', label: 'OTA Commission',         icon: '💻', affectsStock: false },
    { code: 'laundry',        label: 'Linen / Laundry',        icon: '👔', affectsStock: false },
    { code: 'food_purchase',  label: 'Food / Beverage Purchase',icon: '🍽️',affectsStock: true  },
  ],
  catering: [
    { code: 'raw_material',   label: 'Raw Material',           icon: '🥘', affectsStock: true  },
    { code: 'gas_lpg',        label: 'Gas / LPG',              icon: '🔥', affectsStock: false },
    { code: 'staff_wages',    label: 'Event Staff Wages',      icon: '👨‍🍳', affectsStock: false },
    { code: 'equipment_hire', label: 'Equipment Hire',         icon: '🍽️', affectsStock: false },
    { code: 'venue',          label: 'Venue Charges',          icon: '🏟️', affectsStock: false },
  ],
  coaching: [
    { code: 'faculty',        label: 'Faculty / Tutor Payment',icon: '👨‍🏫', affectsStock: false },
    { code: 'study_material', label: 'Study Material',         icon: '📚', affectsStock: false },
    { code: 'online_tools',   label: 'Online Tools / Software',icon: '💻', affectsStock: false },
    { code: 'exam_fees',      label: 'Exam / Test Fees',       icon: '📝', affectsStock: false },
  ],
  printing: [
    { code: 'paper_purchase', label: 'Paper / Media Purchase', icon: '📄', affectsStock: true  },
    { code: 'ink_plates',     label: 'Ink / Plates',           icon: '🖨️', affectsStock: true  },
    { code: 'outsourcing',    label: 'Job Outsourcing',        icon: '🤝', affectsStock: false },
    { code: 'equipment',      label: 'Machine Maintenance',    icon: '⚙️', affectsStock: false },
  ],
  laundry: [
    { code: 'detergent',      label: 'Detergent / Chemicals',  icon: '🧴', affectsStock: true  },
    { code: 'machine',        label: 'Machine Maintenance',    icon: '🫧', affectsStock: false },
    { code: 'pickup_delivery',label: 'Pickup / Delivery',      icon: '🚗', affectsStock: false },
  ],
  hardware: [
    { code: 'purchases',      label: 'Stock Purchases',        icon: '🔩', affectsStock: true  },
    { code: 'freight',        label: 'Freight / Loading',      icon: '🚚', affectsStock: false },
  ],
  iron_steel: [
    { code: 'steel_purchase', label: 'Steel / Iron Purchase',  icon: '🏗️', affectsStock: true  },
    { code: 'freight',        label: 'Freight / Transport',    icon: '🚚', affectsStock: false },
    { code: 'loading',        label: 'Loading / Unloading',    icon: '🏋', affectsStock: false },
    { code: 'eway_bill',      label: 'E-Way Bill Charges',     icon: '📄', affectsStock: false },
    { code: 'weighbridge',    label: 'Weighbridge Charges',    icon: '⚖️', affectsStock: false },
    { code: 'interest',       label: 'Interest / Finance',     icon: '🏦', affectsStock: false },
  ],
  petrol_pump: [
    { code: 'fuel_purchase',  label: 'Fuel Purchase (OMC)',    icon: '⛽', affectsStock: true  },
    { code: 'dso_charges',    label: 'DSO / OMC Charges',      icon: '🏢', affectsStock: false },
    { code: 'calibration',    label: 'Nozzle Calibration',     icon: '⚖️', affectsStock: false },
    { code: 'lube_purchase',  label: 'Lubricant Purchase',     icon: '🛢️', affectsStock: true  },
  ],
  agri: [
    { code: 'stock_purchase', label: 'Stock Purchase',         icon: '🌾', affectsStock: true  },
    { code: 'storage',        label: 'Storage / Godown',       icon: '🏚️', affectsStock: false },
    { code: 'licence',        label: 'Licence / Fees',         icon: '📋', affectsStock: false },
  ],
  repair: [
    { code: 'parts_purchase', label: 'Parts Purchase',         icon: '🔩', affectsStock: true  },
    { code: 'tools',          label: 'Tools / Equipment',      icon: '🔧', affectsStock: false },
    { code: 'technician',     label: 'Technician Payment',     icon: '👨‍🔧', affectsStock: false },
  ],
  tiffin: [
    { code: 'raw_material',   label: 'Raw Material / Grocery', icon: '🥗', affectsStock: true  },
    { code: 'gas_lpg',        label: 'Gas / LPG',              icon: '🔥', affectsStock: false },
    { code: 'containers',     label: 'Tiffin Containers',      icon: '🍱', affectsStock: false },
    { code: 'delivery',       label: 'Delivery Charges',       icon: '🛵', affectsStock: false },
  ],
  gym: [
    { code: 'equipment',      label: 'Equipment Purchase',     icon: '🏋️', affectsStock: false },
    { code: 'supplements',    label: 'Supplements / Stock',    icon: '💪', affectsStock: true  },
    { code: 'trainer',        label: 'Trainer Payment',        icon: '🤸', affectsStock: false },
    { code: 'software',       label: 'Management Software',    icon: '💻', affectsStock: false },
  ],
  diagnostic_lab: [
    { code: 'reagents',       label: 'Reagents / Consumables', icon: '🧪', affectsStock: true  },
    { code: 'equipment',      label: 'Equipment / Analyser',   icon: '🔬', affectsStock: false },
    { code: 'outsource',      label: 'Test Outsourcing',       icon: '🤝', affectsStock: false },
    { code: 'collection',     label: 'Home Collection Cost',   icon: '🏠', affectsStock: false },
    { code: 'licence',        label: 'NABL / Licence',         icon: '📋', affectsStock: false },
  ],
  pest_control: [
    { code: 'chemicals',      label: 'Chemical Purchase',      icon: '🧴', affectsStock: true  },
    { code: 'equipment',      label: 'Equipment / PPE',        icon: '🦺', affectsStock: false },
    { code: 'technician',     label: 'Technician Wages',       icon: '👷', affectsStock: false },
    { code: 'licence',        label: 'PCO Licence',            icon: '📋', affectsStock: false },
  ],
  photography: [
    { code: 'equipment',      label: 'Camera / Equipment',     icon: '📷', affectsStock: false },
    { code: 'outsource',      label: 'Freelancer / Outsource', icon: '🤝', affectsStock: false },
    { code: 'storage',        label: 'Cloud Storage / Drive',  icon: '☁️', affectsStock: false },
    { code: 'travel',         label: 'Travel / Fuel',          icon: '🚗', affectsStock: false },
    { code: 'album',          label: 'Album / Print Material', icon: '📔', affectsStock: true  },
  ],
  milk_dairy: [
    { code: 'milk_purchase',  label: 'Milk Purchase / Procurement', icon: '🥛', affectsStock: true  },
    { code: 'packaging',      label: 'Pouches / Bottles',           icon: '📦', affectsStock: true  },
    { code: 'delivery',       label: 'Delivery / Route Expenses',   icon: '🛵', affectsStock: false },
    { code: 'chilling',       label: 'Chilling / Cold Storage',     icon: '❄️', affectsStock: false },
    { code: 'testing',        label: 'Milk Testing / Lab',          icon: '🧪', affectsStock: false },
  ],
  banquet_hall: [
    { code: 'maintenance',    label: 'Hall Maintenance',            icon: '🏟️', affectsStock: false },
    { code: 'electricity',    label: 'Power / Generator',           icon: '⚡', affectsStock: false },
    { code: 'housekeeping',   label: 'Housekeeping / Cleaning',     icon: '🧹', affectsStock: false },
    { code: 'furniture',      label: 'Furniture / Décor Stock',     icon: '🪑', affectsStock: true  },
    { code: 'catering_outside',label:'Outside Caterer Commission',  icon: '🍽️', affectsStock: false },
  ],
  real_estate: [
    { code: 'property_tax',   label: 'Property Tax / Municipal',   icon: '🏛️', affectsStock: false },
    { code: 'maintenance',    label: 'Property Maintenance',        icon: '🔧', affectsStock: false },
    { code: 'brokerage_paid', label: 'Brokerage Paid Out',         icon: '🤝', affectsStock: false },
    { code: 'legal',          label: 'Legal / Registration Fees',  icon: '⚖️', affectsStock: false },
    { code: 'insurance',      label: 'Property Insurance',         icon: '🛡️', affectsStock: false },
  ],
  tailoring: [
    { code: 'fabric_purchase',label: 'Fabric / Thread Purchase',icon: '🧵', affectsStock: true  },
    { code: 'buttons_zip',    label: 'Buttons / Zips / Lining', icon: '🪡', affectsStock: true  },
    { code: 'machine',        label: 'Machine Maintenance',     icon: '⚙️', affectsStock: false },
    { code: 'embroidery',     label: 'Embroidery / Handwork',   icon: '🎨', affectsStock: false },
  ],
  ca_firm: [
    { code: 'govt_fees',      label: 'Govt / Portal Fees',     icon: '🏛️', affectsStock: false },
    { code: 'software',       label: 'Software / Subscription', icon: '💻', affectsStock: false },
    { code: 'professional',   label: 'Outsourced Professional', icon: '👨‍💼', affectsStock: false },
    { code: 'stationery',     label: 'Stationery / Printing',  icon: '📄', affectsStock: false },
  ],
  gas_agency: [
    { code: 'cylinder_purchase', label: 'Cylinder / Gas Purchase', icon: '⛽', affectsStock: true  },
    { code: 'delivery',          label: 'Delivery Expenses',       icon: '🛵', affectsStock: false },
    { code: 'omc_charges',       label: 'OMC / Depot Charges',     icon: '🏢', affectsStock: false },
    { code: 'cylinder_repair',   label: 'Cylinder Repair / Safety',icon: '🔧', affectsStock: false },
  ],
  event_management: [
    { code: 'rental_inventory',  label: 'Rental Stock Purchase',   icon: '🎪', affectsStock: true  },
    { code: 'vendor_payment',    label: 'Vendor / Subcontractor',  icon: '🤝', affectsStock: false },
    { code: 'transport',         label: 'Transport / Loading',     icon: '🚛', affectsStock: false },
    { code: 'labour',            label: 'Labour / Setup Crew',     icon: '👷', affectsStock: false },
    { code: 'equipment_repair',  label: 'Equipment Repair',        icon: '🔧', affectsStock: false },
  ],
  veterinary: [
    { code: 'medicine_purchase', label: 'Medicine / Vaccine Stock',icon: '💉', affectsStock: true  },
    { code: 'pet_food',          label: 'Pet Food / Accessories',  icon: '🐾', affectsStock: true  },
    { code: 'equipment',         label: 'Medical Equipment',       icon: '⚕️', affectsStock: false },
    { code: 'lab_outsource',     label: 'Lab Outsourcing',         icon: '🔬', affectsStock: false },
    { code: 'licence',           label: 'VCI Licence / Registration',icon:'📋', affectsStock: false },
  ],
  water_supplier: [
    { code: 'can_purchase',      label: 'Can / Jar Purchase',      icon: '🪣', affectsStock: true  },
    { code: 'ro_filter',         label: 'RO Filter / Membrane',    icon: '💧', affectsStock: true  },
    { code: 'delivery',          label: 'Delivery / Route Expenses',icon:'🛵', affectsStock: false },
    { code: 'tanker_hire',       label: 'Tanker Hire',             icon: '🚚', affectsStock: false },
    { code: 'maintenance',       label: 'Plant / Pump Maintenance',icon: '🔧', affectsStock: false },
  ],
  driving_school: [
    { code: 'fuel',              label: 'Fuel / Vehicle Running',  icon: '⛽', affectsStock: false },
    { code: 'vehicle_insurance', label: 'Vehicle Insurance',       icon: '🛡️', affectsStock: false },
    { code: 'vehicle_service',   label: 'Vehicle Service / Repair',icon: '🔧', affectsStock: false },
    { code: 'rto_fees',          label: 'RTO / Licence Fees',      icon: '🏛️', affectsStock: false },
    { code: 'instructor',        label: 'Instructor Salary',       icon: '👨‍🏫', affectsStock: false },
  ],
  interior_contractor: [
    { code: 'material',          label: 'Material / Raw Purchase', icon: '🧱', affectsStock: true  },
    { code: 'labour',            label: 'Labour / Contractor',     icon: '👷', affectsStock: false },
    { code: 'tool_hire',         label: 'Tool / Equipment Hire',   icon: '🔨', affectsStock: false },
    { code: 'site_transport',    label: 'Site Transport',          icon: '🚛', affectsStock: false },
    { code: 'subcontractor',     label: 'Subcontractor Payment',   icon: '🤝', affectsStock: false },
  ],
  packers_movers: [
    { code: 'packing_material',  label: 'Packing Material',        icon: '📦', affectsStock: true  },
    { code: 'labour',            label: 'Labour / Loading Crew',   icon: '👷', affectsStock: false },
    { code: 'vehicle_hire',      label: 'Vehicle Hire / Diesel',   icon: '🚚', affectsStock: false },
    { code: 'insurance',         label: 'Transit Insurance',       icon: '🛡️', affectsStock: false },
    { code: 'storage',           label: 'Storage / Warehouse',     icon: '🏭', affectsStock: false },
  ],
  security_agency: [
    { code: 'guard_salary',      label: 'Guard Salary / Wages',    icon: '👮', affectsStock: false },
    { code: 'uniform',           label: 'Uniform / Equipment',     icon: '🦺', affectsStock: true  },
    { code: 'pf_esic',           label: 'PF / ESIC Contribution',  icon: '🏛️', affectsStock: false },
    { code: 'training',          label: 'Training / Certification',icon: '📋', affectsStock: false },
    { code: 'background_check',  label: 'Background Verification', icon: '🔍', affectsStock: false },
  ],
  creche_daycare: [
    { code: 'toys_supplies',     label: 'Toys / Activity Supplies',icon: '🧸', affectsStock: true  },
    { code: 'meals',             label: 'Meals / Snacks',          icon: '🍱', affectsStock: false },
    { code: 'staff_salary',      label: 'Caretaker / Staff Salary',icon: '👩‍🏫', affectsStock: false },
    { code: 'hygiene',           label: 'Hygiene / Cleaning',      icon: '🧹', affectsStock: false },
    { code: 'insurance',         label: 'Child Care Insurance',    icon: '🛡️', affectsStock: false },
  ],
  dance_music_school: [
    { code: 'instruments',       label: 'Instruments / Equipment', icon: '🎸', affectsStock: true  },
    { code: 'costume',           label: 'Costumes / Props',        icon: '👗', affectsStock: true  },
    { code: 'faculty',           label: 'Faculty / Trainer Fee',   icon: '👨‍🎤', affectsStock: false },
    { code: 'competition',       label: 'Competition / Event Fees',icon: '🏆', affectsStock: false },
    { code: 'studio_rent',       label: 'Studio / Hall Rent',      icon: '🏪', affectsStock: false },
  ],
  footwear: [
    { code: 'stock_purchase',    label: 'Footwear Stock Purchase', icon: '👟', affectsStock: true  },
    { code: 'repair_material',   label: 'Repair / Cobbling Material',icon:'🔨',affectsStock: true  },
    { code: 'display',           label: 'Display / Rack Fittings', icon: '🪟', affectsStock: false },
    { code: 'import_duty',       label: 'Import Duty / Customs',   icon: '🏛️', affectsStock: false },
  ],
  tent_house: [
    { code: 'inventory_purchase',label: 'Rental Inventory Purchase',icon:'🎪', affectsStock: true  },
    { code: 'labour',            label: 'Setup / Dismantling Labour',icon:'👷',affectsStock: false },
    { code: 'transport',         label: 'Transport / Loading',     icon: '🚛', affectsStock: false },
    { code: 'repair',            label: 'Repair / Replacement',    icon: '🔧', affectsStock: false },
    { code: 'storage',           label: 'Warehouse / Storage',     icon: '🏭', affectsStock: false },
  ],
}

export function getExpenseCategories(domainType: DomainType): ExpenseCategory[] {
  const domain = DOMAIN_EXPENSE_CATEGORIES[domainType] ?? []
  // Merge domain-specific first (shown at top), then universals not already covered
  const domainCodes = new Set(domain.map((c) => c.code))
  const extras = UNIVERSAL.filter((c) => !domainCodes.has(c.code))
  return [...domain, ...extras]
}

export type DomainType = keyof typeof DOMAIN_REGISTRY

export type DomainProductAttrs<T extends DomainType> = z.infer<typeof DOMAIN_REGISTRY[T]['productAttrsSchema']>
export type DomainInvoiceData<T extends DomainType>  = z.infer<typeof DOMAIN_REGISTRY[T]['invoiceDataSchema']>
export type DomainItemMeta<T extends DomainType>     = z.infer<typeof DOMAIN_REGISTRY[T]['itemMetaSchema']>

// Helper: get features for a domain type
export function getDomainFeatures(domainType: string) {
  const domain = DOMAIN_REGISTRY[domainType as DomainType]
  if (!domain) throw new Error(`Unknown domain type: ${domainType}`)
  return domain.features
}

// Helper: validate domain_attrs for a product
export function validateProductAttrs(domainType: string, attrs: unknown) {
  const domain = DOMAIN_REGISTRY[domainType as DomainType]
  if (!domain) throw new Error(`Unknown domain type: ${domainType}`)
  // Use passthrough so legacy/extra keys already stored in the JSON field don't break validation
  return (domain.productAttrsSchema as z.ZodObject<z.ZodRawShape>).passthrough().parse(attrs ?? {})
}

// Helper: validate invoice domain_data
export function validateInvoiceData(domainType: string, data: unknown) {
  const domain = DOMAIN_REGISTRY[domainType as DomainType]
  if (!domain) throw new Error(`Unknown domain type: ${domainType}`)
  return domain.invoiceDataSchema.parse(data)
}
