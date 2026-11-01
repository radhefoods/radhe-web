"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField, controlStyles } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { fieldProblems } from "@/lib/api/errors";
import type { Id, MyReview } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { StarPicker } from "./star-picker";

const TEXT_MIN = 10;
const TEXT_MAX = 2000;

/**
 * Writing, or rewriting, the review of a product (doc 22) in a sheet:
 * the stars, an optional title, the text with its count. Every review
 * waits for Radhe Foods before it is shown; the sheet says so on saving.
 */
export function ReviewSheet({
  productId,
  productName,
  orderNumber,
  existing,
  onClose,
  onSaved,
}: {
  productId: Id;
  productName: string;
  /** The delivered order the review comes from, when known. */
  orderNumber?: string | null;
  /** The review to rewrite, if any. */
  existing?: MyReview | null;
  onClose: () => void;
  onSaved: (review: MyReview) => void;
}) {
  const t = useTranslations("reviews");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [text, setText] = useState(existing?.text ?? "");
  const [problems, setProblems] = useState<{
    rating?: string;
    text?: string;
    title?: string;
  }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: typeof problems = {};
    if (rating === null) found.rating = t("ratingMissing");
    if (text.trim().length < TEXT_MIN) found.text = t("textTooShort");
    setProblems(found);
    if (found.rating || found.text) return;
    setBusy(true);
    setError(null);
    try {
      const { review } = await api.saveReview(productId, {
        rating: rating!,
        ...(title.trim() && { title: title.trim() }),
        text: text.trim(),
        ...(orderNumber && { orderNumber }),
        locale,
      });
      onSaved(review);
      onClose();
    } catch (caught) {
      const fromApi = fieldProblems(caught);
      if (fromApi.text || fromApi.title || fromApi.rating) {
        setProblems({
          ...(fromApi.text && { text: t("textTooShort") }),
          ...(fromApi.title && { title: t("titleInvalid") }),
          ...(fromApi.rating && { rating: t("ratingMissing") }),
        });
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("sheetTitle", { name: productName })}
      closeLabel={tCommon("close")}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <StarPicker
          name="review-rating"
          legend={t("rating")}
          value={rating}
          onChange={(value) => {
            setRating(value);
            setProblems((rest) => ({ ...rest, rating: undefined }));
          }}
          labelOf={(value) => t("stars", { count: value })}
          error={problems.rating}
        />
        <TextField
          id="review-title"
          label={t("reviewTitle")}
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={problems.title}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="review-text" className="text-sm font-semibold">
            {t("text")}
          </label>
          <textarea
            id="review-text"
            rows={5}
            maxLength={TEXT_MAX}
            value={text}
            aria-invalid={problems.text ? true : undefined}
            aria-describedby="review-text-hint"
            onChange={(event) => {
              setText(event.target.value);
              setProblems((rest) => ({ ...rest, text: undefined }));
            }}
            className={cn(controlStyles, "py-3")}
          />
          <p
            id="review-text-hint"
            className={cn(
              "flex justify-between text-sm",
              problems.text ? "font-semibold text-red-800" : "text-ink-muted",
            )}
          >
            <span>{problems.text ?? t("textHint")}</span>
            <span className="tabular-nums">
              {text.length} / {TEXT_MAX}
            </span>
          </p>
        </div>
        {error !== null && <ErrorAlert error={error} />}
        <div className="flex flex-col gap-3">
          <Button type="submit" block loading={busy}>
            {t("save")}
          </Button>
          <Button variant="secondary" block disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
