"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

type Href = ComponentProps<typeof Link>["href"];
type Alternates = Partial<Record<Locale, Href>>;

// The language switch keeps the customer on the same page. Most pages have
// the same address pattern in both languages; products and categories have
// a translated slug, which only the page knows. Such a page tells the
// switch through `<LocaleAlternates>`.

const AlternatesContext = createContext<{
  alternates: Alternates;
  setAlternates: (alternates: Alternates) => void;
}>({ alternates: {}, setAlternates: () => {} });

export function LocaleAlternatesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [alternates, setAlternates] = useState<Alternates>({});
  const value = useMemo(() => ({ alternates, setAlternates }), [alternates]);
  return (
    <AlternatesContext.Provider value={value}>
      {children}
    </AlternatesContext.Provider>
  );
}

/** Rendered by a page whose address differs per language. Shows nothing. */
export function LocaleAlternates({ hrefs }: { hrefs: Alternates }) {
  const { setAlternates } = useContext(AlternatesContext);
  // The hrefs are small plain objects: compare them by content.
  const key = JSON.stringify(hrefs);
  useEffect(() => {
    setAlternates(JSON.parse(key) as Alternates);
    return () => setAlternates({});
  }, [key, setAlternates]);
  return null;
}

export function LocaleSwitcher({
  tone = "light",
  className,
}: {
  /** `wheat`: on the wheat promise strip at the top of the page. */
  tone?: "light" | "wheat";
  className?: string;
}) {
  const t = useTranslations("language");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useParams();
  const { alternates } = useContext(AlternatesContext);
  const wheat = tone === "wheat";

  return (
    <nav aria-label={tNav("switchTo")} className={className}>
      <ul
        className={cn(
          "flex items-center gap-0.5 rounded-full p-0.5 text-sm font-bold",
          wheat ? "bg-ink/8" : "bg-mist",
        )}
      >
        {locales.map((other) => {
          const active = other === locale;
          const href =
            alternates[other] ??
            // The same page; its address pattern is filled with the current
            // parameters (a product page then redirects to its own slug).
            ({ pathname, params } as unknown as Href);
          return (
            <li key={other}>
              <Link
                href={href}
                locale={other}
                lang={other}
                hrefLang={other}
                aria-current={active ? "true" : undefined}
                aria-label={t(other)}
                className={cn(
                  "grid place-items-center rounded-full px-2.5 uppercase",
                  wheat ? "h-7 min-w-9 text-xs" : "h-9 min-w-10",
                  active &&
                    (wheat ? "bg-ink text-wheat-400" : "bg-ink text-white"),
                  !active &&
                    (wheat
                      ? "text-ink hover:bg-ink/10"
                      : "text-ink-muted hover:bg-cloud hover:text-ink"),
                )}
              >
                {other}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
