// server/prisma/seed.ts
// ─────────────────────────────────────────────────────────────
// Seeds the minimal data the hello-world PosScreen demo needs:
//   • `demo-customer-1` / `demo-customer-2` — customer accounts for
//     the "Check Account Balance" button and the veresiye (account
//     payment) checkout flow in packages/ui/src/PosScreen.tsx.
//   • Three products — replaces the old hardcoded DEMO_CATALOG that
//     used to live directly in PosScreen.tsx (Inventory MVP moved the
//     catalog into the database; see server/src/routes/products.ts).
//     "Ceramic Mug" is deliberately seeded below its low-stock
//     threshold so the ⚠ Low stock badge has something to show.
//
// Run with: pnpm --filter @pazariopos/server exec prisma db seed
// (also runs automatically after `prisma migrate dev`)
// ─────────────────────────────────────────────────────────────

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const demoAccount = await prisma.account.upsert({
    where: { id: 'demo-customer-1' },
    update: {},
    create: {
      id: 'demo-customer-1',
      name: 'Demo Customer',
      type: 'customer',
      balance: 15000,          // 150.00 in minor units — matches money() formatting in PosScreen
      creditLimit: 100000,     // 1,000.00 — enough headroom for demo veresiye sales
      paymentTermDays: 30,
    },
  })
  console.log('Seeded account:', demoAccount)

  const secondAccount = await prisma.account.upsert({
    where: { id: 'demo-customer-2' },
    update: {},
    create: {
      id: 'demo-customer-2',
      name: 'Ayşe Yılmaz',
      type: 'customer',
      phone: '+90 555 000 00 00',
      balance: 0,
      creditLimit: 50000,      // 500.00 — deliberately lower, for Phase 3 risk-report testing
      paymentTermDays: 14,
    },
  })
  console.log('Seeded account:', secondAccount)

  const productCategories = {
    coffee: await prisma.category.upsert({
      where: { id: 'cat-coffee' },
      update: {},
      create: { id: 'cat-coffee', name: 'Kahve', type: 'product' },
    }),
    accessories: await prisma.category.upsert({
      where: { id: 'cat-accessories' },
      update: {},
      create: { id: 'cat-accessories', name: 'Aksesuar', type: 'product' },
    }),
    dairy: await prisma.category.upsert({
      where: { id: 'cat-dairy' },
      update: {},
      create: { id: 'cat-dairy', name: 'Süt Ürünleri', type: 'product' },
    }),
  }
  console.log('Seeded product categories:', Object.values(productCategories).map(c => c.name).join(', '))

  const products = [
    {
      sku: 'SKU-001',
      name: 'Espresso Beans 250g',
      barcode: ['8690000000017'],
      price: 24900,
      costPrice: 15000,
      taxRate: 0.18,
      stock: 42,
      lowStockThreshold: 10,
      unit: 'piece' as const,
      categoryId: productCategories.coffee.id,
    },
    {
      sku: 'SKU-002',
      name: 'Ceramic Mug',
      barcode: ['8690000000024'],
      price: 8900,
      costPrice: 4500,
      taxRate: 0.18,
      stock: 3,              // deliberately below threshold — demonstrates the low-stock badge
      lowStockThreshold: 5,
      unit: 'piece' as const,
      categoryId: productCategories.accessories.id,
    },
    {
      sku: 'SKU-003',
      name: 'Milk 1L',
      barcode: ['8690000000031'],
      price: 3200,
      costPrice: 2400,
      taxRate: 0.01,
      stock: 60,
      lowStockThreshold: 15,
      unit: 'piece' as const,
      categoryId: productCategories.dairy.id,
    },
  ]

  for (const product of products) {
    const row = await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    })
    console.log('Seeded product:', row.sku, row.name)
  }

  // Gelir/Gider & Finans Phase 1 — default cash register (fixed ID
  // referenced directly by routes/sales.ts when a sale is paid in cash).
  const cashRegister = await prisma.cashRegister.upsert({
    where: { id: 'default-cash-register' },
    update: {},
    create: {
      id: 'default-cash-register',
      name: 'Ana Kasa',
      balance: 0,
    },
  })
  console.log('Seeded cash register:', cashRegister.name)

  const bankAccount = await prisma.bankAccount.upsert({
    where: { id: 'default-bank-account' },
    update: {},
    create: {
      id: 'default-bank-account',
      name: 'İş Bankası - Ana Hesap',
      iban: 'TR000000000000000000000000',
      bankName: 'Türkiye İş Bankası',
      balance: 0,
    },
  })
  console.log('Seeded bank account:', bankAccount.name)

  const incomeCategory = await prisma.category.upsert({
    where: { id: 'cat-satis-geliri' },
    update: {},
    create: { id: 'cat-satis-geliri', name: 'Satış Geliri', type: 'income' },
  })
  const expenseCategory = await prisma.category.upsert({
    where: { id: 'cat-genel-gider' },
    update: {},
    create: { id: 'cat-genel-gider', name: 'Genel Giderler', type: 'expense' },
  })
  console.log('Seeded categories:', incomeCategory.name, '/', expenseCategory.name)

  // Auth Phase 1 — default users. These passwords are DEV-ONLY seed
  // credentials, printed here for convenience; change them (or create
  // real accounts and deactivate these) before any real deployment.
  const adminPasswordHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      name: 'Sistem Yöneticisi',
      role: 'admin',
    },
  })
  console.log(`Seeded user: ${admin.username} (password: admin123 — DEV ONLY, change before production)`)

  const cashierPasswordHash = await bcrypt.hash('kasiyer123', 10)
  const cashier = await prisma.user.upsert({
    where: { username: 'kasiyer1' },
    update: {},
    create: {
      username: 'kasiyer1',
      passwordHash: cashierPasswordHash,
      name: 'Demo Kasiyer',
      role: 'cashier',
    },
  })
  console.log(`Seeded user: ${cashier.username} (password: kasiyer123 — DEV ONLY, change before production)`)
}

main()
  .catch(err => {
    console.error('Seed failed:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
