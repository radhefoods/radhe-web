import { getTranslations } from "next-intl/server";
import { CategoryCard } from "@/components/catalogue/category-card";
import { ProductRow, ProductRowItem } from "@/components/home/product-row";
import type { StandInPictures } from "@/features/catalogue/categories";
import type { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";
import type { ComponentProps } from "react";

type Href = ComponentProps<typeof Link>["href"];

/**
 * The categories of the shop as a row of cards (`CategoryCard`) that
 * scrolls and turns like the product rows: under the related products of
 * a product page since 2026-10-19 ("Shop by category", the link leads to
 * all products), and right under the hero of the home page since
 * 2026-10-24 ("Popular categories", the link leads to the page of all
 * categories). The order is the admin's, as in the header: the API knows
 * no popularity. `standIns` gives the categories without a picture the
 * picture of their first product.
 */
export async function CategoryTiles({
  id,
  title,
  categories,
  href = "/products",
  link,
  linkLabel,
  labels,
  standIns = {},
}: {
  id: string;
  title: string;
  categories: Category[];
  /** Where the link beside the heading leads; all products unless told. */
  href?: Href;
  link: string;
  linkLabel: string;
  labels: { back: string; forward: string };
  standIns?: StandInPictures;
}) {
  const t = await getTranslations("product");
  // A card of a row: two and a sliver on phones, then three, four, five.
  const sizes =
    "(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw";

  return (
    <ProductRow
      id={id}
      title={title}
      href={href}
      link={link}
      linkLabel={linkLabel}
      labels={labels}
    >
      {categories.map((category) => (
        <ProductRowItem key={category.id}>
          <CategoryCard
            category={category}
            standIn={standIns[category.id] ?? null}
            sizes={sizes}
            countLabel={t("productCount", { count: category.productCount })}
          />
        </ProductRowItem>
      ))}
    </ProductRow>
  );
}
