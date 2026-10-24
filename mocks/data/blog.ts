// Fixture articles of the mock API (doc 19, doc/BLOG.md): the posts and
// the categories of the blog as the admin keeps them, drafts and scheduled
// posts included. Each featured picture is a generated placeholder in the
// three widths the real API would store. Everything here is invented
// sample data for development and tests.

import type { Translated } from "./catalogue.ts";

export interface BlogCategoryRecord {
  id: string;
  name: Translated;
  slug: Translated;
  description: Translated | null;
  seo: { title: Translated | null; description: Translated | null };
  sortOrder: number;
}

export interface BlogImageRecord {
  /** The size of the upload; the picture keeps this ratio. */
  width: number;
  height: number;
  /** The colours of the placeholder: a gradient from the first to the second. */
  tint: [string, string];
  alt: Translated | null;
}

export interface BlogPostRecord {
  id: string;
  title: Translated;
  slug: Translated;
  summary: Translated | null;
  /** Markdown; `""` for a language without a text. */
  content: Translated;
  featuredImage: BlogImageRecord | null;
  authorName: string;
  categoryId: string | null;
  tags: string[];
  status: "draft" | "published";
  publishedAt: string;
  updatedAt: string;
  seo: { title: Translated | null; description: Translated | null };
}

export const blogCategories: BlogCategoryRecord[] = [
  {
    id: "66f600000000000000000c01",
    name: { en: "Recipes", de: "Rezepte" },
    slug: { en: "recipes", de: "rezepte" },
    description: {
      en: "Dishes from our kitchen, with the products that make them.",
      de: "Gerichte aus unserer Küche, mit den Produkten, die sie ausmachen.",
    },
    seo: {
      title: { en: "Indian recipes from Radhe Foods", de: "" },
      description: null,
    },
    sortOrder: 0,
  },
  {
    id: "66f600000000000000000c02",
    name: { en: "Kitchen tips", de: "Küchentipps" },
    slug: { en: "kitchen-tips", de: "kuechentipps" },
    description: {
      en: "Storing, soaking, tempering: the small things that matter.",
      de: "Lagern, einweichen, anrösten: die kleinen Dinge, auf die es ankommt.",
    },
    seo: { title: null, description: null },
    sortOrder: 1,
  },
  {
    id: "66f600000000000000000c03",
    name: { en: "News", de: "Neuigkeiten" },
    slug: { en: "news", de: "neuigkeiten" },
    description: null,
    seo: { title: null, description: null },
    sortOrder: 2,
  },
  {
    id: "66f600000000000000000c04",
    name: { en: "Festivals", de: "Feste" },
    slug: { en: "festivals", de: "feste" },
    description: null,
    seo: { title: null, description: null },
    // No published post yet: the shop may hide it.
    sortOrder: 3,
  },
];

const RECIPES = "66f600000000000000000c01";
const TIPS = "66f600000000000000000c02";
const NEWS = "66f600000000000000000c03";

const picture = (
  tint: [string, string],
  alt: Translated | null = null,
): BlogImageRecord => ({ width: 2000, height: 1125, tint, alt });

let counter = 0;
function post(
  record: Omit<
    BlogPostRecord,
    "id" | "status" | "authorName" | "updatedAt" | "seo"
  > &
    Partial<Pick<BlogPostRecord, "status" | "authorName" | "seo">>,
): BlogPostRecord {
  counter += 1;
  return {
    id: `66f6000000000000000000${String(counter).padStart(2, "0")}`,
    status: "published",
    authorName: "Vrushabh",
    updatedAt: record.publishedAt,
    seo: { title: null, description: null },
    ...record,
  };
}

export const blogPosts: BlogPostRecord[] = [
  post({
    title: { en: "The perfect dal", de: "Das perfekte Dal" },
    slug: { en: "the-perfect-dal", de: "das-perfekte-dal" },
    summary: {
      en: "Five lentils, one pot, and the tempering that makes the difference.",
      de: "Fünf Linsen, ein Topf und das Anrösten, das den Unterschied macht.",
    },
    content: {
      en: "# Dal\n\nWash the lentils until the water runs clear, then soak them for twenty minutes.\n\n## The tempering\n\nHeat ghee, add cumin seeds and wait for them to crackle. Add garlic and dried chillies, then pour the tempering over the cooked dal.\n\n![A bowl of dal](/media/blog/66f600000000000000000001/medium.svg)\n\n- 200 g toor dal\n- 1 tsp turmeric\n- 2 tbsp ghee\n\n> Serve with rice or roti.",
      de: "# Dal\n\nDie Linsen waschen, bis das Wasser klar bleibt, dann zwanzig Minuten einweichen.\n\n## Das Anrösten\n\nGhee erhitzen, Kreuzkümmel zugeben und warten, bis er knistert. Knoblauch und getrocknete Chilis zugeben, dann über das gekochte Dal gießen.\n\n- 200 g Toor Dal\n- 1 TL Kurkuma\n- 2 EL Ghee",
    },
    featuredImage: picture(["#0b4a31", "#4a5e24"], {
      en: "A bowl of dal",
      de: "Eine Schale Dal",
    }),
    categoryId: RECIPES,
    tags: ["recipes", "lentils", "dal"],
    publishedAt: "2026-10-20T08:00:00.000Z",
    seo: {
      title: { en: "The perfect dal – a recipe from Radhe Foods", de: "" },
      description: {
        en: "How to cook toor dal with a proper tempering of cumin, garlic and chilli.",
        de: "",
      },
    },
  }),
  post({
    title: { en: "How to store spices", de: "So lagern Sie Gewürze" },
    slug: { en: "how-to-store-spices", de: "so-lagern-sie-gewuerze" },
    summary: {
      en: "Whole, dark and dry: spices keep their aroma for a year when stored right.",
      de: "Ganz, dunkel und trocken: Richtig gelagert halten Gewürze ihr Aroma ein Jahr lang.",
    },
    content: {
      en: "Buy whole spices where you can and grind them as you need them.\n\n## Three rules\n\n1. Keep them away from the stove.\n2. Keep them in the dark.\n3. Keep the lid on.",
      de: "",
    },
    featuredImage: picture(["#6e5630", "#ebd9b4"]),
    categoryId: TIPS,
    tags: ["spices", "storage"],
    publishedAt: "2026-10-18T09:00:00.000Z",
  }),
  post({
    title: { en: "Diwali at Radhe Foods", de: "Diwali bei Radhe Foods" },
    slug: { en: "diwali-at-radhe-foods", de: "diwali-bei-radhe-foods" },
    summary: {
      en: "Sweets, snacks and gift boxes: what we have in store for the festival of lights.",
      de: "Süßes, Snacks und Geschenkboxen: Was wir zum Lichterfest auf Lager haben.",
    },
    content: {
      en: "Diwali is around the corner and our shelves are full.\n\n## Sweets\n\nKaju katli, soan papdi and ladoo, fresh from our suppliers in Gujarat.",
      de: "Diwali steht vor der Tür und unsere Regale sind voll.\n\n## Süßes\n\nKaju Katli, Soan Papdi und Ladoo, frisch von unseren Lieferanten in Gujarat.",
    },
    featuredImage: picture(["#9a2f14", "#f2e6cc"], {
      en: "Diwali sweets",
      de: "Süßigkeiten zu Diwali",
    }),
    categoryId: NEWS,
    tags: ["diwali", "sweets", "news"],
    publishedAt: "2026-10-15T07:30:00.000Z",
  }),
  post({
    title: { en: "Basmati, three ways", de: "Basmati auf drei Arten" },
    slug: { en: "basmati-three-ways", de: "basmati-auf-drei-arten" },
    summary: {
      en: "Plain, jeera and a quick pulao: the rice that goes with everything.",
      de: "Pur, mit Kreuzkümmel und als schneller Pulao: der Reis, der zu allem passt.",
    },
    content: {
      en: "Rinse, soak, and never stir while it cooks.\n\n## Jeera rice\n\nTemper cumin in ghee, add the soaked rice and water, cover and leave it alone.",
      de: "",
    },
    featuredImage: picture(["#1f5a30", "#ebd9b4"]),
    categoryId: RECIPES,
    tags: ["recipes", "rice", "basmati"],
    publishedAt: "2026-10-12T10:00:00.000Z",
  }),
  post({
    title: {
      en: "Soaking beans overnight",
      de: "Bohnen über Nacht einweichen",
    },
    slug: {
      en: "soaking-beans-overnight",
      de: "bohnen-ueber-nacht-einweichen",
    },
    summary: {
      en: "Why the overnight soak is worth it, and the shortcut when you forgot.",
      de: "Warum sich das Einweichen lohnt, und die Abkürzung, wenn Sie es vergessen haben.",
    },
    content: {
      en: "Soaked beans cook faster and more evenly.\n\nForgot? Cover them with boiling water and wait an hour.",
      de: "Eingeweichte Bohnen garen schneller und gleichmäßiger.",
    },
    featuredImage: null,
    categoryId: TIPS,
    tags: ["beans", "lentils", "storage"],
    publishedAt: "2026-10-10T06:00:00.000Z",
  }),
  post({
    title: { en: "Masala chai, properly", de: "Masala Chai, richtig gemacht" },
    slug: { en: "masala-chai-properly", de: "masala-chai-richtig-gemacht" },
    summary: {
      en: "Strong tea, whole spices, and milk brought to the boil twice.",
      de: "Kräftiger Tee, ganze Gewürze und Milch, die zweimal aufkocht.",
    },
    content: {
      en: "Crush cardamom, ginger and a clove. Boil with water and tea, add milk, boil again.",
      de: "",
    },
    featuredImage: picture(["#4a5e24", "#f7f0e0"]),
    categoryId: RECIPES,
    tags: ["recipes", "tea", "spices"],
    publishedAt: "2026-10-08T15:00:00.000Z",
  }),
  post({
    title: {
      en: "New: fresh vegetables every week",
      de: "Neu: frisches Gemüse jede Woche",
    },
    slug: {
      en: "fresh-vegetables-every-week",
      de: "frisches-gemuese-jede-woche",
    },
    summary: {
      en: "Okra, bitter gourd and curry leaves now arrive every Tuesday.",
      de: "Okra, Bittermelone und Curryblätter kommen jetzt jeden Dienstag.",
    },
    content: {
      en: "Order by Monday evening for the freshest pick.",
      de: "Bestellen Sie bis Montagabend für die frischeste Auswahl.",
    },
    featuredImage: picture(["#157a4b", "#f2f4ee"]),
    categoryId: NEWS,
    tags: ["news", "vegetables"],
    publishedAt: "2026-10-05T12:00:00.000Z",
  }),
  post({
    title: { en: "Ghee: what to look for", de: "Ghee: Worauf es ankommt" },
    slug: { en: "ghee-what-to-look-for", de: "ghee-worauf-es-ankommt" },
    summary: null,
    content: {
      en: "Good ghee smells of toasted milk and nothing else.",
      de: "",
    },
    featuredImage: picture(["#e2cca0", "#6e5630"]),
    categoryId: TIPS,
    tags: ["ghee", "dairy"],
    publishedAt: "2026-10-02T09:00:00.000Z",
  }),
  post({
    title: { en: "Chana masala for a crowd", de: "Chana Masala für viele" },
    slug: { en: "chana-masala-for-a-crowd", de: "chana-masala-fuer-viele" },
    summary: {
      en: "One pot, ten people, under an hour.",
      de: "Ein Topf, zehn Personen, unter einer Stunde.",
    },
    content: {
      en: "Use two tins of chickpeas or 500 g soaked and cooked chana.",
      de: "",
    },
    featuredImage: picture(["#bf3c1d", "#fbf8f1"]),
    categoryId: RECIPES,
    tags: ["recipes", "chickpeas", "chana"],
    publishedAt: "2026-09-28T11:00:00.000Z",
  }),
  post({
    title: {
      en: "Khakhra: the thin crisp bread",
      de: "Khakhra: das dünne Knusperbrot",
    },
    slug: {
      en: "khakhra-the-thin-crisp-bread",
      de: "khakhra-das-duenne-knusperbrot",
    },
    summary: {
      en: "What khakhra is, how it is made and what to eat it with.",
      de: "Was Khakhra ist, wie es gemacht wird und wozu man es isst.",
    },
    content: {
      en: "A Gujarati classic: wheat dough rolled paper-thin and roasted dry.",
      de: "",
    },
    featuredImage: picture(["#ebd9b4", "#0f5c38"]),
    categoryId: NEWS,
    tags: ["snacks", "gujarat"],
    publishedAt: "2026-09-25T08:00:00.000Z",
  }),
  post({
    title: { en: "Tempering, explained", de: "Anrösten, erklärt" },
    slug: { en: "tempering-explained", de: "anroesten-erklaert" },
    summary: {
      en: "Tadka, chaunk, vaghar: one technique, many names.",
      de: "Tadka, Chaunk, Vaghar: eine Technik, viele Namen.",
    },
    content: {
      en: "Whole spices bloom in hot fat and release their aroma into the dish.",
      de: "",
    },
    featuredImage: picture(["#0b4a31", "#ebd9b4"]),
    categoryId: TIPS,
    tags: ["spices", "technique"],
    publishedAt: "2026-09-20T08:00:00.000Z",
  }),
  post({
    title: {
      en: "Aloo paratha for breakfast",
      de: "Aloo Paratha zum Frühstück",
    },
    slug: {
      en: "aloo-paratha-for-breakfast",
      de: "aloo-paratha-zum-fruehstueck",
    },
    summary: {
      en: "Stuffed flatbread with potatoes, served with yoghurt and pickle.",
      de: "Gefülltes Fladenbrot mit Kartoffeln, dazu Joghurt und Pickle.",
    },
    content: {
      en: "Use chakki atta for the dough and rest it for half an hour.",
      de: "",
    },
    featuredImage: picture(["#f2e6cc", "#9a2f14"]),
    categoryId: RECIPES,
    tags: ["recipes", "bread", "potatoes"],
    publishedAt: "2026-09-15T07:00:00.000Z",
  }),
  post({
    title: {
      en: "We now deliver with Hermes too",
      de: "Wir liefern jetzt auch mit Hermes",
    },
    slug: {
      en: "we-now-deliver-with-hermes-too",
      de: "wir-liefern-jetzt-auch-mit-hermes",
    },
    summary: {
      en: "A second carrier for faster parcels in the west of Germany.",
      de: "Ein zweiter Versanddienst für schnellere Pakete im Westen Deutschlands.",
    },
    content: {
      en: "Nothing changes for you: we pick the faster carrier for your address.",
      de: "",
    },
    featuredImage: null,
    categoryId: NEWS,
    tags: ["news", "delivery"],
    publishedAt: "2026-09-10T09:00:00.000Z",
  }),
  post({
    title: { en: "Scheduled: Holi colours", de: "Geplant: Holi-Farben" },
    slug: { en: "holi-colours", de: "holi-farben" },
    summary: { en: "Coming in spring.", de: "" },
    content: { en: "Not yet.", de: "" },
    featuredImage: null,
    categoryId: NEWS,
    tags: ["holi"],
    // Published, but its date has not come: scheduled, not in the shop.
    publishedAt: "2099-03-01T08:00:00.000Z",
  }),
  post({
    title: { en: "Draft: our story", de: "Entwurf: unsere Geschichte" },
    slug: { en: "our-story", de: "unsere-geschichte" },
    summary: null,
    content: { en: "Still being written.", de: "" },
    featuredImage: null,
    categoryId: null,
    tags: [],
    status: "draft",
    publishedAt: "2026-10-01T08:00:00.000Z",
  }),
];
