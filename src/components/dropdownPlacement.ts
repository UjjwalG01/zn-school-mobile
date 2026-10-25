// Where a dropdown's list goes relative to the field that opened it. Pure, so the rules are tested without a screen.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement {
  left: number;
  width: number;
  /** The list may not grow past this; it scrolls inside. */
  maxHeight: number;
  /** Set when the list opens downwards: its top edge sits just under the field. */
  top?: number;
  /** Set when it opens upwards: its bottom edge sits just over the field (so a short list still touches the field). */
  bottom?: number;
}

/** Space kept free between the list and the edges of the usable screen. */
export interface Edges {
  top: number;
  bottom: number;
  side: number;
}

const GAP = 4;

/**
 * Opens downwards, like the web's dropdown, unless the list (`wanted` points tall, capped by the caller) does not fit
 * below the field and there is more room above it; then it opens upwards. The width is the field's. The list is held
 * inside the usable screen: it shrinks (and scrolls) rather than run under the status bar or the navigation bar.
 */
export function placeDropdown(
  anchor: Rect,
  screen: { width: number; height: number },
  wanted: number,
  edges: Edges,
): Placement {
  const below = screen.height - edges.bottom - (anchor.y + anchor.height) - GAP;
  const above = anchor.y - edges.top - GAP;
  const up = below < wanted && above > below;
  const room = Math.max(up ? above : below, 0);

  const width = Math.min(anchor.width, screen.width - 2 * edges.side);
  const left = Math.min(Math.max(anchor.x, edges.side), screen.width - edges.side - width);
  const maxHeight = Math.min(wanted, room);

  return up
    ? { left, width, maxHeight, bottom: screen.height - anchor.y + GAP }
    : { left, width, maxHeight, top: anchor.y + anchor.height + GAP };
}
