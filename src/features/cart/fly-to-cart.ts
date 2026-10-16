/**
 * The flight into the cart (owner, 2026-10-16): when a pack size is added,
 * a ghost of its picture lifts off its tile, arcs across the page and
 * drops into the cart pill of the header (on phones: the cart tab), which
 * bobs as it lands. Plain DOM and the Web Animations API, nothing in React
 * state: the real cart count has already changed by then.
 *
 * Markup contract: the add button's nearest `[data-fly-scope]` holds one
 * `[data-fly-source]`, the tile whose first child is the picture; the cart
 * pills carry `[data-cart-target]`, and the visible one is the target. With
 * no tile on screen the flight starts at the button itself, as a leaf dot.
 */

const FLIGHT_MS = 720;
const LANDING_MS = 360;
/** The ghost shrinks to about this size as it lands. */
const LANDED_PX = 28;

function isShown(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function onScreen(rect: DOMRect): boolean {
  return (
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < window.innerHeight &&
    rect.left < window.innerWidth
  );
}

function cartTarget(): HTMLElement | null {
  for (const candidate of document.querySelectorAll("[data-cart-target]")) {
    if (isShown(candidate)) return candidate;
  }
  return null;
}

/**
 * The ghost: an outer box at the tile's place that moves up or down, and
 * in it the tile's frame (corners, tint, padding) with a copy of the
 * picture, which moves across and shrinks. Two boxes, so that the frame
 * can clip its picture while the whole still travels on a bent path.
 */
function ghostOf(
  source: HTMLElement | null,
  button: HTMLElement,
): { outer: HTMLDivElement; frame: HTMLDivElement; rect: DOMRect } {
  const outer = document.createElement("div");
  const frame = document.createElement("div");
  outer.setAttribute("aria-hidden", "true");
  outer.dataset.flyGhost = "";
  let rect: DOMRect;
  if (source) {
    rect = source.getBoundingClientRect();
    const style = getComputedStyle(source);
    frame.style.borderRadius = style.borderRadius;
    frame.style.background = style.backgroundColor;
    frame.style.padding = style.padding;
    const picture = source.firstElementChild;
    if (picture) frame.append(picture.cloneNode(true));
  } else {
    rect = button.getBoundingClientRect();
    frame.style.borderRadius = "9999px";
    frame.style.background = "var(--color-leaf-600)";
  }
  Object.assign(outer.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
    zIndex: "50",
  });
  Object.assign(frame.style, {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    overflow: "hidden",
    boxShadow: "var(--shadow-float)",
    willChange: "transform",
  });
  outer.append(frame);
  return { outer, frame, rect };
}

/** Flies the picture of the button's tile into the cart. Call on the tap. */
export function flyToCart(button: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = cartTarget();
  if (!target) return;
  const scope = button.closest("[data-fly-scope]") ?? document;
  const tile = scope.querySelector("[data-fly-source]");
  const source =
    tile instanceof HTMLElement && onScreen(tile.getBoundingClientRect())
      ? tile
      : null;
  const { outer, frame, rect } = ghostOf(source, button);
  const to = target.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (rect.left + rect.width / 2);
  const dy = to.top + to.height / 2 - (rect.top + rect.height / 2);
  const scale = LANDED_PX / Math.max(rect.width, rect.height);
  document.body.append(outer);

  // Across and shrinking with one easing, up or down with another, so the
  // path bends: it rises past a cart above and drops in, or lifts first
  // and then falls to the cart tab below.
  const across = frame.animate(
    [
      { transform: "translateX(0) scale(1)" },
      { transform: `translateX(${dx}px) scale(${scale})` },
    ],
    {
      duration: FLIGHT_MS,
      easing: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
      fill: "forwards",
    },
  );
  outer.animate(
    [{ transform: "translateY(0)" }, { transform: `translateY(${dy}px)` }],
    {
      duration: FLIGHT_MS,
      easing:
        dy < 0
          ? "cubic-bezier(0.2, 1.3, 0.4, 1)"
          : "cubic-bezier(0.5, -0.6, 0.6, 1)",
      fill: "forwards",
    },
  );
  outer.animate(
    [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: 0.75 },
      { opacity: 0, offset: 1 },
    ],
    { duration: FLIGHT_MS, easing: "linear", fill: "forwards" },
  );

  const land = () => {
    outer.remove();
    target.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.12)", offset: 0.4 },
        { transform: "scale(1)" },
      ],
      { duration: LANDING_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
    );
  };
  across.finished.then(land, () => outer.remove());
}
