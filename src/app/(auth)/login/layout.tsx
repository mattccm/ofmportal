import type { Metadata } from "next";
import { linkCardMetadata } from "@/lib/link-cards";

export const metadata: Metadata = {
  title: "Sign in",
  ...linkCardMetadata("login"),
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
