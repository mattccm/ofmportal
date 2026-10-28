import type { Metadata } from "next";
import { linkCardMetadata } from "@/lib/link-cards";

// A creator's invite link: generic, never indexed, and the link (a bearer
// secret) never leaks as a referrer. Chat apps show the creator card.
export const metadata: Metadata = {
  title: "Set up your portal",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
  ...linkCardMetadata("creator"),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
