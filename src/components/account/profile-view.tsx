"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField, controlStyles } from "@/components/ui/field";
import { isFeatureEnabled } from "@/config/env";
import { normalizePhone } from "@/features/checkout/address-schema";
import { useSession, useSessionActions } from "@/features/session/session";
import { locales, type Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { fieldProblems } from "@/lib/api/errors";
import type { Customer } from "@/lib/api/types";
import { SignOutButton } from "./sign-out";

const PHONE = /^\+[1-9]\d{6,14}$/;
const sectionTitle = "font-display text-3xl text-blue-900";
const panel = "border-line flex flex-col gap-4 rounded-xl border bg-white p-5";

/** Name, phone and the language of emails (`PATCH /v1/store/me`). */
function DetailsForm({ customer }: { customer: Customer }) {
  const t = useTranslations("profile");
  const tAddress = useTranslations("address");
  const tLanguage = useTranslations("language");
  const { signedIn } = useSessionActions();
  const [firstName, setFirstName] = useState(customer.firstName ?? "");
  const [lastName, setLastName] = useState(customer.lastName ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [language, setLanguage] = useState<Locale>(customer.locale);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    setError(null);
    const found: Record<string, string> = {};
    for (const [key, value] of [
      ["firstName", firstName],
      ["lastName", lastName],
    ] as const) {
      if (!value.trim()) found[key] = tAddress("errors.required");
      else if (value.trim().length > 80)
        found[key] = tAddress("errors.tooLong");
    }
    const cleanPhone = normalizePhone(phone.trim());
    if (cleanPhone && !PHONE.test(cleanPhone)) {
      found.phone = tAddress("errors.phone");
    }
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      // Only what the API accepts: an empty phone is left out, not sent.
      const result = await api.updateMe({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(cleanPhone && { phone: cleanPhone }),
        locale: language,
      });
      signedIn(result.customer);
      setSaved(true);
    } catch (caught) {
      const fromApi = fieldProblems(caught);
      if (Object.keys(fromApi).length > 0) {
        setProblems(
          Object.fromEntries(
            Object.keys(fromApi).map((field) => [
              field,
              tAddress("errors.invalid"),
            ]),
          ),
        );
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={panel}>
      <h2 className={sectionTitle}>{t("detailsTitle")}</h2>
      <TextField
        id="profile-email"
        label={t("email")}
        value={customer.email}
        hint={t("emailHint")}
        readOnly
        disabled
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="profile-first-name"
          label={t("firstName")}
          autoComplete="given-name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          error={problems.firstName}
        />
        <TextField
          id="profile-last-name"
          label={t("lastName")}
          autoComplete="family-name"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          error={problems.lastName}
        />
      </div>
      <TextField
        id="profile-phone"
        label={t("phone")}
        hint={t("phoneHint")}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={problems.phone}
      />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-language" className="text-sm font-bold">
          {t("language")}
        </label>
        <select
          id="profile-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value as Locale)}
          className={controlStyles}
        >
          {locales.map((locale) => (
            <option key={locale} value={locale}>
              {tLanguage(locale)}
            </option>
          ))}
        </select>
      </div>
      {error !== null && <ErrorAlert error={error} />}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" loading={busy}>
          {t("save")}
        </Button>
        <p role="status" className="font-semibold text-teal-700">
          {saved ? t("saved") : ""}
        </p>
      </div>
    </form>
  );
}

/**
 * How the customer wants to hear from Radhe Foods
 * (`PATCH /v1/store/me/communication`). Each switch is a consent of its own
 * and is stored at once. WhatsApp appears only when the feature is on.
 */
function CommunicationForm({ customer }: { customer: Customer }) {
  const t = useTranslations("profile");
  const tAddress = useTranslations("address");
  const { signedIn } = useSessionActions();
  const whatsappEnabled = isFeatureEnabled("whatsapp");
  const [communication, setCommunication] = useState(customer.communication);
  const [number, setNumber] = useState(
    customer.communication.whatsappNumber ?? "",
  );
  const [numberProblem, setNumberProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function update(
    input: Parameters<typeof api.updateCommunication>[0],
  ): Promise<void> {
    setBusy(true);
    setSaved(false);
    setError(null);
    // The switch moves at once; it moves back when the API refuses.
    const before = communication;
    setCommunication({
      ...communication,
      ...(input.marketingOptIn !== undefined && {
        marketingOptIn: input.marketingOptIn,
      }),
      ...(input.whatsappOptIn !== undefined && {
        whatsappOptIn: input.whatsappOptIn,
      }),
    });
    try {
      const result = await api.updateCommunication(input);
      setCommunication(result.communication);
      signedIn({ ...customer, communication: result.communication });
      setSaved(true);
    } catch (caught) {
      setCommunication(before);
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const checkbox = "mt-0.5 size-6 shrink-0 accent-blue-600";

  return (
    <section aria-labelledby="profile-news" className={panel}>
      <h2 id="profile-news" className={sectionTitle}>
        {t("newsTitle")}
      </h2>
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          className={checkbox}
          checked={communication.marketingOptIn}
          disabled={busy}
          aria-describedby="profile-news-hint"
          onChange={(event) =>
            void update({ marketingOptIn: event.target.checked })
          }
        />
        <span>{t("newsLabel")}</span>
      </label>
      <p id="profile-news-hint" className="text-ink-muted text-sm">
        {t("newsHint")}
      </p>

      {whatsappEnabled && (
        <div className="border-line flex flex-col gap-4 border-t pt-4">
          <h3 className="text-lg font-bold">{t("whatsappTitle")}</h3>
          <form
            className="flex flex-wrap items-end gap-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const clean = normalizePhone(number.trim());
              if (clean && !PHONE.test(clean)) {
                setNumberProblem(tAddress("errors.phone"));
                return;
              }
              setNumberProblem(null);
              // `null` removes the number: the phone of the profile is used.
              void update({ whatsappNumber: clean || null });
            }}
          >
            <TextField
              id="profile-whatsapp"
              label={t("whatsappNumber")}
              hint={t("whatsappHint")}
              type="tel"
              inputMode="tel"
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              error={numberProblem}
              className="min-w-64 flex-1"
            />
            <Button type="submit" variant="secondary" loading={busy}>
              {t("save")}
            </Button>
          </form>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className={checkbox}
              checked={communication.whatsappOptIn}
              disabled={busy}
              onChange={(event) =>
                void update({ whatsappOptIn: event.target.checked })
              }
            />
            <span>{t("whatsappLabel")}</span>
          </label>
        </div>
      )}

      {error !== null && <ErrorAlert error={error} />}
      <p role="status" className="font-semibold text-teal-700">
        {saved ? t("saved") : ""}
      </p>
    </section>
  );
}

export function ProfileView() {
  const t = useTranslations("profile");
  const locale = useLocale();
  const { customer } = useSession({ force: true });
  if (!customer) return null;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t("title")}
      </h1>
      {/* The forms start from the stored profile; a new language reloads them. */}
      <DetailsForm key={`${customer.id}-${locale}`} customer={customer} />
      <CommunicationForm customer={customer} />
      <section aria-labelledby="profile-session" className={panel}>
        <h2 id="profile-session" className={sectionTitle}>
          {t("sessionTitle")}
        </h2>
        <div className="flex flex-wrap items-start gap-3">
          <SignOutButton />
          <SignOutButton everywhere variant="quiet" />
        </div>
        <Alert tone="info">{t("signOutAllHint")}</Alert>
      </section>
    </div>
  );
}
