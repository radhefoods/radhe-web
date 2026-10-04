"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

/**
 * The form of sorting and filters. Without scripts it is a plain form with
 * an "Apply" button; with scripts every change applies at once, without a
 * full page load, and the button is not needed.
 *
 * The address is the truth: when it changes by other means (the reset link,
 * the back button), the controls are set to what the address says.
 */
export function FilterForm({
  action,
  values,
  children,
  className,
}: {
  /** The address of the list, for the plain form. */
  action: string;
  /** The state of the list by control name: text for selects, boolean for checkboxes. */
  values: Record<string, string | boolean>;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const form = useRef<HTMLFormElement>(null);
  const valuesKey = JSON.stringify(values);

  useEffect(() => {
    const current = JSON.parse(valuesKey) as Record<string, string | boolean>;
    for (const [name, value] of Object.entries(current)) {
      const control = form.current?.elements.namedItem(name);
      if (control instanceof HTMLInputElement && typeof value === "boolean") {
        control.checked = value;
      } else if (
        control instanceof HTMLSelectElement &&
        typeof value === "string"
      ) {
        control.value = value;
      }
    }
  }, [valuesKey]);

  return (
    <form
      ref={form}
      method="get"
      action={action}
      className={className}
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        const query: Record<string, string> = {};
        for (const [key, value] of data) {
          if (typeof value === "string" && value !== "") query[key] = value;
        }
        if (query.sort === "recommended") delete query.sort;
        // A changed filter starts at the first page again.
        delete query.page;
        router.replace(
          { pathname, params, query } as unknown as Parameters<
            typeof router.replace
          >[0],
          { scroll: false },
        );
      }}
    >
      {children}
    </form>
  );
}
