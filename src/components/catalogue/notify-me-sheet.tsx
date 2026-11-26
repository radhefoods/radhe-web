"use client";

import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { NotifyControl } from "./notify-me";
import { NotifyMeAsked, NotifyMeForm } from "./notify-me-form";

/**
 * The panel a product card opens for a visitor who taps its bell (doc 26):
 * the product with its size, what "Notify me" does, the form, and after
 * the form what happens next with "Done". Fetched on demand by
 * `NotifyMeBell`; open while the control's form is.
 */
export function NotifyMeSheet({
  control,
  name,
  idBase,
  returnFocusTo,
}: {
  control: NotifyControl;
  /** The name with the size. */
  name: string;
  idBase: string;
  /** The bell: the focus goes back to it when the panel closes. */
  returnFocusTo: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("stockAlerts");
  const tCommon = useTranslations("common");
  const { asked } = control.local;
  return (
    <Sheet
      open={control.local.form}
      onOpenChange={(open) => {
        if (!open) control.closeForm();
      }}
      returnFocusTo={returnFocusTo}
      title={t("notify")}
      closeLabel={tCommon("close")}
    >
      <div className="flex flex-col gap-4">
        <p className="text-[0.9375rem]">
          <span className="block font-semibold">{name}</span>
          <span className="text-ink-muted">{t("hint")}</span>
        </p>
        {asked ? (
          <>
            <NotifyMeAsked answer={asked} />
            <Button variant="secondary" onClick={control.closeForm}>
              {t("done")}
            </Button>
          </>
        ) : (
          <NotifyMeForm control={control} idBase={idBase} />
        )}
      </div>
    </Sheet>
  );
}
