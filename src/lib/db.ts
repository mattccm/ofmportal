import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Using mock client for build.");
    // Return a minimal client for build time - real queries will fail
    return new PrismaClient({
      log: ["error"],
    });
  }

  // Create adapter with connection string config for Prisma 7
  // Note: Connection timeout is configured via DATABASE_URL query params
  // e.g., ?connect_timeout=30&sslmode=require
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    adapter,
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// Export as `prisma` for backwards compatibility
export const prisma = db;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
