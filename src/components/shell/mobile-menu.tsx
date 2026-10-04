"use client";

import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import type { Category } from "@/lib/api/types";

type Panel = typeof import("./mobile-menu-panel").MobileMenuPanel;

let loading: Promise<Panel> | null = null;
/** Fetches the panel once; every later call answers the same promise. */
function loadPanel(): Promise<Panel> {
  loading ??= import("./mobile-menu-panel").then(
    (module) => module.MobileMenuPanel,
  );
  // A failed download (connection lost) may be tried again with the next tap.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * The menu button on small screens. The panel with the categories and the
 * dialog code behind it are fetched when the button is first touched, not
 * with every page: most visits never open the menu.
 */
export function MobileMenu({ categories }: { categories: Category[] }) {
  const t = useTranslations("common");
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [Panel, setPanel] = useState<Panel | null>(null);

  // Touching or focusing the button starts the download; the tap that
  // follows usually finds it ready.
  const warmUp = () => void loadPanel().catch(() => {});
  const openMenu = () => {
    setOpen(true);
    loadPanel()
      .then((panel) => setPanel(() => panel))
      .catch(() => setOpen(false));
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={t("menu")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerEnter={warmUp}
        onTouchStart={warmUp}
        onFocus={warmUp}
        onClick={openMenu}
        className="hover:bg-mist grid size-11 place-items-center rounded-sm lg:hidden"
      >
        <Menu aria-hidden="true" className="size-6" />
      </button>
      {Panel && (
        <Panel
          categories={categories}
          open={open}
          onOpenChange={setOpen}
          button={button}
        />
      )}
    </>
  );
}
