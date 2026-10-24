import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: { absolute: `Messages · ${BRAND.productName}` },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
