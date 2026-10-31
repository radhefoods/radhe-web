import { Search, SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ComponentProps } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { listBlogPosts } from "@/features/content/data";
import {
  toBlogQuery,
  toBlogSearchParams,
  type BlogScope,
  type BlogState,
} from "@/features/content/blog-state";
import { Link, getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { BlogCategory, BlogTag } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { PostCard } from "./post-card";

type Href = ComponentProps<typeof Link>["href"];

/** The page a list is on; its pages and its search link back to it. */
export type BlogBase =
  | { pathname: "/blog" }
  | { pathname: "/blog/category/[slug]"; params: { slug: string } }
  | { pathname: "/blog/tag/[tag]"; params: { tag: string } };

/** How many topics the row under the categories holds at most. */
const TAG_ROW = 12;

const chip =
  "flex min-h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-150";
const quietChip = "glass-soft hover:bg-white/90";
const activeChip =
  "bg-ink text-white shadow-[0_6px_16px_-8px_rgb(23_33_27/0.5)]";

/**
 * The body of a page of the blog (doc 19): the search field (on the blog's
 * front page), the categories and the topics as rows of chips with the
 * current one marked, the posts as a grid of cards, and the pages. Its
 * state is the address: `?q=` and `?page=`, as the product lists do.
 */
export async function BlogListing({
  locale,
  base,
  scope,
  state,
  categories,
  tags,
  search = false,
  emptyText,
}: {
  locale: Locale;
  base: BlogBase;
  scope: BlogScope;
  state: BlogState;
  categories: BlogCategory[];
  tags: BlogTag[];
  /** Show the search field of the blog. */
  search?: boolean;
  /** What to say when the list is empty without a search. */
  emptyText: string;
}) {
  const [t, tCatalogue] = await Promise.all([
    getTranslations("blog"),
    getTranslations("catalogue"),
  ]);
  const page = await listBlogPosts(toBlogQuery(state, scope), locale);
  const hrefOf = (number: number): Href =>
    ({ ...base, query: toBlogSearchParams(state, { page: number }) }) as Href;
  const searchId = "blog-search";
  const visibleCategories = categories.filter((c) => c.postCount > 0);
  const visibleTags = tags.slice(0, TAG_ROW);

  return (
    <div className="space-y-5">
      {search && (
        <form
          role="search"
          method="get"
          action={getPathname({ href: "/blog", locale })}
          className="relative max-w-xl"
        >
          <label htmlFor={searchId} className="sr-only">
            {t("search")}
          </label>
          <Search
            aria-hidden="true"
            className="text-ink-subtle pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2"
          />
          <input
            id={searchId}
            type="search"
            name="q"
            defaultValue={state.q}
            minLength={2}
            maxLength={80}
            required
            enterKeyHint="search"
            autoComplete="off"
            placeholder={t("searchPlaceholder")}
            className="placeholder:text-ink-subtle ease-glass focus-visible:outline-leaf-600/40 h-11 w-full rounded-full border-0 bg-white/60 pr-12 pl-11 text-[0.9375rem] shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_0_0_1px_rgb(23_33_27/0.07),0_4px_14px_-8px_rgb(23_33_27/0.12)] transition-[background-color,box-shadow] duration-200 hover:bg-white/80 focus-visible:bg-white focus-visible:shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_0_0_1px_rgb(23_33_27/0.1),0_8px_24px_-12px_rgb(23_33_27/0.2)] focus-visible:outline-[3px] focus-visible:outline-offset-0"
          />
          <button
            type="submit"
            aria-label={t("search")}
            className="leaf-gradient shadow-leaf absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-white transition-[filter,transform] duration-150 hover:brightness-[1.06] active:scale-95"
          >
            <Search aria-hidden="true" className="size-4" strokeWidth={2.5} />
          </button>
        </form>
      )}

      {visibleCategories.length > 0 && (
        <nav aria-label={t("categories")}>
          <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            <li>
              <Link
                href="/blog"
                aria-current={
                  !scope.category && !scope.tag ? "page" : undefined
                }
                className={cn(
                  chip,
                  !scope.category && !scope.tag ? activeChip : quietChip,
                )}
              >
                {t("allPosts")}
              </Link>
            </li>
            {visibleCategories.map((category) => {
              const active = scope.category === category.slug;
              return (
                <li key={category.id}>
                  <Link
                    href={{
                      pathname: "/blog/category/[slug]",
                      params: { slug: category.slug },
                    }}
                    aria-current={active ? "page" : undefined}
                    className={cn(chip, active ? activeChip : quietChip)}
                  >
                    {category.name}
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        active ? "text-white/70" : "text-ink-subtle",
                      )}
                    >
                      {category.postCount}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {visibleTags.length > 0 && (
        <nav aria-label={t("tags")}>
          <ul className="flex flex-wrap gap-2">
            {visibleTags.map(({ tag }) => {
              const active = scope.tag === tag;
              return (
                <li key={tag}>
                  <Link
                    href={{ pathname: "/blog/tag/[tag]", params: { tag } }}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-9 items-center rounded-full border-[1.5px] px-3 text-sm font-semibold transition-colors duration-200",
                      active
                        ? "border-ink bg-ink text-white"
                        : "border-ink/10 text-ink-muted hover:border-ink/25 hover:text-ink hover:bg-white/60",
                    )}
                  >
                    #{tag}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {page.items.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
          <SearchX aria-hidden="true" className="text-ink-subtle size-10" />
          <h2 className="font-display text-ink text-2xl">
            {state.q ? tCatalogue("emptyTitle") : t("emptyTitle")}
          </h2>
          <p className="text-ink-muted max-w-md">
            {state.q ? t("emptySearchText", { query: state.q }) : emptyText}
          </p>
          {(state.q || scope.category || scope.tag) && (
            <Link
              href="/blog"
              className={buttonStyles({ variant: "secondary", size: "sm" })}
            >
              {t("showAll")}
            </Link>
          )}
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {page.items.map((post, index) => (
            <li key={post.id}>
              <PostCard post={post} locale={locale} priority={index < 3} />
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page.page}
        totalPages={page.totalPages}
        hrefOf={hrefOf}
        labels={{
          pagination: tCatalogue("pagination"),
          previous: tCatalogue("previous"),
          next: tCatalogue("next"),
          pageOf: (number, total) =>
            tCatalogue("pageOf", { page: number, total }),
        }}
        className="pt-4"
      />
    </div>
  );
}
