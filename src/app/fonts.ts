import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";

// Both families are downloaded when the shop is built and served from the
// shop's own address: no request goes to Google when a customer visits.
//
// Both are variable fonts, so every weight the system uses comes from one
// file per family. `subsets` names what is loaded ahead of the page: "latin"
// covers English and German (umlauts, sharp s, the euro sign); the extended
// Latin files remain in the style sheet and are fetched only when a page
// shows such a letter, for example in a customer's name.

/** Headlines, prices and the big numbers: heavy, tight. */
export const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plus-jakarta-sans",
});

/** Everything that is read or tapped. The optical size axis keeps small text open. */
export const dmSans = DM_Sans({
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
  variable: "--font-dm-sans",
});
