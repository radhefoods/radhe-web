"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { iconControl } from "./icon-control";

/**
 * The wishlist in the header: a heart, for signed-in customers only
 * (owner, 2026-10-19). It leads to the wishlist page of the account, which
 * waits for the API's wishlist; a visitor never sees it.
 */
export function WishlistLink({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const session = useSession();
  if (session.status !== "customer") return null;
  return (
    <Tooltip label={t("wishlist")}>
      <Link
        href="/account/wishlist"
        aria-label={t("wishlist")}
        className={cn(iconControl, className)}
      >
        <Heart aria-hidden="true" className="size-6" />
      </Link>
    </Tooltip>
  );
}
