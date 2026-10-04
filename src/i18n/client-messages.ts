import type { Messages } from "next-intl";

type Namespace = keyof Messages;

/**
 * The parts of the translations that components running in the browser
 * need. Whatever is sent to the browser is part of the page, so server
 * components keep their texts on the server, and only these namespaces
 * travel: the basic ones with every page, the others with their area only.
 * Add a namespace here when a client component starts using it.
 */
const BASE = [
  "errors",
  "language",
  "common",
  "nav",
  "cargo",
  "product",
  "cart",
  "cookieNotice",
] as const satisfies readonly Namespace[];

const AREAS = {
  signIn: ["auth"],
  checkout: ["address", "checkout"],
  account: [
    "account",
    "address",
    "addressBook",
    "documents",
    "orders",
    "payment",
    "profile",
    "returns",
  ],
  emailLinks: ["payLink", "payment", "unsubscribe"],
} as const satisfies Record<string, readonly Namespace[]>;

export type ClientArea = keyof typeof AREAS;

/** Every namespace a client component may use, for the tests. */
export const CLIENT_NAMESPACES: readonly Namespace[] = [
  ...new Set<Namespace>([...BASE, ...Object.values(AREAS).flat()]),
];

/** The basic namespaces, plus those of one area of the shop. */
export function clientMessages(
  messages: Messages,
  area?: ClientArea,
): Partial<Messages> {
  const namespaces: readonly Namespace[] = area
    ? [...BASE, ...AREAS[area]]
    : BASE;
  return Object.fromEntries(
    namespaces.map((namespace) => [namespace, messages[namespace]]),
  ) as Partial<Messages>;
}
