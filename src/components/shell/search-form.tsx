import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * The product search: a slim field with softly rounded corners (owner,
 * 2026-10-21: no pill, no green outline), the icon at its start and a
 * round leaf button at its end. A plain form that leads to the product
 * list with `?q=`, so it works before any script has loaded; Enter and the
 * button both send it. The focus is marked by a quiet grey outline and
 * the white fill, never the leaf: keyboard users still see where they are.
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
        className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2"
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
        className="placeholder:text-ink-subtle bg-mist hover:bg-cloud focus-visible:outline-line-strong h-10 w-full rounded-sm border-0 pr-12 pl-10.5 text-[0.9375rem] transition-colors duration-150 focus-visible:bg-white focus-visible:outline-[1.5px] focus-visible:outline-offset-0 lg:h-11"
      />
      <button
        type="submit"
        aria-label={t("search")}
        className="bg-leaf-600 hover:bg-leaf-700 absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-full text-white transition-[background-color,transform] duration-150 active:scale-95 lg:size-8"
      >
        <Search aria-hidden="true" className="size-4" strokeWidth={2.5} />
      </button>
    </form>
  );
}
