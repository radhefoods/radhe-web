import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CategoryCard } from "@/components/catalogue/category-card";
import {
  shopCategories,
  standInPictures,
} from "@/features/catalogue/categories";
import { getCategories, listProducts } from "@/features/catalogue/data";
import { rowQuery } from "@/features/catalogue/home";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import type { Locale } from "@/i18n/routing";
import type { Category, ProductSummary } from "@/lib/api/types";
import { alternates, sameHref } from "@/lib/seo/alternates";

type Props = PageProps<"/[locale]/categories">;

// The categories and the first products of each come from the catalogue's
// cache (five minutes); the page itself is kept as long, like a product page.
export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("catalogue");
  return {
    title: t("categoriesTitle"),
    description: t("categoriesDescription"),
    alternates: alternates(locale, sameHref("/categories")),
  };
}

/** The first products of a category, for the stand-in picture; none when the catalogue is away. */
async function firstProducts(
  category: Category,
  locale: Locale,
): Promise<ProductSummary[]> {
  try {
    // The same request as the category's row on the home page: one cache entry.
    return (await listProducts(rowQuery(category.slug), locale)).items;
  } catch {
    return [];
  }
}

/**
 * Every category of the shop on one page (owner, 2026-10-24: "See all"
 * beside the popular categories of the home page leads here): the parent
 * categories as the cards of the home page, in a grid, each with its
 * sub-categories as chips under it. Only categories with products are
 * shown; the order is the admin's.
 */
export default async function CategoriesPage({ params }: Props) {
  const locale = await localeOf(params);
  const [t, tNav, tProduct, categories] = await Promise.all([
    getTranslations("catalogue"),
    getTranslations("nav"),
    getTranslations("product"),
    getCategories(locale).then(shopCategories),
  ]);
  const standIns = standInPictures(
    await Promise.all(
      categories.map(async (category) => ({
        category,
        items: category.image ? [] : await firstProducts(category, locale),
      })),
    ),
  );
  // A card of the grid: two on phones, then three, four.
  const sizes = "(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 44vw";

  return (
    <div className="container-page space-y-6 py-6 sm:py-8">
      <header className="space-y-1.5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("categoriesTitle")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("categoriesIntro")}</p>
      </header>

      {categories.length === 0 ? (
        <p className="bg-mist text-ink-muted rounded-lg px-5 py-8 text-center">
          {t("categoriesEmpty")}
        </p>
      ) : (
        <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {categories.map((category) => {
            const children = shopCategories(category.children);
            return (
              <li key={category.id} className="flex flex-col gap-3">
                <CategoryCard
                  category={category}
                  standIn={standIns[category.id] ?? null}
                  sizes={sizes}
                  countLabel={tProduct("productCount", {
                    count: category.productCount,
                  })}
                />
                {children.length > 0 && (
                  <ul
                    aria-label={tNav("subcategoriesOf", {
                      name: category.name,
                    })}
                    className="flex flex-wrap gap-1.5 px-1"
                  >
                    {children.map((child) => (
                      <li key={child.id}>
                        <Link
                          href={{
                            pathname: "/category/[slug]",
                            params: { slug: child.slug },
                          }}
                          className="bg-mist text-ink-muted hover:bg-cloud hover:text-leaf-700 inline-block rounded-full px-2.5 py-1 text-[0.8125rem] font-semibold transition-colors duration-150"
                        >
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
