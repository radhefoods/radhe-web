import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** The look of a text input, also for selects and textareas. */
export const controlStyles =
  "min-h-12 w-full rounded-sm border-[1.5px] border-line-strong bg-white px-3.5 text-base text-ink placeholder:text-ink-subtle focus-visible:border-blue-600 focus-visible:outline-offset-1 disabled:bg-cloud disabled:text-ink-subtle aria-invalid:border-red-600 aria-invalid:bg-red-50";

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
}

/**
 * A text input with its label, hint and error. Text is 16 px so that iOS
 * does not zoom into the field.
 */
export function TextField({
  id,
  label,
  hint,
  error,
  className,
  ...props
}: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        className={controlStyles}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-red-600">
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
