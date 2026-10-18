import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { ProductRow, ProductRowItem } from "@/components/home/product-row";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";

/**
 * The categories of the shop as a row of tiles (owner, 2026-10-19: a
 * "popular categories" section under the related products of a product
 * page). Each tile is one link: the category's picture on a mist tile, or
 * the Radhe mark ghosted while the admin has given it none; under it the
 * name, its tagline and how many products it holds; an arrow in the
 * corner turns leaf on hover. The row scrolls and turns like the product
 * rows, and "All products" leads to the whole range. The order is the
 * admin's, as in the header: the API knows no popularity.
 */
export async function CategoryTiles({
  id,
  title,
  categories,
  link,
  linkLabel,
  labels,
}: {
  id: string;
  title: string;
  categories: Category[];
  link: string;
  linkLabel: string;
  labels: { back: string; forward: string };
}) {
  const t = await getTranslations("product");
  const sizes =
    "(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw";

  return (
    <ProductRow
      id={id}
      title={title}
      href="/products"
      link={link}
      linkLabel={linkLabel}
      labels={labels}
    >
      {categories.map((category) => {
        const image = category.image;
        return (
          <ProductRowItem key={category.id}>
            <Link
              href={{
                pathname: "/category/[slug]",
                params: { slug: category.slug },
              }}
              className="group border-line hover:border-line-strong hover:shadow-lift flex h-full flex-col rounded-lg border-[1.5px] bg-white p-2 transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5"
            >
              <span className="bg-mist relative block aspect-[4/3] overflow-hidden rounded-md">
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
                  {t("productCount", { count: category.productCount })}
                </span>
              </span>
            </Link>
          </ProductRowItem>
        );
      })}
    </ProductRow>
  );
}
