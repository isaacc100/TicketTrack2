import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash('1234', salt);

  await prisma.staff.create({
    data: {
      name: 'Admin',
      pin: hash,
      rank: 7,
    }
  });

  await prisma.table.createMany({
    data: [
      { number: 1, seats: 2 },
      { number: 2, seats: 4 },
      { number: 3, seats: 4 },
      { number: 4, seats: 6 },
    ]
  });

  await prisma.category.create({
    data: {
      name: 'Mains',
      sortOrder: 1,
      items: {
        create: [
          { name: 'Burger', price: 12.50, kdsStation: 'Grill' },
          { name: 'Pizza', price: 10.00, kdsStation: 'Grill' },
          { name: 'Salad', price: 8.50, kdsStation: 'Grill' },
        ]
      }
    }
  });

  await prisma.category.create({
    data: {
      name: 'Drinks',
      sortOrder: 2,
      items: {
        create: [
          { name: 'Cola', price: 2.50, kdsStation: 'Bar' },
          { name: 'Water', price: 1.50, kdsStation: 'Bar' },
          { name: 'Beer', price: 4.50, kdsStation: 'Bar' },
        ]
      }
    }
  });

  // Create default KDS stations
  await prisma.kdsStation.createMany({
    data: [
      { name: 'Grill', colour: '#ef4444', sortOrder: 1 },
      { name: 'Bar', colour: '#3b82f6', sortOrder: 2 },
    ],
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
