import type { Category } from "@/lib/api/types";

// The category navigation of the header and of the phone menu (owner,
// 2026-11-11). The shop has nineteen parent categories with seventy
// sub-categories: as one item each they filled three rows of the header.
// They are shown in a handful of groups instead, each a mega menu with its
// categories and their sub-categories.
//
// The categories, their names, their order and their pages stay the API's
// (`GET /v1/store/categories`); only the grouping is the shop's. A group
// is not a category and has no page of its own.

/**
 * The groups of the navigation, in the order of the bar. A parent category
 * belongs to the first group that knows one of the words of its English
 * slug (`spices-masalas` is "spices" and "masalas"), so a category the
 * admin renames or adds finds its place without a change here as long as
 * it is named in the usual words; any other category is listed under
 * "More", never left out. The labels are in the messages (`nav.groups`).
 */
export const NAV_GROUPS = [
  {
    id: "staples",
    words: [
      "rice",
      "atta",
      "flour",
      "flours",
      "dal",
      "dals",
      "pulses",
      "lentils",
      "oil",
      "oils",
      "ghee",
    ],
  },
  {
    id: "cooking",
    words: [
      "spices",
      "masala",
      "masalas",
      "pantry",
      "baking",
      "pickles",
      "chutneys",
      "sauces",
      "instant",
      "ready",
    ],
  },
  {
    id: "snacks",
    words: [
      "snacks",
      "namkeen",
      "papad",
      "khakhra",
      "sweets",
      "biscuits",
      "beverages",
      "drinks",
      "tea",
      "coffee",
    ],
  },
  {
    id: "fresh",
    words: [
      "fresh",
      "chilled",
      "frozen",
      "dairy",
      "fruit",
      "fruits",
      "vegetables",
    ],
  },
  { id: "world", words: ["asian", "african", "caribbean"] },
  {
    id: "home",
    words: ["care", "beauty", "pooja", "festival", "household", "kitchen"],
  },
] as const;

export type NavGroupId = (typeof NAV_GROUPS)[number]["id"];

/** A catalogue of up to this many parent categories needs no groups. */
export const MAX_UNGROUPED = 6;

/**
 * How many items a narrow desktop shows beside "All products" before the
 * rest moves under "More": German labels are long, and the bar keeps to
 * one row.
 */
export const NARROW_VISIBLE = 4;

/** The categories of one group; `other`: those no group knows. */
export interface NavSection {
  id: NavGroupId | "other";
  categories: Category[];
}

/** A parent category shown as itself: a link with its sub-categories. */
export interface NavCategoryItem {
  kind: "category";
  key: string;
  category: Category;
  /** The group it would stand in; `null` in a catalogue without groups. */
  group: NavGroupId | "other" | null;
}

/**
 * Several categories behind one label: a group of the list above, "More"
 * (what no group knows, or what a narrow bar has no room for), or "All
 * categories" when no category is known to any group.
 */
export interface NavGroupItem {
  kind: "group";
  key: string;
  label: NavGroupId | "more" | "all";
  sections: NavSection[];
}

export type NavItem = NavCategoryItem | NavGroupItem;

function groupOf(category: Category): NavGroupId | "other" {
  const words = category.slugs.en.split("-");
  for (const group of NAV_GROUPS) {
    if (words.some((word) => (group.words as readonly string[]).includes(word)))
      return group.id;
  }
  return "other";
}

/**
 * The items of the navigation for the parent categories of the API, which
 * keep their order inside every group. A small catalogue is shown category
 * by category; a group with a single category is shown as that category.
 */
export function navItems(categories: Category[]): NavItem[] {
  const single = (
    category: Category,
    group: NavCategoryItem["group"],
  ): NavCategoryItem => ({
    kind: "category",
    key: `category:${category.id}`,
    category,
    group,
  });
  if (categories.length <= MAX_UNGROUPED) {
    return categories.map((category) => single(category, null));
  }

  const members = new Map<NavGroupId | "other", Category[]>();
  for (const category of categories) {
    const id = groupOf(category);
    members.set(id, [...(members.get(id) ?? []), category]);
  }
  const items: NavItem[] = [];
  for (const { id } of NAV_GROUPS) {
    const own = members.get(id);
    if (!own) continue;
    items.push(
      own.length === 1
        ? single(own[0], id)
        : {
            kind: "group",
            key: `group:${id}`,
            label: id,
            sections: [{ id, categories: own }],
          },
    );
  }
  const rest = members.get("other");
  if (rest) {
    items.push({
      kind: "group",
      key: "group:other",
      label: items.length === 0 ? "all" : "more",
      sections: [{ id: "other", categories: rest }],
    });
  }
  return items;
}

/**
 * The same items for a bar with less room: the first ones as they are and
 * the others together under "More", each group a section of its panel.
 * Nothing moves when at most one item would.
 */
export function collapseTail(
  items: NavItem[],
  visible: number = NARROW_VISIBLE,
): { head: NavItem[]; more: NavGroupItem | null } {
  if (items.length <= visible + 1) return { head: items, more: null };
  const sections: NavSection[] = [];
  for (const item of items.slice(visible)) {
    const parts: NavSection[] =
      item.kind === "group"
        ? item.sections
        : [{ id: item.group ?? "other", categories: [item.category] }];
    for (const part of parts) {
      const last = sections.at(-1);
      if (last?.id === part.id) {
        last.categories = [...last.categories, ...part.categories];
      } else {
        sections.push({ ...part });
      }
    }
  }
  return {
    head: items.slice(0, visible),
    more: { kind: "group", key: "group:more-narrow", label: "more", sections },
  };
}

/** Every slug under a category, its own first. */
export function slugsOf(category: Category): string[] {
  return [category.slug, ...category.children.flatMap(slugsOf)];
}

/** The parent categories of an item. */
export function categoriesOf(item: NavItem): Category[] {
  return item.kind === "category"
    ? [item.category]
    : item.sections.flatMap((section) => section.categories);
}

/** Whether the page of this category, or of one below it, is under the item. */
export function holdsSlug(item: NavItem, slug: string | null): boolean {
  return (
    slug !== null &&
    categoriesOf(item).some((category) => slugsOf(category).includes(slug))
  );
}
