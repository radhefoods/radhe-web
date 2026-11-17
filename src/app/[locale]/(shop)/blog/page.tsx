import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BlogListing } from "@/components/blog/blog-listing";
import {
  parseBlogState,
  toBlogQuery,
  toBlogQueryString,
} from "@/features/content/blog-state";
import {
  getBlogCategories,
  getBlogTags,
  listBlogPosts,
} from "@/features/content/data";
import { localeOf } from "@/i18n/locale";
import { alternates, sameHref } from "@/lib/seo/alternates";

type Props = PageProps<"/[locale]/blog">;

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("blog");
  const state = parseBlogState(await searchParams);
  const links = alternates(locale, sameHref("/blog"));
  // The list the page shows (the same call, answered once).
  const posts = await listBlogPosts(toBlogQuery(state), locale);
  return {
    title: state.q ? t("searchTitle", { query: state.q }) : t("title"),
    description: t("metaDescription"),
    // A search is a view of the same list: only the list itself (and its
    // further pages) belongs in a search engine, and not before the first
    // post is published: a blog without posts is an empty page.
    robots:
      state.q || posts.total === 0 ? { index: false, follow: true } : undefined,
    alternates:
      !state.q && state.page > 1
        ? { canonical: `${links.canonical}?${toBlogQueryString(state)}` }
        : links,
  };
}

/** The front page of the blog (doc 19): the newest posts, the search, the filters. */
export default async function BlogPage({ params, searchParams }: Props) {
  const locale = await localeOf(params);
  const [t, state, categories, tags] = await Promise.all([
    getTranslations("blog"),
    searchParams.then(parseBlogState),
    getBlogCategories(locale),
    getBlogTags(locale),
  ]);

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {state.q ? t("searchTitle", { query: state.q }) : t("title")}
        </h1>
        {!state.q && <p className="text-ink-muted max-w-2xl">{t("intro")}</p>}
      </header>
      <BlogListing
        locale={locale}
        base={{ pathname: "/blog" }}
        scope={{}}
        state={state}
        categories={categories}
        tags={tags}
        search
        emptyText={t("emptyText")}
      />
    </div>
  );
}
