import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import type { Breadcrumb } from "@/lib/api/types";

/**
 * Where the page sits: Home, the categories above it, and optionally the
 * page itself as the last entry (not a link).
 */
export async function Breadcrumbs({
  categories,
  current,
}: {
  categories: Breadcrumb[];
  /** The page itself, when it is not one of the categories. */
  current?: string;
}) {
  const t = await getTranslations("catalogue");
  const tNav = await getTranslations("nav");
  const last = current ? null : categories.at(-1);
  const links = current ? categories : categories.slice(0, -1);
  const separator = (
    <ChevronRight
      aria-hidden="true"
      className="text-ink-subtle size-4 shrink-0"
    />
  );

  return (
    <nav aria-label={t("breadcrumb")}>
      <ol className="text-ink-muted flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
        <li>
          <Link href="/" className="hover:text-ink rounded-xs hover:underline">
            {tNav("home")}
          </Link>
        </li>
        {links.map((category) => (
          <Fragment key={category.id}>
            {separator}
            <li>
              <Link
                href={{
                  pathname: "/category/[slug]",
                  params: { slug: category.slug },
                }}
                className="hover:text-ink rounded-xs hover:underline"
              >
                {category.name}
              </Link>
            </li>
          </Fragment>
        ))}
        {separator}
        <li aria-current="page" className="text-ink font-semibold">
          {current ?? last?.name}
        </li>
      </ol>
    </nav>
  );
}
