"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useErrorText } from "@/lib/api/error-text";
import { isApiError, isUnexpectedError } from "@/lib/api/errors";
import { Alert } from "./alert";
import { Button } from "./button";

/**
 * An error of the API, said in the customer's language. When the fault is
 * not the customer's (server, network), the request id is shown so that
 * support can find it; "Try again" appears when a retry is offered.
 */
export function ErrorAlert({
  error,
  title,
  onRetry,
  children,
  className,
}: {
  error: unknown;
  title?: ReactNode;
  onRetry?: () => void;
  children?: ReactNode;
  className?: string;
}) {
  const t = useTranslations("common");
  const tErrors = useTranslations("errors");
  const errorText = useErrorText();
  const requestId = isApiError(error) ? error.requestId : null;
  return (
    <Alert tone="bad" title={title} className={className}>
      <p>{errorText(error)}</p>
      {children}
      {requestId && isUnexpectedError(error) && (
        <p className="text-sm break-all">
          {tErrors("reference", { requestId })}
        </p>
      )}
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          className="mt-2"
        >
          {t("retry")}
        </Button>
      )}
    </Alert>
  );
}
