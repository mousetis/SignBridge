// Lọc Joystick (vùng chết + trung bình trượt 5 mẫu) và nhận dạng cử chỉ thổi/hút từ áp suất (kPa).

export class JoystickFilter {
  constructor({ deadzone = 0.12, window = 5 } = {}) {
    this.deadzone = deadzone;
    this.window = window;
    this.bx = [];
    this.by = [];
  }
  setDeadzone(v) {
    this.deadzone = v;
  }
  reset() {
    this.bx.length = 0;
    this.by.length = 0;
  }
  /** @returns {{x:number,y:number,mag:number}} đã lọc, vùng chết xuyên tâm, -1..1 */
  push(x, y) {
    this.bx.push(x);
    this.by.push(y);
    if (this.bx.length > this.window) {
      this.bx.shift();
      this.by.shift();
    }
    const mx = this.bx.reduce((a, b) => a + b, 0) / this.bx.length;
    const my = this.by.reduce((a, b) => a + b, 0) / this.by.length;
    const m = Math.hypot(mx, my);
    if (m < this.deadzone) return { x: 0, y: 0, mag: 0 };
    const k = Math.min(1, (m - this.deadzone) / (1 - this.deadzone)) / m;
    return { x: mx * k, y: my * k, mag: Math.min(1, (m - this.deadzone) / (1 - this.deadzone)) };
  }
}

/**
 * Cử chỉ thổi/hút (khi firmware chỉ gửi giá trị kPa thô):
 *  - thổi ngắn (nhả trước 600 ms)         -> LEFT_CLICK
 *  - thổi lần 2 trong 350 ms              -> DOUBLE_CLICK
 *  - thổi và giữ ≥ 600 ms                 -> DRAG_START ... nhả -> DRAG_END
 *  - hút (≤ -0.45 kPa)                    -> RIGHT_CLICK
 */
export class PressureGestureDetector {
  constructor(cfg) {
    this.setConfig(cfg);
    this.reset();
  }
  setConfig({ puff = 0.45, sip = -0.45, doubleMs = 350, holdMs = 600 } = {}) {
    Object.assign(this, { puff, sip, doubleMs, holdMs });
  }
  reset() {
    this.puffing = false;
    this.puffStart = 0;
    this.second = false;
    this.lastRelease = 0;
    this.dragging = false;
    this.sipping = false;
    this.sipStart = 0;
    this.sipFired = false;
  }
  /** @returns {string[]} danh sách sự kiện phát sinh ở mẫu này */
  update(kpa, now) {
    const ev = [];
    if (kpa === null || kpa === undefined) return ev;
    if (!this.puffing && !this.sipping && kpa >= this.puff) {
      this.puffing = true;
      this.puffStart = now;
      this.second = this.lastRelease > 0 && now - this.lastRelease <= this.doubleMs;
    } else if (this.puffing) {
      if (!this.dragging && now - this.puffStart >= this.holdMs) {
        this.dragging = true;
        ev.push('DRAG_START');
      }
      if (kpa < this.puff * 0.6) {
        this.puffing = false;
        if (this.dragging) {
          this.dragging = false;
          ev.push('DRAG_END');
          this.lastRelease = 0;
        } else if (now - this.puffStart >= 30) {
          if (this.second) {
            ev.push('DOUBLE_CLICK');
            this.lastRelease = 0;
          } else {
            ev.push('LEFT_CLICK');
            this.lastRelease = now;
          }
        }
      }
    }
    if (!this.sipping && !this.puffing && kpa <= this.sip) {
      this.sipping = true;
      this.sipStart = now;
      this.sipFired = false;
    } else if (this.sipping) {
      if (!this.sipFired && now - this.sipStart >= 60) {
        this.sipFired = true;
        ev.push('RIGHT_CLICK');
      }
      if (kpa > this.sip * 0.6) this.sipping = false;
    }
    return ev;
  }
}
