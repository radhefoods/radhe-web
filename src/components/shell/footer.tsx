import { getTranslations } from "next-intl/server";
import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { Category } from "@/lib/api/types";
import { Logo } from "./logo";

type Href = ComponentProps<typeof Link>["href"];

function Column({
  title,
  links,
}: {
  title: string;
  links: { href: Href; label: ReactNode; key: string }[];
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase">
        {title}
      </h2>
      <ul className="mt-4 flex flex-col gap-2.5 text-[0.9375rem]">
        {links.map((link) => (
          <li key={link.key}>
            <Link
              href={link.href}
              className="hover:text-leaf-700 rounded-sm font-semibold transition-colors duration-150"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * The foot of every shop page: the range, help, and the legal pages German
 * law wants within reach of every page. On mist, the quiet surface of the
 * shop, where the logo reads as on white.
 */
export async function Footer({ categories }: { categories: Category[] }) {
  const t = await getTranslations("footer");
  const tNav = await getTranslations("nav");

  return (
    <footer className="bg-mist mt-16 pb-36 md:pb-0">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo className="h-12 sm:h-14" />
          <p className="text-ink-muted max-w-sm text-[0.9375rem]">
            {t("about")}
          </p>
        </div>
        <Column
          title={t("shop")}
          links={[
            {
              key: "all",
              href: "/products",
              label: tNav("allProducts"),
            },
            ...categories.map((category) => ({
              key: category.id,
              href: {
                pathname: "/category/[slug]" as const,
                params: { slug: category.slug },
              },
              label: category.name,
            })),
          ]}
        />
        <Column
          title={t("help")}
          links={[
            {
              key: "how",
              href: "/how-it-works",
              label: t("howItWorks"),
            },
            {
              key: "delivery",
              href: "/delivery-and-payment",
              label: t("delivery"),
            },
            { key: "faq", href: "/faq", label: t("faq") },
            { key: "blog", href: "/blog", label: t("blog") },
            { key: "account", href: "/account", label: t("account") },
          ]}
        />
        <Column
          title={t("legal")}
          links={[
            { key: "terms", href: "/legal/terms", label: t("terms") },
            {
              key: "withdrawal",
              href: "/legal/withdrawal",
              label: t("withdrawal"),
            },
            { key: "privacy", href: "/legal/privacy", label: t("privacy") },
            { key: "cookies", href: "/legal/cookies", label: t("cookies") },
            { key: "imprint", href: "/legal/imprint", label: t("imprint") },
          ]}
        />
      </div>
      <div className="border-line-strong border-t">
        <div className="container-page text-ink-subtle flex flex-wrap justify-between gap-x-6 gap-y-1 py-5 text-sm">
          <p>{t("rights", { year: new Date().getFullYear() })}</p>
          <p>{t("priceNote")}</p>
        </div>
      </div>
    </footer>
  );
}
