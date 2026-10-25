"use client";

import { OverviewWall } from "@/components/overview/overview-wall";
import type { OverviewData } from "./_overview/types";

interface DashboardClientProps {
  data: OverviewData;
  canRemind: boolean;
}

/**
 * The staff Overview. The customisable widget grid (Quick Stats and the other
 * widgets) is replaced by the Title Wall; its components stay in
 * src/components/dashboard for now but are no longer rendered here.
 */
export function DashboardClient({ data, canRemind }: DashboardClientProps) {
  return <OverviewWall data={data} canRemind={canRemind} />;
}
