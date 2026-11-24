// Chế độ quét (switch scanning) cho người chỉ thao tác được một–hai nút (thổi / hút / phím cách):
// giao diện lần lượt tô sáng từng nút; một lần thổi (hoặc phím Cách) để chọn.
export const SCAN_SELECTOR = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="radio"], [role="tab"], [role="switch"], [role="slider"], [data-scan]';

function visible(el) {
  if (el.disabled || el.getAttribute?.('aria-disabled') === 'true' || el.closest?.('[data-noscan], [aria-hidden="true"], [inert]')) return false;
  const r = el.getBoundingClientRect?.();
  if (!r || r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

/** Danh sách phần tử có thể chọn; nếu đang có hộp thoại thì chỉ quét trong hộp thoại. */
export function collectTargets(root = document) {
  const dlg = root.querySelector('[role="dialog"][aria-modal="true"]');
  return [...(dlg || root).querySelectorAll(SCAN_SELECTOR)].filter(visible);
}

export class ScanController {
  constructor({ getTargets = collectTargets, intervalMs = 1600, mode = 'auto', onChange } = {}) {
    Object.assign(this, { getTargets, intervalMs, mode, onChange });
    this.index = -1;
    this.paused = false;
    this.timer = null;
    this.cur = null;
    this.running = false;
  }

  start() {
    this.running = true;
    this._arm();
    this.step(1);
  }
  stop() {
    this.running = false;
    clearInterval(this.timer);
    this.timer = null;
    this._mark(null);
    this.index = -1;
  }
  configure({ mode, intervalMs }) {
    if (mode) this.mode = mode;
    if (intervalMs) this.intervalMs = intervalMs;
    if (this.running) this._arm();
  }
  _arm() {
    clearInterval(this.timer);
    this.timer = this.mode === 'auto' ? setInterval(() => !this.paused && this.step(1), this.intervalMs) : null;
  }
  _mark(el) {
    if (this.cur && this.cur !== el) this.cur.classList?.remove('scan-focus');
    this.cur = el;
    if (el) {
      el.classList?.add('scan-focus');
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
    this.onChange?.(el);
  }
  /** Chuyển tới phần tử kế (d = 1) hoặc trước (d = −1), quay vòng. */
  step(d = 1) {
    const list = this.getTargets();
    if (!list.length) return this._mark(null);
    const at = this.cur ? list.indexOf(this.cur) : -1;
    this.index = at >= 0 ? (at + d + list.length) % list.length : d > 0 ? 0 : list.length - 1;
    this._mark(list[this.index]);
  }
  select() {
    const el = this.cur;
    if (!el) return false;
    this.paused = true; // dừng một nhịp để người dùng thấy kết quả
    setTimeout(() => { this.paused = false; }, Math.min(1400, this.intervalMs));
    if (el.matches?.('input[type="text"], input:not([type]), textarea') || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.focus?.();
    else el.click?.();
    return true;
  }
  /** Sự kiện từ ESP32: thổi = chọn; hút = sang mục kế (chế độ từng bước) hoặc tạm dừng / tiếp tục (chế độ tự động). */
  gesture(ev) {
    if (ev === 'LEFT_CLICK' || ev === 'DOUBLE_CLICK') return this.select();
    if (ev === 'RIGHT_CLICK') {
      if (this.mode === 'step') this.step(1);
      else this.paused = !this.paused;
      return true;
    }
    return false;
  }
  key(e) {
    if (e.key === ' ' || e.key === 'Enter') { if (this.select()) e.preventDefault(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { this.step(1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { this.step(-1); e.preventDefault(); }
  }
}
