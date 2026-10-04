"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Shown when a page could not be loaded (the API did not answer).
 * `digest` identifies the failure in the server log.
 */
export function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");
  const tErrors = useTranslations("errors");
  return (
    <div className="container-page flex flex-col items-center gap-4 py-20 text-center">
      <h1 className="font-display text-4xl text-blue-900">{t("errorTitle")}</h1>
      <p className="text-ink-muted max-w-md">{t("errorText")}</p>
      <Button onClick={reset}>
        <RotateCw aria-hidden="true" className="size-4" />
        {t("retry")}
      </Button>
      {error.digest && (
        <p className="text-ink-muted text-sm">
          {tErrors("reference", { requestId: error.digest })}
        </p>
      )}
    </div>
  );
}
