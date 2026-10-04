"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";

/** A click that the browser, not the shop, will handle (new tab, download). */
function leavesThePage(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (anchor.target !== "" && anchor.target !== "_self") ||
    anchor.hasAttribute("download")
  );
}

/** Never show the line for longer than this, whatever happens. */
const GIVE_UP_MS = 10_000;

/**
 * A thin line at the top of the window while the next page is on its way.
 * On a slow connection a tap on a link otherwise shows nothing until the
 * page arrives. It starts with a click on a link of the shop and ends when
 * the address has changed. It waits a moment before it appears, so quick
 * page changes show nothing at all.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = `${pathname}?${search}`;
  // The address the visitor was on when the click happened.
  const [leaving, setLeaving] = useState<string | null>(null);
  const timer = useRef(0);

  const start = useEffectEvent(() => {
    setLeaving(here);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setLeaving(null), GIVE_UP_MS);
  });

  useEffect(() => {
    function onClick(event: MouseEvent) {
      const anchor =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || leavesThePage(event, anchor)) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const same =
        url.pathname === window.location.pathname &&
        url.search === window.location.search;
      if (!same) start();
    }
    // Capture: before the link itself handles the click.
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (leaving !== here) return null;
  return (
    <div
      aria-hidden="true"
      className="nav-progress pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] bg-blue-600"
    />
  );
}
