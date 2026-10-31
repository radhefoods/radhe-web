"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export interface FacetOption {
  value: string;
  label: string;
  /** How many products choosing it would leave; none: no count shown. */
  count?: number;
}

/** Controlled by the form: the change is handled there, not here. */
const handledByForm = () => {};

/**
 * The values of one facet as a list of boxes (or dots, for one of a kind)
 * with their counts. A value that would leave no product is dimmed and
 * cannot be chosen; a chosen one can always be taken off again. Long lists
 * show a few values and a button for the rest.
 */
export function FacetOptions({
  name,
  type = "checkbox",
  options,
  selected,
  limit = 8,
  expanded = false,
  onExpand,
}: {
  name: string;
  type?: "checkbox" | "radio";
  options: FacetOption[];
  selected: readonly string[];
  limit?: number;
  expanded?: boolean;
  onExpand?: (expanded: boolean) => void;
}) {
  const t = useTranslations("filters");
  const shown = expanded
    ? options
    : options.filter(
        (option, index) => index < limit || selected.includes(option.value),
      );
  const more = options.length > shown.length;

  return (
    <>
      <ul className="max-h-72 overflow-y-auto">
        {shown.map((option) => {
          const on = selected.includes(option.value);
          const dead = option.count === 0 && !on;
          return (
            <li key={option.value}>
              <label
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm font-semibold transition-colors duration-150",
                  dead
                    ? "text-ink-subtle cursor-not-allowed"
                    : "hover:bg-ink/5 cursor-pointer",
                )}
              >
                <input
                  type={type}
                  name={name}
                  value={option.value}
                  checked={on}
                  onChange={handledByForm}
                  disabled={dead}
                  className="accent-leaf-600 size-4 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.count !== undefined && (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      dead ? "text-ink-subtle/70" : "text-ink-subtle",
                    )}
                  >
                    {option.count}
                  </span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      {(more || expanded) && onExpand && (
        <button
          type="button"
          onClick={() => onExpand(!expanded)}
          className="text-leaf-700 flex min-h-10 items-center rounded-lg px-2.5 text-sm font-semibold hover:underline"
        >
          {expanded ? t("showLess") : t("showMore", { count: options.length })}
        </button>
      )}
    </>
  );
}
