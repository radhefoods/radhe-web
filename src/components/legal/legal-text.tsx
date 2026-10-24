import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Marks of a part that still has to be filled in: `[[...]]`. */
export const PLACEHOLDER = /\[\[[^\]]+\]\]/;

/**
 * A text written in Markdown, in the type of the shop: the legal texts,
 * the answers of the FAQ and the articles of the blog. HTML inside the
 * text is not rendered: whatever is pasted into a text cannot run in a
 * customer's browser. Inline code that holds a `[[placeholder]]` is shown
 * as a marked gap. A page that has its own title can ask for the headings
 * to step down one level (`demoteHeadings`): a `#` in the text then
 * renders as the page's second level, never as a second `h1`.
 */
export function LegalText({
  children,
  tableLabel,
  demoteHeadings = false,
}: {
  children: string;
  /** The spoken name of a table's scrolling box. */
  tableLabel: string;
  demoteHeadings?: boolean;
}) {
  return (
    <div className="[&_h2]:font-display [&_td]:border-line [&_th]:border-line-strong [&_a]:text-leaf-700 [&_h2]:text-ink [&_blockquote]:border-line-strong [&_blockquote]:text-ink-muted max-w-none [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:mt-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_h2]:mt-8 [&_h2]:text-3xl [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_h4]:mt-4 [&_h4]:font-bold [&_img]:mt-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_table]:mt-4 [&_table]:w-full [&_table]:min-w-[36rem] [&_table]:text-left [&_table]:text-[0.9375rem] [&_td]:border-b [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_th]:border-b [&_th]:py-2 [&_th]:pr-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
          ...(demoteHeadings && {
            h1: ({ children: text }) => <h2>{text}</h2>,
            h2: ({ children: text }) => <h3>{text}</h3>,
            h3: ({ children: text }) => <h4>{text}</h4>,
          }),
          // Wide tables scroll inside their own box, not the page. The box
          // takes focus, so it can be scrolled with the arrow keys too.
          table: ({ children: rows }) => (
            <div
              role="group"
              aria-label={tableLabel}
              tabIndex={0}
              className="overflow-x-auto"
            >
              <table>{rows}</table>
            </div>
          ),
          code: ({ children: text }) =>
            PLACEHOLDER.test(String(text)) ? (
              <mark className="bg-wheat-100 text-wheat-800 rounded-xs px-1 font-semibold">
                {String(text)}
              </mark>
            ) : (
              <code className="bg-mist rounded-xs px-1 text-[0.875em]">
                {text}
              </code>
            ),
        }}
      >
        {children}
      </Markdown>
    </div>
  );
}
