import { cache } from "react";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import {
  REVALIDATE,
  TAGS,
  leaveToFirstVisitWhileBuilding,
  serverApi,
} from "@/lib/api/server";
import type {
  BlogCategory,
  BlogPost,
  BlogPostSummary,
  BlogQuery,
  BlogTag,
  FaqGroup,
  Page,
} from "@/lib/api/types";

// What the server reads from the API for the FAQ and the blog (doc 18 and
// 19). Every answer is cached for `REVALIDATE.content` (the API allows
// five minutes) and shared by the components of one request (`cache`).
// The content of a page throws, so the error page with "try again" shows;
// the frame around it (categories, tags) answers an empty list instead.

const content = { revalidate: REVALIDATE.content, tags: [TAGS.content] };

/** The groups of the FAQ; `[]` when nothing is published. */
export const getFaqs = cache(async (locale: Locale): Promise<FaqGroup[]> => {
  try {
    const { groups } = await serverApi.listFaqs({ locale, next: content });
    return groups;
  } catch (error) {
    await leaveToFirstVisitWhileBuilding();
    throw error;
  }
});

export function listBlogPosts(
  query: BlogQuery,
  locale: Locale,
): Promise<Page<BlogPostSummary>> {
  return serverApi.listBlogPosts(query, { locale, next: content });
}

/** `null` when the post does not exist, is a draft or is scheduled. */
export const getBlogPost = cache(
  async (slug: string, locale: Locale): Promise<BlogPost | null> => {
    try {
      const { post } = await serverApi.getBlogPost(slug, {
        locale,
        next: content,
      });
      return post;
    } catch (error) {
      if (
        hasErrorCode(error, "BLOG_POST_NOT_FOUND") ||
        hasErrorCode(error, "NOT_FOUND")
      ) {
        return null;
      }
      await leaveToFirstVisitWhileBuilding();
      throw error;
    }
  },
);

/** The categories of the blog in display order; `[]` when they do not arrive. */
export const getBlogCategories = cache(
  async (locale: Locale): Promise<BlogCategory[]> => {
    try {
      const { items } = await serverApi.listBlogCategories({
        locale,
        next: content,
      });
      return items;
    } catch {
      return [];
    }
  },
);

/** The tags of the published posts, most used first; `[]` when they do not arrive. */
export const getBlogTags = cache(async (locale: Locale): Promise<BlogTag[]> => {
  try {
    const { items } = await serverApi.listBlogTags({ locale, next: content });
    return items;
  } catch {
    return [];
  }
});
