import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "./db";
import { rateLimitAsync, RATE_LIMITS } from "./rate-limit";
import * as OTPAuth from "otpauth";
import type { Prisma } from "@prisma/client";

/**
 * Consume a single-use remember-me nonce issued by PUT /api/auth/remember.
 * Atomically marks it used (replay-safe) and returns the bound userId, or null.
 */
async function consumeRememberNonce(nonce: string): Promise<string | null> {
  const tokenHash = crypto.createHash("sha256").update(nonce).digest("hex");
  const marked = await db.rememberAuthNonce.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (marked.count !== 1) return null;
  const record = await db.rememberAuthNonce.findUnique({
    where: { tokenHash },
    select: { userId: true },
  });
  return record?.userId ?? null;
}

/**
 * Write a login event to the security log. Fire-and-forget: a logging failure
 * must never break the login itself.
 */
function logAuthEvent(
  userId: string,
  action: string,
  headers: Record<string, string | undefined>
): void {
  db.activityLog
    .create({
      data: {
        userId,
        action,
        entityType: "User",
        entityId: userId,
        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"] || undefined,
        userAgent: headers["user-agent"] || undefined,
      },
    })
    .catch(() => {});
}

// How often a session's role/agency is re-read from the DB
const SESSION_RECHECK_MS = 5 * 60 * 1000;

// Cookie configuration for iOS Safari PWA support
const useSecureCookies = process.env.NODE_ENV === "production";
const cookiePrefix = useSecureCookies ? "__Secure-" : "";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  // Explicit cookie configuration for iOS Safari PWA persistence
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax", // "lax" works better for PWAs than "strict"
        path: "/",
        secure: useSecureCookies,
        maxAge: 30 * 24 * 60 * 60, // 30 days - match session maxAge
      },
    },
    callbackUrl: {
      name: `${cookiePrefix}next-auth.callback-url`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
    csrfToken: {
      name: `${cookiePrefix}next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
      },
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
        rememberNonce: { label: "Remember Nonce", type: "text" },
        rememberUserId: { label: "Remember User ID", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email) {
          throw new Error("Email required");
        }

        // Remember-me auto-login: a single-use nonce issued by PUT /api/auth/remember
        // (only after a valid pre-validated remember token) stands in for the password.
        // No 2FA re-prompt here: the remember token was minted after a full prior login.
        if (credentials.rememberNonce && credentials.rememberUserId) {
          const nonceUserId = await consumeRememberNonce(credentials.rememberNonce);
          if (!nonceUserId || nonceUserId !== credentials.rememberUserId) {
            throw new Error("Invalid remember token");
          }

          const user = await db.user.findUnique({
            where: { id: nonceUserId },
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
              image: true,
              role: true,
              twoFactorEnabled: true,
              agencyId: true,
              agency: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (!user) {
            throw new Error("Invalid remember token");
          }

          // Verify the nonce-bound user matches the submitted email
          if (user.email.toLowerCase() !== credentials.email.toLowerCase()) {
            throw new Error("Invalid remember token");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar || user.image,
            role: user.role,
            agencyId: user.agencyId,
            agencyName: user.agency?.name || "",
            twoFactorEnabled: user.twoFactorEnabled,
          };
        }

        if (!credentials.password) {
          throw new Error("Email and password required");
        }

        // Rate limit password logins by email + IP (Redis-backed when configured)
        const headers = (req?.headers ?? {}) as Record<string, string | undefined>;
        const ip =
          headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
          headers["x-real-ip"] ||
          "unknown";
        const rl = await rateLimitAsync(
          `login:${credentials.email.toLowerCase()}:${ip}`,
          RATE_LIMITS.login
        );
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again later.");
        }
        // Per-account bucket too, so one account can't be brute-forced from many IPs
        const emailRl = await rateLimitAsync(
          `login:staff-email:${credentials.email.toLowerCase()}`,
          RATE_LIMITS.login
        );
        if (!emailRl.success) {
          throw new Error("Too many login attempts for this account. Please try again later.");
        }

        // Normal login flow
        // Use explicit select to ensure password field is always returned
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true, // Primary avatar field (uploaded by user)
            image: true,  // OAuth/legacy avatar field
            role: true,
            password: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
            preferences: true,
            agencyId: true,
            agency: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        // Ensure password exists before comparing
        if (!user.password) {
          console.error("User has no password set:", user.email);
          throw new Error("Invalid email or password");
        }

        const passwordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!passwordValid) {
          logAuthEvent(user.id, "auth.login.failed", headers);
          throw new Error("Invalid email or password");
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          // Normalize totpCode - handle undefined, null, empty string, "undefined" string
          const totpCode = credentials.totpCode;
          const isCodeMissing = !totpCode ||
            totpCode.trim() === "" ||
            totpCode === "undefined" ||
            totpCode === "null";

          if (isCodeMissing) {
            throw new Error("2FA_REQUIRED");
          }

          const raw = totpCode.trim();
          let isValid = /^\d{6}$/.test(raw) && verifyTwoFactorCode(user.twoFactorSecret, raw);

          // Fall back to a single-use backup code (XXXX-XXXX hex, bcrypt-hashed in preferences)
          if (!isValid) {
            const norm = raw.toUpperCase().replace(/[^0-9A-F]/g, "");
            if (norm.length === 8) {
              const candidate = `${norm.slice(0, 4)}-${norm.slice(4)}`;
              const prefs = (user.preferences as Record<string, unknown>) || {};
              const codes = (prefs.backupCodes as Array<{ code: string; used: boolean; usedAt?: string }>) || [];
              for (let i = 0; i < codes.length; i++) {
                if (!codes[i].used && (await bcrypt.compare(candidate, codes[i].code))) {
                  const updated = codes.map((c, j) =>
                    j === i ? { ...c, used: true, usedAt: new Date().toISOString() } : c
                  );
                  await db.user.update({
                    where: { id: user.id },
                    data: { preferences: { ...prefs, backupCodes: updated } as unknown as Prisma.InputJsonValue },
                  });
                  await db.activityLog
                    .create({
                      data: {
                        userId: user.id,
                        action: "2fa.backup_code_used",
                        entityType: "User",
                        entityId: user.id,
                        metadata: { remaining: updated.filter((c) => !c.used).length },
                        ipAddress: headers["x-forwarded-for"]?.split(",")[0]?.trim() || headers["x-real-ip"] || undefined,
                        userAgent: headers["user-agent"] || undefined,
                      },
                    })
                    .catch(() => {});
                  isValid = true;
                  break;
                }
              }
            }
          }

          if (!isValid) {
            logAuthEvent(user.id, "auth.login.failed", headers);
            throw new Error("Invalid 2FA code");
          }
        }

        logAuthEvent(user.id, "auth.login", headers);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          // Prefer avatar field (uploaded by user), fall back to image (OAuth)
          image: user.avatar || user.image,
          role: user.role,
          agencyId: user.agencyId,
          agencyName: user.agency?.name || "",
          twoFactorEnabled: user.twoFactorEnabled,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.image = user.image;
        token.role = user.role;
        token.agencyId = user.agencyId || "";
        token.agencyName = user.agencyName || "";
        token.twoFactorEnabled = user.twoFactorEnabled;
        token.checkedAt = Date.now();
        token.loginAt = Date.now();
      }

      // Periodically re-read role/agency so removed or demoted staff lose access
      if (
        !user &&
        token.id &&
        (!token.checkedAt || Date.now() - (token.checkedAt as number) > SESSION_RECHECK_MS)
      ) {
        try {
          const fresh = await db.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, agencyId: true, preferences: true, agency: { select: { name: true } } },
          });
          // preferences.sessionsValidAfter (ms) signs out every session issued before it
          const validAfter = Number(
            (fresh?.preferences as Record<string, unknown> | null)?.sessionsValidAfter ?? 0
          );
          // loginAt is stamped once at sign-in (iat changes whenever the cookie is re-encoded)
          const loginAt = typeof token.loginAt === "number" ? token.loginAt : 0;
          if (!fresh || (validAfter > 0 && loginAt < validAfter)) {
            // User removed or sessions revoked: strip identity so every session.user.id / agencyId / role check fails
            return { checkedAt: Date.now() } as unknown as typeof token;
          }
          token.role = fresh.role;
          token.agencyId = fresh.agencyId || "";
          token.agencyName = fresh.agency?.name || "";
          token.checkedAt = Date.now();
        } catch (error) {
          // Keep the existing token on a DB error rather than logging everyone out
          console.error("Session recheck failed:", error);
        }
      }

      // Handle session update (e.g., after enabling 2FA or avatar update)
      if (trigger === "update" && session) {
        if (session.twoFactorEnabled !== undefined) {
          token.twoFactorEnabled = session.twoFactorEnabled;
        }
        if (session.image !== undefined) {
          token.image = session.image;
        }
        if (session.name !== undefined) {
          token.name = session.name;
        }
      }

      return token;
    },
    async session({ session, token }) {
      // Revoked token (user removed, see jwt callback): expose no user at all so
      // `!session?.user` checks fail too, not only `!session?.user?.id` ones
      if (!token.id) {
        return { expires: session.expires } as typeof session;
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.image = token.image as string | null;
        session.user.role = token.role as string;
        session.user.agencyId = token.agencyId as string;
        session.user.agencyName = token.agencyName as string;
        session.user.twoFactorEnabled = token.twoFactorEnabled as boolean;
      }
      return session;
    },
  },
};

// Password hashing utilities
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

// 2FA utilities
export function generateTwoFactorSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function generateTwoFactorQRCodeUrl(
  email: string,
  secret: string
): string {
  const totp = new OTPAuth.TOTP({
    issuer: "CCM",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTwoFactorCode(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    issuer: "CCM",
    label: "user",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
