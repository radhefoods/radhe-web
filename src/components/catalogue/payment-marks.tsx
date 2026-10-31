import { cn } from "@/lib/cn";

// The marks of the payment methods the shop accepts at checkout: Visa,
// Mastercard and American Express through Stripe's card payment, and
// PayPal (owner, 2026-10-19: these four, verified). Drawn here as small
// SVGs in the brands' own colours, so no file of a card scheme has to be
// hosted; each is an image with the brand's name for screen readers.

const mark = "h-5 w-full";
const wordmark = {
  fontFamily: "var(--font-display), 'Segoe UI', system-ui, sans-serif",
  fontWeight: 800,
} as const;

function Visa() {
  return (
    <svg role="img" aria-label="Visa" viewBox="0 0 40 20" className={mark}>
      <text
        x="20"
        y="15"
        textAnchor="middle"
        fontSize="14"
        fontStyle="italic"
        letterSpacing="-0.5"
        fill="#1A1F71"
        style={wordmark}
      >
        VISA
      </text>
    </svg>
  );
}

function Mastercard() {
  return (
    <svg
      role="img"
      aria-label="Mastercard"
      viewBox="0 0 32 20"
      className={mark}
    >
      <circle cx="11" cy="10" r="7" fill="#EB001B" />
      <circle cx="21" cy="10" r="7" fill="#F79E1B" />
      {/* Where the two circles overlap. */}
      <path
        d="M16 5.101A7 7 0 0 1 16 14.899A7 7 0 0 1 16 5.101Z"
        fill="#FF5F00"
      />
    </svg>
  );
}

function AmericanExpress() {
  return (
    <svg
      role="img"
      aria-label="American Express"
      viewBox="0 0 40 20"
      className={mark}
    >
      <rect width="40" height="20" rx="3" fill="#006FCF" />
      <text
        x="20"
        y="13.5"
        textAnchor="middle"
        fontSize="8.5"
        letterSpacing="0.3"
        fill="#ffffff"
        style={wordmark}
      >
        AMEX
      </text>
    </svg>
  );
}

function PayPal() {
  return (
    <svg role="img" aria-label="PayPal" viewBox="0 0 48 20" className={mark}>
      <text
        x="24"
        y="14.5"
        textAnchor="middle"
        fontSize="12.5"
        fontStyle="italic"
        letterSpacing="-0.3"
        style={wordmark}
      >
        <tspan fill="#003087">Pay</tspan>
        <tspan fill="#009CDE">Pal</tspan>
      </text>
    </svg>
  );
}

const MARKS = [
  { key: "visa", Mark: Visa },
  { key: "mastercard", Mark: Mastercard },
  { key: "amex", Mark: AmericanExpress },
  { key: "paypal", Mark: PayPal },
] as const;

/** The four marks in a row of small white chips. */
export function PaymentMarks({
  label,
  className,
}: {
  /** The spoken name of the list: "Accepted payment methods". */
  label: string;
  className?: string;
}) {
  return (
    <ul
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      {MARKS.map(({ key, Mark }) => (
        <li
          key={key}
          className="ring-ink/8 flex h-8 w-12 items-center justify-center rounded-lg bg-white px-1 shadow-[0_1px_2px_rgb(23_33_27/0.05)] ring-1"
        >
          <Mark />
        </li>
      ))}
    </ul>
  );
}
