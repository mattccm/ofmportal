import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";
import * as OTPAuth from "otpauth";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        // Use explicit select to ensure password field is always returned
        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            password: true,
            twoFactorEnabled: true,
            twoFactorSecret: true,
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
          throw new Error("Invalid email or password");
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          // Check if TOTP code is missing or empty (NextAuth may convert undefined to "")
          if (!credentials.totpCode || credentials.totpCode.trim() === "") {
            throw new Error("2FA_REQUIRED");
          }

          const isValid = verifyTwoFactorCode(
            user.twoFactorSecret,
            credentials.totpCode
          );

          if (!isValid) {
            throw new Error("Invalid 2FA code");
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
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
        token.role = user.role;
        token.agencyId = user.agencyId || "";
        token.agencyName = user.agencyName || "";
        token.twoFactorEnabled = user.twoFactorEnabled;
      }

      // Handle session update (e.g., after enabling 2FA)
      if (trigger === "update" && session) {
        token.twoFactorEnabled = session.twoFactorEnabled;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
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
