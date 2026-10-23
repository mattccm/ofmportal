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

  const searchParams = parsed.searchParams;
  const pgbouncer = searchParams.get("pgbouncer") === "true";

  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

  // Supabase's poolers (session 5432 / transaction 6543) require TLS, and
  // present a self-signed cert. Enable TLS (without cert verification) for ANY
  // remote host regardless of whether the URL carries ?sslmode=require — a
  // dropped param must never silently disable SSL and break the connection.
  // Set PGSSL_REJECT_UNAUTHORIZED=true (with a CA available) to enforce it.
  const rejectUnauthorized = process.env.PGSSL_REJECT_UNAUTHORIZED === "true";

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "5432", 10),
    database: parsed.pathname.slice(1), // Remove leading /
    user: parsed.username,
    password: decodeURIComponent(parsed.password || ""),
    ssl: isLocal ? undefined : { rejectUnauthorized },
    // If using pgbouncer/Supavisor, we need transaction mode support
    pgbouncer,
  };
}

function createPrismaClient(): PrismaClient {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL is not set. DB access will throw until it is configured.");
    // Prisma 7 can't construct a client without an adapter, so return a lazy
    // proxy that only throws when the client is actually used (e.g. at build time)
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        if (prop === "then") return undefined; // keep it from looking like a thenable
        throw new Error(`DATABASE_URL is not set; cannot access prisma.${String(prop)}`);
      },
    });
  }

  // Parse the connection URL to extract components
  // This is a workaround for Prisma 7's @prisma/adapter-pg not handling
  // SSL connections properly when using connectionString directly
  // See: https://github.com/prisma/prisma/issues/29252
  const config = parseConnectionUrl(process.env.DATABASE_URL);

  // Create adapter with explicit connection parameters
  // Use small pool size for serverless environments to avoid exhausting Supabase pooler
  const adapter = new PrismaPg({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: config.ssl,
    connectionTimeoutMillis: 10000, // 10 second timeout
    idleTimeoutMillis: 10000, // 10 second idle timeout (reduced to free connections faster)
    max: 2, // Maximum 2 connections per serverless function instance
    min: 0, // Don't keep idle connections
    allowExitOnIdle: true, // Allow the pool to exit when idle
  });

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    adapter,
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// Export as `prisma` for backwards compatibility
export const prisma = db;

// Reuse a single client across the serverless instance's lifetime (and dev HMR)
// so we never accumulate connection pools from repeated module evaluation.
// Don't cache the no-DATABASE_URL proxy so a later evaluation can pick up a real client.
if (process.env.DATABASE_URL) globalForPrisma.prisma = db;
