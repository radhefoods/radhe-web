"use client";

import { Bell, BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { cn } from "@/lib/cn";
import type { NotifyControl } from "./notify-me";
import { NotifyMeAsked, NotifyMeForm } from "./notify-me-form";

// "Notify me" on the product page (doc 26): the block under the pill that
// says why the size cannot be ordered, and the button of the bar the page
// keeps above the tab bar on phones. Both show one control
// (`useNotifyControl` of `notify-me.tsx`, called by `ProductPurchase`).

/**
 * The block under the pill: the button with one line of what it does; for
 * a visitor the form opens in its place and is followed by what happens
 * next; a customer who waits reads so, with the address the email goes to
 * and "Cancel".
 */
export function NotifyMePanel({
  control,
  name,
  id,
  className,
}: {
  control: NotifyControl;
  /** The name with the size, for the spoken labels. */
  name: string;
  /** Of the block: the bar of the page scrolls to it. */
  id: string;
  className?: string;
}) {
  const t = useTranslations("stockAlerts");
  const { waiting, local, email } = control;
  if (!control.offered) return null;

  if (waiting) {
    return (
      <div id={id} className={cn("flex flex-col gap-2", className)}>
        <div className="bg-leaf-50/85 ring-leaf-600/15 flex min-h-12 items-center justify-between gap-2 rounded-full py-1 pr-1.5 pl-5 ring-1">
          <p className="text-leaf-700 flex min-w-0 items-center gap-2 text-[0.9375rem] leading-tight font-semibold">
            <BellRing
              aria-hidden="true"
              className="animate-count-pop size-4.5 shrink-0 fill-current"
            />
            {t("waiting")}
          </p>
          <Button
            variant="quiet"
            size="sm"
            className="min-h-10 shrink-0"
            loading={local.busy}
            aria-label={t("cancelNamed", { name })}
            onClick={() => void control.stop()}
          >
            {t("cancel")}
          </Button>
        </div>
        {email && (
          <p role="status" className="text-ink-muted text-sm break-words">
            {t("customerDone", { email })}
          </p>
        )}
        {local.error !== null && <ErrorAlert error={local.error} />}
      </div>
    );
  }

  if (local.asked) {
    return (
      <div id={id} className={className}>
        <NotifyMeAsked answer={local.asked} />
      </div>
    );
  }

  if (local.form) {
    return (
      <div id={id} className={cn("flex flex-col gap-3", className)}>
        <p className="text-[0.9375rem] font-semibold">{t("hint")}</p>
        <NotifyMeForm control={control} idBase={id} />
      </div>
    );
  }

  return (
    <div id={id} className={cn("flex flex-col gap-2", className)}>
      <Button
        variant="secondary"
        block
        loading={local.busy}
        aria-label={t("notifyNamed", { name })}
        onClick={() => void control.start()}
      >
        <Bell aria-hidden="true" className="size-4.5 shrink-0" />
        {t("notify")}
      </Button>
      <p role="status" className="text-ink-muted text-center text-sm">
        {local.cancelled ? t("cancelled") : t("hint")}
      </p>
      {local.error !== null && <ErrorAlert error={local.error} />}
    </div>
  );
}

/**
 * "Notify me" in the bar above the tab bar, in the place of the pill,
 * while there is something to ask. A customer asks with the tap and reads
 * at the top of the window that it worked (the block of the page may be
 * out of sight); a visitor is led to the form in the page (`panelId`).
 */
export function NotifyMeBarButton({
  control,
  name,
  panelId,
  className,
}: {
  control: NotifyControl;
  name: string;
  panelId: string;
  className?: string;
}) {
  const t = useTranslations("stockAlerts");
  return (
    <Button
      variant="secondary"
      size="sm"
      className={cn("px-3.5", className)}
      loading={control.local.busy}
      aria-label={t("notifyNamed", { name })}
      onClick={async () => {
        if (await control.start({ aloud: true })) {
          document
            .getElementById(panelId)
            ?.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }}
    >
      <Bell aria-hidden="true" className="size-4 shrink-0" />
      {t("notify")}
    </Button>
  );
}
