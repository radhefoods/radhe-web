import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PayLaterNote } from "@/components/cargo/pay-later-note";
import { buttonStyles } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { localeOf } from "@/i18n/locale";
import { alternates, sameHref } from "@/lib/seo/alternates";
import { JsonLd } from "@/lib/seo/json-ld";

type Props = PageProps<"/[locale]/how-it-works">;

const QUESTIONS = [1, 2, 3, 4, 5, 6] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await localeOf(params);
  const t = await getTranslations("help.howItWorks");
  return {
    title: t("title"),
    description: t("metaDescription"),
    alternates: alternates(locale, sameHref("/how-it-works")),
  };
}

/** The pre-order explained: three steps, then the questions customers ask. */
export default async function HowItWorksPage({ params }: Props) {
  await localeOf(params);
  const [t, tHome] = await Promise.all([
    getTranslations("help.howItWorks"),
    getTranslations("home"),
  ]);
  const steps = [
    { title: tHome("step1Title"), text: tHome("step1Text") },
    { title: tHome("step2Title"), text: tHome("step2Text") },
    { title: tHome("step3Title"), text: tHome("step3Text") },
  ];
  const faq = QUESTIONS.map((n) => ({
    question: t(`q${n}`),
    answer: t(`a${n}`),
  }));

  return (
    <article className="container-page max-w-4xl space-y-10 py-8 sm:py-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faq.map(({ question, answer }) => ({
            "@type": "Question",
            name: question,
            acceptedAnswer: { "@type": "Answer", text: answer },
          })),
        }}
      />
      <header className="space-y-3">
        <h1 className="font-display text-4xl text-blue-900 sm:text-6xl">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-lg">{t("intro")}</p>
      </header>

      <ol className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="bg-mist flex flex-col gap-2 rounded-lg p-5 sm:p-6"
          >
            <span
              aria-hidden="true"
              className="font-display text-5xl leading-none text-blue-600"
            >
              {index + 1}
            </span>
            <h2 className="text-lg font-bold">{step.title}</h2>
            <p className="text-ink-muted text-[0.9375rem]">{step.text}</p>
          </li>
        ))}
      </ol>

      <PayLaterNote className="max-w-2xl" />

      <section aria-labelledby="how-faq" className="space-y-4">
        <h2
          id="how-faq"
          className="font-display text-3xl text-blue-900 sm:text-4xl"
        >
          {t("faqTitle")}
        </h2>
        <dl className="divide-line border-line divide-y border-y">
          {faq.map(({ question, answer }) => (
            <div key={question} className="py-5">
              <dt className="text-lg font-bold">{question}</dt>
              <dd className="text-ink-muted mt-1.5 max-w-prose">{answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Link href="/products" className={buttonStyles({ size: "lg" })}>
        {t("cta")}
      </Link>
    </article>
  );
}
