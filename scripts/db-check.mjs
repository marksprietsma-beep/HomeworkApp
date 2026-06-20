import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const result = await prisma.$queryRaw`SELECT 1 AS ok`;
  console.log('Database connection OK:', result);
} finally {
  await prisma.$disconnect();
}
