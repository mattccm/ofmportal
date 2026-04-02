import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreatorsSuggestions } from "@/components/suggestions/creators-suggestions";
import { Plus, FileUp, Users } from "lucide-react";
import { NoCreators } from "@/components/empty-states";
import { CreatorsList } from "@/components/creators/creators-list";
import { differenceInDays } from "date-fns";

async function getCreators(agencyId: string) {
  return db.creator.findMany({
    where: { agencyId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          requests: true,
          uploads: true,
        },
      },
      requests: {
        where: {
          status: { in: ["PENDING", "IN_PROGRESS", "SUBMITTED"] },
        },
        select: { id: true },
      },
      uploads: {
        orderBy: { uploadedAt: "desc" },
        take: 1,
        select: { uploadedAt: true },
      },
    },
  });
}

// Get inactive creators for suggestions
function getInactiveCreators(creators: Awaited<ReturnType<typeof getCreators>>) {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  return creators
    .filter((creator) => {
      if (creator.inviteStatus !== "ACCEPTED") return false;
      const lastUpload = creator.uploads[0]?.uploadedAt;
      if (!lastUpload) return true; // Never uploaded
      return lastUpload < twoWeeksAgo;
    })
    .map((creator) => {
      const lastUpload = creator.uploads[0]?.uploadedAt;
      const daysSinceLastSubmission = lastUpload
        ? differenceInDays(new Date(), lastUpload)
        : 30;

      return {
        id: creator.id,
        name: creator.name,
        daysSinceLastSubmission,
      };
    })
    .filter((c) => c.daysSinceLastSubmission >= 14)
    .sort((a, b) => b.daysSinceLastSubmission - a.daysSinceLastSubmission)
    .slice(0, 5);
}

export default async function CreatorsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.agencyId) {
    redirect("/login");
  }

  let creators: Awaited<ReturnType<typeof getCreators>> = [];
  let inactiveCreators: ReturnType<typeof getInactiveCreators> = [];
  let serializedCreators: Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    inviteStatus: string;
    lastLoginAt: Date | null;
    _count: { requests: number; uploads: number };
    requests: { id: string }[];
  }> = [];

  try {
    creators = await getCreators(session.user.agencyId);
    inactiveCreators = getInactiveCreators(creators);

    // Serialize creators for client component
    serializedCreators = creators.map((creator) => ({
      id: creator.id,
      name: creator.name,
      email: creator.email,
      phone: creator.phone,
      inviteStatus: creator.inviteStatus,
      lastLoginAt: creator.lastLoginAt,
      _count: creator._count,
      requests: creator.requests,
    }));
  } catch (error) {
    console.error("CreatorsPage data fetch error:", error);
    // Continue with empty arrays - graceful degradation
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header - Responsive */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Creators</h1>
          <p className="mt-1 text-sm md:text-base text-muted-foreground">
            Manage your creators and their content submissions
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button asChild variant="outline" className="w-full sm:w-auto min-h-[44px]">
            <Link href="/dashboard/creators/groups">
              <Users className="mr-2 h-4 w-4" />
              Groups
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto min-h-[44px]">
            <Link href="/dashboard/creators/import">
              <FileUp className="mr-2 h-4 w-4" />
              Import CSV
            </Link>
          </Button>
          <Button asChild className="w-full sm:w-auto min-h-[44px]">
            <Link href="/dashboard/creators/invite">
              <Plus className="mr-2 h-4 w-4" />
              Invite Creator
            </Link>
          </Button>
        </div>
      </div>

      {/* Smart Suggestions */}
      {creators.length > 0 && (
        <CreatorsSuggestions
          inactiveCreators={inactiveCreators}
          totalCreators={creators.length}
        />
      )}

      {/* Empty State */}
      {creators.length === 0 ? (
        <NoCreators />
      ) : (
        <CreatorsList creators={serializedCreators} />
      )}
    </div>
  );
}
