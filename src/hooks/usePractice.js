import { useCallback, useEffect, useRef, useState } from 'react';
import { signEngine, modeForChar } from '../lib/ml/signEngine.js';
import { isDynamic } from '../data/lessons.js';
import { LM } from '../lib/hand/handSkeleton.js';
import { systemConfig } from '../config/systemConfig.js';

const FB = systemConfig.deaf_mute_learning_module.practice_feedback;
export const REQ = FB.required_accuracy_percent / 100; // 0.80
export const HOLD_MS = FB.hold_success_ms; // 1000
const GREEN = '#6EE7A8';
const YELLOW = '#FFC93C';
const RED = '#FF8A7A';
const colorOf = (s) => (s >= 0.8 ? GREEN : s >= 0.55 ? YELLOW : RED);

/**
 * Chấm điểm một ký tự mục tiêu từ camera: độ chính xác (hình học + mô hình), giữ đúng `holdMs` thì thành công.
 * Dùng chung cho Học, Ôn tập, Kiểm tra và Trò chơi phản xạ. `runKey` đổi => bắt đầu lại (kể cả khi ký tự giống nhau).
 */
export function usePractice({ ch, runKey = 0, holdMs = HOLD_MS, req = REQ, active = true, onSuccess }) {
  const [live, setLive] = useState({ acc: 0, hold: 0, success: false, present: false });
  const H = useRef({ start: 0, ema: 0, lockUntil: 0, frame: 0, miss: 0, dynConf: 0 });
  const chRef = useRef(ch);
  const cb = useRef(onSuccess);
  const activeRef = useRef(active);
  chRef.current = ch;
  cb.current = onSuccess;
  activeRef.current = active;

  useEffect(() => {
    signEngine.load();
  }, []);
  useEffect(() => {
    H.current = { start: 0, ema: 0, lockUntil: 0, frame: 0, miss: 0, dynConf: 0 };
    signEngine.reset();
    setLive({ acc: 0, hold: 0, success: false, present: false });
  }, [ch, runKey]);

  const onFrame = useCallback((lm, W, Ht, ts) => {
    const h = H.current;
    const c = chRef.current;
    if (!c || !activeRef.current) return {};
    const f = signEngine.process(lm, W, Ht, { mode: modeForChar(c) });
    if (ts < h.lockUntil) return { jointColors: new Array(21).fill(GREEN) };
    let acc = 0;
    let per = null;
    let success = false;
    if (f.present) {
      const sc = signEngine.scoreTarget(f, c);
      per = sc.per;
      if (isDynamic(c)) {
        const d = f.dynamic;
        if (d?.candidate === c) h.dynConf = d.conf || h.dynConf * 0.9;
        else h.dynConf *= 0.9;
        acc = Math.min(1, 0.5 * sc.geometric + 0.5 * h.dynConf);
        if (d?.detected && d.cls === c) {
          success = true;
          acc = 1;
        }
      } else acc = sc.accuracy;
    }
    h.ema = h.ema * 0.6 + acc * 0.4;
    let holdProg = 0;
    if (!isDynamic(c)) {
      if (f.present && h.ema >= req) {
        if (!h.start) h.start = ts;
        holdProg = Math.min(1, (ts - h.start) / holdMs);
        if (holdProg >= 1) success = true;
        h.miss = 0;
      } else if (++h.miss > 4) {
        h.start = 0;
        h.miss = 0;
      }
    } else holdProg = h.ema;

    if (success) {
      h.lockUntil = ts + 1000;
      const accNow = Math.max(h.ema, req);
      setLive({ acc: 1, hold: 1, success: true, present: true });
      const key = runKey;
      setTimeout(() => { if (chRef.current === c) cb.current?.(c, accNow, key); }, 700);
      return { jointColors: new Array(21).fill(GREEN) };
    }
    if (++h.frame % 3 === 0) setLive({ acc: h.ema, hold: holdProg, success: false, present: f.present });
    if (!f.present || !per) return {};
    const cols = new Array(21).fill('#FFFFFF');
    for (const name of ['thumb', 'index', 'middle', 'ring', 'pinky']) {
      const idx = name === 'thumb' ? LM.THUMB : LM[name];
      idx.forEach((i) => (cols[i] = colorOf(per[name])));
    }
    return { jointColors: cols, lineColor: '#FFFFFF' };
  }, [holdMs, req, runKey]);

  const border = live.success ? 'ok' : !live.present ? 'idle' : live.acc >= req ? 'ok' : live.acc >= 0.5 ? 'warn' : 'bad';
  return { onFrame, live, border, req };
}
