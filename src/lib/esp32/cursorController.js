// Con trỏ ảo điều khiển bằng Joystick 4 trục: di chuyển theo thời gian, phát sự kiện click/kéo-thả vào trang.
import { fireClick, fireDoubleClick, fireContextMenu, dragStart, dragMove, dragEnd, setHover, clearHover } from '../ui/domEvents.js';

const BASE_SPEED = 620; // px/giây ở độ nghiêng tối đa khi cursor_speed = 1

export class CursorController {
  constructor() {
    this.x = window.innerWidth / 2;
    this.y = window.innerHeight / 2;
    this.vx = 0;
    this.vy = 0;
    this.speed = 1.5;
    this.invertX = false;
    this.invertY = false;
    this.dragging = false;
    this.enabled = true;
    this.last = 0;
    this.raf = 0;
    this.listeners = new Set();
    this.moved = false;
  }

  onAction(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  _emit(a) {
    this.listeners.forEach((fn) => fn(a));
  }

  configure({ speed, invertX, invertY, enabled }) {
    if (speed !== undefined) this.speed = speed;
    if (invertX !== undefined) this.invertX = invertX;
    if (invertY !== undefined) this.invertY = invertY;
    if (enabled !== undefined) {
      this.enabled = enabled;
      if (!enabled) this.stop();
    }
  }

  setVector(x, y) {
    this.vx = x;
    this.vy = y;
  }

  start() {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (t) => {
      this.raf = requestAnimationFrame(loop);
      this._step(t);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.dragging) this.dragging = false;
    clearHover();
  }

  _step(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (!this.enabled) return;
    const dx = this.vx * (this.invertX ? -1 : 1) * BASE_SPEED * this.speed * dt;
    const dy = this.vy * (this.invertY ? -1 : 1) * BASE_SPEED * this.speed * dt;
    if (dx || dy) {
      this.x = Math.min(window.innerWidth - 2, Math.max(2, this.x + dx));
      this.y = Math.min(window.innerHeight - 2, Math.max(2, this.y + dy));
      this.moved = true;
      // cuộn trang khi chạm mép trên/dưới
      const edge = 36;
      if (this.y > window.innerHeight - edge && dy > 0) window.scrollBy(0, 14 * this.speed);
      if (this.y < edge && dy < 0) window.scrollBy(0, -14 * this.speed);
      if (this.dragging) dragMove(this.x, this.y);
    }
    if (this.moved || this._hoverDirty) {
      setHover(this.x, this.y);
      this.moved = false;
    }
    this._emit({ type: 'move', x: this.x, y: this.y, dragging: this.dragging });
  }

  /** Thực thi lệnh từ ESP32: LEFT_CLICK, DOUBLE_CLICK, RIGHT_CLICK, DRAG_START, DRAG_END (HOLD_DRAG được xử lý bởi nơi gọi). */
  perform(type) {
    if (!this.enabled) return;
    const { x, y } = this;
    switch (type) {
      case 'LEFT_CLICK':
        fireClick(x, y);
        break;
      case 'DOUBLE_CLICK':
        fireDoubleClick(x, y);
        break;
      case 'RIGHT_CLICK':
        fireContextMenu(x, y);
        break;
      case 'DRAG_START':
        if (!this.dragging) {
          this.dragging = true;
          dragStart(x, y);
        }
        break;
      case 'DRAG_END':
        if (this.dragging) {
          this.dragging = false;
          dragEnd(x, y);
        }
        break;
      default:
        return;
    }
    this._emit({ type: 'action', action: type, x, y, dragging: this.dragging, at: performance.now() });
  }
}
