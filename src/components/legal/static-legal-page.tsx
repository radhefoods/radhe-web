import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cache } from "react";
import { Alert } from "@/components/ui/alert";
import type { Locale } from "@/i18n/routing";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { LegalText, PLACEHOLDER } from "./legal-text";

// Legal texts of the shop's own files: the cookie page, and the legal
// notice (Impressum) and the right of withdrawal for as long as the admin
// has published no text for them in the panel (`LegalDocumentPage`). They
// live as Markdown files in `content/legal/<name>.<language>.md`. Parts
// still to be filled in are written as `[[placeholder]]` and shown marked.

export type StaticLegalName = "imprint" | "withdrawal" | "cookies";

const PATHS = {
  imprint: "/legal/imprint",
  withdrawal: "/legal/withdrawal",
  cookies: "/legal/cookies",
} as const;

const loadText = cache(async (name: StaticLegalName, locale: Locale) => {
  const file = path.join(
    process.cwd(),
    "content",
    "legal",
    `${name}.${locale}.md`,
  );
  // The comment at the top of a file is a note for the editor, not content.
  return (await readFile(file, "utf8")).replace(/<!--[\s\S]*?-->/g, "").trim();
});

export async function staticLegalMetadata(
  name: StaticLegalName,
  locale: Locale,
): Promise<Metadata> {
  const [t, text] = await Promise.all([
    getTranslations({ locale, namespace: "staticLegal" }),
    loadText(name, locale),
  ]);
  return {
    title: t(name),
    alternates: alternates(locale, sameHref(PATHS[name])),
    // A template with open gaps says of itself that it is not complete:
    // search engines leave it out until it is filled in or, for the legal
    // notice and the right of withdrawal, published in the admin panel.
    ...(PLACEHOLDER.test(text) && { robots: { index: false, follow: true } }),
  };
}

export async function StaticLegalPage({
  name,
  locale,
}: {
  name: StaticLegalName;
  locale: Locale;
}) {
  const [t, tLegal, text] = await Promise.all([
    getTranslations("staticLegal"),
    getTranslations("legal"),
    loadText(name, locale),
  ]);
  return (
    <article className="container-page max-w-3xl py-6 sm:py-10">
      <div className="glass-strong space-y-6 rounded-3xl p-5 sm:p-8">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t(name)}
        </h1>
        {PLACEHOLDER.test(text) && (
          <Alert tone="warn" title={t("templateTitle")}>
            {t("templateText")}
          </Alert>
        )}
        <LegalText tableLabel={tLegal("table")}>{text}</LegalText>
      </div>
    </article>
  );
}
