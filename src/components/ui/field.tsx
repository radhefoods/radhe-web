import type { InputHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

/**
 * The look of a text input, also for selects and textareas: a white field
 * with a faint outline that turns leaf with the focus (and keeps the
 * standard outline, which keyboard users rely on), red when it is refused.
 */
export const controlStyles =
  "min-h-12 w-full rounded-md border-[1.5px] border-line-strong bg-white/90 px-3.5 text-base text-ink shadow-[inset_0_1px_2px_rgb(23_33_27/0.04)] transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ink-subtle hover:border-ink-subtle focus-visible:border-leaf-600 focus-visible:bg-white focus-visible:outline-offset-1 disabled:bg-cloud/70 disabled:text-ink-subtle disabled:shadow-none disabled:hover:border-line-strong aria-invalid:border-red-600 aria-invalid:bg-red-50";

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  /** Also the base of the ids of hint and error. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Shown instead of the hint, and marks the field as invalid. */
  error?: ReactNode;
  /** The input itself, to focus it. */
  inputRef?: Ref<HTMLInputElement>;
  /**
   * `float`: the label rests inside the field and rises to its top edge
   * as soon as the field has the focus or a value (the checkout, after
   * the design "Liquid Glass" of the lab). The label stays a `label` of
   * the input either way.
   */
  look?: "plain" | "float";
}

/** The label of a floating field: in the middle at rest, small at the top when in use. */
const floatingLabel =
  "text-ink-subtle ease-glass pointer-events-none absolute top-7 left-[0.96875rem] max-w-[calc(100%-1.75rem)] -translate-y-1/2 truncate text-[0.96875rem] font-medium transition-[top,font-size,color] duration-200 peer-focus:top-[0.9375rem] peer-focus:text-[0.71875rem] peer-focus:font-semibold peer-focus:text-leaf-700 peer-[:not(:placeholder-shown)]:top-[0.9375rem] peer-[:not(:placeholder-shown)]:text-[0.71875rem] peer-[:not(:placeholder-shown)]:font-semibold";

/**
 * A text input with its label, hint and error. Text is 16 px so that iOS
 * does not zoom into the field.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  inputRef,
  look = "plain",
  className,
  ...props
}: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {look === "float" ? (
        <div className="relative">
          <input
            id={id}
            ref={inputRef}
            className={cn(
              controlStyles,
              "peer border-ink/14 min-h-14 bg-white/70 pt-[1.0625rem]",
            )}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...props}
            // A blank that is never seen: it tells the label whether the
            // field is empty (`:placeholder-shown`).
            placeholder=" "
          />
          <label htmlFor={id} className={floatingLabel}>
            {label}
          </label>
        </div>
      ) : (
        <>
          <label htmlFor={id} className="text-sm font-semibold">
            {label}
          </label>
          <input
            id={id}
            ref={inputRef}
            className={controlStyles}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            {...props}
          />
        </>
      )}
      {error ? (
        // Spoken when it appears: a form that refuses a value on "submit"
        // leaves the focus on the button.
        <p
          id={`${id}-error`}
          role="alert"
          className="text-sm font-semibold text-red-800"
        >
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-ink-muted text-sm">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
