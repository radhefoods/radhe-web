"use client";

import { Bell, BellRing } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useSession } from "@/features/session/session";
import {
  useNotifyMe,
  useStockAlerts,
  type NotifyMe,
} from "@/features/stock-alerts/stock-alerts";
import type { Id, StockAlertAsked } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { AddToCart } from "./add-to-cart";
import { cardSlot } from "./card-slot";

// "Notify me" (doc 26), where "Add to cart" would stand for a pack size
// that cannot be ordered: a block under the "Sold out" pill of the product
// page and a button in the bar that page keeps above the tab bar on phones
// (`notify-me-panel.tsx`), and a round bell in the price row of a product
// card (here). A signed-in customer asks with one tap; a visitor gets a
// small form (the address and a box to tick, `notify-me-form.tsx`), in
// place on the product page and in a panel that slides over the page from
// a card (`notify-me-sheet.tsx`). Nothing is shown while the shop does not
// offer the emails (`useStockAlerts().offered`).
//
// This file is what every product card carries: the state of a control and
// the bell. The form and the panel are not in it.

/** What one control is doing and has to say, per pack size. */
export interface NotifyLocal {
  busy: boolean;
  /** A refusal that is a sentence: shown beside the control. */
  error: unknown;
  /** The visitor's form is open. */
  form: boolean;
  /** The answer to the visitor's request. */
  asked: StockAlertAsked | null;
  /** The customer took the request back just now. */
  cancelled: boolean;
}

const REST: NotifyLocal = {
  busy: false,
  error: null,
  form: false,
  asked: null,
  cancelled: false,
};

export interface NotifyControl extends Pick<
  NotifyMe,
  "offered" | "waiting" | "back"
> {
  local: NotifyLocal;
  /** The address of the account, while a customer is signed in. */
  email: string | null;
  /**
   * A tap on "Notify me". Answers whether the visitor's form opened.
   * `aloud`: say at the top of the window that the customer was asked for
   * (where the control itself cannot).
   */
  start: (options?: { aloud?: boolean }) => Promise<boolean>;
  /** The customer takes the request back. */
  stop: () => Promise<void>;
  /** The visitor's form was sent; answers the fields the API refused. */
  submit: (
    email: string,
  ) => Promise<{ email: boolean; consent: boolean } | null>;
  closeForm: () => void;
}

/**
 * One "Notify me" control. On the product page (`page`) what happened is
 * said in place; on a card there is no room, so it is said at the top of
 * the window (`StockAlertNotice`). The state is kept per pack size: the
 * product page changes its size in place, and each size keeps what was
 * said about it.
 */
export function useNotifyControl(
  variantId: Id,
  surface: "page" | "card",
): NotifyControl {
  const t = useTranslations("stockAlerts");
  const tErrors = useTranslations("errors");
  const session = useSession();
  const { announce } = useStockAlerts();
  const notify = useNotifyMe(variantId);
  const [locals, setLocals] = useState<Readonly<Record<Id, NotifyLocal>>>({});
  const local = locals[variantId] ?? REST;
  const patch = useCallback(
    (change: Partial<NotifyLocal>) =>
      setLocals((all) => ({
        ...all,
        [variantId]: { ...(all[variantId] ?? REST), ...change },
      })),
    [variantId],
  );

  /** A refusal that is a sentence: in place on the page, on top from a card. */
  const refuse = (error: unknown) => {
    if (surface === "card") announce({ tone: "bad", error });
    patch({ busy: false, error: surface === "page" ? error : null });
  };
  /** The pack size came back meanwhile: "Add to cart" takes over. */
  const backAgain = () => {
    announce({ tone: "good", text: tErrors("STOCK_ALERT_NOT_NEEDED") });
    patch({ ...REST });
  };

  const start = async ({
    aloud = surface === "card",
  } = {}): Promise<boolean> => {
    // A visitor is known without a call: the form opens at once.
    if (session.status === "guest") {
      patch({ form: true, error: null, cancelled: false });
      return true;
    }
    patch({ busy: true, error: null, cancelled: false });
    const outcome = await notify.ask();
    switch (outcome.kind) {
      case "asked":
        if (aloud) {
          announce({
            tone: "good",
            text: t("customerDone", { email: outcome.email }),
          });
        }
        patch({ ...REST });
        return false;
      case "visitor":
        patch({ busy: false, form: true });
        return true;
      case "back":
        backAgain();
        return false;
      case "hidden":
        patch({ ...REST });
        return false;
      default:
        refuse(outcome.error);
        return false;
    }
  };

  const stop = async () => {
    patch({ busy: true, error: null });
    const outcome = await notify.cancel();
    if (outcome.kind === "error") refuse(outcome.error);
    else patch({ ...REST, cancelled: true });
  };

  const submit = async (email: string) => {
    patch({ busy: true, error: null });
    const outcome = await notify.askAsVisitor(email);
    switch (outcome.kind) {
      case "asked":
        // On a card the panel stays open and says so; on the page the
        // message takes the form's place.
        patch({ ...REST, asked: outcome.answer, form: surface === "card" });
        return null;
      case "fields":
        patch({ busy: false });
        return { email: outcome.email, consent: outcome.consent };
      case "back":
        backAgain();
        return null;
      case "hidden":
        patch({ ...REST });
        return null;
      default:
        // In the form, wherever it stands: the visitor is looking at it.
        patch({ busy: false, error: outcome.error });
        return null;
    }
  };

  const closeForm = () =>
    patch(surface === "card" ? { ...REST } : { form: false, error: null });

  return {
    offered: notify.offered,
    waiting: notify.waiting,
    back: notify.back,
    local,
    email: session.customer?.email ?? null,
    start,
    stop,
    submit,
    closeForm,
  };
}

type Panel = typeof import("./notify-me-sheet").NotifyMeSheet;

let loading: Promise<Panel> | null = null;
/** Fetches the panel once; every later call answers the same promise. */
function loadPanel(): Promise<Panel> {
  loading ??= import("./notify-me-sheet").then(
    (module) => module.NotifyMeSheet,
  );
  // A failed download (connection lost) may be tried again with the next tap.
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * "Notify me" on a product card whose size cannot be ordered: a round bell
 * in the slot of the price row, where the basket stands otherwise. It
 * fills when the customer waits, and a second tap takes the request back,
 * like the heart of the wishlist. A visitor gets the form in a panel that
 * slides over the page; the panel, with the form and the dialog code
 * behind it, is fetched when the bell is first touched, focused or pointed
 * at, not with every card (as the phone menu fetches its panel). When the
 * API answers that the size can be ordered again, the basket takes the
 * bell's place (`data-back-again` lets the card drop its "Sold out" pill
 * and the grey of its picture).
 */
export function NotifyMeBell({
  variantId,
  name,
}: {
  variantId: Id;
  /** The name with the size, for the spoken labels and the panel. */
  name: string;
}) {
  const t = useTranslations("stockAlerts");
  const control = useNotifyControl(variantId, "card");
  const bell = useRef<HTMLButtonElement>(null);
  const [Panel, setPanel] = useState<Panel | null>(null);
  const { waiting, local, back } = control;

  if (back) {
    return (
      <div data-back-again="" className={cardSlot}>
        <AddToCart
          variantId={variantId}
          name={name}
          ordering={back}
          size="sm"
          look="card"
        />
      </div>
    );
  }
  if (!control.offered) return null;

  // Touching or focusing the bell starts the download; the tap that
  // follows usually finds it ready.
  const warmUp = () => void loadPanel().catch(() => {});
  const tap = async () => {
    if (local.busy) return;
    if (waiting) return control.stop();
    // The form opened (a visitor): it stands in the panel.
    if (await control.start()) {
      loadPanel()
        .then((panel) => setPanel(() => panel))
        .catch(control.closeForm);
    }
  };

  return (
    <div className={cardSlot}>
      <button
        ref={bell}
        type="button"
        aria-pressed={waiting !== null}
        aria-busy={local.busy || undefined}
        aria-label={
          waiting ? t("cancelNamed", { name }) : t("notifyNamed", { name })
        }
        onPointerEnter={warmUp}
        onTouchStart={warmUp}
        onFocus={warmUp}
        onClick={() => void tap()}
        className={cn(
          "text-leaf-700 ring-leaf-600/15 hover:shadow-lift ease-glass grid size-10 shrink-0 place-items-center rounded-full ring-1 transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.94]",
          waiting ? "bg-leaf-100" : "bg-leaf-50 hover:bg-leaf-100",
        )}
      >
        {local.busy ? (
          <Spinner className="size-4.5" />
        ) : waiting ? (
          <BellRing
            aria-hidden="true"
            className="animate-count-pop size-5 fill-current"
            strokeWidth={2.1}
          />
        ) : (
          <Bell aria-hidden="true" className="size-5" strokeWidth={2.1} />
        )}
      </button>
      {/* Always in the tree, so that the change of its text is read out. */}
      <span role="status" className="sr-only">
        {local.cancelled ? t("cancelled") : ""}
      </span>
      {Panel && (
        <Panel
          control={control}
          name={name}
          idBase={`notify-${variantId}`}
          returnFocusTo={bell}
        />
      )}
    </div>
  );
}
