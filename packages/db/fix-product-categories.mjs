import { PrismaClient } from '@prisma/client'

const BASE_URL = 'postgresql://billing_app:localdev123@localhost:5432/billing_db'

// Keyword → category name fragment mapping (product name keywords → category name keyword)
const KEYWORD_MAP = [
  // Electronics
  { words: ['tv', 'qled', 'oled', 'display', 'monitor', 'projector'], cat: 'tv' },
  { words: ['iphone', 'samsung galaxy', 'redmi', 'oneplus', 'vivo', 'oppo', 'realme', 'mobile', 'tablet', 'ipad'], cat: 'mobile' },
  { words: ['laptop', 'macbook', 'pc', 'desktop', 'computer', 'chromebook', 'notebook'], cat: 'laptop' },
  { words: ['speaker', 'headphone', 'earphone', 'airpod', 'airdopes', 'soundbar', 'audio', 'boat', 'jbl', 'sony wh', 'earbuds'], cat: 'audio' },
  { words: ['mouse', 'keyboard', 'webcam', 'router', 'hub', 'cable', 'charger', 'power bank', 'pendrive', 'hard disk', 'peripheral', 'logitech', 'hp mo'], cat: 'peripheral' },
  { words: ['ac ', 'air conditioner', 'cooler', 'fan ', 'refrigerator', 'washing'], cat: 'ac' },
  // Kirana / Grocery
  { words: ['rice', 'basmati', 'wheat', 'flour', 'atta'], cat: 'grain' },
  { words: ['dal', 'pulses', 'lentil', 'chana', 'rajma'], cat: 'pulse' },
  { words: ['oil', 'ghee', 'butter', 'vanaspati'], cat: 'oil' },
  { words: ['sugar', 'jaggery', 'salt', 'spice', 'masala', 'turmeric', 'chilli', 'pepper', 'cumin', 'coriander'], cat: 'spice' },
  { words: ['soap', 'shampoo', 'detergent', 'surf', 'vim', 'dettol', 'lifebuoy', 'colgate', 'harpic', 'phenyl'], cat: 'household' },
  { words: ['biscuit', 'chips', 'snack', 'namkeen', 'chocolate', 'candy', 'wafer', 'parle', 'britannia'], cat: 'snack' },
  { words: ['milk', 'curd', 'paneer', 'cheese', 'amul', 'dairy', 'butter'], cat: 'dairy' },
  { words: ['juice', 'cold drink', 'pepsi', 'cola', 'sprite', 'water', 'beverage'], cat: 'beverage' },
  // Pharmacy
  { words: ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'paracetamol', 'azithro', 'amox', 'cipro', 'metfor', 'omeprazole', 'cetirizine', 'vitamin', 'calcium'], cat: 'medicine' },
  { words: ['surgical', 'gloves', 'mask', 'syringe', 'bandage', 'cotton', 'gauze'], cat: 'surgical' },
  { words: ['glucometer', 'bp monitor', 'nebulizer', 'thermometer', 'oximeter'], cat: 'device' },
  // Restaurant / Food
  { words: ['paneer', 'curry', 'dal makhani', 'butter chicken', 'tikka', 'biryani', 'fried rice', 'noodle', 'pasta', 'pizza', 'burger'], cat: 'main' },
  { words: ['appetizer', 'soup', 'salad', 'starter', 'kebab', 'tikki'], cat: 'starter' },
  { words: ['ice cream', 'gulab', 'dessert', 'sweet', 'halwa', 'kheer', 'rasmalai'], cat: 'dessert' },
  { words: ['chai', 'coffee', 'tea', 'lassi', 'juice', 'mocktail', 'shake'], cat: 'beverage' },
  // Salon
  { words: ['shampoo', 'conditioner', 'hair color', 'wella', 'loreal', 'schwarzkopf', 'hair'], cat: 'hair' },
  { words: ['facial', 'cleanser', 'moisturizer', 'serum', 'toner', 'face'], cat: 'skin' },
  { words: ['nail', 'polish', 'gel', 'nail art'], cat: 'nail' },
  { words: ['waxing', 'threading', 'bleach', 'detan'], cat: 'waxing' },
  // Gym
  { words: ['protein', 'whey', 'mass gainer', 'bcaa', 'creatine', 'pre-workout', 'supplement'], cat: 'supplement' },
  { words: ['dumbbell', 'barbell', 'treadmill', 'cycle', 'bench', 'equipment', 'gloves', 'belt'], cat: 'equipment' },
  { words: ['t-shirt', 'shorts', 'track', 'vest', 'sports wear'], cat: 'apparel' },
  // Automotive
  { words: ['engine oil', 'castrol', 'mobil', 'brake fluid', 'coolant', 'lubricant'], cat: 'lubricant' },
  { words: ['filter', 'spark plug', 'belt', 'chain', 'bulb', 'fuse', 'wire'], cat: 'spare' },
  { words: ['tyre', 'tire', 'tube', 'battery', 'wiper'], cat: 'tyre' },
  // Pest control
  { words: ['cockroach', 'gel', 'spray', 'termite', 'mosquito', 'rodent', 'rat'], cat: 'chemical' },
]

function findCategory(productName, categories) {
  const nameLower = productName.toLowerCase()
  for (const { words, cat } of KEYWORD_MAP) {
    if (words.some(w => nameLower.includes(w))) {
      // Find matching category by checking if any category name contains the cat keyword
      const match = categories.find(c => c.name.toLowerCase().includes(cat))
      if (match) return match
    }
  }
  return null
}

const publicDb = new PrismaClient({ datasources: { db: { url: BASE_URL } } })
const schemas = await publicDb.$queryRawUnsafe(
  `SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 't_%' ORDER BY schema_name`
)
await publicDb.$disconnect()

for (const { schema_name } of schemas) {
  const db = new PrismaClient({ datasources: { db: { url: `${BASE_URL}?schema=${schema_name}` } } })
  const categories = await db.category.findMany({ select: { id: true, name: true } })
  if (!categories.length) { await db.$disconnect(); continue }

  const products = await db.product.findMany({ select: { id: true, name: true } })
  let updated = 0

  for (const product of products) {
    const cat = findCategory(product.name, categories) ?? categories[0]
    await db.product.update({ where: { id: product.id }, data: { categoryId: cat.id } })
    updated++
  }
  console.log(`  ✓ ${schema_name} — ${updated} products categorized`)
  await db.$disconnect()
}
console.log('Done.')
