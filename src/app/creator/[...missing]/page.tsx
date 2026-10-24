import { notFound } from "next/navigation";

// Unknown /creator/* URLs render the creator 404 (creator links only) instead
// of the root one, which can't know the path when it is prerendered
export default function CreatorMissingPage() {
  notFound();
}
