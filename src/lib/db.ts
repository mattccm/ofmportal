import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Parse a PostgreSQL connection URL into its components
 * Handles format: postgresql://user:password@host:port/database?params
 */
function parseConnectionUrl(url: string) {
  const parsed = new URL(url);

  // Extract query params
  const searchParams = parsed.searchParams;
  const sslmode = searchParams.get("sslmode");
  const pgbouncer = searchParams.get("pgbouncer") === "true";

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "5432", 10),
    database: parsed.pathname.slice(1), // Remove leading /
    user: parsed.username,
    password: decodeURIComponent(parsed.password || ""),
    ssl: sslmode === "require" ? { rejectUnauthorized: false } : undefined,
    // If using pgbouncer/Supavisor, we need transaction mode support
    pgbouncer,
  };
}

function createPrismaClient(): PrismaClient {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. Using mock client for build.");
    // Return a minimal client for build time - real queries will fail
    return new PrismaClient({
      log: ["error"],
    });
  }

  // Parse the connection URL to extract components
  // This is a workaround for Prisma 7's @prisma/adapter-pg not handling
  // SSL connections properly when using connectionString directly
  // See: https://github.com/prisma/prisma/issues/29252
  const config = parseConnectionUrl(process.env.DATABASE_URL);

  // Create adapter with explicit connection parameters
  const adapter = new PrismaPg({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    connectionTimeoutMillis: 10000, // 10 second timeout
    idleTimeoutMillis: 30000, // 30 second idle timeout
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
