import type { ComponentProps } from "react";
import type { Link } from "@/i18n/navigation";

type Href = ComponentProps<typeof Link>["href"];

const SLUG = "([a-z0-9]+(?:-[a-z0-9]+)*)";
const PRODUCT = new RegExp(`^/products/${SLUG}/?$`, "i");
const CATEGORY = new RegExp(`^/categor(?:y|ies)/${SLUG}/?$`, "i");
const POST = new RegExp(`^/blog/${SLUG}/?$`, "i");

/**
 * A path of the shop as the API hands it out without a language (the
 * `linkUrl` of a banner, doc 17), as a link of the shop's router, which
 * adds the language and the localized address: `/products/basmati-rice-1kg`
 * becomes `/de/produkte/basmati-rice-1kg` (the product page then moves to
 * the German slug). `/categories/<slug>`, as the admin's documentation
 * words it, and `/category/<slug>` both lead to the category. Anything
 * else answers `null`: the caller then uses the path as it is, and the
 * proxy sends it to the customer's language.
 */
export function shopHref(path: string): Href | null {
  const plain = path.replace(/\/+$/, "") || "/";
  switch (plain) {
    case "/":
    case "/products":
    case "/categories":
    case "/how-it-works":
    case "/delivery-and-payment":
    case "/faq":
    case "/blog":
      return plain;
  }
  const post = POST.exec(path);
  if (post) {
    return { pathname: "/blog/[slug]", params: { slug: post[1] } };
  }
  const product = PRODUCT.exec(path);
  if (product) {
    return { pathname: "/products/[slug]", params: { slug: product[1] } };
  }
  const category = CATEGORY.exec(path);
  if (category) {
    return { pathname: "/category/[slug]", params: { slug: category[1] } };
  }
  return null;
}
