import type { Prisma } from "@prisma/client";

// Pseudo-users back creator comments and use emails ending in ".internal".
// They are not real staff and must be excluded from staff-facing listings.
export const excludePseudoUsers: Prisma.UserWhereInput = {
  email: { not: { endsWith: ".internal" } },
};
