import { describe, expect, it } from "vitest";
import { buildUrl } from "@/lib/api/http";
import {
  BLOG_PAGE_SIZE,
  cleanTag,
  parseBlogState,
  toBlogQuery,
  toBlogQueryString,
} from "./blog-state";

const url = (query: object) =>
  buildUrl("", "/v1/store/blog/posts", { ...query, locale: "en" });

describe("parseBlogState", () => {
  it("reads the search and the page, and ignores what the API would refuse", () => {
    expect(parseBlogState({})).toEqual({ q: undefined, page: 1 });
    expect(parseBlogState({ q: " dal ", page: "3" })).toEqual({
      q: "dal",
      page: 3,
    });
    expect(parseBlogState({ q: "d", page: "0" })).toEqual({
      q: undefined,
      page: 1,
    });
    expect(parseBlogState({ page: "abc" }).page).toBe(1);
    expect(parseBlogState({ page: "501" }).page).toBe(1);
  });
});

describe("toBlogQuery", () => {
  it("asks for a page of the whole blog", () => {
    expect(url(toBlogQuery({ page: 2 }))).toBe(
      `/v1/store/blog/posts?page=2&limit=${BLOG_PAGE_SIZE}&locale=en`,
    );
  });

  it("limits the page to a category or a tag and keeps the search", () => {
    expect(
      url(toBlogQuery({ q: "dal", page: 1 }, { category: "recipes" })),
    ).toBe(
      `/v1/store/blog/posts?category=recipes&q=dal&page=1&limit=${BLOG_PAGE_SIZE}&locale=en`,
    );
    expect(url(toBlogQuery({ page: 1 }, { tag: "spices" }))).toBe(
      `/v1/store/blog/posts?tag=spices&page=1&limit=${BLOG_PAGE_SIZE}&locale=en`,
    );
  });
});

describe("toBlogQueryString", () => {
  it("leaves the defaults out", () => {
    expect(toBlogQueryString({ page: 1 })).toBe("");
    expect(toBlogQueryString({ q: "dal", page: 1 }, { page: 2 })).toBe(
      "q=dal&page=2",
    );
  });
});

describe("cleanTag", () => {
  it("lower-cases a tag and refuses blanks", () => {
    expect(cleanTag("Spices")).toBe("spices");
    expect(cleanTag("  ")).toBeNull();
    expect(cleanTag("two words")).toBeNull();
  });
});
