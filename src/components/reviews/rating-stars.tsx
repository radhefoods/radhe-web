import { Star } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Five stars with the average filled to the decimal: a grey row with a
 * wheat row clipped over it. The figure beside them is the caller's; the
 * spoken label carries the whole meaning. Since 2026-11-02 only for the
 * reviews of orders (doc ORDER_REVIEWS): nothing on a product is rated.
 */
export function RatingStars({
  average,
  label,
  size = "sm",
  className,
}: {
  /** 0 to 5, one decimal. */
  average: number;
  /** "4.6 out of 5, 12 reviews": what a screen reader says instead of the stars. */
  label: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const width = `${Math.max(0, Math.min(5, average)) * 20}%`;
  const star = cn(
    "shrink-0",
    size === "lg" ? "size-6" : size === "md" ? "size-5" : "size-3.5",
  );
  const row = (filled: boolean) => (
    <span className="flex gap-px">
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={cn(star, filled ? "fill-current" : "fill-ink/10")}
          strokeWidth={0}
        />
      ))}
    </span>
  );
  return (
    <span
      role="img"
      aria-label={label}
      className={cn("text-wheat-800 relative inline-flex", className)}
    >
      <span className="text-ink/10">{row(false)}</span>
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 overflow-hidden"
        style={{ width }}
      >
        {row(true)}
      </span>
    </span>
  );
}
