"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ImportWizard } from "@/components/creators/import-wizard";

export default function ImportCreatorsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/creators">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Import Creators
          </h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Bulk import creators from a CSV file
          </p>
        </div>
      </div>

      {/* Import Wizard */}
      <ImportWizard />
    </div>
  );
}
