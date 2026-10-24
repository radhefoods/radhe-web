import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalText } from "@/components/legal/legal-text";
import { Disclosure } from "@/components/ui/disclosure";
import { getFaqs } from "@/features/content/data";
import { localeOf } from "@/i18n/locale";
import { markdownToText } from "@/lib/format/markdown";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { JsonLd, faqPageJsonLd } from "@/lib/seo/json-ld";

type Props = PageProps<"/[locale]/faq">;

export const revalidate = 300;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("faq");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: alternates(locale, sameHref("/faq")),
  };
}

/**
 * The questions and answers the admin keeps (doc 18): each group as a
 * heading with its questions folded under it, in the admin's order, the
 * questions without a group last under their own heading. Every question
 * has an anchor (`#faq-<id>`), so a link can point at one; a folded answer
 * is still in the page for search engines, which also get the questions
 * as `FAQPage` data with the answers as plain words. Nothing is listed
 * while nothing is published.
 */
export default async function FaqPage({ params }: Props) {
  const locale = await localeOf(params);
  const [t, tLegal, groups] = await Promise.all([
    getTranslations("faq"),
    getTranslations("legal"),
    getFaqs(locale),
  ]);
  const questions = groups.flatMap((group) => group.items);

  return (
    <article className="container-page max-w-3xl space-y-8 py-6 sm:py-10">
      {questions.length > 0 && (
        <JsonLd
          data={faqPageJsonLd(
            questions.map((item) => ({
              question: item.question,
              answer: markdownToText(item.answer),
            })),
          )}
        />
      )}
      <header className="space-y-3">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-ink-muted max-w-2xl text-lg">{t("intro")}</p>
      </header>

      {groups.map((group) => {
        const headingId = `faq-group-${group.id ?? "other"}`;
        return (
          <section
            key={group.id ?? "other"}
            aria-labelledby={headingId}
            className="space-y-3"
          >
            <h2
              id={headingId}
              className="font-display text-ink text-2xl sm:text-3xl"
            >
              {group.name ?? t("otherQuestions")}
            </h2>
            <div>
              {group.items.map((item) => (
                <Disclosure
                  key={item.id}
                  id={`faq-${item.id}`}
                  title={item.question}
                  headingLevel="h3"
                  look="row"
                >
                  <LegalText tableLabel={tLegal("table")} demoteHeadings>
                    {item.answer}
                  </LegalText>
                </Disclosure>
              ))}
            </div>
          </section>
        );
      })}
    </article>
  );
}
