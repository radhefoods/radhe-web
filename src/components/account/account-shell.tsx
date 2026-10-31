"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/features/session/session";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { parseReturnTo } from "@/lib/navigation/return-to";

const SECTIONS = [
  { href: "/account", key: "overview" },
  { href: "/account/orders", key: "orders" },
  { href: "/account/invoices", key: "invoices" },
  { href: "/account/addresses", key: "addresses" },
  { href: "/account/profile", key: "profile" },
  { href: "/wishlist", key: "wishlist" },
] as const;

/**
 * The frame of the account pages. Everything in the account belongs to one
 * customer and is read in the browser, with the session cookies; a visitor
 * without a session is sent to sign in and comes back to the same page.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const t = useTranslations("account");
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const session = useSession({ force: true });

  // The page to come back to: the address pattern, with the order number
  // filled in where the page has one.
  const orderNumber =
    typeof params.orderNumber === "string" ? params.orderNumber : null;
  const here = parseReturnTo(
    orderNumber ? `/account/orders/${orderNumber}` : pathname,
  );

  useEffect(() => {
    if (session.status === "guest") {
      router.replace({ pathname: "/sign-in", query: { returnTo: here } });
    }
  }, [session.status, router, here]);

  return (
    <div className="container-page grid gap-6 py-6 sm:py-8 lg:grid-cols-[13rem_1fr] lg:gap-12">
      <nav aria-label={t("navLabel")} className="min-w-0">
        {/* A segmented control on phones and tablets: a frosted track, the
    current section on a white thumb; a column of pills from `lg`
    (2026-10-31). */}
        <ul className="glass-soft no-scrollbar lg:glass -mx-4 flex gap-1 overflow-x-auto rounded-full p-1 sm:mx-0 lg:flex-col lg:gap-0.5 lg:rounded-2xl lg:p-2">
          {SECTIONS.map(({ href, key }) => {
            const active =
              href === "/account"
                ? pathname === "/account"
                : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ease-glass flex min-h-10 items-center rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200 lg:min-h-11 lg:rounded-xl",
                    active
                      ? "text-leaf-700 bg-white shadow-[0_1px_2px_rgb(23_33_27/0.08),0_4px_12px_-4px_rgb(23_33_27/0.16)]"
                      : "text-ink-muted hover:text-ink hover:bg-white/60",
                  )}
                >
                  {t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0">
        {session.status === "customer" ? (
          children
        ) : (
          <div className="space-y-4" aria-hidden="true">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
          </div>
        )}
      </div>
    </div>
  );
}
