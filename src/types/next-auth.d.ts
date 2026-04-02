import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      image: string | null;
      role: string;
      agencyId: string;
      agencyName: string;
      twoFactorEnabled: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    image: string | null;
    role: string;
    agencyId: string | null;
    agencyName: string | undefined;
    twoFactorEnabled: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    image: string | null;
    role: string;
    agencyId: string;
    agencyName: string;
    twoFactorEnabled: boolean;
  }
}
