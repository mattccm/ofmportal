import { Metadata } from "next";
import { HelpCenter } from "@/components/help/help-center";

export const metadata: Metadata = {
  title: "Help Center | UploadPortal",
  description: "Find answers, guides, and resources to help you get the most out of UploadPortal.",
};

export default function HelpPage() {
  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      <HelpCenter isAuthenticated={true} />
    </div>
  );
}
