import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import { REVALIDATE, TAGS, serverApi } from "@/lib/api/server";
import type { LegalDocument, LegalType } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { LegalText } from "./legal-text";

// The legal texts of the API (terms, pre-order terms, privacy): the version
// that applies now, as the admin wrote it (plain text or Markdown).

const PATHS = {
  terms: "/legal/terms",
  preorder_terms: "/legal/preorder-terms",
  privacy: "/legal/privacy",
} as const;

async function loadDocument(
  type: LegalType,
  locale: Locale,
): Promise<LegalDocument | null> {
  try {
    const { document } = await serverApi.getLegal(type, {
      locale,
      next: { revalidate: REVALIDATE.legal, tags: [TAGS.legal] },
    });
    return document;
  } catch (error) {
    if (hasErrorCode(error, "LEGAL_DOCUMENT_NOT_FOUND")) return null;
    throw error;
  }
}

export async function legalMetadata(
  type: LegalType,
  locale: Locale,
): Promise<Metadata> {
  const document = await loadDocument(type, locale).catch(() => null);
  return {
    title: document?.title,
    alternates: alternates(locale, sameHref(PATHS[type])),
  };
}

export async function LegalDocumentPage({
  type,
  locale,
}: {
  type: LegalType;
  locale: Locale;
}) {
  const document = await loadDocument(type, locale);
  if (!document) notFound();
  const t = await getTranslations("legal");

  return (
    <article className="container-page max-w-3xl space-y-6 py-8 sm:py-12">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
          {document.title}
        </h1>
        <p className="text-ink-muted text-sm">
          {t("version", {
            version: document.version,
            date: formatDate(document.publishedAt, locale),
          })}
        </p>
      </header>
      <LegalText tableLabel={t("table")}>{document.content}</LegalText>
    </article>
  );
}
