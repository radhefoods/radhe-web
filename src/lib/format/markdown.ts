/**
 * The plain words of a Markdown text, for places that take no markup: the
 * structured data of the FAQ (doc 18: "the answers as plain text") and a
 * description. Headings, emphasis, links (their text stays), pictures
 * (their description stays), code marks, quotes, list markers and table
 * rules are dropped; the lines are joined with single spaces.
 */
export function markdownToText(markdown: string): string {
  return (
    markdown
      // Fenced code: keep what is inside, without the fence.
      .replace(/```[^\n]*\n([\s\S]*?)```/g, "$1")
      // Pictures and links: their description or text.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      // Table rules (`| --- |`) go; the cells of a row stay.
      .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/gm, "")
      .replace(/\|/g, " ")
      // Headings, quotes and list markers at the start of a line.
      .replace(/^\s{0,3}#{1,6}\s+/gm, "")
      .replace(/^\s{0,3}>\s?/gm, "")
      .replace(/^\s*(?:[-*+]|\d+[.)])\s+/gm, "")
      // Emphasis and code marks.
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/(\*|_)(.*?)\1/g, "$2")
      .replace(/`([^`]*)`/g, "$1")
      .replace(/\s+/g, " ")
      .trim()
  );
}
