import type { ReactNode } from "react";

/** The look of a link inside the auth forms ("Forgot password?"). */
export const authLink =
  "text-leaf-700 rounded-xs font-semibold underline underline-offset-4";

/**
 * The frame of the sign-in, sign-up and password pages: the title with a
 * line under it, then one white card. The same card for all four pages, so
 * that the way from one to the other feels like one place.
 */
export function AuthPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="container-page py-10 sm:py-16">
      <div className="mx-auto flex max-w-md flex-col gap-6">
        <header className="space-y-3">
          <h1 className="font-display text-ink text-3xl sm:text-4xl">
            {title}
          </h1>
          {intro && <p className="text-ink-muted">{intro}</p>}
        </header>
        <div className="glass-strong shadow-float rounded-3xl p-5 sm:p-7">
          {children}
        </div>
      </div>
    </div>
  );
}
