import type { ProductSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { ProductCard } from "./product-card";

/**
 * Product cards in a grid: two columns on phones, up to four (or five in
 * `wide` lists) on large screens. The first row's pictures load at once.
 */
export function ProductGrid({
  products,
  headingLevel,
  wide = false,
  className,
}: {
  products: ProductSummary[];
  headingLevel?: "h2" | "h3";
  /** The list has the full width of the page (no filter column). */
  wide?: boolean;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4",
        wide && "xl:grid-cols-5",
        className,
      )}
    >
      {products.map((product, index) => (
        <li key={product.id}>
          <ProductCard
            product={product}
            headingLevel={headingLevel}
            priority={index < 4}
          />
        </li>
      ))}
    </ul>
  );
}
