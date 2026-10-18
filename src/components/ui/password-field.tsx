"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/cn";
import { controlStyles } from "./field";

export interface PasswordFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "type"
> {
  /** Also the base of the ids of hint and error. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  /** Shown instead of the hint, and marks the field as invalid. */
  error?: ReactNode;
  /** The input itself, to focus it after a refused attempt. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A password input like `TextField`, with a button in the field that shows
 * the characters while a customer types them. The button is a toggle for
 * screen readers (`aria-pressed`) and never in the way of the password
 * manager: `autoComplete` comes from the form (`current-password` on
 * sign-in, `new-password` on sign-up and reset).
 */
export function PasswordField({
  id,
  label,
  hint,
  error,
  inputRef,
  className,
  ...props
}: PasswordFieldProps) {
  const t = useTranslations("common");
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={shown ? "text" : "password"}
          className={cn(controlStyles, "pr-13")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          spellCheck={false}
          autoCapitalize="none"
          {...props}
        />
        <button
          type="button"
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          aria-pressed={shown}
          onClick={() => setShown((value) => !value)}
          className="text-ink-muted hover:text-ink absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-md transition-colors duration-150 focus-visible:outline-offset-[-3px]"
        >
          {shown ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm font-semibold text-red-800">
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
