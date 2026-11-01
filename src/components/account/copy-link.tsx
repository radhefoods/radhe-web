"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlStyles } from "@/components/ui/field";
import { cn } from "@/lib/cn";

/** How long "Link copied" stays. */
const COPIED_FOR_MS = 2000;

/**
 * A link to pass on (the referral link, doc 21): the address in a field
 * that selects itself on focus, and a button that copies it. Where the
 * clipboard is not available the field is there to copy by hand.
 */
export function CopyLink({
  id,
  link,
  label,
  copy,
  copied,
  className,
}: {
  id: string;
  link: string;
  /** The spoken label of the field. */
  label: string;
  copy: string;
  copied: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setDone(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), COPIED_FOR_MS);
    } catch {
      // No clipboard: the field selects itself for a copy by hand.
      document.getElementById(id)?.focus();
    }
  }

  return (
    <div className={cn("flex flex-col gap-2 sm:flex-row", className)}>
      <input
        id={id}
        aria-label={label}
        readOnly
        value={link}
        onFocus={(event) => event.target.select()}
        className={cn(controlStyles, "min-h-11 text-sm")}
      />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void copyLink()}
        className="shrink-0"
      >
        {done ? (
          <Check aria-hidden="true" className="size-4" />
        ) : (
          <Copy aria-hidden="true" className="size-4" />
        )}
        {done ? copied : copy}
      </Button>
      <span role="status" className="sr-only">
        {done ? copied : ""}
      </span>
    </div>
  );
}
