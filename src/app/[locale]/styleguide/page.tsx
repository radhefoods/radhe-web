import type { Metadata } from "next";
import type { ReactNode } from "react";
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
      group:
        "Leaf: 600 for every action, 700 for hover and text on a tint; 900 through moss to olive for the woven dark band",
      items: [
        ["50", "bg-leaf-50"],
        ["100", "bg-leaf-100"],
        ["200", "bg-leaf-200"],
        ["300", "bg-leaf-300"],
        ["400", "bg-leaf-400"],
        ["500", "bg-leaf-500"],
        ["600", "bg-leaf-600"],
        ["700", "bg-leaf-700"],
        ["800", "bg-leaf-800"],
        ["900", "bg-leaf-900"],
        ["moss", "bg-moss"],
        ["olive", "bg-olive"],
      ],
    },
    {
      group:
        "Neutrals: a very light green canvas is the page, white the cards on it, mist a quiet surface inside a panel",
      items: [
        ["canvas", "bg-canvas"],
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
      group:
        "Wheat, the highlight: fills and big numerals only, 800 for text on the tints",
      items: [
        ["wheat-50", "bg-wheat-50"],
        ["wheat-100", "bg-wheat-100"],
        ["wheat-200", "bg-wheat-200"],
        ["wheat-400", "bg-wheat-400"],
        ["wheat-500", "bg-wheat-500"],
        ["wheat-800", "bg-wheat-800"],
      ],
    },
    {
      group: "Red: reduced prices and offers, errors, overdue",
      items: [
        ["red-50", "bg-red-50"],
        ["red-100", "bg-red-100"],
        ["red-200", "bg-red-200"],
        ["red-600", "bg-red-600"],
        ["red-800", "bg-red-800"],
      ],
    },
  ];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-ink/8 space-y-5 border-t pt-8">
      <h2 className="font-display text-ink text-2xl">{title}</h2>
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
      wanted((p) => p.pricing.onSale),
      wanted((p) => p.ordering?.reason === "sold_out"),
      wanted((p) => p.image === null),
      wanted(
        (p) =>
          p.ordering !== null &&
          p.ordering.canOrder &&
          p.ordering.remaining <= 10,
      ),
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
        <h1 className="font-display text-ink text-4xl">Design system</h1>
        <p className="text-ink-muted max-w-2xl">
          Tokens and components of the Radhe Foods shop. The tokens live in{" "}
          <code>src/app/globals.css</code>, the components in{" "}
          <code>src/components</code>.
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
                    className={`ring-ink/8 h-14 rounded-lg ring-1 ${className}`}
                  />
                  {name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title="Type">
        <p className="font-display text-ink text-5xl">
          Indian groceries, delivered to your door
        </p>
        <p className="font-display text-ink text-3xl">
          Reis, Mehl und Hülsenfrüchte
        </p>
        <p className="font-display text-xl">
          Section title, Inter 700 set tight, 20 px
        </p>
        <p className="text-[0.9375rem] font-semibold">
          Product title, Inter 600, 15 px: India Gate Basmati-Reis, Classic, 5
          kg
        </p>
        <p className="max-w-prose">
          Body text, 16 px. Gereifter Langkornreis aus Indien. Bestellen Sie bis
          Freitag, wir liefern zwischen dem 19. und 21. Oktober.
        </p>
        <p className="text-ink-muted text-sm">Small and muted, 14 px.</p>
        <p className="text-ink-subtle text-xs font-bold tracking-wider uppercase">
          Label, 12 px, spaced caps
        </p>
        <p className="font-display text-[2rem] tabular-nums">
          <span className="text-red-600">19,99 €</span>{" "}
          <s className="text-ink-subtle font-sans text-base font-medium">
            24,99 €
          </s>
        </p>
      </Section>

      <Section title="Glass">
        <p className="text-ink-muted max-w-2xl">
          The chrome of the shop is frosted glass over the soft green canvas:
          five strengths, each with a white hairline along its top edge, a faint
          outline and a soft fall. Products stay on solid white (
          <code>surface</code>), so pictures and prices never lose clarity.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(
            [
              ["glass", "The default: header, footer, dropdowns, pills"],
              ["glass-strong", "Panels full of text: summaries, forms, legal"],
              ["glass-soft", "Small controls on the page: pills, arrows"],
              ["glass-leaf", "A leaf tint: a reached goal, a chosen tile"],
              ["surface", "Solid white: product, category and post cards"],
            ] as const
          ).map(([name, note]) => (
            <div key={name} className={`${name} rounded-2xl p-5`}>
              <p className="font-display text-ink text-lg">{name}</p>
              <p className="text-ink-muted mt-1 text-sm">{note}</p>
            </div>
          ))}
          <div className="glass-dark rounded-2xl p-5 text-white">
            <p className="font-display text-lg">glass-dark</p>
            <p className="mt-1 text-sm text-white/80">
              Dark glass for white text: tooltips, the carousel&apos;s dots
            </p>
          </div>
        </div>
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
          <Button size="lg">Large, 52 px</Button>
        </div>
        <div className="hero-band flex flex-wrap gap-3 rounded-lg p-4">
          <Button variant="wheat">Wheat, on the dark band</Button>
          <Button variant="ghost">Ghost, on the dark band</Button>
        </div>
      </Section>

      <Section title="Status chips">
        <div className="flex flex-wrap gap-2">
          <Chip tone="wheat">Waiting for payment</Chip>
          <Chip tone="leaf">Confirmed</Chip>
          <Chip tone="leaf">Being prepared</Chip>
          <Chip tone="forest">On its way</Chip>
          <Chip tone="green">Delivered</Chip>
          <Chip tone="mute">Returned</Chip>
          <Chip tone="mute">Cancelled</Chip>
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip tone="wheat">Not paid yet</Chip>
          <Chip tone="green">Paid</Chip>
          <Chip tone="red">Payment failed</Chip>
          <Chip tone="mute">Refunded</Chip>
        </div>
      </Section>

      <Section title="Messages">
        <div className="grid gap-3 md:grid-cols-2">
          <Alert tone="info" title="Information">
            Your order is on its way.
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
      </Section>

      <Section title="Forms">
        <div className="grid max-w-3xl gap-4 md:grid-cols-2">
          <TextField
            id="sg-email"
            label="Email address"
            type="email"
            defaultValue="priya@example.com"
            hint="You sign in with this address."
          />
          <TextField
            id="sg-postcode"
            label="Postcode"
            defaultValue="6031"
            error="Enter a 5-digit postcode."
          />
          <TextField id="sg-disabled" label="Disabled" disabled value="DE" />
          <div className="space-y-1.5">
            <p className="text-sm font-semibold">Quantity stepper</p>
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
