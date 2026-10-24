import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BlogListing } from "@/components/blog/blog-listing";
import {
  cleanTag,
  parseBlogState,
  toBlogQueryString,
} from "@/features/content/blog-state";
import { getBlogCategories, getBlogTags } from "@/features/content/data";
import { permanentRedirect } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import { alternates, sameHref } from "@/lib/seo/alternates";

type Props = PageProps<"/[locale]/blog/tag/[tag]">;

const tagHref = (tag: string) => ({
  pathname: "/blog/tag/[tag]" as const,
  params: { tag },
});

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const tag = cleanTag((await params).tag);
  if (!tag) return {};
  const t = await getTranslations("blog");
  const state = parseBlogState(await searchParams);
  const links = alternates(locale, sameHref(tagHref(tag)));
  return {
    title: t("tagTitle", { tag }),
    description: t("tagDescription", { tag }),
    robots: state.q ? { index: false, follow: true } : undefined,
    alternates:
      !state.q && state.page > 1
        ? { canonical: `${links.canonical}?${toBlogQueryString(state)}` }
        : links,
  };
}

/** The posts under one topic (a tag), the same word in both languages. */
export default async function BlogTagPage({ params, searchParams }: Props) {
  const locale = await localeOf(params);
  const raw = (await params).tag;
  const tag = cleanTag(raw);
  if (!tag) notFound();
  // Tags are lower-case words (doc 19); the page has one address per tag.
  if (tag !== raw) permanentRedirect({ href: tagHref(tag), locale });
  const [t, state, categories, tags] = await Promise.all([
    getTranslations("blog"),
    searchParams.then(parseBlogState),
    getBlogCategories(locale),
    getBlogTags(locale),
  ]);

  return (
    <div className="container-page space-y-5 py-6 sm:py-8">
      <header className="space-y-1.5">
        <p className="text-leaf-700 text-[0.6875rem] font-bold tracking-[0.1em] uppercase">
          {t("title")}
        </p>
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("tagTitle", { tag })}
        </h1>
      </header>
      <BlogListing
        locale={locale}
        base={tagHref(tag)}
        scope={{ tag }}
        state={state}
        categories={categories}
        tags={tags}
        emptyText={t("emptyTagText")}
      />
    </div>
  );
}
