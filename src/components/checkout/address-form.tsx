"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
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
import { cn } from "@/lib/cn";

type FieldName = keyof AddressFormValues;
type ErrorKey = "required" | "tooLong" | "postalCode" | "phone" | "invalid";

/** What the page that holds an `order` form may ask of it. */
export interface AddressFormHandle {
  /**
   * Checks the address the way "Save" would. The values when they hold;
   * `null` when a field is refused, which then shows its message and has
   * the focus.
   */
  validate: () => Promise<AddressFormValues | null>;
}

/**
 * The form of a delivery address. It checks what the API checks before
 * sending, and shows what the API still refuses next to the field it names.
 *
 * Two uses. `saved` (the address book of an account, and a customer at
 * the checkout): the address gets a label, may become the standard one,
 * and is stored with "Save address". `order` (a guest at the checkout,
 * owner, 2026-11-17): the address goes with the one order and nowhere
 * else, so there is no label, no standard and nothing to save; the page
 * asks the form for its values when the order is placed (`handle`).
 *
 * `look="float"` is the checkout's: the labels rest inside the fields,
 * the company hides behind a link until it is wanted, and the country is
 * not a field (the page says where the shop delivers).
 */
export function AddressForm({
  idPrefix,
  initial = EMPTY_ADDRESS,
  showDefault = false,
  mode = "saved",
  look = "plain",
  handle,
  onSave,
  onCancel,
}: {
  /** Makes the ids of the fields unique on the page. */
  idPrefix: string;
  initial?: AddressFormValues;
  /** Offer "use as my standard address" (pointless for the first address). */
  showDefault?: boolean;
  mode?: "saved" | "order";
  look?: "plain" | "float";
  /** For `order`: lets the page check the form and read its values. */
  handle?: Ref<AddressFormHandle>;
  /** Stores the address. Throws the error of the API when it refuses. */
  onSave?: (values: AddressFormValues) => Promise<void>;
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
  const floating = look === "float";
  const saved = mode === "saved";
  // The company is rare: at the checkout it is one tap away, and there
  // from the start when the address has one.
  const [company, setCompany] = useState(!floating || initial.company !== "");
  // Asked for with a tap: the field takes the focus it was opened for.
  const companyAsked = useRef(false);
  useEffect(() => {
    if (company && companyAsked.current) {
      companyAsked.current = false;
      form.setFocus("company");
    }
  }, [company, form]);

  useImperativeHandle(
    handle,
    () => ({
      validate: async () => {
        let values: AddressFormValues | null = null;
        // Resolves once the form has put the focus on a refused field, so
        // the page may move the focus on after it.
        await form.handleSubmit((checked) => {
          values = checked;
        })();
        return values;
      },
    }),
    [form],
  );

  const errorOf = (name: FieldName) => {
    const message = errors[name]?.message as ErrorKey | undefined;
    return message ? t(`errors.${message}`) : undefined;
  };
  const field = (name: Exclude<FieldName, "isDefault">) => ({
    id: `${idPrefix}-${name}`,
    label: t(name),
    error: errorOf(name),
    look,
    ...form.register(name),
  });

  const submit = form.handleSubmit(async (values) => {
    if (!onSave) return;
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
    <form
      method="post"
      onSubmit={submit}
      noValidate
      className={cn("grid sm:grid-cols-2", floating ? "gap-3.5" : "gap-4")}
    >
      {saved && (
        <TextField
          {...field("label")}
          hint={t("labelHint")}
          maxLength={30}
          className="sm:col-span-2"
        />
      )}
      <TextField {...field("firstName")} autoComplete="given-name" required />
      <TextField {...field("lastName")} autoComplete="family-name" required />
      {company && (
        <TextField
          {...field("company")}
          autoComplete="organization"
          className="sm:col-span-2"
        />
      )}
      <div
        className={cn(
          "grid sm:col-span-2",
          floating
            ? "grid-cols-[minmax(0,1fr)_8.75rem] gap-3.5"
            : "grid-cols-[1fr_7rem] gap-4",
        )}
      >
        <TextField {...field("street")} autoComplete="address-line1" required />
        <TextField {...field("houseNumber")} required />
      </div>
      <TextField
        {...field("additionalLine")}
        hint={t("additionalLineHint")}
        autoComplete="address-line2"
        className="sm:col-span-2"
      />
      <div
        className={cn(
          "grid sm:col-span-2",
          floating
            ? "grid-cols-[8.75rem_minmax(0,1fr)] gap-3.5"
            : "grid-cols-[8rem_1fr] gap-4",
        )}
      >
        <TextField
          {...field("postalCode")}
          autoComplete="postal-code"
          inputMode="numeric"
          maxLength={5}
          required
        />
        <TextField {...field("city")} autoComplete="address-level2" required />
      </div>
      {!floating && (
        <TextField
          id={`${idPrefix}-country`}
          label={t("country")}
          value={t("germany")}
          readOnly
          disabled
        />
      )}
      <TextField
        {...field("phone")}
        hint={t("phoneHint")}
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        className={cn(floating && "sm:col-span-2")}
      />
      {!company && (
        <p className="sm:col-span-2">
          <button
            type="button"
            onClick={() => {
              companyAsked.current = true;
              setCompany(true);
            }}
            className="text-leaf-700 hover:text-leaf-800 inline-flex min-h-9 items-center gap-1 rounded-xs text-sm font-semibold underline underline-offset-4"
          >
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.5} />
            {t("addCompany")}
          </button>
        </p>
      )}
      {saved && showDefault && (
        <label className="flex min-h-11 items-center gap-3 sm:col-span-2">
          <input
            type="checkbox"
            className="accent-leaf-600 size-5"
            {...form.register("isDefault")}
          />
          {t("isDefault")}
        </label>
      )}
      {error !== null && <ErrorAlert error={error} className="sm:col-span-2" />}
      {saved && (
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
      )}
    </form>
  );
}
