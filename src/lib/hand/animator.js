// Điều khiển diễn hoạt bàn tay 3D: chuyển tiếp mượt giữa các ký tự bằng Quaternion SLERP,
// vẽ quỹ đạo cho J/Z và báo chỉ số ký tự đang thực hiện (để tô sáng phụ đề đồng bộ).
import * as THREE from 'three';
import { blendPoses, dynamicOffset, DYNAMIC_INFO } from './handPose.js';
import { getPoseQuats } from './poseLibrary.js';

export const TRANSITION = 0.3; // giây (ở tốc độ 1.0×)
export const HOLD = 0.62;
export const HOLD_DYNAMIC = 1.7;
export const HOLD_SPACE = 0.5;

const ease = (u) => u * u * (3 - 2 * u);

export class PoseAnimator {
  constructor(rig) {
    this.rig = rig;
    this.tokens = [];
    this.index = 0;
    this.local = 0;
    this.playing = false;
    this.speed = 1;
    this.mode = 'once'; // 'once' | 'loop-dynamic'
    this.onIndex = null;
    this.onEnd = null;
    this.scratch = null;
    this.offset = new THREE.Vector3();
    this._trailTick = 0;
    this.applyRest();
  }

  load(chars) {
    this.tokens = chars.map((ch) => ({
      ch,
      key: ch === ' ' ? 'REST' : ch,
      dynamic: ch === 'J' || ch === 'Z',
      hold: ch === ' ' ? HOLD_SPACE : ch === 'J' || ch === 'Z' ? HOLD_DYNAMIC : HOLD,
    }));
    this.index = 0;
    this.local = 0;
    this.rig.clearTrail();
    this._apply();
  }

  setSpeed(s) {
    this.speed = s;
  }
  play() {
    if (!this.tokens.length) return;
    if (this.index >= this.tokens.length - 1 && this.local >= this._total(this.tokens[this.index])) this.restart();
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  restart() {
    this.index = 0;
    this.local = 0;
    this.rig.clearTrail();
    this.onIndex?.(0);
  }
  seek(i) {
    this.index = Math.max(0, Math.min(this.tokens.length - 1, i));
    this.local = TRANSITION; // nhảy thẳng tới tư thế đích (không dừng ở tư thế trước)
    this.rig.clearTrail();
    this.onIndex?.(this.index);
    this._apply();
  }

  _total(t) {
    return TRANSITION + t.hold;
  }

  applyRest() {
    this.rig.setPose(getPoseQuats('REST'));
  }

  update(dt) {
    if (!this.tokens.length) return;
    if (this.playing) {
      this.local += dt * this.speed;
      let guard = 0;
      while (this.local >= this._total(this.tokens[this.index]) && guard++ < 8) {
        if (this.index >= this.tokens.length - 1) {
          if (this.mode === 'loop-dynamic' && this.tokens[this.index].dynamic) {
            this.local -= this._total(this.tokens[this.index]) + 0.5;
            if (this.local < 0) this.local = 0;
            this.rig.clearTrail();
          } else {
            this.local = this._total(this.tokens[this.index]);
            this.playing = false;
            this.onEnd?.();
          }
          break;
        }
        this.local -= this._total(this.tokens[this.index]);
        this.index++;
        this.rig.clearTrail();
        this.onIndex?.(this.index);
      }
    }
    this._apply();
  }

  _apply() {
    const tok = this.tokens[this.index];
    if (!tok) return;
    const prev = this.tokens[this.index - 1];
    const toQ = getPoseQuats(tok.key);
    const fromQ = getPoseQuats(prev ? prev.key : 'REST');
    const u = ease(Math.min(1, this.local / TRANSITION));
    this.scratch = blendPoses(fromQ, toQ, u, this.scratch);
    // Dịch chuyển cả bàn tay khi vẽ J/Z
    const off = this.offset.set(0, 0, 0);
    let uDyn = 0;
    if (tok.dynamic) {
      uDyn = Math.max(0, Math.min(1, (this.local - TRANSITION) / tok.hold));
      const [x, y, z] = dynamicOffset(tok.ch, uDyn);
      off.set(x, y, z);
    }
    if (prev?.dynamic && this.local < TRANSITION) {
      const [px, py, pz] = dynamicOffset(prev.ch, 1);
      off.x += px * (1 - u);
      off.y += py * (1 - u);
      off.z += pz * (1 - u);
    }
    this.rig.setPose(this.scratch, { position: off });
    if (tok.dynamic && this.local > TRANSITION && this.playing && ++this._trailTick % 2 === 0) {
      this.rig.pushTrail(DYNAMIC_INFO[tok.ch].tipLandmark);
    }
  }
}
