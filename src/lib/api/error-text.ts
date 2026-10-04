import { useTranslations } from "next-intl";
import { isApiError } from "./errors";

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Turns an error of the API into a sentence in the customer's language.
 * The API's own `message` is English and for developers; the shop
 * translates the `code` and fills in the numbers the API sends along.
 */
export function useErrorText(): (error: unknown) => string {
  const t = useTranslations("errors");
  return (error) => {
    if (!isApiError(error)) return t("INTERNAL_ERROR");
    const details = (error.details ?? {}) as Record<string, unknown>;
    switch (error.code) {
      case "OTP_COOLDOWN":
        return t("OTP_COOLDOWN", {
          seconds: numberOf(details.retryAfterSeconds),
        });
      case "OTP_LIMIT_REACHED":
        return t("OTP_LIMIT_REACHED", {
          minutes: Math.max(
            1,
            Math.ceil(numberOf(details.retryAfterSeconds) / 60),
          ),
        });
      case "OTP_INVALID":
        return typeof details.attemptsRemaining === "number"
          ? t("OTP_INVALID_ATTEMPTS", { count: details.attemptsRemaining })
          : t("OTP_INVALID");
      case "ADDRESS_LIMIT_REACHED":
        return t("ADDRESS_LIMIT_REACHED", {
          maximum: numberOf(details.maximum),
        });
      case "CART_FULL":
        return t("CART_FULL", { maximum: numberOf(details.maximum) });
      case "CARGO_PRODUCT_LIMIT_REACHED":
        return t("CARGO_PRODUCT_LIMIT_REACHED", {
          remaining: numberOf(details.remaining),
        });
      case "RETURN_QUANTITY_INVALID":
        return t("RETURN_QUANTITY_INVALID", {
          available: numberOf(details.available),
        });
      default:
        return t(error.code);
    }
  };
}
