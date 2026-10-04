// Fixture catalogue of the mock API. The records are stored the way the real
// backend stores them (translated fields as `{ en, de }`, money in cents,
// VAT in basis points); `views.ts` turns them into the answers of the store
// API. Everything here is invented sample data for development and tests.

export interface Translated {
  en: string;
  de: string;
}

export interface CategoryRecord {
  id: string;
  parentId: string | null;
  slug: Translated;
  name: Translated;
  tagline: Translated | null;
  description: Translated | null;
  sortOrder: number;
}

export interface ProductRecord {
  id: string;
  sku: string;
  /** Pack sizes of the same product share a group. */
  group: string;
  isDefaultSize: boolean;
  slug: Translated;
  name: Translated;
  subtitle: Translated | null;
  shortDescription: Translated | null;
  description: Translated | null;
  brand: string | null;
  categoryId: string;
  packValue: number;
  packUnit: "g" | "kg" | "ml" | "l" | "pcs";
  regularPrice: number;
  salePrice: number | null;
  vatRate: number;
  isAvailable: boolean;
  isFeatured: boolean;
  minQuantity: number;
  maxQuantity: number | null;
  storageType: "ambient" | "chilled" | "frozen";
  tags: string[];
  keywords: string[];
  highlights: Translated[];
  uses: Translated[];
  food: {
    ingredients: Translated | null;
    allergens: Translated | null;
    nutrition: Translated | null;
    storageInstructions: Translated | null;
    origin: Translated | null;
    manufacturer: string | null;
  };
  gtin: string | null;
  publishedAt: string;
  updatedAt: string;
  sortOrder: number;
  /** Tint of the generated placeholder picture. */
  tint: string;
}

/** Availability of a product in the cargo that takes orders. */
export interface CargoProductRecord {
  productId: string;
  maxQuantity: number | null;
  reservedQuantity: number;
}

let sequence = 0;
function oid(prefix: string): string {
  sequence += 1;
  return `${prefix}${sequence.toString(16).padStart(24 - prefix.length, "0")}`;
}

const t = (en: string, de: string): Translated => ({ en, de });

// --- Categories -------------------------------------------------------------

function category(
  parentId: string | null,
  sortOrder: number,
  slug: Translated,
  name: Translated,
  tagline: Translated | null = null,
  description: Translated | null = null,
): CategoryRecord {
  return {
    id: oid("66c0"),
    parentId,
    slug,
    name,
    tagline,
    description,
    sortOrder,
  };
}

const rice = category(
  null,
  1,
  t("rice", "reis"),
  t("Rice", "Reis"),
  t("Basmati, Sona Masoori and more", "Basmati, Sona Masoori und mehr"),
  t(
    "Long-grain basmati for biryani and pulao, everyday Sona Masoori and flattened rice for breakfast.",
    "Langkorn-Basmati für Biryani und Pulao, Sona Masoori für jeden Tag und Reisflocken fürs Frühstück.",
  ),
);
const basmati = category(
  rice.id,
  1,
  t("basmati-rice", "basmati-reis"),
  t("Basmati Rice", "Basmati-Reis"),
);
const everydayRice = category(
  rice.id,
  2,
  t("everyday-rice", "alltagsreis"),
  t("Everyday Rice", "Reis für jeden Tag"),
);
const flour = category(
  null,
  2,
  t("flour", "mehl"),
  t("Flour", "Mehl"),
  t("Atta, besan and more", "Atta, Besan und mehr"),
);
const pulses = category(
  null,
  3,
  t("pulses-and-lentils", "huelsenfruechte-und-linsen"),
  t("Pulses & Lentils", "Hülsenfrüchte & Linsen"),
  t("Dal for every day", "Dal für jeden Tag"),
);
const spices = category(
  null,
  4,
  t("spices", "gewuerze"),
  t("Spices", "Gewürze"),
  t("Whole, ground and blended", "Ganz, gemahlen und gemischt"),
);
const wholeSpices = category(
  spices.id,
  1,
  t("whole-spices", "ganze-gewuerze"),
  t("Whole Spices", "Ganze Gewürze"),
);
const groundSpices = category(
  spices.id,
  2,
  t("ground-spices", "gemahlene-gewuerze"),
  t("Ground Spices", "Gemahlene Gewürze"),
);
const masalas = category(
  spices.id,
  3,
  t("masala-blends", "masala-mischungen"),
  t("Masala Blends", "Masala-Mischungen"),
);
const snacks = category(
  null,
  5,
  t("snacks", "snacks"),
  t("Snacks", "Snacks"),
  t("Namkeen, chips and khakhra", "Namkeen, Chips und Khakhra"),
);
const fruit = category(
  null,
  6,
  t("fresh-fruit", "frisches-obst"),
  t("Fresh Fruit", "Frisches Obst"),
  t("Mango season, flown in", "Mangosaison, eingeflogen"),
);
const drinks = category(
  null,
  7,
  t("tea-and-drinks", "tee-und-getraenke"),
  t("Tea & Drinks", "Tee & Getränke"),
);
const dairy = category(
  null,
  8,
  t("ghee-and-dairy", "ghee-und-milchprodukte"),
  t("Ghee & Dairy", "Ghee & Milchprodukte"),
);
const frozen = category(
  null,
  9,
  t("frozen", "tiefkuehl"),
  t("Frozen", "Tiefkühl"),
  t("Parathas and ready to cook", "Parathas und Kochfertiges"),
);

export const categories: CategoryRecord[] = [
  rice,
  basmati,
  everydayRice,
  flour,
  pulses,
  spices,
  wholeSpices,
  groundSpices,
  masalas,
  snacks,
  fruit,
  drinks,
  dairy,
  frozen,
];

// --- Products ---------------------------------------------------------------

interface ProductSeed {
  sku: string;
  group: string;
  isDefaultSize?: boolean;
  slug: Translated;
  name: Translated;
  subtitle?: Translated;
  shortDescription?: Translated;
  description?: Translated;
  brand?: string;
  categoryId: string;
  pack: [number, ProductRecord["packUnit"]];
  price: number;
  salePrice?: number;
  vatRate?: number;
  isAvailable?: boolean;
  isFeatured?: boolean;
  minQuantity?: number;
  maxQuantity?: number;
  storageType?: ProductRecord["storageType"];
  tags?: string[];
  keywords?: string[];
  highlights?: Translated[];
  uses?: Translated[];
  ingredients?: Translated;
  allergens?: Translated;
  origin?: Translated;
  tint: string;
}

const INDIA = t("India", "Indien");
const STORE_DRY = t("Store in a cool, dry place.", "Kühl und trocken lagern.");

let productOrder = 0;
function product(seed: ProductSeed): ProductRecord {
  productOrder += 1;
  const day = String((productOrder % 27) + 1).padStart(2, "0");
  return {
    id: oid("66e9"),
    sku: seed.sku,
    group: seed.group,
    isDefaultSize: seed.isDefaultSize ?? true,
    slug: seed.slug,
    name: seed.name,
    subtitle: seed.subtitle ?? null,
    shortDescription: seed.shortDescription ?? null,
    description: seed.description ?? seed.shortDescription ?? null,
    brand: seed.brand ?? null,
    categoryId: seed.categoryId,
    packValue: seed.pack[0],
    packUnit: seed.pack[1],
    regularPrice: seed.price,
    salePrice: seed.salePrice ?? null,
    vatRate: seed.vatRate ?? 700,
    isAvailable: seed.isAvailable ?? true,
    isFeatured: seed.isFeatured ?? false,
    minQuantity: seed.minQuantity ?? 1,
    maxQuantity: seed.maxQuantity ?? null,
    storageType: seed.storageType ?? "ambient",
    tags: seed.tags ?? [],
    keywords: seed.keywords ?? [],
    highlights: seed.highlights ?? [],
    uses: seed.uses ?? [],
    food: {
      ingredients: seed.ingredients ?? null,
      allergens: seed.allergens ?? null,
      nutrition: null,
      storageInstructions: seed.storageType === "frozen" ? null : STORE_DRY,
      origin: seed.origin ?? INDIA,
      manufacturer: seed.brand ?? null,
    },
    gtin: null,
    publishedAt: `2026-09-${day}T08:00:00.000Z`,
    updatedAt: "2026-09-28T09:30:00.000Z",
    sortOrder: productOrder,
    tint: seed.tint,
  };
}

export const products: ProductRecord[] = [
  product({
    sku: "RF-00041",
    group: "basmati-india-gate",
    isDefaultSize: false,
    slug: t("basmati-rice-1-kg", "basmati-reis-1-kg"),
    name: t("Basmati Rice", "Basmati-Reis"),
    shortDescription: t("Aged long-grain rice", "Gereifter Langkornreis"),
    brand: "India Gate",
    categoryId: basmati.id,
    pack: [1, "kg"],
    price: 599,
    keywords: ["biryani", "pulao"],
    ingredients: t("Basmati rice", "Basmati-Reis"),
    tint: "#F3E6C4",
  }),
  product({
    sku: "RF-00042",
    group: "basmati-india-gate",
    slug: t("basmati-rice-5-kg", "basmati-reis-5-kg"),
    name: t("Basmati Rice", "Basmati-Reis"),
    shortDescription: t("Aged long-grain rice", "Gereifter Langkornreis"),
    description: t(
      "Extra-long grains, aged for two years so they cook fluffy and separate. The rice for biryani, pulao and every festive meal.",
      "Extralange Körner, zwei Jahre gereift, damit sie locker und körnig kochen. Der Reis für Biryani, Pulao und jedes Festessen.",
    ),
    brand: "India Gate",
    categoryId: basmati.id,
    pack: [5, "kg"],
    price: 2499,
    salePrice: 1999,
    isFeatured: true,
    tags: ["bestseller"],
    keywords: ["biryani", "pulao"],
    highlights: [
      t("Aged 2 years", "2 Jahre gereift"),
      t("Extra-long grain", "Extralanges Korn"),
    ],
    uses: [t("Biryani", "Biryani"), t("Pulao", "Pulao")],
    ingredients: t("Basmati rice", "Basmati-Reis"),
    tint: "#F3E6C4",
  }),
  product({
    sku: "RF-00051",
    group: "sona-masoori",
    slug: t("sona-masoori-rice-5-kg", "sona-masoori-reis-5-kg"),
    name: t("Sona Masoori Rice", "Sona-Masoori-Reis"),
    shortDescription: t(
      "Light medium-grain rice for every day",
      "Leichter Mittelkornreis für jeden Tag",
    ),
    brand: "Radhe",
    categoryId: everydayRice.id,
    pack: [5, "kg"],
    price: 1499,
    ingredients: t("Rice", "Reis"),
    tint: "#EFE7D2",
  }),
  product({
    sku: "RF-00052",
    group: "sona-masoori",
    isDefaultSize: false,
    slug: t("sona-masoori-rice-10-kg", "sona-masoori-reis-10-kg"),
    name: t("Sona Masoori Rice", "Sona-Masoori-Reis"),
    shortDescription: t(
      "Light medium-grain rice for every day",
      "Leichter Mittelkornreis für jeden Tag",
    ),
    brand: "Radhe",
    categoryId: everydayRice.id,
    pack: [10, "kg"],
    price: 2799,
    ingredients: t("Rice", "Reis"),
    tint: "#EFE7D2",
  }),
  product({
    sku: "RF-00060",
    group: "poha",
    slug: t("poha-flattened-rice-1-kg", "poha-reisflocken-1-kg"),
    name: t("Poha (Flattened Rice)", "Poha (Reisflocken)"),
    shortDescription: t(
      "Medium thick, for breakfast",
      "Mitteldick, fürs Frühstück",
    ),
    brand: "Radhe",
    categoryId: everydayRice.id,
    pack: [1, "kg"],
    price: 349,
    ingredients: t("Rice", "Reis"),
    tint: "#F1EDE0",
  }),
  product({
    sku: "RF-00101",
    group: "chakki-atta",
    slug: t("chakki-atta-5-kg", "chakki-atta-5-kg"),
    name: t("Chakki Atta", "Chakki Atta"),
    subtitle: t("Whole wheat flour", "Weizenvollkornmehl"),
    shortDescription: t(
      "Stone-ground whole wheat flour for soft rotis",
      "Steingemahlenes Vollkornmehl für weiche Rotis",
    ),
    brand: "Aashirvaad",
    categoryId: flour.id,
    pack: [5, "kg"],
    price: 1299,
    isFeatured: true,
    tags: ["bestseller"],
    keywords: ["roti", "chapati", "weizenmehl"],
    ingredients: t("Whole wheat flour", "Weizenvollkornmehl"),
    allergens: t("Contains gluten (wheat).", "Enthält Gluten (Weizen)."),
    tint: "#EADBC0",
  }),
  product({
    sku: "RF-00102",
    group: "chakki-atta",
    isDefaultSize: false,
    slug: t("chakki-atta-10-kg", "chakki-atta-10-kg"),
    name: t("Chakki Atta", "Chakki Atta"),
    subtitle: t("Whole wheat flour", "Weizenvollkornmehl"),
    shortDescription: t(
      "Stone-ground whole wheat flour for soft rotis",
      "Steingemahlenes Vollkornmehl für weiche Rotis",
    ),
    brand: "Aashirvaad",
    categoryId: flour.id,
    pack: [10, "kg"],
    price: 2399,
    keywords: ["roti", "chapati", "weizenmehl"],
    ingredients: t("Whole wheat flour", "Weizenvollkornmehl"),
    allergens: t("Contains gluten (wheat).", "Enthält Gluten (Weizen)."),
    tint: "#EADBC0",
  }),
  product({
    sku: "RF-00110",
    group: "besan",
    slug: t("besan-gram-flour-1-kg", "besan-kichererbsenmehl-1-kg"),
    name: t("Besan (Gram Flour)", "Besan (Kichererbsenmehl)"),
    shortDescription: t(
      "Finely milled chickpea flour",
      "Fein gemahlenes Kichererbsenmehl",
    ),
    brand: "Radhe",
    categoryId: flour.id,
    pack: [1, "kg"],
    price: 399,
    keywords: ["pakora", "chickpea"],
    ingredients: t("Chickpeas", "Kichererbsen"),
    tint: "#F2DFA3",
  }),
  product({
    sku: "RF-00201",
    group: "toor-dal",
    slug: t("toor-dal-1-kg", "toor-dal-1-kg"),
    name: t("Toor Dal", "Toor Dal"),
    subtitle: t("Split pigeon peas", "Geschälte Straucherbsen"),
    shortDescription: t(
      "The dal for sambar and everyday dal",
      "Das Dal für Sambar und jeden Tag",
    ),
    brand: "Radhe",
    categoryId: pulses.id,
    pack: [1, "kg"],
    price: 449,
    isFeatured: true,
    keywords: ["arhar", "linsen"],
    ingredients: t("Split pigeon peas", "Geschälte Straucherbsen"),
    tint: "#EFD27A",
  }),
  product({
    sku: "RF-00202",
    group: "toor-dal",
    isDefaultSize: false,
    slug: t("toor-dal-2-kg", "toor-dal-2-kg"),
    name: t("Toor Dal", "Toor Dal"),
    subtitle: t("Split pigeon peas", "Geschälte Straucherbsen"),
    shortDescription: t(
      "The dal for sambar and everyday dal",
      "Das Dal für Sambar und jeden Tag",
    ),
    brand: "Radhe",
    categoryId: pulses.id,
    pack: [2, "kg"],
    price: 849,
    keywords: ["arhar", "linsen"],
    ingredients: t("Split pigeon peas", "Geschälte Straucherbsen"),
    tint: "#EFD27A",
  }),
  product({
    sku: "RF-00210",
    group: "moong-dal",
    slug: t("moong-dal-1-kg", "moong-dal-1-kg"),
    name: t("Moong Dal", "Moong Dal"),
    subtitle: t("Split mung beans", "Geschälte Mungbohnen"),
    shortDescription: t("Light and quick to cook", "Leicht und schnell gar"),
    brand: "Radhe",
    categoryId: pulses.id,
    pack: [1, "kg"],
    price: 479,
    ingredients: t("Split mung beans", "Geschälte Mungbohnen"),
    tint: "#EBDD8E",
  }),
  product({
    sku: "RF-00220",
    group: "chana-dal",
    slug: t("chana-dal-1-kg", "chana-dal-1-kg"),
    name: t("Chana Dal", "Chana Dal"),
    subtitle: t("Split chickpeas", "Geschälte Kichererbsen"),
    shortDescription: t("Nutty and firm", "Nussig und bissfest"),
    brand: "Radhe",
    categoryId: pulses.id,
    pack: [1, "kg"],
    price: 399,
    salePrice: 349,
    ingredients: t("Split chickpeas", "Geschälte Kichererbsen"),
    tint: "#E8CC6E",
  }),
  product({
    sku: "RF-00301",
    group: "cumin-seeds",
    slug: t("cumin-seeds-100-g", "kreuzkuemmel-ganz-100-g"),
    name: t("Cumin Seeds", "Kreuzkümmel, ganz"),
    shortDescription: t("Whole jeera", "Ganze Jeera"),
    brand: "Radhe",
    categoryId: wholeSpices.id,
    pack: [100, "g"],
    price: 199,
    keywords: ["jeera", "kümmel"],
    ingredients: t("Cumin", "Kreuzkümmel"),
    tint: "#D9C49A",
  }),
  product({
    sku: "RF-00302",
    group: "cumin-seeds",
    isDefaultSize: false,
    slug: t("cumin-seeds-400-g", "kreuzkuemmel-ganz-400-g"),
    name: t("Cumin Seeds", "Kreuzkümmel, ganz"),
    shortDescription: t("Whole jeera", "Ganze Jeera"),
    brand: "Radhe",
    categoryId: wholeSpices.id,
    pack: [400, "g"],
    price: 599,
    keywords: ["jeera", "kümmel"],
    ingredients: t("Cumin", "Kreuzkümmel"),
    tint: "#D9C49A",
  }),
  product({
    sku: "RF-00311",
    group: "turmeric-powder",
    slug: t("turmeric-powder-100-g", "kurkuma-gemahlen-100-g"),
    name: t("Turmeric Powder", "Kurkuma, gemahlen"),
    shortDescription: t(
      "Bright and earthy haldi",
      "Leuchtendes, erdiges Haldi",
    ),
    brand: "MDH",
    categoryId: groundSpices.id,
    pack: [100, "g"],
    price: 179,
    keywords: ["haldi", "gelbwurz"],
    ingredients: t("Turmeric", "Kurkuma"),
    tint: "#F2C14E",
  }),
  product({
    sku: "RF-00312",
    group: "turmeric-powder",
    isDefaultSize: false,
    slug: t("turmeric-powder-400-g", "kurkuma-gemahlen-400-g"),
    name: t("Turmeric Powder", "Kurkuma, gemahlen"),
    shortDescription: t(
      "Bright and earthy haldi",
      "Leuchtendes, erdiges Haldi",
    ),
    brand: "MDH",
    categoryId: groundSpices.id,
    pack: [400, "g"],
    price: 549,
    keywords: ["haldi", "gelbwurz"],
    ingredients: t("Turmeric", "Kurkuma"),
    tint: "#F2C14E",
  }),
  product({
    sku: "RF-00321",
    group: "red-chilli-powder",
    slug: t("red-chilli-powder-100-g", "chilipulver-rot-100-g"),
    name: t("Red Chilli Powder", "Chilipulver, rot"),
    shortDescription: t(
      "Hot Kashmiri-style chilli",
      "Scharfes Chili nach Kaschmir-Art",
    ),
    brand: "MDH",
    categoryId: groundSpices.id,
    pack: [100, "g"],
    price: 189,
    keywords: ["mirch", "chili"],
    ingredients: t("Red chilli", "Rote Chili"),
    tint: "#E7A08A",
  }),
  product({
    sku: "RF-00331",
    group: "garam-masala",
    slug: t("garam-masala-100-g", "garam-masala-100-g"),
    name: t("Garam Masala", "Garam Masala"),
    shortDescription: t(
      "Warm blend of twelve spices",
      "Warme Mischung aus zwölf Gewürzen",
    ),
    brand: "MDH",
    categoryId: masalas.id,
    pack: [100, "g"],
    price: 249,
    isFeatured: true,
    ingredients: t(
      "Coriander, cumin, black pepper, cardamom, cinnamon, cloves, nutmeg, bay leaf, mace, fennel, ginger, star anise",
      "Koriander, Kreuzkümmel, schwarzer Pfeffer, Kardamom, Zimt, Nelken, Muskat, Lorbeer, Macis, Fenchel, Ingwer, Sternanis",
    ),
    tint: "#C9A27E",
  }),
  product({
    sku: "RF-00401",
    group: "banana-chips",
    slug: t("banana-chips-200-g", "bananenchips-200-g"),
    name: t("Banana Chips", "Bananenchips"),
    shortDescription: t(
      "Kerala style, lightly salted",
      "Nach Kerala-Art, leicht gesalzen",
    ),
    brand: "Radhe",
    categoryId: snacks.id,
    pack: [200, "g"],
    price: 399,
    tags: ["new"],
    ingredients: t(
      "Bananas, coconut oil, salt, turmeric",
      "Bananen, Kokosöl, Salz, Kurkuma",
    ),
    tint: "#F4D98B",
  }),
  product({
    sku: "RF-00410",
    group: "aloo-bhujia",
    slug: t("aloo-bhujia-400-g", "aloo-bhujia-400-g"),
    name: t("Aloo Bhujia", "Aloo Bhujia"),
    shortDescription: t(
      "Crisp potato and gram flour noodles",
      "Knusprige Nudeln aus Kartoffel und Kichererbsenmehl",
    ),
    brand: "Haldiram's",
    categoryId: snacks.id,
    pack: [400, "g"],
    price: 449,
    maxQuantity: 12,
    keywords: ["namkeen"],
    ingredients: t(
      "Potatoes, gram flour, vegetable oil, salt, spices",
      "Kartoffeln, Kichererbsenmehl, Pflanzenöl, Salz, Gewürze",
    ),
    tint: "#F0CF86",
  }),
  product({
    sku: "RF-00420",
    group: "methi-khakhra",
    slug: t("methi-khakhra-200-g", "methi-khakhra-200-g"),
    name: t("Methi Khakhra", "Methi Khakhra"),
    shortDescription: t(
      "Thin roasted wheat crisps with fenugreek",
      "Dünne geröstete Weizenfladen mit Bockshornklee",
    ),
    brand: "Radhe",
    categoryId: snacks.id,
    pack: [200, "g"],
    price: 299,
    minQuantity: 2,
    ingredients: t(
      "Wheat flour, fenugreek leaves, oil, salt, spices",
      "Weizenmehl, Bockshornkleeblätter, Öl, Salz, Gewürze",
    ),
    allergens: t("Contains gluten (wheat).", "Enthält Gluten (Weizen)."),
    tint: "#E5D2A8",
  }),
  product({
    sku: "RF-00501",
    group: "kesar-mango",
    slug: t("kesar-mango-box-3-kg", "kesar-mango-kiste-3-kg"),
    name: t("Kesar Mango, Box", "Kesar-Mango, Kiste"),
    shortDescription: t(
      "Fragrant saffron-coloured mangoes from Gujarat",
      "Duftende safranfarbene Mangos aus Gujarat",
    ),
    brand: "Radhe",
    categoryId: fruit.id,
    pack: [3, "kg"],
    price: 2499,
    isFeatured: true,
    storageType: "chilled",
    tags: ["seasonal"],
    origin: t("Gujarat, India", "Gujarat, Indien"),
    tint: "#F6C667",
  }),
  product({
    sku: "RF-00502",
    group: "alphonso-mango",
    slug: t("alphonso-mango-box-3-kg", "alphonso-mango-kiste-3-kg"),
    name: t("Alphonso Mango, Box", "Alphonso-Mango, Kiste"),
    shortDescription: t(
      "The king of mangoes from Ratnagiri",
      "Die Königin der Mangos aus Ratnagiri",
    ),
    brand: "Radhe",
    categoryId: fruit.id,
    pack: [3, "kg"],
    price: 2999,
    storageType: "chilled",
    tags: ["seasonal"],
    origin: t("Maharashtra, India", "Maharashtra, Indien"),
    tint: "#F7B955",
  }),
  product({
    sku: "RF-00601",
    group: "masala-chai",
    slug: t("masala-chai-250-g", "masala-chai-250-g"),
    name: t("Masala Chai", "Masala Chai"),
    shortDescription: t(
      "Strong Assam tea with cardamom and ginger",
      "Kräftiger Assam-Tee mit Kardamom und Ingwer",
    ),
    brand: "Wagh Bakri",
    categoryId: drinks.id,
    pack: [250, "g"],
    price: 549,
    keywords: ["tee", "tea"],
    ingredients: t(
      "Black tea, cardamom, ginger, cloves, black pepper",
      "Schwarzer Tee, Kardamom, Ingwer, Nelken, schwarzer Pfeffer",
    ),
    tint: "#D8B48C",
  }),
  product({
    sku: "RF-00610",
    group: "mango-drink",
    slug: t("mango-drink-1-l", "mango-getraenk-1-l"),
    name: t("Mango Drink", "Mango-Getränk"),
    shortDescription: t("Sweet mango fruit drink", "Süßes Mango-Fruchtgetränk"),
    brand: "Frooti",
    categoryId: drinks.id,
    pack: [1, "l"],
    price: 249,
    vatRate: 1900,
    ingredients: t(
      "Water, mango pulp (19%), sugar, acidifier citric acid",
      "Wasser, Mangomark (19 %), Zucker, Säuerungsmittel Citronensäure",
    ),
    tint: "#F9CE74",
  }),
  product({
    sku: "RF-00701",
    group: "ghee",
    slug: t("pure-ghee-500-ml", "reines-ghee-500-ml"),
    name: t("Pure Ghee", "Reines Ghee"),
    shortDescription: t(
      "Clarified butter from cow's milk",
      "Butterschmalz aus Kuhmilch",
    ),
    brand: "Amul",
    categoryId: dairy.id,
    pack: [500, "ml"],
    price: 999,
    ingredients: t("Milk fat", "Milchfett"),
    allergens: t("Contains milk.", "Enthält Milch."),
    tint: "#F5E29B",
  }),
  product({
    sku: "RF-00702",
    group: "ghee",
    isDefaultSize: false,
    slug: t("pure-ghee-1-l", "reines-ghee-1-l"),
    name: t("Pure Ghee", "Reines Ghee"),
    shortDescription: t(
      "Clarified butter from cow's milk",
      "Butterschmalz aus Kuhmilch",
    ),
    brand: "Amul",
    categoryId: dairy.id,
    pack: [1, "l"],
    price: 1899,
    salePrice: 1699,
    ingredients: t("Milk fat", "Milchfett"),
    allergens: t("Contains milk.", "Enthält Milch."),
    tint: "#F5E29B",
  }),
  product({
    sku: "RF-00710",
    group: "paneer",
    slug: t("paneer-500-g", "paneer-500-g"),
    name: t("Paneer", "Paneer"),
    shortDescription: t("Fresh Indian cheese", "Indischer Frischkäse"),
    brand: "Radhe",
    categoryId: dairy.id,
    pack: [500, "g"],
    price: 599,
    isAvailable: false,
    storageType: "chilled",
    ingredients: t(
      "Milk, acidifier citric acid",
      "Milch, Säuerungsmittel Citronensäure",
    ),
    allergens: t("Contains milk.", "Enthält Milch."),
    origin: t("Germany", "Deutschland"),
    tint: "#F4F0E6",
  }),
  product({
    sku: "RF-00801",
    group: "paratha",
    slug: t("plain-paratha-5-pieces", "paratha-natur-5-stueck"),
    name: t("Plain Paratha", "Paratha, natur"),
    shortDescription: t(
      "Flaky layered flatbread, ready for the pan",
      "Blättriges Fladenbrot, fertig für die Pfanne",
    ),
    brand: "Radhe",
    categoryId: frozen.id,
    pack: [5, "pcs"],
    price: 349,
    storageType: "frozen",
    ingredients: t(
      "Wheat flour, water, vegetable oil, salt, sugar",
      "Weizenmehl, Wasser, Pflanzenöl, Salz, Zucker",
    ),
    allergens: t("Contains gluten (wheat).", "Enthält Gluten (Weizen)."),
    tint: "#EBDCC0",
  }),
];

const bySku = new Map(products.map((p) => [p.sku, p]));
const idOf = (sku: string): string => {
  const found = bySku.get(sku);
  if (!found) throw new Error(`Unknown SKU in fixtures: ${sku}`);
  return found.id;
};

/**
 * What the open cargo offers. Everything is in the cargo without a limit,
 * except: the Kesar mangoes are sold out, the bhujia has 37 units left, and
 * the Alphonso mangoes are not offered in this cargo.
 */
export const cargoProducts: CargoProductRecord[] = products
  .filter((p) => p.sku !== "RF-00502")
  .map((p) => {
    if (p.sku === "RF-00501") {
      return { productId: p.id, maxQuantity: 40, reservedQuantity: 40 };
    }
    if (p.sku === "RF-00410") {
      return { productId: p.id, maxQuantity: 50, reservedQuantity: 13 };
    }
    return { productId: p.id, maxQuantity: null, reservedQuantity: 0 };
  });

/** Product ids by SKU, for tests and for the seeded demo data. */
export const SKU = {
  basmati1kg: idOf("RF-00041"),
  basmati5kg: idOf("RF-00042"),
  chakkiAtta5kg: idOf("RF-00101"),
  toorDal1kg: idOf("RF-00201"),
  bhujia: idOf("RF-00410"),
  khakhra: idOf("RF-00420"),
  kesarMango: idOf("RF-00501"),
  alphonsoMango: idOf("RF-00502"),
  mangoDrink: idOf("RF-00610"),
  paneer: idOf("RF-00710"),
} as const;
