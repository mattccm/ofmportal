import type { Metadata } from "next";
import { BRAND } from "./brand";

/**
 * What a chat app shows when someone pastes a portal link: the title, the
 * line under it and the picture (src/app/og/[card]/route.tsx). Generic on
 * purpose: link previews are fetched by the chat app, so they never carry
 * a name, an email or anything about a request.
 *
 * Picture headings avoid opening with "Yo": the image renderer mis-measures
 * Onest's kerned "Yo" and leaves a gap after the first word.
 */
export const LINK_CARDS = {
  default: {
    title: BRAND.productName,
    description: "Requests, uploads and approvals in one place.",
    heading: "One place for your content",
    line: "Requests, uploads and approvals.",
    action: "Open the portal",
  },
  team: {
    title: `You're invited to the ${BRAND.name} team`,
    description: "Choose a password to set up your account. The link works once and expires in 7 days.",
    heading: `Join the ${BRAND.name} team`,
    line: "Choose a password to set up your account on the portal.",
    action: "Join the team",
  },
  creator: {
    title: `Your ${BRAND.name} creator portal is ready`,
    description: "Set up your account to see what we need, upload your content and track approvals. The link expires in 7 days.",
    heading: "Set up your creator portal",
    line: "See what we need and send your content.",
    action: "Set up my account",
  },
  login: {
    title: `Sign in to ${BRAND.productName}`,
    description: "Requests, uploads and approvals in one place.",
    heading: `Sign in to ${BRAND.name}`,
    line: "Requests, uploads and approvals in one place.",
    action: "Sign in",
  },
} as const;

export type LinkCardKey = keyof typeof LINK_CARDS;

/** Open Graph and Twitter tags for a page; relative image URLs resolve against metadataBase */
export function linkCardMetadata(key: LinkCardKey): Pick<Metadata, "openGraph" | "twitter"> {
  const c = LINK_CARDS[key];
  const image = { url: `/og/${key}.png`, width: 1200, height: 630, alt: c.heading };
  return {
    openGraph: { type: "website", siteName: BRAND.productName, title: c.title, description: c.description, images: [image] },
    twitter: { card: "summary_large_image", title: c.title, description: c.description, images: [image.url] },
  };
}
