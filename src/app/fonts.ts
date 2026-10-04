import { Instrument_Sans, Instrument_Serif } from "next/font/google";

// Both families are downloaded when the shop is built and served from the
// shop's own address: no request goes to Google when a customer visits.
//
// `subsets` names what is loaded ahead of the page. "latin" covers English
// and German (umlauts, sharp s, the euro sign); the extended Latin files
// remain in the style sheet and are fetched only when a page shows such a
// letter, for example in a customer's name.

export const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-instrument-sans",
});

export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-instrument-serif",
});
