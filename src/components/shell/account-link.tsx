"use client";

import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** A small green dot on the account icon while a customer is signed in. */
export function AccountDot({ className }: { className?: string }) {
  const session = useSession();
  if (session.status !== "customer") return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -top-0.5 -right-1 size-2.5 rounded-full bg-green-600 ring-2 ring-white",
        className,
      )}
    />
  );
}

/**
 * The account in the header. Leads to the account, or to sign in first; on
 * wide screens it says which of the two, or greets the customer by name.
 */
export function AccountLink({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const session = useSession();
  const name =
    session.status === "customer" ? session.customer?.firstName : null;
  return (
    <Link
      href="/account"
      aria-label={t("account")}
      className={cn(
        "hover:bg-mist min-h-11 items-center gap-2.5 rounded-md px-2.5",
        className,
      )}
    >
      <span className="relative">
        <User aria-hidden="true" className="size-6" />
        <AccountDot />
      </span>
      <span className="hidden flex-col text-left leading-tight lg:flex">
        <span className="text-sm font-bold">{t("account")}</span>
        <span className="text-ink-subtle max-w-28 truncate text-xs font-medium">
          {name || t("signIn")}
        </span>
      </span>
    </Link>
  );
}
