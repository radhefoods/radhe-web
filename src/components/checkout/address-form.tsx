"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import {
  EMPTY_ADDRESS,
  addressSchema,
  type AddressFormValues,
} from "@/features/checkout/address-schema";
import { fieldProblems } from "@/lib/api/errors";

type FieldName = keyof AddressFormValues;
type ErrorKey = "required" | "tooLong" | "postalCode" | "phone" | "invalid";

/**
 * The form of a delivery address. It checks what the API checks before
 * sending, and shows what the API still refuses next to the field it names.
 */
export function AddressForm({
  idPrefix,
  initial = EMPTY_ADDRESS,
  showDefault,
  onSave,
  onCancel,
}: {
  /** Makes the ids of the fields unique on the page. */
  idPrefix: string;
  initial?: AddressFormValues;
  /** Offer "use as my standard address" (pointless for the first address). */
  showDefault: boolean;
  /** Stores the address. Throws the error of the API when it refuses. */
  onSave: (values: AddressFormValues) => Promise<void>;
  onCancel?: () => void;
}) {
  const t = useTranslations("address");
  const [error, setError] = useState<unknown>(null);
  const form = useForm<AddressFormValues>({
    resolver: zodResolver(addressSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;

  const errorOf = (name: FieldName) => {
    const message = errors[name]?.message as ErrorKey | undefined;
    return message ? t(`errors.${message}`) : undefined;
  };
  const field = (name: Exclude<FieldName, "isDefault">) => ({
    id: `${idPrefix}-${name}`,
    label: t(name),
    error: errorOf(name),
    ...form.register(name),
  });

  const submit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await onSave(values);
    } catch (caught) {
      const problems = fieldProblems(caught);
      const known = Object.keys(problems).filter(
        (name): name is FieldName => name in EMPTY_ADDRESS,
      );
      if (known.length > 0) {
        for (const name of known) form.setError(name, { message: "invalid" });
        form.setFocus(known[0]);
      } else {
        setError(caught);
      }
    }
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
      <TextField {...field("firstName")} autoComplete="given-name" required />
      <TextField {...field("lastName")} autoComplete="family-name" required />
      <TextField
        {...field("company")}
        autoComplete="organization"
        className="sm:col-span-2"
      />
      <div className="grid grid-cols-[1fr_7rem] gap-4 sm:col-span-2">
        <TextField {...field("street")} autoComplete="address-line1" required />
        <TextField {...field("houseNumber")} required />
      </div>
      <TextField
        {...field("additionalLine")}
        hint={t("additionalLineHint")}
        autoComplete="address-line2"
        className="sm:col-span-2"
      />
      <div className="grid grid-cols-[8rem_1fr] gap-4 sm:col-span-2">
        <TextField
          {...field("postalCode")}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={5}
          required
        />
        <TextField {...field("city")} autoComplete="address-level2" required />
      </div>
      <TextField
        id={`${idPrefix}-country`}
        label={t("country")}
        value={t("germany")}
        readOnly
        disabled
      />
      <TextField
        {...field("phone")}
        hint={t("phoneHint")}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
      />
      {showDefault && (
        <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            className="size-5 accent-blue-600"
            {...form.register("isDefault")}
          />
          {t("isDefault")}
        </label>
      )}
      {error !== null && <ErrorAlert error={error} className="sm:col-span-2" />}
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <Button type="submit" loading={isSubmitting}>
          {t("save")}
        </Button>
        {onCancel && (
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}
