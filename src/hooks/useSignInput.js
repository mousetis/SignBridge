import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signEngine } from '../lib/ml/signEngine.js';
import { CharCommitter, WordBuilder } from '../lib/ml/assembly.js';
import { systemConfig } from '../config/systemConfig.js';
import { frameFeature, resample, WordSegmenter, trimStill, DIM } from '../lib/words/dtw.js';
import { buildMatcher, addSample } from '../lib/words/store.js';

const THR = systemConfig.ai_sign_to_text_engine.recognition_models.static_pose_classifier.confidence_threshold;
export const CONF_THR = THR;
const MARGIN = systemConfig.ai_sign_to_text_engine.recognition_models.static_pose_classifier.min_margin;
export const MARGIN_THR = MARGIN;

/**
 * Toàn bộ logic "camera → chữ/từ": gom khung hình từ CameraView, nhận dạng ký tự (MLP+kNN+LSTM) hoặc từ/cụm từ (DTW),
 * ghép thành văn bản (tự cách chữ khi ngừng tay), đồng thời hỗ trợ GHI MẪU TỪ mới.
 */
export function useSignInput({ enabled = true, mode = 'auto', unit = 'letters' } = {}) {
  const [engine, setEngine] = useState({ ...signEngine.status, userSamples: 0 });
  const [text, setTextState] = useState('');
  const [live, setLive] = useState({ present: false, top: null, conf: 0, progress: 0, dyn: null });
  const [pause, setPause] = useState(0);
  const [flash, setFlash] = useState(null);
  const [wordLive, setWordLive] = useState({ state: 'idle', n: 0, last: null, ambiguous: null });
  const [wordCount, setWordCount] = useState(0);
  const [rec, setRec] = useState(null); // { display, phase:'count'|'rec'|'done', left }
  const committer = useRef(new CharCommitter());
  const builder = useRef(new WordBuilder());
  const segmenter = useRef(new WordSegmenter());
  const matcher = useRef(null);
  const modeRef = useRef(mode);
  const unitRef = useRef(unit);
  const recRef = useRef(null);
  const frameNo = useRef(0);
  const listeners = useRef(new Set());
  modeRef.current = mode;
  unitRef.current = unit;

  useEffect(() => {
    signEngine.load().then((s) => setEngine({ ...s, userSamples: signEngine.userSamples || 0 }));
  }, []);

  const reloadWords = useCallback(async () => {
    matcher.current = await buildMatcher();
    setWordCount(matcher.current.size);
  }, []);
  useEffect(() => { reloadWords(); }, [reloadWords]);

  const doFlash = useCallback((ch) => {
    setFlash(ch);
    setTimeout(() => setFlash(null), 650);
  }, []);
  const sync = useCallback(() => setTextState(builder.current.text), []);
  const emit = useCallback((kind, value) => listeners.current.forEach((fn) => fn(kind, value)), []);
  /** Đăng ký nhận sự kiện 'char' | 'word' khi có ký tự/từ mới được chốt. */
  const onCommit = useCallback((fn) => { listeners.current.add(fn); return () => listeners.current.delete(fn); }, []);

  const commit = useCallback((ch) => {
    builder.current.add(ch, performance.now());
    sync();
    doFlash(ch);
    emit('char', ch);
  }, [doFlash, sync, emit]);

  const commitWord = useCallback((m) => {
    const t = builder.current.text;
    builder.current.set(`${t && !t.endsWith(' ') ? `${t} ` : t}${m.key} `, performance.now());
    sync();
    doFlash(m.display);
    emit('word', m);
  }, [doFlash, sync, emit]);

  const onFrame = useCallback((lm, W, H, ts, extra) => {
    const hands = extra?.hands?.length ? extra.hands : lm ? [lm] : [];
    // ---- đang ghi mẫu từ
    const r = recRef.current;
    if (r && r.phase === 'rec') {
      r.frames.push(frameFeature(hands, W, H));
      return { lineColor: '#FF6B6B' };
    }
    // ---- nhận dạng TỪ / CỤM TỪ
    if (unitRef.current === 'words') {
      const feat = frameFeature(hands, W, H);
      const s = segmenter.current.push(feat, hands.length > 0);
      let last = null;
      if (s.done && matcher.current?.size) {
        const m = matcher.current.match(resample(s.done));
        if (m) {
          commitWord(m);
          last = { ...m, at: Date.now() };
        } else last = { key: null, display: null, at: Date.now() };
      }
      if (++frameNo.current % 3 === 0 || last) setWordLive((w) => ({ state: s.state, n: s.n, last: last || w.last, ambiguous: last?.ambiguous ? last.alt : last ? null : w.ambiguous }));
      return { lineColor: s.state === 'collecting' ? '#FFC93C' : '#7DD3E0' };
    }
    // ---- nhận dạng KÝ TỰ
    const f = signEngine.process(lm, W, H, { mode: modeRef.current });
    const c = committer.current.update(f.present ? { present: true, top: f.top, conf: f.conf, margin: f.margin, moving: f.moving, now: performance.now() } : { present: false });
    if (c.committed) commit(c.committed);
    if (f.present && f.dynamic?.detected) {
      committer.current.lockUntilRelease('*');
      commit(f.dynamic.cls);
    }
    if (++frameNo.current % 3 === 0 || c.committed) {
      setLive({ present: f.present, top: c.candidate || f.top, conf: f.conf || 0, margin: f.margin || 0, avg: c.avgConf, progress: c.progress, dyn: f.present ? f.dynamic : null });
    }
    if (!f.present) return {};
    return { lineColor: f.conf >= THR && (f.margin ?? 1) >= MARGIN ? '#34D399' : '#7DD3E0' };
  }, [commit, commitWord]);

  // Tự chèn dấu cách khi ngừng tay + đồng hồ đếm ngược trực quan
  useEffect(() => {
    if (!enabled || unit === 'words') return undefined;
    const t = setInterval(() => {
      const now = performance.now();
      if (builder.current.tick(now)) {
        sync();
        doFlash('␣');
        emit('space', ' ');
      }
      setPause(builder.current.pauseProgress(now));
    }, 100);
    return () => clearInterval(t);
  }, [enabled, unit, doFlash, sync, emit]);

  useEffect(() => { if (unit === 'words') segmenter.current.reset(); else committer.current.reset(); }, [unit]);

  // ---- ghi mẫu từ: đếm ngược 3 giây rồi ghi 3 giây
  const record = useCallback((display) => new Promise((resolve) => {
    let left = 3;
    recRef.current = { phase: 'count', frames: [] };
    setRec({ display, phase: 'count', left });
    const tick = setInterval(async () => {
      left--;
      if (left > 0) return setRec({ display, phase: 'count', left });
      clearInterval(tick);
      recRef.current = { phase: 'rec', frames: [] };
      setRec({ display, phase: 'rec', left: 3 });
      let l = 3;
      const t2 = setInterval(async () => {
        l--;
        if (l > 0) return setRec({ display, phase: 'rec', left: l });
        clearInterval(t2);
        const frames = recRef.current.frames.filter((f) => f.some((v, i) => v !== 0 && i % 45 === 44)); // chỉ khung có tay
        recRef.current = null;
        if (frames.length < 8) {
          setRec(null);
          return resolve({ ok: false, reason: 'nohand' });
        }
        const seq = resample(trimStill(frames));
        const out = await addSample(display, seq);
        await reloadWords();
        setRec({ display, phase: 'done', left: 0 });
        setTimeout(() => setRec(null), 900);
        resolve({ ok: true, ...out });
      }, 1000);
    }, 1000);
  }), [reloadWords]);
  const cancelRecord = useCallback(() => { recRef.current = null; setRec(null); }, []);

  const api = useMemo(() => ({
    space: () => { builder.current.add(' ', performance.now()); sync(); },
    backspace: () => { builder.current.backspace(performance.now()); sync(); },
    clear: () => { builder.current.clear(); sync(); },
    set: (t) => { builder.current.set(t, performance.now()); sync(); },
    add: (c) => commit(c),
  }), [sync, commit]);

  return { engine, text, live, pause, flash, wordLive, wordCount, rec, record, cancelRecord, reloadWords, onFrame, onCommit, ...api, DIM };
}
