import { Inter } from "next/font/google";

// The family is downloaded when the shop is built and served from the
// shop's own address: no request goes to Google when a customer visits.
//
// One family for everything, as Apple sets its interfaces (redesign of
// 2026-10-31): Inter, a variable font, so every weight the system uses
// comes from one file. Its optical-size axis keeps small text open and
// lets headlines be set tight (`font-display`). `subsets` names what is
// loaded ahead of the page: "latin" covers English and German (umlauts,
// sharp s, the euro sign); the extended Latin files remain in the style
// sheet and are fetched only when a page shows such a letter, for example
// in a customer's name.

/** Everything: body text, controls, headlines and prices. */
export const inter = Inter({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-inter",
});
