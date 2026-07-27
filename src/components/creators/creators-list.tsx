"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail,
  Phone,
  MoreHorizontal,
  FileText,
  Clock,
  Upload,
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// TYPES

interface Creator {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  inviteStatus: string;
  isArchived: boolean;
  lastLoginAt: Date | null;
  _count: {
    requests: number;
    uploads: number;
  };
  requests: { id: string }[];
}

interface CreatorsListProps {
  creators: Creator[];
  favoriteIds?: string[];
}

// HELPER FUNCTIONS

function getInviteStatusBadge(status: string, compact = false) {
  const configs: Record<string, { class: string; label: string; shortLabel: string }> = {
    PENDING: {
      class: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
      label: "Invite Pending",
      shortLabel: "Pending",
    },
    ACCEPTED: {
      class: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      label: "Active",
      shortLabel: "Active",
    },
    EXPIRED: {
      class: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      label: "Invite Expired",
      shortLabel: "Expired",
    },
  };

  const config = configs[status];
  if (!config) return null;

  return (
    <Badge variant="outline" className={config.class}>
      {compact ? config.shortLabel : config.label}
    </Badge>
  );
}

// Renders the status badge for a creator: a distinct "Archived" badge when the
// creator is archived, otherwise their invite status badge.
function getCreatorStatusBadge(creator: Creator, compact = false) {
  if (creator.isArchived) {
    return (
      <Badge
        variant="outline"
        className="bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800/60 dark:text-gray-300 dark:border-gray-700"
      >
        Archived
      </Badge>
    );
  }
  return getInviteStatusBadge(creator.inviteStatus, compact);
}

// CREATORS LIST COMPONENT

export function CreatorsList({ creators, favoriteIds = [] }: CreatorsListProps) {
  const [view, setView] = React.useState<"active" | "archived">("active");

  const activeCreators = React.useMemo(
    () => creators.filter((c) => !c.isArchived),
    [creators]
  );
  const archivedCreators = React.useMemo(
    () => creators.filter((c) => c.isArchived),
    [creators]
  );
  const displayCreators = view === "archived" ? archivedCreators : activeCreators;

  return (
    <>
      {/* Active / Archived filter */}
      <div className="flex items-center gap-1 p-1 bg-muted rounded-lg w-fit mb-3">
        <Button
          size="sm"
          variant={view === "active" ? "secondary" : "ghost"}
          className="h-8"
          onClick={() => setView("active")}
        >
          Active ({activeCreators.length})
        </Button>
        <Button
          size="sm"
          variant={view === "archived" ? "secondary" : "ghost"}
          className="h-8"
          onClick={() => setView("archived")}
        >
          Archived ({archivedCreators.length})
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        <p className="text-sm text-muted-foreground px-1">
          {displayCreators.length} {view} creator{displayCreators.length !== 1 ? "s" : ""}
        </p>
        {displayCreators.map((creator) => (
          <Card
            key={creator.id}
            className="card-elevated relative overflow-hidden"
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <Link href={`/dashboard/creators/${creator.id}`}>
                  <Avatar
                    className="h-12 w-12 flex-shrink-0"
                    user={{
                      name: creator.name,
                      email: creator.email,
                      image: creator.avatar,
                    }}
                  />
                </Link>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/dashboard/creators/${creator.id}`}
                        className="font-semibold text-foreground truncate block hover:text-primary transition-colors"
                      >
                        {creator.name}
                      </Link>
                      <p className="text-sm text-muted-foreground truncate">
                        {creator.email}
                      </p>
                    </div>
                    <Link href={`/dashboard/creators/${creator.id}`}>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </Link>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{creator.requests.length} active</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Upload className="h-4 w-4" />
                      <span>{creator._count.uploads} uploads</span>
                    </div>
                  </div>

                  {/* Status & Last Active */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    {getCreatorStatusBadge(creator, true)}
                    <span className="text-xs text-muted-foreground">
                      {creator.lastLoginAt
                        ? `Active ${formatDistanceToNow(creator.lastLoginAt, { addSuffix: true })}`
                        : "Never logged in"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table View */}
      <Card className="card-elevated hidden md:block">
        <CardHeader>
          <CardTitle>{view === "archived" ? "Archived Creators" : "All Creators"}</CardTitle>
          <CardDescription>
            {displayCreators.length} {view} creator{displayCreators.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active Requests</TableHead>
                <TableHead>Total Uploads</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayCreators.map((creator) => (
                <TableRow key={creator.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar
                        user={{
                          name: creator.name,
                          email: creator.email,
                          image: creator.avatar,
                        }}
                      />
                      <div>
                        <Link
                          href={`/dashboard/creators/${creator.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {creator.name}
                        </Link>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" />
                        {creator.email}
                      </div>
                      {creator.phone && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          {creator.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getCreatorStatusBadge(creator)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {creator.requests.length}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      {creator._count.uploads}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {creator.lastLoginAt
                        ? formatDistanceToNow(creator.lastLoginAt, { addSuffix: true })
                        : "Never"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/creators/${creator.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/requests/new?creatorId=${creator.id}`}>
                            New Request
                          </Link>
                        </DropdownMenuItem>
                        {creator.inviteStatus === "PENDING" && (
                          <DropdownMenuItem>Resend Invite</DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

export default CreatorsList;
