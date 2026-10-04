"use client";

import { User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/** A small teal dot on the account icon while a customer is signed in. */
export function AccountDot({ className }: { className?: string }) {
  const session = useSession();
  if (session.status !== "customer") return null;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -top-0.5 -right-1 size-2.5 rounded-full bg-teal-600 ring-2 ring-white",
        className,
      )}
    />
  );
}

/** The account in the header. Leads to the account, or to sign in first. */
export function AccountLink({ className }: { className?: string }) {
  const t = useTranslations("nav");
  return (
    <Link
      href="/account"
      aria-label={t("account")}
      className={cn(
        "hover:bg-mist size-11 place-items-center rounded-sm",
        className,
      )}
    >
      <span className="relative">
        <User aria-hidden="true" className="size-6" />
        <AccountDot />
      </span>
    </Link>
  );
}
