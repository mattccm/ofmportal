import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

// Deliberately generic: request titles can be explicit, and tab titles show
// up in browser history, task switchers and screen shares.
export const metadata: Metadata = {
  title: { absolute: `Request · ${BRAND.productName}` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
