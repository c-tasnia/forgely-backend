import { PrismaClient } from "@prisma/client";

// Reuse a single instance across hot reloads / serverless invocations
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
