import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * The product search: a large pill with the icon at its start and a round
 * leaf button at its end (owner, 2026-10-19: larger and more prominent).
 * A plain form that leads to the product list with `?q=`, so it works
 * before any script has loaded; Enter and the button both send it.
 */
export async function SearchForm({
  locale,
  defaultValue,
  id,
  className,
}: {
  locale: Locale;
  defaultValue?: string;
  /** Ids must be unique: the form appears in the header and on the list. */
  id: string;
  className?: string;
}) {
  const t = await getTranslations("common");
  return (
    <form
      role="search"
      method="get"
      action={getPathname({ href: "/products", locale })}
      className={cn("relative", className)}
    >
      <label htmlFor={id} className="sr-only">
        {t("search")}
      </label>
      <Search
        aria-hidden="true"
        className="text-ink-subtle pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 lg:left-5"
      />
      <input
        id={id}
        type="search"
        name="q"
        defaultValue={defaultValue}
        minLength={2}
        maxLength={80}
        required
        enterKeyHint="search"
        autoComplete="off"
        placeholder={t("searchPlaceholder")}
        // A pill on mist with a hairline that turns white while it has the
        // focus; the leaf border is the focus mark next to the outline.
        className="placeholder:text-ink-subtle bg-mist border-line hover:border-line-strong focus-visible:border-leaf-600 h-12 w-full rounded-full border-[1.5px] pr-14 pl-12 text-base transition-colors duration-150 focus-visible:bg-white lg:h-14 lg:pr-16 lg:pl-13"
      />
      <button
        type="submit"
        aria-label={t("search")}
        className="bg-leaf-600 hover:bg-leaf-700 absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-white transition-[background-color,transform] duration-150 active:scale-95 lg:size-11"
      >
        <Search
          aria-hidden="true"
          className="size-4 lg:size-5"
          strokeWidth={2.5}
        />
      </button>
    </form>
  );
}
