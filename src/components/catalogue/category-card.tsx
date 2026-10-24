import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ApiImage, Category } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * A category as one card that is one link (owner, 2026-10-19, the tiles
 * under a product page; since 2026-10-24 also "Popular categories" on the
 * home page and the page of all categories). The picture of the category
 * fills a mist tile, cropped; while the admin has given the category none,
 * the picture of its first product stands in on white (`standIn`), and
 * without either the Radhe mark is ghosted on the tile. Under the tile the
 * name, the tagline and how many products the category holds; an arrow in
 * the corner of the tile turns leaf on hover, the picture grows a little
 * and the card lifts.
 *
 * @param sizes how wide the tile is shown, as for `<img sizes>`
 * @param countLabel "12 products", in the visitor's language
 */
export function CategoryCard({
  category,
  standIn = null,
  sizes,
  countLabel,
  className,
}: {
  category: Category;
  standIn?: ApiImage | null;
  sizes: string;
  countLabel: string;
  className?: string;
}) {
  const image = category.image;
  return (
    <Link
      href={{
        pathname: "/category/[slug]",
        params: { slug: category.slug },
      }}
      className={cn(
        "group border-line hover:border-line-strong hover:shadow-lift flex h-full flex-col rounded-lg border-[1.5px] bg-white p-2 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5",
        className,
      )}
    >
      <span
        className={cn(
          "relative block aspect-[4/3] overflow-hidden rounded-md",
          // A product picture is a packshot on white (owner, 2026-10-23);
          // the category's own picture and the mark stand on mist.
          !image && standIn ? "bg-white" : "bg-mist",
        )}
      >
        {image ? (
          // The API's ready-made sizes, as for the product pictures.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image.sizes.medium.url}
            srcSet={`${image.sizes.small.url} ${image.sizes.small.width}w, ${image.sizes.medium.url} ${image.sizes.medium.width}w, ${image.sizes.large.url} ${image.sizes.large.width}w`}
            sizes={sizes}
            width={image.sizes.medium.width}
            height={image.sizes.medium.height}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.04]"
          />
        ) : standIn ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={standIn.sizes.medium.url}
            srcSet={`${standIn.sizes.small.url} ${standIn.sizes.small.width}w, ${standIn.sizes.medium.url} ${standIn.sizes.medium.width}w, ${standIn.sizes.large.url} ${standIn.sizes.large.width}w`}
            sizes={sizes}
            width={standIn.sizes.medium.width}
            height={standIn.sizes.medium.height}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-contain p-3 transition-transform duration-300 ease-out motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <span className="grid size-full place-items-center bg-[radial-gradient(closest-side,rgb(255_255_255_/_0.75),transparent)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/radhe-logo-240.webp"
              srcSet="/brand/radhe-logo-160.webp 160w, /brand/radhe-logo-240.webp 240w"
              sizes="120px"
              width={240}
              height={144}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="w-[44%] max-w-30 opacity-25"
            />
          </span>
        )}
        <span
          aria-hidden="true"
          className="shadow-card text-leaf-700 group-hover:bg-leaf-600 absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-white transition-colors duration-150 group-hover:text-white"
        >
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </span>
      </span>
      <span className="flex flex-1 flex-col gap-0.5 px-2 pt-3 pb-2">
        <span className="font-display text-ink text-[1.0625rem] leading-tight">
          {category.name}
        </span>
        {category.tagline && (
          <span className="text-ink-muted text-[0.8125rem] leading-snug">
            {category.tagline}
          </span>
        )}
        <span className="text-ink-subtle mt-auto pt-1 text-xs font-semibold tabular-nums">
          {countLabel}
        </span>
      </span>
    </Link>
  );
}
