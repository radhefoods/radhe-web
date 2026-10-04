import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Marks of a part that still has to be filled in: `[[...]]`. */
export const PLACEHOLDER = /\[\[[^\]]+\]\]/;

/**
 * A legal text written in Markdown, in the type of the shop. HTML inside
 * the text is not rendered: whatever is pasted into a text cannot run in a
 * customer's browser. Inline code that holds a `[[placeholder]]` is shown
 * as a marked gap.
 */
export function LegalText({
  children,
  tableLabel,
}: {
  children: string;
  /** The spoken name of a table's scrolling box. */
  tableLabel: string;
}) {
  return (
    <div className="[&_h2]:font-display [&_td]:border-line [&_th]:border-line-strong max-w-none [&_a]:font-semibold [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-8 [&_h2]:text-3xl [&_h2]:text-blue-900 [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-bold [&_li]:mt-1 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-3 [&_table]:mt-4 [&_table]:w-full [&_table]:min-w-[36rem] [&_table]:text-left [&_table]:text-[0.9375rem] [&_td]:border-b [&_td]:py-2.5 [&_td]:pr-4 [&_td]:align-top [&_th]:border-b [&_th]:py-2 [&_th]:pr-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
      <Markdown
        skipHtml
        remarkPlugins={[remarkGfm]}
        components={{
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
              <mark className="bg-gold-100 text-gold-800 rounded-xs px-1 font-semibold">
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
