import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getLegalDocument } from "@/features/legal/data";
import type { Locale } from "@/i18n/routing";
import type { LegalDocument, LegalType } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import {
  FILE_UNTIL_PUBLISHED,
  LEGAL_HREF,
  legalTitle,
} from "@/lib/legal/pages";
import { alternates, pageUrl, sameHref } from "@/lib/seo/alternates";
import { JsonLd, webPageJsonLd } from "@/lib/seo/json-ld";
import { sharedOpenGraph } from "@/lib/seo/open-graph";
import { LegalText } from "./legal-text";
import {
  StaticLegalPage,
  staticLegalMetadata,
  type StaticLegalName,
} from "./static-legal-page";

// The six legal pages of the API (imprint, shipping information, refund
// policy, terms, privacy policy, right of withdrawal): the version that
// applies now, as the admin wrote it (plain text or Markdown). A page
// without a published version answers 404; the imprint and the right of
// withdrawal show the shop's file until then.

const fileOf = (type: LegalType): StaticLegalName | undefined =>
  (FILE_UNTIL_PUBLISHED as Partial<Record<LegalType, StaticLegalName>>)[type];

/**
 * For search engines and shared links: the admin's title and description
 * (`seo`), the address of the page in both languages, and the Open Graph
 * block. Without a description of the admin the shop says in one sentence
 * what the page is, instead of the tagline every page would share.
 */
export async function legalMetadata(
  type: LegalType,
  locale: Locale,
): Promise<Metadata> {
  const hrefs = sameHref(LEGAL_HREF[type]);
  let document: LegalDocument | null;
  try {
    document = await getLegalDocument(type, locale);
  } catch {
    // The page itself goes to the error page.
    return { alternates: alternates(locale, hrefs) };
  }
  if (!document) {
    const file = fileOf(type);
    // Without a file the page answers 404 and has nothing to describe.
    return file ? staticLegalMetadata(file, locale) : {};
  }

  const [t, tSite, openGraph] = await Promise.all([
    getTranslations({ locale, namespace: "legal" }),
    getTranslations({ locale, namespace: "site" }),
    sharedOpenGraph(locale),
  ]);
  // An API older than 2026-11-11 has no `seo`.
  const title = document.seo?.title || document.title;
  const description = document.seo?.description || t(`descriptions.${type}`);
  return {
    title: legalTitle(title, tSite("name")),
    description,
    alternates: alternates(locale, hrefs),
    openGraph: {
      ...openGraph,
      type: "website",
      title,
      description,
      url: pageUrl(LEGAL_HREF[type], locale),
    },
  };
}

export async function LegalDocumentPage({
  type,
  locale,
}: {
  type: LegalType;
  locale: Locale;
}) {
  const document = await getLegalDocument(type, locale);
  if (!document) {
    const file = fileOf(type);
    if (!file) notFound();
    return <StaticLegalPage name={file} locale={locale} />;
  }
  const t = await getTranslations("legal");
  // A text may exist in one language only; the API then answers it for
  // both and says which it is.
  const language = document.contentLanguage ?? locale;

  return (
    <article className="container-page max-w-3xl py-6 sm:py-10">
      <JsonLd
        data={webPageJsonLd({
          url: pageUrl(LEGAL_HREF[type], locale),
          name: document.title,
          description: document.seo?.description || t(`descriptions.${type}`),
          language,
          modified: document.publishedAt,
        })}
      />
      <div className="glass-strong space-y-6 rounded-3xl p-5 sm:p-8">
        <header className="space-y-2">
          <h1 className="font-display text-ink text-3xl sm:text-4xl">
            {document.title}
          </h1>
          <p className="text-ink-muted text-sm">
            {t("version", {
              version: document.version,
              date: formatDate(document.publishedAt, locale),
            })}
          </p>
        </header>
        {/* The language is named only where it differs from the page's:
            for screen readers, translation tools and search engines. */}
        <LegalText
          tableLabel={t("table")}
          lang={language === locale ? undefined : language}
        >
          {document.content}
        </LegalText>
      </div>
    </article>
  );
}
