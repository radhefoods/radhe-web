"use client";

import { Plus, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useWishlistsRefresh } from "@/features/wishlist/wishlists";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { Id, WishlistSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const NAME_MAX = 40;

/**
 * The name of a list, asked for in a sheet: for a new list, or to rename
 * one (doc 16.2). A name another list has is said at the field.
 */
function NameSheet({
  open,
  title,
  initial = "",
  submitLabel,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  initial?: string;
  submitLabel: string;
  onClose: () => void;
  /** Throws the error of the API when it refuses. */
  onSave: (name: string) => Promise<void>;
}) {
  const t = useTranslations("wishlist");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setProblem(t("listNameMissing"));
      return;
    }
    setBusy(true);
    setProblem(null);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (caught) {
      if (hasErrorCode(caught, "WISHLIST_NAME_TAKEN")) {
        setProblem(t("listNameTaken"));
      } else {
        setError(caught);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={title}
      closeLabel={tCommon("close")}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <TextField
          id="wishlist-name"
          label={t("listName")}
          maxLength={NAME_MAX}
          autoFocus
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setProblem(null);
          }}
          hint={t("listNameHint")}
          error={problem}
        />
        {error !== null && <ErrorAlert error={error} />}
        <div className="flex flex-col gap-3">
          <Button type="submit" block loading={busy}>
            {submitLabel}
          </Button>
          <Button variant="secondary" block disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** "Delete the list?" with a second tap, in a sheet. */
function DeleteSheet({
  list,
  onClose,
  onDeleted,
}: {
  list: WishlistSummary | null;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const t = useTranslations("wishlist");
  const tCommon = useTranslations("common");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  return (
    <Sheet
      open={list !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t("deleteTitle", { name: list?.name ?? "" })}
      closeLabel={tCommon("close")}
    >
      <div className="flex flex-col gap-5">
        <p className="text-ink-muted">
          {t("deleteText", { count: list?.count ?? 0 })}
        </p>
        {error !== null && <ErrorAlert error={error} />}
        <div className="flex flex-col gap-3">
          <Button
            variant="danger"
            block
            loading={busy}
            onClick={async () => {
              if (!list) return;
              setBusy(true);
              setError(null);
              try {
                await api.deleteWishlist(list.id);
                onDeleted();
                onClose();
              } catch (caught) {
                setError(caught);
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("deleteYes")}
          </Button>
          <Button variant="secondary" block disabled={busy} onClick={onClose}>
            {t("cancel")}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * The lists of a customer on the wishlist page (doc 16.2): a chooser of
 * frosted pills with the count on each and a star on the default, "New
 * list" at its end; for the chosen list "Rename", "Make default" and
 * "Delete list". Up to 20 lists under names of the customer's own.
 */
export function WishlistLists({
  lists,
  current,
  onChoose,
}: {
  lists: WishlistSummary[];
  current: WishlistSummary;
  onChoose: (id: Id | null) => void;
}) {
  const t = useTranslations("wishlist");
  const refresh = useWishlistsRefresh();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState<WishlistSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function makeDefault() {
    setBusy(true);
    setError(null);
    try {
      await api.updateWishlist(current.id, { isDefault: true });
      // The heart now means this list: both lists are read afresh.
      refresh({ defaultList: true, lists: [current.id] });
      onChoose(null);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <nav aria-label={t("lists")}>
        <ul className="glass-soft no-scrollbar -mx-4 flex gap-1 overflow-x-auto rounded-full p-1 sm:mx-0 sm:flex-wrap">
          {lists.map((list) => {
            const active = list.id === current.id;
            return (
              <li key={list.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => onChoose(list.isDefault ? null : list.id)}
                  className={cn(
                    "ease-glass flex min-h-10 items-center gap-1.5 rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-200",
                    active
                      ? "text-leaf-700 bg-white shadow-[0_1px_2px_rgb(23_33_27/0.08),0_4px_12px_-4px_rgb(23_33_27/0.16)]"
                      : "text-ink-muted hover:text-ink hover:bg-white/60",
                  )}
                >
                  {list.isDefault && (
                    <Star
                      aria-label={t("default")}
                      className="text-wheat-800 size-4 fill-current"
                    />
                  )}
                  {list.name}
                  <span className="text-ink-subtle text-xs tabular-nums">
                    {list.count}
                  </span>
                </button>
              </li>
            );
          })}
          {lists.length < 20 && (
            <li className="shrink-0">
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="text-leaf-700 hover:bg-leaf-50/80 ease-glass flex min-h-10 items-center gap-1 rounded-full px-4 text-[0.9375rem] font-semibold whitespace-nowrap transition-colors duration-200"
              >
                <Plus aria-hidden="true" className="size-4" />
                {t("newList")}
              </button>
            </li>
          )}
        </ul>
      </nav>

      <div
        role="group"
        aria-label={t("listActions")}
        className="flex flex-wrap items-center gap-x-1 gap-y-1"
      >
        <Button variant="quiet" size="sm" onClick={() => setRenaming(true)}>
          {t("rename")}
        </Button>
        {!current.isDefault && (
          <Button
            variant="quiet"
            size="sm"
            loading={busy}
            onClick={() => void makeDefault()}
          >
            {t("makeDefault")}
          </Button>
        )}
        <Button
          variant="quiet"
          size="sm"
          className="text-red-600 hover:bg-red-50"
          onClick={() => setDeleting(current)}
        >
          {t("deleteList")}
        </Button>
        {current.isDefault && (
          <p className="text-ink-muted ml-2 text-sm">{t("defaultHint")}</p>
        )}
      </div>
      {error !== null && <ErrorAlert error={error} />}

      {creating && (
        <NameSheet
          open
          title={t("newListTitle")}
          submitLabel={t("create")}
          onClose={() => setCreating(false)}
          onSave={async (name) => {
            const { wishlist } = await api.createWishlist({ name });
            refresh();
            onChoose(wishlist.id);
          }}
        />
      )}
      {renaming && (
        <NameSheet
          open
          title={t("renameTitle")}
          initial={current.name}
          submitLabel={t("save")}
          onClose={() => setRenaming(false)}
          onSave={async (name) => {
            await api.updateWishlist(current.id, { name });
            refresh({ defaultList: current.isDefault, lists: [current.id] });
          }}
        />
      )}
      <DeleteSheet
        list={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          refresh({ defaultList: true });
          onChoose(null);
        }}
      />
    </div>
  );
}
