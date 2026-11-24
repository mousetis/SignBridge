// Logic ghép ký tự -> từ (thuần, không phụ thuộc React để dễ kiểm thử).
import { systemConfig } from '../../config/systemConfig.js';
import { VOCAB } from '../../data/vocabulary.js';
import { normalizeForSign } from '../text.js';

const sCfg = systemConfig.ai_sign_to_text_engine.recognition_models.static_pose_classifier;

/**
 * Chốt ký tự (v2): phải giữ ổn định ≥ N khung VÀ ≥ holdMs, mỗi khung vượt "sàn" (conf ≥ floor, chênh lệch ≥ marginFloor),
 * và TRUNG BÌNH độ tin cậy / chênh lệch trong lúc giữ phải vượt ngưỡng (≥ 80% / ≥ 30%). Cách này nhạy hơn với dao động nhẹ
 * của tay thật nhưng khó chốt nhầm hơn kiểu "mọi khung đều ≥ ngưỡng". Sau khi chốt, phải "nhả tay" mới chốt được ký tự kế tiếp.
 */
export class CharCommitter {
  constructor({
    threshold = sCfg.confidence_threshold,
    floor = sCfg.frame_floor ?? 0.6,
    holdFrames = sCfg.hold_frames_to_confirm,
    holdMs = sCfg.hold_ms_to_confirm ?? 0,
    releaseFrames = 6,
    grace = 3,
    minMargin = sCfg.min_margin ?? 0,
    marginFloor = sCfg.frame_margin_floor ?? 0,
  } = {}) {
    Object.assign(this, { threshold, floor, holdFrames, holdMs, releaseFrames, grace, minMargin, marginFloor });
    this.reset();
  }

  reset() {
    this.candidate = null;
    this.streak = 0;
    this.sumConf = 0;
    this.sumMargin = 0;
    this.startAt = 0;
    this.miss = 0;
    this.locked = null; // ký tự vừa chốt, cần nhả tay
    this.lowFrames = 0;
    this.holdOff = 0;
  }

  _clear() {
    this.candidate = null;
    this.streak = 0;
    this.sumConf = 0;
    this.sumMargin = 0;
    this.startAt = 0;
  }

  /** Khoá sau khi chốt ký tự động (J/Z): chặn chốt tĩnh trong `holdOff` khung hình. */
  lockUntilRelease(ch = '*', holdOff = 25) {
    this.locked = ch;
    this.holdOff = holdOff;
    this.lowFrames = 0;
    this._clear();
  }

  /** @returns {{candidate:string|null, progress:number, committed:string|null, avgConf:number, avgMargin:number}} */
  update({ present, top, conf, moving, margin, now }) {
    const mg = margin === undefined ? 1 : margin;
    const solid = !!(present && top && conf >= this.floor && mg >= this.marginFloor);
    if (this.holdOff > 0) this.holdOff--;
    if (this.locked) {
      if (solid && top === this.locked) this.lowFrames = 0;
      else this.lowFrames++;
      if (this.lowFrames >= this.releaseFrames || (!present && this.lowFrames >= 3)) this.locked = null;
    }
    let committed = null;
    if (solid && !moving) {
      if (top === this.candidate) {
        this.streak++;
        this.sumConf += conf;
        this.sumMargin += mg;
      } else {
        this.candidate = top;
        this.streak = 1;
        this.sumConf = conf;
        this.sumMargin = mg;
        this.startAt = now ?? 0;
      }
      this.miss = 0;
      const avgConf = this.sumConf / this.streak;
      const avgMargin = this.sumMargin / this.streak;
      const timeOk = !this.holdMs || now === undefined || now - this.startAt >= this.holdMs;
      if (this.streak >= this.holdFrames && timeOk && avgConf >= this.threshold && avgMargin >= this.minMargin && !this.locked && this.holdOff === 0) {
        committed = top;
        this.locked = top;
        this.lowFrames = 0;
        this._clear();
      }
    } else if (++this.miss > this.grace) {
      this._clear();
    }
    const n = this.streak;
    let progress = Math.min(1, n / this.holdFrames);
    if (this.holdMs && now !== undefined && n) progress = Math.min(progress, (now - this.startAt) / this.holdMs);
    if (n) {
      // chưa đủ độ chắc chắn trung bình → thanh tiến độ dừng ở 90% cho tới khi tay rõ hơn
      const ok = this.sumConf / n >= this.threshold && this.sumMargin / n >= this.minMargin;
      if (!ok) progress = Math.min(progress, 0.9);
    }
    return { candidate: this.candidate, progress: Math.max(0, progress), committed, avgConf: n ? this.sumConf / n : 0, avgMargin: n ? this.sumMargin / n : 0 };
  }
}

/** Gợi ý hoàn thành từ/cụm từ theo phần đuôi của văn bản. */
export function suggest(text, userFreq = {}, max = 5) {
  const trailingSpace = /\s$/.test(text);
  const tokens = normalizeForSign(text).trim().split(' ').filter(Boolean);
  if (!tokens.length) return [];
  const res = [];
  for (const w of VOCAB) {
    const wk = w.key.split(' ').length;
    for (let k = Math.min(wk, tokens.length); k >= 1; k--) {
      const tail = tokens.slice(-k).join(' ');
      if (w.key.startsWith(tail) && w.key !== tail && (!trailingSpace || k >= 1)) {
        res.push({ key: w.key, display: w.display, replace: k, score: k * 10 + (userFreq[w.key] || 0) * 3 - w.key.length * 0.01 });
        break;
      }
    }
  }
  res.sort((a, b) => b.score - a.score);
  return res.slice(0, max);
}

export function applySuggestion(text, s) {
  const tokens = normalizeForSign(text).trim().split(' ').filter(Boolean);
  tokens.splice(tokens.length - s.replace, s.replace, s.key);
  return tokens.join(' ') + ' ';
}

/** Tự chèn dấu cách khi ngừng tay đủ lâu. */
export class WordBuilder {
  constructor(pauseMs = systemConfig.ai_sign_to_text_engine.output_assembly.auto_space_pause_ms) {
    this.pauseMs = pauseMs;
    this.text = '';
    this.lastActivity = 0;
    this.spaceAdded = false;
  }
  add(ch, now) {
    this.text += ch;
    this.lastActivity = now;
    this.spaceAdded = false;
  }
  backspace(now) {
    this.text = this.text.slice(0, -1);
    this.lastActivity = now;
    this.spaceAdded = this.text.endsWith(' ');
  }
  clear() {
    this.text = '';
    this.lastActivity = 0;
    this.spaceAdded = false;
  }
  set(text, now) {
    this.text = text;
    this.lastActivity = now;
    this.spaceAdded = text.endsWith(' ');
  }
  /** 0..1 tiến độ tới lúc tự chèn dấu cách (0 nếu không có gì để đếm). */
  pauseProgress(now) {
    if (!this.text || this.text.endsWith(' ') || !this.lastActivity) return 0;
    return Math.min(1, (now - this.lastActivity) / this.pauseMs);
  }
  /** @returns {boolean} true nếu vừa chèn dấu cách */
  tick(now) {
    if (this.text && !this.text.endsWith(' ') && this.lastActivity && now - this.lastActivity >= this.pauseMs) {
      this.text += ' ';
      this.spaceAdded = true;
      return true;
    }
    return false;
  }
}
