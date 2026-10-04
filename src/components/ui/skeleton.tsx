import { cn } from "@/lib/cn";

/** A grey block that stands in for content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("bg-cloud block animate-pulse rounded-sm", className)}
    />
  );
}
