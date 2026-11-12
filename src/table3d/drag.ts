// Drag-to-look state shared by the camera and the click handlers: a press that turned into a drag
// must not also count as a click on whatever is under the cursor when the button is released.

/** Pointer travel (in CSS pixels) before a press counts as a drag. */
export const DRAG_THRESHOLD = 6;

let lastDragEnd = 0;
export function markDragEnded() {
  lastDragEnd = performance.now();
}
/** true right after a drag ended: ignore the click that the release produces. */
export function justDragged() {
  return performance.now() - lastDragEnd < 80;
}
