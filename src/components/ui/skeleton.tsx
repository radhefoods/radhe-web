import { cn } from "@/lib/cn";

/** A soft grey block that shimmers, standing in for content still loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("shimmer block rounded-sm", className)}
    />
  );
}
