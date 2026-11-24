// Phát sự kiện chuột/pointer "ảo" tại toạ độ con trỏ điều khiển bằng Joystick – hơi thở.
const PID = 4242;
const HOVER_SELECTOR = 'button, a[href], [role="button"], [role="slider"], [role="tab"], input, textarea, select, label, summary, [data-hover-target]';

const mouseInit = (x, y, extra = {}) => ({
  bubbles: true, cancelable: true, composed: true, view: window,
  clientX: x, clientY: y, screenX: x, screenY: y, button: 0, buttons: 0, ...extra,
});
function pointerEvent(type, x, y, extra) {
  const init = { ...mouseInit(x, y, extra), pointerId: PID, pointerType: 'mouse', isPrimary: true };
  try {
    return new PointerEvent(type, init);
  } catch {
    return new MouseEvent(type, init);
  }
}
export const elementAt = (x, y) => document.elementFromPoint(x, y);

let hovered = null;
export function setHover(x, y) {
  const el = elementAt(x, y);
  const target = el ? el.closest(HOVER_SELECTOR) : null;
  if (target !== hovered) {
    hovered?.removeAttribute('data-cursor-hover');
    target?.setAttribute('data-cursor-hover', 'true');
    hovered = target;
  }
  return target;
}
export function clearHover() {
  hovered?.removeAttribute('data-cursor-hover');
  hovered = null;
}

export function fireClick(x, y, detail = 1) {
  const el = elementAt(x, y);
  if (!el) return null;
  el.dispatchEvent(pointerEvent('pointerdown', x, y, { buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', mouseInit(x, y, { buttons: 1, detail })));
  const focusable = el.closest('input, textarea, select, button, [tabindex]');
  focusable?.focus?.({ preventScroll: true });
  el.dispatchEvent(pointerEvent('pointerup', x, y));
  el.dispatchEvent(new MouseEvent('mouseup', mouseInit(x, y, { detail })));
  el.dispatchEvent(new MouseEvent('click', mouseInit(x, y, { detail })));
  return el;
}
export function fireDoubleClick(x, y) {
  const el = fireClick(x, y, 2);
  el?.dispatchEvent(new MouseEvent('dblclick', mouseInit(x, y, { detail: 2 })));
  return el;
}
export function fireContextMenu(x, y) {
  const el = elementAt(x, y);
  el?.dispatchEvent(new MouseEvent('contextmenu', mouseInit(x, y, { button: 2, buttons: 2 })));
  return el;
}
export function dragStart(x, y) {
  const el = elementAt(x, y);
  if (!el) return null;
  el.dispatchEvent(pointerEvent('pointerdown', x, y, { buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', mouseInit(x, y, { buttons: 1 })));
  el.closest('input, textarea, select, button, [tabindex]')?.focus?.({ preventScroll: true });
  return el;
}
export function dragMove(x, y) {
  const el = elementAt(x, y) || document.body;
  el.dispatchEvent(pointerEvent('pointermove', x, y, { buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousemove', mouseInit(x, y, { buttons: 1 })));
}
export function dragEnd(x, y) {
  const el = elementAt(x, y) || document.body;
  el.dispatchEvent(pointerEvent('pointerup', x, y));
  el.dispatchEvent(new MouseEvent('mouseup', mouseInit(x, y)));
}
