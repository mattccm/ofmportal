"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { TemplateBuilder } from "@/components/templates/template-builder";
import { Template, TemplateFormData } from "@/lib/template-types";
import { toast } from "sonner";

// ============================================
// PROPS
// ============================================

interface EditTemplateClientProps {
  template: Template & { categoryId?: string | null };
}

// ============================================
// CLIENT COMPONENT
// ============================================

export function EditTemplateClient({ template }: EditTemplateClientProps) {
  const router = useRouter();

  const initialData: TemplateFormData & { categoryId?: string | null } = {
    name: template.name,
    description: template.description,
    richContent: template.richContent,
    fields: template.fields,
    defaultDueDays: template.defaultDueDays,
    defaultUrgency: template.defaultUrgency,
    isActive: template.isActive,
    categoryId: template.categoryId,
  };

  const handleSave = async (data: TemplateFormData, isDraft: boolean) => {
    const response = await fetch(`/api/templates/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        isActive: isDraft ? template.isActive : data.isActive,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update template");
    }

    if (!isDraft) {
      router.push("/dashboard/templates");
    }
  };

  const handleDuplicate = async () => {
    const response = await fetch(`/api/templates/${template.id}/duplicate`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Failed to duplicate template");
    }

    const newTemplate = await response.json();
    toast.success("Template duplicated");
    router.push(`/dashboard/templates/${newTemplate.id}/edit`);
  };

  const handleDelete = async () => {
    const response = await fetch(`/api/templates/${template.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete template");
    }

    toast.success("Template deleted");
    router.push("/dashboard/templates");
  };

  return (
    <TemplateBuilder
      initialData={initialData}
      templateId={template.id}
      usageCount={template._count?.requests || 0}
      onSave={handleSave}
      onDuplicate={handleDuplicate}
      onDelete={handleDelete}
    />
  );
}
