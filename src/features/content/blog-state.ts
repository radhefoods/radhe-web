import type { BlogQuery } from "@/lib/api/types";

// The state of a page of the blog lives in the address (`?q=dal&page=2`),
// as the product lists do: every view can be linked, shared and reached
// with the back button. The parameters are those of the API.

/** How many posts a page of the blog holds: four rows of three cards. */
export const BLOG_PAGE_SIZE = 12;

export interface BlogState {
  q?: string;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBlogState(params: RawParams): BlogState {
  const q = first(params.q)?.trim().slice(0, 80);
  const page = Number(first(params.page));
  return {
    // The API searches from two characters on.
    q: q && q.length >= 2 ? q : undefined,
    page: Number.isInteger(page) && page >= 1 && page <= 500 ? page : 1,
  };
}

/** What a page of the blog is about: the whole blog, a category or a tag. */
export interface BlogScope {
  category?: string;
  tag?: string;
}

/** The query of the API for a state within a scope. */
export function toBlogQuery(
  state: BlogState,
  scope: BlogScope = {},
): BlogQuery {
  return {
    category: scope.category,
    tag: scope.tag,
    q: state.q,
    page: state.page,
    limit: BLOG_PAGE_SIZE,
  };
}

/** The address query for a state; defaults are left out. */
export function toBlogSearchParams(
  state: BlogState,
  overrides: Partial<BlogState> = {},
): Record<string, string> {
  const next = { ...state, ...overrides };
  const query: Record<string, string> = {};
  if (next.q) query.q = next.q;
  if (next.page > 1) query.page = String(next.page);
  return query;
}

/** The same as a query string, without the `?`; empty for the plain list. */
export function toBlogQueryString(
  state: BlogState,
  overrides: Partial<BlogState> = {},
): string {
  return new URLSearchParams(toBlogSearchParams(state, overrides)).toString();
}

/** A tag as the address carries it: lower-case words, as the API keeps them. */
export function cleanTag(value: string): string | null {
  const tag = value.trim().toLowerCase().slice(0, 80);
  return tag.length > 0 && !/\s/.test(tag) ? tag : null;
}
