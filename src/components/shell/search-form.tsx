import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/**
 * The product search. A plain form that leads to the product list with
 * `?q=`, so it works before any script has loaded.
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
        className="text-ink-subtle pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
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
        className="border-line bg-mist placeholder:text-ink-subtle hover:border-line-strong h-12 w-full rounded-md border-[1.5px] pr-4 pl-11 text-base focus-visible:border-blue-600 focus-visible:bg-white focus-visible:outline-offset-1"
      />
    </form>
  );
}
