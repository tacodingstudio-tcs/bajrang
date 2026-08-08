// Domain-specific entity configuration for party/customer management

export interface EntityMetaField {
  key:         string
  label:       string
  type:        'text' | 'number' | 'select' | 'date'
  placeholder?: string
  options?:    string[]
  optional?:   boolean
}

export interface EntityConfig {
  singular:     string
  plural:       string
  singularLower: string
  // What to call the product/service catalogue for this domain
  catalogSingular: string   // e.g. "Service", "Test", "Menu Item"
  catalogPlural:   string   // e.g. "Services & Tests", "Menu Items"
  // Which meta fields to capture on the add/edit entity form
  metaFields:   EntityMetaField[]
  // Which columns to show in the list beyond name/phone/balance
  listColumns:  Array<{ key: string; label: string; fromMeta?: boolean }>
}

const NONE: EntityMetaField[] = []

const DOMAIN_ENTITY: Record<string, EntityConfig> = {

  clinic: {
    singular: 'Patient', plural: 'Patients', singularLower: 'patient',
    catalogSingular: 'Service / Test', catalogPlural: 'Services & Tests',
    metaFields: [
      { key: 'age',               label: 'Age',                type: 'number', placeholder: 'Years',         optional: true  },
      { key: 'gender',            label: 'Gender',             type: 'select', options: ['Male','Female','Other'], optional: true },
      { key: 'dob',               label: 'Date of Birth',      type: 'date',   optional: true },
      { key: 'blood_group',       label: 'Blood Group',        type: 'select', options: ['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'], optional: true },
      { key: 'known_allergies',   label: 'Known Allergies',    type: 'text',   placeholder: 'e.g. Penicillin, Sulfa', optional: true },
      { key: 'chronic_conditions',label: 'Chronic Conditions', type: 'text',   placeholder: 'e.g. Diabetes, Hypertension', optional: true },
      { key: 'emergency_contact', label: 'Emergency Contact',  type: 'text',   placeholder: 'Name / Phone', optional: true },
    ],
    listColumns: [
      { key: 'age',    label: 'Age',    fromMeta: true },
      { key: 'gender', label: 'Gender', fromMeta: true },
    ],
  },

  diagnostic_lab: {
    singular: 'Patient', plural: 'Patients', singularLower: 'patient',
    catalogSingular: 'Test', catalogPlural: 'Tests & Services',
    metaFields: [
      { key: 'age',               label: 'Age',             type: 'number', placeholder: 'Years', optional: true },
      { key: 'gender',            label: 'Gender',          type: 'select', options: ['Male','Female','Other'], optional: true },
      { key: 'dob',               label: 'Date of Birth',   type: 'date',   optional: true },
      { key: 'blood_group',       label: 'Blood Group',     type: 'select', options: ['A+','A-','B+','B-','AB+','AB-','O+','O-','Unknown'], optional: true },
      { key: 'ref_doctor',        label: 'Referring Doctor',type: 'text',   placeholder: 'Dr. Name', optional: true },
      { key: 'known_allergies',   label: 'Known Allergies', type: 'text',   optional: true },
    ],
    listColumns: [
      { key: 'age',        label: 'Age',     fromMeta: true },
      { key: 'gender',     label: 'Gender',  fromMeta: true },
      { key: 'ref_doctor', label: 'Ref. Doctor', fromMeta: true },
    ],
  },

  optical: {
    singular: 'Patient', plural: 'Patients', singularLower: 'patient',
    catalogSingular: 'Service / Lens', catalogPlural: 'Services & Lenses',
    metaFields: [
      { key: 'age',          label: 'Age',           type: 'number', placeholder: 'Years', optional: true },
      { key: 'gender',       label: 'Gender',        type: 'select', options: ['Male','Female','Other'], optional: true },
      { key: 'dob',          label: 'Date of Birth', type: 'date',   optional: true },
      { key: 'occupation',   label: 'Occupation',    type: 'text',   placeholder: 'e.g. IT Professional', optional: true },
    ],
    listColumns: [
      { key: 'age',    label: 'Age',    fromMeta: true },
      { key: 'gender', label: 'Gender', fromMeta: true },
    ],
  },

  pharmacy: {
    singular: 'Patient', plural: 'Patients', singularLower: 'patient',
    catalogSingular: 'Medicine', catalogPlural: 'Medicines',
    metaFields: [
      { key: 'age',               label: 'Age',                type: 'number', placeholder: 'Years', optional: true },
      { key: 'gender',            label: 'Gender',             type: 'select', options: ['Male','Female','Other'], optional: true },
      { key: 'dob',               label: 'Date of Birth',      type: 'date',   optional: true },
      { key: 'chronic_conditions',label: 'Chronic Conditions', type: 'text',   optional: true },
      { key: 'doctor_preference', label: 'Regular Doctor',     type: 'text',   placeholder: 'Dr. Name', optional: true },
    ],
    listColumns: [
      { key: 'age',    label: 'Age',    fromMeta: true },
      { key: 'gender', label: 'Gender', fromMeta: true },
    ],
  },

  gym: {
    singular: 'Member', plural: 'Members', singularLower: 'member',
    catalogSingular: 'Plan / Service', catalogPlural: 'Plans & Services',
    metaFields: [
      { key: 'age',               label: 'Age',               type: 'number', placeholder: 'Years', optional: true },
      { key: 'gender',            label: 'Gender',            type: 'select', options: ['Male','Female','Other'], optional: true },
      { key: 'dob',               label: 'Date of Birth',     type: 'date',   optional: true },
      { key: 'anniversary',       label: 'Anniversary Date',  type: 'date',   optional: true },
      { key: 'emergency_contact', label: 'Emergency Contact', type: 'text',   placeholder: 'Name', optional: true },
      { key: 'emergency_phone',   label: 'Emergency Phone',   type: 'text',   placeholder: '10-digit', optional: true },
      { key: 'health_conditions', label: 'Health Conditions', type: 'text',   placeholder: 'Any injuries or conditions', optional: true },
      { key: 'fitness_goal',      label: 'Fitness Goal',      type: 'select', options: ['Weight Loss','Muscle Gain','Endurance','General Fitness'], optional: true },
    ],
    listColumns: [
      { key: 'age',         label: 'Age',         fromMeta: true },
      { key: 'gender',      label: 'Gender',      fromMeta: true },
      { key: 'fitness_goal',label: 'Goal',        fromMeta: true },
    ],
  },

  coaching: {
    singular: 'Student', plural: 'Students', singularLower: 'student',
    catalogSingular: 'Course / Batch', catalogPlural: 'Courses & Batches',
    metaFields: [
      { key: 'standard',       label: 'Class / Standard',  type: 'text',   placeholder: 'e.g. Class 10, JEE' },
      { key: 'board',          label: 'Board',              type: 'select', options: ['CBSE','ICSE','GSEB','State Board','IIT JEE','NEET','Other'], optional: true },
      { key: 'school',         label: 'School / College',   type: 'text',   optional: true },
      { key: 'parent_name',    label: "Parent's Name",      type: 'text',   optional: true },
      { key: 'parent_phone',   label: "Parent's Phone",     type: 'text',   optional: true },
      { key: 'batch_name',     label: 'Enrolled Batch',     type: 'text',   optional: true },
    ],
    listColumns: [
      { key: 'standard',    label: 'Class',      fromMeta: true },
      { key: 'board',       label: 'Board',      fromMeta: true },
      { key: 'parent_name', label: 'Parent',     fromMeta: true },
    ],
  },

  salon: {
    singular: 'Customer', plural: 'Customers', singularLower: 'customer',
    catalogSingular: 'Service', catalogPlural: 'Services',
    metaFields: [
      { key: 'dob',               label: 'Date of Birth',      type: 'date',   optional: true },
      { key: 'anniversary',       label: 'Anniversary Date',   type: 'date',   optional: true },
      { key: 'stylist_preference',label: 'Preferred Stylist',  type: 'text',   optional: true },
      { key: 'hair_type',         label: 'Hair Type',          type: 'select', options: ['Normal','Dry','Oily','Curly','Wavy'], optional: true },
      { key: 'skin_type',         label: 'Skin Type',          type: 'select', options: ['Normal','Dry','Oily','Combination','Sensitive'], optional: true },
    ],
    listColumns: [
      { key: 'stylist_preference', label: 'Stylist Pref', fromMeta: true },
      { key: 'hair_type',          label: 'Hair Type',    fromMeta: true },
    ],
  },

  restaurant: {
    singular: 'Customer', plural: 'Customers', singularLower: 'customer',
    catalogSingular: 'Menu Item', catalogPlural: 'Menu Items',
    metaFields: [
      { key: 'dob',         label: 'Date of Birth',   type: 'date', optional: true },
      { key: 'anniversary', label: 'Anniversary Date', type: 'date', optional: true },
    ],
    listColumns: [],
  },

  tiffin: {
    singular: 'Subscriber', plural: 'Subscribers', singularLower: 'subscriber',
    catalogSingular: 'Meal Plan', catalogPlural: 'Meal Plans',
    metaFields: [
      { key: 'dob',              label: 'Date of Birth',   type: 'date',   optional: true },
      { key: 'anniversary',      label: 'Anniversary',     type: 'date',   optional: true },
      { key: 'delivery_address', label: 'Delivery Address',type: 'text' },
      { key: 'meal_preference',  label: 'Meal Preference', type: 'select', options: ['Veg','Non-Veg','Jain'] },
      { key: 'delivery_slot',    label: 'Delivery Slot',   type: 'select', options: ['Lunch','Dinner','Both'] },
      { key: 'route',            label: 'Route / Area',    type: 'text',   optional: true },
    ],
    listColumns: [
      { key: 'meal_preference',  label: 'Meal',    fromMeta: true },
      { key: 'delivery_slot',    label: 'Slot',    fromMeta: true },
      { key: 'route',            label: 'Route',   fromMeta: true },
    ],
  },

  hotel: {
    singular: 'Guest', plural: 'Guests', singularLower: 'guest',
    catalogSingular: 'Room Type / Service', catalogPlural: 'Room Types & Services',
    metaFields: [
      { key: 'dob',            label: 'Date of Birth',  type: 'date',   optional: true },
      { key: 'anniversary',    label: 'Anniversary',    type: 'date',   optional: true },
      { key: 'id_proof_type',  label: 'ID Proof Type',  type: 'select', options: ['Aadhaar','PAN','Passport','Voter ID','Driving Licence'], optional: true },
      { key: 'id_proof_no',    label: 'ID Proof No.',   type: 'text',   optional: true },
      { key: 'nationality',    label: 'Nationality',    type: 'text',   placeholder: 'Indian', optional: true },
      { key: 'company',        label: 'Company',        type: 'text',   optional: true },
    ],
    listColumns: [
      { key: 'nationality', label: 'Nationality', fromMeta: true },
      { key: 'company',     label: 'Company',     fromMeta: true },
    ],
  },

  iron_steel: {
    singular: 'Party', plural: 'Buyers / Suppliers', singularLower: 'party',
    catalogSingular: 'Product', catalogPlural: 'Products',
    metaFields: [
      { key: 'gstin',          label: 'GSTIN',                 type: 'text',   placeholder: 'e.g. 24AABCX1234Y1Z5', optional: true },
      { key: 'credit_limit',   label: 'Credit Limit (₹)',      type: 'number', placeholder: '500000',               optional: true },
      { key: 'site_name',      label: 'Site / Project Name',   type: 'text',   placeholder: 'Construction project', optional: true },
    ],
    listColumns: [
      { key: 'gstin',      label: 'GSTIN',        fromMeta: true },
      { key: 'site_name',  label: 'Site',         fromMeta: true },
    ],
  },

  pest_control: {
    singular: 'Client', plural: 'Clients', singularLower: 'client',
    catalogSingular: 'Service', catalogPlural: 'Services',
    metaFields: [
      { key: 'dob',             label: 'Date of Birth',  type: 'date',   optional: true },
      { key: 'anniversary',     label: 'Anniversary',    type: 'date',   optional: true },
      { key: 'property_type',   label: 'Property Type',  type: 'select', options: ['Residential 1BHK','Residential 2BHK','Residential 3BHK','Villa','Commercial Office','Commercial Hotel','Restaurant','Factory'] },
      { key: 'service_address', label: 'Service Address',type: 'text' },
      { key: 'preferred_slot',  label: 'Preferred Slot', type: 'text',   placeholder: 'e.g. Morning, Weekends', optional: true },
    ],
    listColumns: [
      { key: 'property_type',   label: 'Property',  fromMeta: true },
    ],
  },

  photography: {
    singular: 'Client', plural: 'Clients', singularLower: 'client',
    catalogSingular: 'Package', catalogPlural: 'Packages & Services',
    metaFields: [
      { key: 'dob',          label: 'Date of Birth',      type: 'date',   optional: true },
      { key: 'anniversary',  label: 'Anniversary',        type: 'date',   optional: true },
      { key: 'event_type',   label: 'Primary Event Type', type: 'select', options: ['Wedding','Pre-Wedding','Birthday','Corporate','Portrait','Passport'], optional: true },
      { key: 'referral',     label: 'Referred By',        type: 'text',   optional: true },
    ],
    listColumns: [
      { key: 'event_type', label: 'Event Type', fromMeta: true },
    ],
  },

  repair: {
    singular: 'Customer', plural: 'Customers', singularLower: 'customer',
    catalogSingular: 'Service', catalogPlural: 'Services',
    metaFields: [
      { key: 'dob',               label: 'Date of Birth',      type: 'date',   optional: true },
      { key: 'anniversary',       label: 'Anniversary',        type: 'date',   optional: true },
      { key: 'preferred_contact', label: 'Contact Preference', type: 'select', options: ['WhatsApp','Call','SMS'], optional: true },
      { key: 'company',           label: 'Company (if corp.)', type: 'text',   optional: true },
    ],
    listColumns: [],
  },

  laundry: {
    singular: 'Customer', plural: 'Customers', singularLower: 'customer',
    catalogSingular: 'Service', catalogPlural: 'Services',
    metaFields: [
      { key: 'dob',             label: 'Date of Birth',  type: 'date', optional: true },
      { key: 'anniversary',     label: 'Anniversary',    type: 'date', optional: true },
      { key: 'pickup_address',  label: 'Pickup Address', type: 'text', optional: true },
      { key: 'preferred_slot',  label: 'Preferred Slot', type: 'text', placeholder: 'e.g. 8–10 AM', optional: true },
    ],
    listColumns: [
      { key: 'pickup_address', label: 'Pickup Address', fromMeta: true },
    ],
  },
}

// DOB + Anniversary fields added to every customer-facing domain
const CELEBRATION_FIELDS: EntityMetaField[] = [
  { key: 'dob',         label: 'Date of Birth',    type: 'date', optional: true },
  { key: 'anniversary', label: 'Anniversary Date', type: 'date', optional: true },
]

const DEFAULT_CONFIG: EntityConfig = {
  singular: 'Customer', plural: 'Customers', singularLower: 'customer',
  catalogSingular: 'Product', catalogPlural: 'Products',
  metaFields: CELEBRATION_FIELDS,
  listColumns: [],
}

export function getEntityConfig(domainType: string): EntityConfig {
  return DOMAIN_ENTITY[domainType] ?? DEFAULT_CONFIG
}
