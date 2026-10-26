import { z } from "zod";

/**
 * Phone numbers are stored and texted in international E.164 form
 * ("+447700900123"). Creators are all over the world, so a number without its
 * country code can't be guessed safely: "07700 900123" is a UK mobile, but
 * prefixing a default country would text a stranger in another country.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  return /^\+[1-9]\d{6,14}$/.test(s) ? s : null;
}

export const PHONE_FORMAT_HINT = "Add the country code, e.g. +44 7700 900123 or +54 9 11 2345 6789";

/**
 * An optional phone field: blank becomes null, anything else must include its
 * country code and is stored in E.164.
 */
export const optionalPhone = z
  .string()
  .nullable()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined) return undefined;
    if (v === null || v.trim() === "") return null;
    const e164 = toE164(v);
    if (!e164) {
      ctx.addIssue({ code: "custom", message: PHONE_FORMAT_HINT });
      return z.NEVER;
    }
    return e164;
  });
