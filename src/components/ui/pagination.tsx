import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { pageWindow } from "@/features/catalogue/listing-state";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

type Href = ComponentProps<typeof Link>["href"];

const pageLink =
  "grid size-11 place-items-center rounded-full transition-[background-color,color,box-shadow,transform] duration-200 ease-[var(--ease-glass)]";
const quiet = "glass-soft text-ink hover:bg-white/85 active:scale-95";

/**
 * The pages of a list as round glass numbers with an arrow at either end:
 * the first, the last and those around the current one, the gaps as dots;
 * the current page is the leaf pill. Every number is a link, so the pages
 * work without scripts and can be shared. Rendered only when there is
 * more than one page. The product lists and the blog share it.
 */
export function Pagination({
  page,
  totalPages,
  hrefOf,
  labels,
  className,
}: {
  page: number;
  totalPages: number;
  /** The address of a page of the list. */
  hrefOf: (page: number) => Href;
  labels: {
    /** The spoken name of the navigation: "Pages". */
    pagination: string;
    previous: string;
    next: string;
    /** The spoken name of a number: "Page 2 of 5". */
    pageOf: (page: number, total: number) => string;
  };
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav
      aria-label={labels.pagination}
      className={cn("flex items-center justify-center gap-1.5", className)}
    >
      <PageLink
        href={page > 1 ? hrefOf(page - 1) : null}
        label={labels.previous}
        rel="prev"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </PageLink>
      {pageWindow(page, totalPages).map((number, index) =>
        number === null ? (
          <span
            key={`gap-${index}`}
            aria-hidden="true"
            className="text-ink-subtle px-1"
          >
            …
          </span>
        ) : (
          <Link
            key={number}
            href={hrefOf(number)}
            aria-current={number === page ? "page" : undefined}
            aria-label={labels.pageOf(number, totalPages)}
            className={cn(
              pageLink,
              "text-[0.9375rem] font-semibold tabular-nums",
              number === page ? "leaf-gradient shadow-leaf text-white" : quiet,
            )}
          >
            {number}
          </Link>
        ),
      )}
      <PageLink
        href={page < totalPages ? hrefOf(page + 1) : null}
        label={labels.next}
        rel="next"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </PageLink>
    </nav>
  );
}

function PageLink({
  href,
  label,
  rel,
  children,
}: {
  href: Href | null;
  label: string;
  rel: "prev" | "next";
  children: ReactNode;
}) {
  if (!href) {
    return (
      <span aria-hidden="true" className={cn(pageLink, "text-ink-subtle/50")}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      rel={rel}
      aria-label={label}
      className={cn(pageLink, quiet)}
    >
      {children}
    </Link>
  );
}
