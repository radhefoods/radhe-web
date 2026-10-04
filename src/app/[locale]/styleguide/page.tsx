import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PayLaterNote } from "@/components/cargo/pay-later-note";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { Logo } from "@/components/shell/logo";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { listProducts } from "@/features/catalogue/data";
import { localeOf } from "@/i18n/locale";
import type { ProductSummary } from "@/lib/api/types";
import { StepperDemo } from "./stepper-demo";

// The design system on one page: tokens, components and their states, as
// they are in the code. For the people who build and review the shop; not
// linked from the shop and not for search engines. Written in English only.

export const metadata: Metadata = {
  title: "Design system",
  robots: { index: false, follow: false },
};

const COLOURS: { group: string; items: [name: string, className: string][] }[] =
  [
    {
      group: "Blue (wordmark, one step lighter): 600 actions, 900 dark bands",
      items: [
        ["50", "bg-blue-50"],
        ["100", "bg-blue-100"],
        ["200", "bg-blue-200"],
        ["300", "bg-blue-300"],
        ["400", "bg-blue-400"],
        ["500", "bg-blue-500"],
        ["600", "bg-blue-600"],
        ["700", "bg-blue-700"],
        ["800", "bg-blue-800"],
        ["900", "bg-blue-900"],
      ],
    },
    {
      group: "Neutrals",
      items: [
        ["white", "bg-white"],
        ["mist", "bg-mist"],
        ["cloud", "bg-cloud"],
        ["line", "bg-line"],
        ["line-strong", "bg-line-strong"],
        ["ink-subtle", "bg-ink-subtle"],
        ["ink-muted", "bg-ink-muted"],
        ["ink", "bg-ink"],
      ],
    },
    {
      group: "Feather: gold for time, teal for good news, cyan as ornament",
      items: [
        ["gold-100", "bg-gold-100"],
        ["gold-300", "bg-gold-300"],
        ["gold-400", "bg-gold-400"],
        ["gold-500", "bg-gold-500"],
        ["gold-700", "bg-gold-700"],
        ["teal-50", "bg-teal-50"],
        ["teal-600", "bg-teal-600"],
        ["teal-700", "bg-teal-700"],
        ["cyan-500", "bg-cyan-500"],
      ],
    },
    {
      group: "Signals: reduced prices, errors",
      items: [
        ["chili", "bg-chili"],
        ["red-50", "bg-red-50"],
        ["red-600", "bg-red-600"],
      ],
    },
  ];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-line space-y-5 border-t pt-8">
      <h2 className="font-display text-3xl text-blue-900">{title}</h2>
      {children}
    </section>
  );
}

async function sampleProducts(locale: "en" | "de"): Promise<ProductSummary[]> {
  try {
    const page = await listProducts({ limit: 100 }, locale);
    const wanted = (test: (p: ProductSummary) => boolean) =>
      page.items.find(test);
    return [
      wanted((p) => p.pricing.onSale && p.packSizes.length > 1),
      wanted((p) => p.ordering?.reason === "sold_out"),
      wanted((p) => p.ordering?.reason === "not_in_this_cargo"),
      wanted((p) => p.storageType === "frozen"),
    ].filter((p): p is ProductSummary => Boolean(p));
  } catch {
    return [];
  }
}

export default async function StyleguidePage({
  params,
}: PageProps<"/[locale]/styleguide">) {
  const locale = await localeOf(params);
  const products = await sampleProducts(locale);

  return (
    <main id="main" className="container-page space-y-10 py-10">
      <header className="space-y-4">
        <Logo className="h-14" />
        <h1 className="font-display text-5xl text-blue-900">Design system</h1>
        <p className="text-ink-muted max-w-2xl">
          Tokens and components of the Radhe Foods shop. The tokens live in{" "}
          <code>src/app/globals.css</code>, the components in{" "}
          <code>src/components</code>. The logo is used on light grounds only.
        </p>
      </header>

      <Section title="Colour">
        {COLOURS.map(({ group, items }) => (
          <div key={group} className="space-y-2">
            <h3 className="text-sm font-bold">{group}</h3>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-10">
              {items.map(([name, className]) => (
                <li key={name} className="space-y-1 text-xs font-semibold">
                  <div
                    className={`border-line h-14 rounded-md border ${className}`}
                  />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Type">
        <p className="font-display text-6xl text-blue-900">
          Pre-order today, <em className="text-blue-600 italic">pay later.</em>
        </p>
        <p className="font-display text-4xl text-blue-900">
          Reis, Mehl und Hülsenfrüchte
        </p>
        <p className="text-lg font-bold">Instrument Sans, bold 18</p>
        <p className="max-w-prose">
          Body text, 16 px. Gereifter Langkornreis aus Indien. Bestellen Sie bis
          Freitag, wir liefern zwischen dem 19. und 21. Oktober.
        </p>
        <p className="text-ink-muted text-sm">Small and muted, 14 px.</p>
        <p className="font-narrow font-bold">
          Narrow cut for long German labels: Zahlungspflichtig vorbestellen
        </p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="quiet">Quiet</Button>
          <Button variant="pay">Pay now</Button>
          <Button variant="danger">Cancel order</Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small, 44 px</Button>
          <Button size="md">Medium, 48 px</Button>
          <Button size="lg">Large, 56 px</Button>
        </div>
        <div className="hero-band flex flex-wrap gap-3 rounded-lg p-4">
          <Button variant="gold">Gold, on dark bands</Button>
          <Button variant="ghost">Ghost, on dark bands</Button>
        </div>
      </Section>

      <Section title="Status chips">
        <div className="flex flex-wrap gap-2">
          <Chip tone="blue">Confirmed</Chip>
          <Chip tone="gold">Preparing</Chip>
          <Chip tone="navy">On its way</Chip>
          <Chip tone="teal">Delivered</Chip>
          <Chip tone="red">Delivery failed</Chip>
          <Chip tone="mute">Cancelled</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="mute">Pay after delivery</Chip>
          <Chip tone="gold">Payment due</Chip>
          <Chip tone="red">Overdue</Chip>
          <Chip tone="teal">Paid</Chip>
        </div>
      </Section>

      <Section title="Messages">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Information">
            The next pre-order opens on Monday.
          </Alert>
          <Alert tone="good" title="Good news">
            Your payment has arrived.
          </Alert>
          <Alert tone="warn" title="The total has changed.">
            Check the new total and confirm again.
          </Alert>
          <Alert tone="bad" title="That did not work.">
            Try again. Reference: 3f0c1a2e-8b1d-4c2e
          </Alert>
        </div>
        <PayLaterNote className="max-w-xl" />
      </Section>

      <Section title="Forms">
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <TextField
            id="sg-email"
            label="Email address"
            type="email"
            defaultValue="priya@example.com"
            hint="We email you a 6-digit code. No password needed."
          />
          <TextField
            id="sg-postcode"
            label="Postcode"
            defaultValue="6031"
            error="Enter a 5-digit postcode."
          />
          <TextField id="sg-disabled" label="Disabled" disabled value="DE" />
          <div className="space-y-1.5">
            <p className="text-sm font-bold">Quantity stepper</p>
            <StepperDemo />
          </div>
        </div>
      </Section>

      <Section title="Loading">
        <div className="max-w-xs space-y-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </Section>

      {products.length > 0 && (
        <Section title="Product card and its states">
          <ProductGrid products={products} />
        </Section>
      )}
    </main>
  );
}
