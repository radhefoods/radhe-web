import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

/**
 * "Nothing to pay today." The promise of the shop, said wherever the
 * customer decides: on the product, in the cart, at checkout.
 */
export function PayLaterNote({ className }: { className?: string }) {
  const t = useTranslations("cargo");
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-teal-100 bg-teal-50 px-4 py-3.5 text-teal-700",
        className,
      )}
    >
      <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <p className="text-[0.9375rem]">
        <span className="font-bold">{t("payLaterTitle")}</span>{" "}
        {t("payLaterText")}
      </p>
    </div>
  );
}
