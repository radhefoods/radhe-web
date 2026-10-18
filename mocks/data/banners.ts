// Fixture banners of the mock API (doc 17): the slides of the home page
// as the admin keeps them. Each picture is a generated placeholder with
// the banner's name on it, in the three widths the real API would store.
// Everything here is invented sample data for development and tests.

import type { Translated } from "./catalogue.ts";

export interface BannerRecord {
  id: string;
  /** The admin's label. */
  name: string;
  alt: Translated | null;
  /** The size of the upload; the picture keeps this ratio. */
  width: number;
  height: number;
  /** The colours of the placeholder: a gradient from the first to the second. */
  tint: [string, string];
  /** What the placeholder says, in large letters. */
  headline: string;
  /** A path of the shop, an `https://` address, or nothing. */
  linkUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
}

export const banners: BannerRecord[] = [
  {
    id: "66f300000000000000000a01",
    name: "Diwali offer",
    alt: {
      en: "Diwali offer: sweets and snacks reduced",
      de: "Diwali-Angebot: Süßes und Snacks reduziert",
    },
    width: 2400,
    height: 1000,
    tint: ["#0b4a31", "#4a5e24"],
    headline: "Diwali offer · mock banner",
    linkUrl: "/category/snacks",
    isActive: true,
    sortOrder: 0,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "66f300000000000000000a02",
    name: "Basmati week",
    alt: { en: "Basmati week", de: "Basmati-Woche" },
    width: 2400,
    height: 1000,
    tint: ["#6e5630", "#ebd9b4"],
    headline: "Basmati week · mock banner",
    linkUrl: "/products/basmati-rice-1kg",
    isActive: true,
    sortOrder: 1,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "66f300000000000000000a03",
    name: "Follow us",
    alt: null,
    width: 2400,
    height: 800,
    tint: ["#1f5a30", "#157a4b"],
    headline: "Follow us · mock banner · 3:1",
    linkUrl: "https://example.com/radhe-foods",
    isActive: true,
    sortOrder: 2,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "66f300000000000000000a04",
    name: "Fresh mangoes",
    alt: { en: "Fresh mangoes have arrived", de: "Frische Mangos sind da" },
    width: 1800,
    height: 750,
    tint: ["#bf3c1d", "#ebd9b4"],
    headline: "Fresh mangoes · mock banner · no link",
    linkUrl: null,
    isActive: true,
    sortOrder: 3,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "66f300000000000000000a05",
    name: "Switched off",
    alt: null,
    width: 2400,
    height: 1000,
    tint: ["#17211b", "#475149"],
    headline: "Switched off · never shown",
    linkUrl: null,
    isActive: false,
    sortOrder: 4,
    startsAt: null,
    endsAt: null,
  },
  {
    id: "66f300000000000000000a06",
    name: "Scheduled",
    alt: null,
    width: 2400,
    height: 1000,
    tint: ["#17211b", "#475149"],
    headline: "Scheduled · not yet",
    linkUrl: null,
    isActive: true,
    sortOrder: 5,
    startsAt: "2099-01-01T00:00:00.000Z",
    endsAt: null,
  },
];
