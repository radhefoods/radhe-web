import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Alert } from "@/components/ui/alert";
import type { Locale } from "@/i18n/routing";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { LegalText, PLACEHOLDER } from "./legal-text";

// Legal texts that are not in the API: the legal notice (Impressum), the
// right of withdrawal and the cookie page. They live as Markdown files in
// `content/legal/<name>.<language>.md`, for Radhe Foods to edit. Parts still
// to be filled in are written as `[[placeholder]]` and shown marked.

export type StaticLegalName = "imprint" | "withdrawal" | "cookies";

const PATHS = {
  imprint: "/legal/imprint",
  withdrawal: "/legal/withdrawal",
  cookies: "/legal/cookies",
} as const;

async function loadText(name: StaticLegalName, locale: Locale) {
  const file = path.join(
    process.cwd(),
    "content",
    "legal",
    `${name}.${locale}.md`,
  );
  // The comment at the top of a file is a note for the editor, not content.
  return (await readFile(file, "utf8")).replace(/<!--[\s\S]*?-->/g, "").trim();
}

export async function staticLegalMetadata(
  name: StaticLegalName,
  locale: Locale,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "staticLegal" });
  return {
    title: t(name),
    alternates: alternates(locale, sameHref(PATHS[name])),
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
    <article className="container-page max-w-3xl space-y-6 py-8 sm:py-12">
      <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
        {t(name)}
      </h1>
      {PLACEHOLDER.test(text) && (
        <Alert tone="warn" title={t("templateTitle")}>
          {t("templateText")}
        </Alert>
      )}
      <LegalText tableLabel={tLegal("table")}>{text}</LegalText>
    </article>
  );
}
