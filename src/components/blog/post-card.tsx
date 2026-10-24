import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { BlogPostSummary } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { PostImage } from "./post-image";

export const postHref = (slug: string) => ({
  pathname: "/blog/[slug]" as const,
  params: { slug },
});

/** A card of a grid: one on phones, two, then three. */
const CARD_SIZES = "(min-width: 1024px) 30vw, (min-width: 640px) 46vw, 100vw";

/**
 * A post in a list (doc 19): its picture in the card's ratio, the name of
 * its category as a small tracked line, the title, the summary in a few
 * lines, and the date with the reading time at the foot. The whole card
 * leads to the article; the card lifts on hover as the product cards do.
 */
export async function PostCard({
  post,
  locale,
  headingLevel = "h2",
  priority = false,
}: {
  post: BlogPostSummary;
  locale: Locale;
  headingLevel?: "h2" | "h3";
  /** Load the picture at once: the first cards of a page. */
  priority?: boolean;
}) {
  const t = await getTranslations("blog");
  const href = postHref(post.slug);
  const Heading = headingLevel;

  return (
    <article className="group border-line hover:border-line-strong hover:shadow-lift flex h-full flex-col overflow-hidden rounded-lg border-[1.5px] bg-white transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="bg-mist block aspect-[16/9] overflow-hidden"
      >
        <PostImage
          image={post.featuredImage}
          sizes={CARD_SIZES}
          priority={priority}
          className="transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.03]"
        />
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        {post.category && (
          <p className="text-leaf-700 text-[0.6875rem] leading-4 font-bold tracking-[0.1em] uppercase">
            {post.category.name}
          </p>
        )}
        <Heading className="font-display text-ink text-xl leading-snug">
          <Link
            href={href}
            className="hover:text-leaf-700 rounded-xs underline-offset-4 hover:underline"
          >
            {post.title}
          </Link>
        </Heading>
        {post.summary && (
          <p className="text-ink-muted line-clamp-3 text-[0.9375rem]">
            {post.summary}
          </p>
        )}
        <p className="text-ink-subtle mt-auto pt-2 text-sm">
          <time dateTime={post.publishedAt}>
            {formatDate(post.publishedAt, locale)}
          </time>
          {" · "}
          {t("readingTime", { minutes: post.readingMinutes })}
        </p>
      </div>
    </article>
  );
}
