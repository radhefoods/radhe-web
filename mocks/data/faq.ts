// Fixture questions and answers of the mock API (doc 18, doc/FAQ.md): the
// headings and the questions as the admin keeps them, published or not,
// visible or not. Everything here is invented sample data for development
// and tests.

import type { Translated } from "./catalogue.ts";

export interface FaqGroupRecord {
  id: string;
  name: Translated;
  sortOrder: number;
  isVisible: boolean;
}

export interface FaqRecord {
  id: string;
  question: Translated;
  /** Plain text or Markdown. */
  answer: Translated;
  groupId: string | null;
  sortOrder: number;
  isPublished: boolean;
}

export const faqGroups: FaqGroupRecord[] = [
  {
    id: "66f500000000000000000f01",
    name: { en: "Orders", de: "Bestellungen" },
    sortOrder: 0,
    isVisible: true,
  },
  {
    id: "66f500000000000000000f02",
    name: { en: "Delivery", de: "Lieferung" },
    sortOrder: 1,
    isVisible: true,
  },
  {
    id: "66f500000000000000000f03",
    name: { en: "Wholesale", de: "Großhandel" },
    sortOrder: 2,
    // Hidden: its questions stay out of the shop, published or not.
    isVisible: false,
  },
  {
    id: "66f500000000000000000f04",
    name: { en: "Returns", de: "Rücksendungen" },
    sortOrder: 3,
    isVisible: true,
  },
];

export const faqs: FaqRecord[] = [
  {
    id: "66f500000000000000000a01",
    question: {
      en: "Can I cancel my order?",
      de: "Kann ich meine Bestellung stornieren?",
    },
    answer: {
      en: "Yes, until we start preparing it. Open the order in your account and choose *Cancel order*. Once it is on its way, use the [right of withdrawal](/legal/withdrawal) instead.",
      de: "Ja, bis wir mit der Vorbereitung beginnen. Öffnen Sie die Bestellung in Ihrem Konto und wählen Sie *Bestellung stornieren*. Ist sie schon unterwegs, nutzen Sie stattdessen das [Widerrufsrecht](/legal/withdrawal).",
    },
    groupId: "66f500000000000000000f01",
    sortOrder: 0,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a02",
    question: {
      en: "Can I track my order?",
      de: "Kann ich meine Bestellung verfolgen?",
    },
    answer: {
      en: "Yes. Every order shows its status in your account, and we email you when it is dispatched. Parcels sent by DHL or Hermes carry a tracking number.",
      de: "Ja. Jede Bestellung zeigt ihren Status in Ihrem Konto, und wir schreiben Ihnen eine E-Mail, sobald sie verschickt ist. Pakete mit DHL oder Hermes haben eine Sendungsnummer.",
    },
    groupId: "66f500000000000000000f01",
    sortOrder: 1,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a03",
    question: {
      en: "Do you offer a subscription?",
      de: "Gibt es ein Abo?",
    },
    answer: { en: "Not yet. We are working on it.", de: "Noch nicht." },
    groupId: "66f500000000000000000f01",
    sortOrder: 2,
    // A draft: not in the shop.
    isPublished: false,
  },
  {
    id: "66f500000000000000000a04",
    question: {
      en: "How long does delivery take?",
      de: "Wie lange dauert die Lieferung?",
    },
    answer: {
      en: "Usually 2 to 4 working days within Germany. Chilled and frozen food is sent at the beginning of the week so it never waits over a weekend.\n\n| Region | Time |\n| --- | --- |\n| Germany | 2 to 4 working days |\n| Islands | 3 to 5 working days |",
      de: "In der Regel 2 bis 4 Werktage innerhalb Deutschlands. Gekühlte und gefrorene Ware verschicken wir am Wochenanfang, damit sie nie über ein Wochenende wartet.\n\n| Region | Dauer |\n| --- | --- |\n| Deutschland | 2 bis 4 Werktage |\n| Inseln | 3 bis 5 Werktage |",
    },
    groupId: "66f500000000000000000f02",
    sortOrder: 0,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a05",
    question: {
      en: "Do you deliver outside Germany?",
      de: "Liefern Sie auch ins Ausland?",
    },
    answer: {
      en: "Not at the moment. We deliver to every address in Germany.",
      de: "Derzeit nicht. Wir liefern an jede Adresse in Deutschland.",
    },
    groupId: "66f500000000000000000f02",
    sortOrder: 1,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a06",
    question: {
      en: "Do you sell to restaurants?",
      de: "Verkaufen Sie an Restaurants?",
    },
    answer: {
      en: "Yes, write to us for wholesale prices.",
      de: "Ja, schreiben Sie uns für Großhandelspreise.",
    },
    // Published, but its group is hidden.
    groupId: "66f500000000000000000f03",
    sortOrder: 0,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a07",
    question: {
      en: "Can I return food?",
      de: "Kann ich Lebensmittel zurückgeben?",
    },
    answer: {
      en: "Unopened dry goods, yes, within 14 days. Chilled, frozen and opened food cannot be returned for reasons of hygiene.",
      de: "Ungeöffnete Trockenware ja, innerhalb von 14 Tagen. Gekühlte, gefrorene und geöffnete Lebensmittel können aus Hygienegründen nicht zurückgegeben werden.",
    },
    groupId: "66f500000000000000000f04",
    sortOrder: 0,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a08",
    question: {
      en: "Do you have a shop in Frankfurt?",
      // No German yet: the shop falls back to English.
      de: "",
    },
    answer: {
      en: "Not yet. For now we sell online only.",
      de: "",
    },
    groupId: null,
    sortOrder: 0,
    isPublished: true,
  },
  {
    id: "66f500000000000000000a09",
    question: {
      en: "Which payment methods do you accept?",
      de: "Welche Zahlungsarten akzeptieren Sie?",
    },
    answer: {
      en: "Card and PayPal, at checkout. See [delivery and payment](/delivery-and-payment).",
      de: "Karte und PayPal, an der Kasse. Siehe [Lieferung und Zahlung](/delivery-and-payment).",
    },
    groupId: null,
    sortOrder: 1,
    isPublished: true,
  },
];
