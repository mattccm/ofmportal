import { Skeleton } from "@/components/ui/skeleton";

/** The Overview's shape while it loads: the finding, the billboard, two shelves. */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading the overview">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-full max-w-[560px]" />
      <Skeleton className="mt-2 h-4 w-full max-w-[420px]" />
      <Skeleton className="mt-6 h-[200px] w-full rounded-[10px] max-[899px]:h-[340px]" />
      {[0, 1].map((row) => (
        <div key={row} className="mt-10">
          <Skeleton className="h-5 w-44" />
          <div className="mt-3 flex gap-4 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-[150px] w-[78%] shrink-0 rounded-[10px] sm:w-[40%] lg:w-[22%]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
