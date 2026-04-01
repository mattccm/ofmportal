"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TemplateBuilder } from "@/components/templates/template-builder";
import { TemplateFormData } from "@/lib/template-types";
import { toast } from "sonner";

export default function NewTemplatePage() {
  const router = useRouter();

  const handleSave = async (data: TemplateFormData, isDraft: boolean) => {
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        isActive: isDraft ? false : data.isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create template");
    }

    const template = await response.json();

    if (isDraft) {
      router.push(`/dashboard/templates/${template.id}/edit`);
    } else {
      router.push("/dashboard/templates");
    }
  };

  return (
    <div className="h-full">
      {/* Back Link */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Templates
          </Link>
        </Button>
      </div>

      {/* Template Builder */}
      <TemplateBuilder onSave={handleSave} />
    </div>
  );
}
