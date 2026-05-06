import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create bootstrap manager user
  const adminPassword = await hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@example.com',
      passwordHash: adminPassword,
      role: 'manager',
    },
  });

  console.log(`Created admin user: ${admin.email}`);

  // Create a sample customer
  const customer = await prisma.customer.create({
    data: {
      name: 'Demo Customer',
    },
  });

  console.log(`Created customer: ${customer.name}`);

  // Create a sample site
  const site = await prisma.site.create({
    data: {
      customerId: customer.id,
      name: 'Demo Site',
      address: '123 Demo Street',
    },
  });

  console.log(`Created site: ${site.name}`);

  // Create a sample gauge
  const gauge = await prisma.gauge.create({
    data: {
      siteId: site.id,
      label: 'Gauge #001',
    },
  });

  console.log(`Created gauge: ${gauge.label}`);

  console.log('Seeding complete!');
  console.log('');
  console.log('Test credentials:');
  console.log('Email: admin@example.com');
  console.log('Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
