import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { getPageAccess } from "@/lib/access/server";
import { NoAccess } from "@/components/access/no-access";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deserializeTemplate } from "@/lib/templates";
import { EditTemplateClient } from "./edit-template-client";

// DATA FETCHING

async function getTemplate(id: string, agencyId: string) {
  const template = await db.requestTemplate.findFirst({
    where: { id, agencyId },
    include: {
      _count: {
        select: { requests: true },
      },
    },
  });

  if (!template) {
    return null;
  }

  const deserialized = deserializeTemplate(template);
  return {
    ...deserialized,
    categoryId: template.categoryId,
  };
}

// PAGE COMPONENT

interface EditTemplatePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditTemplatePage({
  params,
}: EditTemplatePageProps) {
  const { id } = await params;
  const access = await getPageAccess();
  if (!access.has("templates.edit")) return <NoAccess what="editing templates" roleName={access.role.name} />;

  const template = await getTemplate(id, access.agencyId);

  if (!template) {
    notFound();
  }

  return (
    <div className="h-full">
      {/* Back Link */}
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/templates">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Templates
          </Link>
        </Button>
      </div>

      {/* Template Builder */}
      <EditTemplateClient template={template} />
    </div>
  );
}
