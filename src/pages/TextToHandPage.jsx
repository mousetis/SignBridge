import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, Play, Pause, RotateCcw, SkipBack, SkipForward, Keyboard, Trash2, Orbit, LocateFixed, Film, ImageIcon, BookmarkPlus, Pencil, X, Loader2 } from 'lucide-react';
import Hand3DViewer from '../components/hand/Hand3DViewer.jsx';
import SubtitleBar from '../components/hand/SubtitleBar.jsx';
import HandSnap from '../components/hand/HandSnap.jsx';
import WordCanvas, { drawWordFrame } from '../components/hand/WordCanvas.jsx';
import OnScreenKeyboard from '../components/ui/OnScreenKeyboard.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import Slider from '../components/ui/Slider.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/kit.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSpeechRecognition } from '../hooks/useSpeech.js';
import { normalizeForSign } from '../lib/text.js';
import { buildSegments } from '../lib/words/segments.js';
import { loadWords } from '../lib/words/store.js';
import { suggest, applySuggestion } from '../lib/ml/assembly.js';
import { loadPhrases, savePhrases, loadFreq } from '../lib/smart.js';
import { recordCanvas, canRecordVideo } from '../lib/export/media.js';
import { downloadBlob } from '../lib/backup.js';
import { systemConfig } from '../config/systemConfig.js';
import { useT } from '../i18n/index.jsx';

const SPEEDS = systemConfig.text_voice_to_3d_hand.hand_3d_renderer.playback_speeds;
const WORD_SECONDS = 1.8;

export default function TextToHandPage() {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const { notify } = useToast();
  const viewer = useRef(null);
  const autoPlay = useRef(false);
  const [input, setInput] = useState('');
  const [words, setWords] = useState({});
  const [index, setIndex] = useState(0);
  const [range, setRange] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [showKb, setShowKb] = useState(false);
  const [spin, setSpin] = useState(false);
  const [segNo, setSegNo] = useState(0);
  const [word, setWord] = useState(null); // { seq, display }
  const [wprog, setWprog] = useState(0);
  const [phrases, setPhrases] = useState(loadPhrases);
  const [editPh, setEditPh] = useState(false);
  const [exp, setExp] = useState(null); // { format, p }
  const speed = settings.playbackSpeed;
  const { norm, segs } = useMemo(() => buildSegments(input, words), [input, words]);
  const chars = useMemo(() => norm.split(''), [norm]);

  useEffect(() => { loadWords().then(setWords); }, []);

  // ---- bộ điều khiển phát theo đoạn
  const P = useRef({ segs: [], k: 0, playing: false, wordT: 0, speed: 1 });
  P.current.segs = segs;
  P.current.speed = speed;
  const anim = () => viewer.current?.animator;

  const startSeg = useCallback((k) => {
    const ctl = P.current;
    const a = anim();
    if (!a) return;
    if (k >= ctl.segs.length) {
      ctl.playing = false;
      setPlaying(false);
      setWord(null);
      return;
    }
    ctl.k = k;
    setSegNo(k);
    const sg = ctl.segs[k];
    if (sg.kind === 'letters') {
      setWord(null);
      a.pause();
      a.load(sg.chars);
      a.setSpeed(ctl.speed);
      a.onIndex = (i) => { setIndex(sg.start + Math.min(i, sg.end - sg.start)); setRange(null); };
      a.onEnd = () => { if (ctl.playing && ctl.k === k) startSeg(k + 1); };
      setIndex(sg.start);
      setRange(null);
      if (ctl.playing) a.play();
    } else {
      a.pause();
      setWord({ seq: sg.seq, display: sg.display });
      setWprog(0);
      ctl.wordT = 0;
      setIndex(sg.start);
      setRange([sg.start, sg.end]);
    }
  }, []);

  // Nạp lại khi nội dung đổi
  useEffect(() => {
    const ctl = P.current;
    anim()?.pause();
    ctl.playing = false;
    setPlaying(false);
    startSeg(0);
    setIndex(segs[0]?.start ?? 0);
    if (autoPlay.current && segs.length) {
      autoPlay.current = false;
      ctl.playing = true;
      setPlaying(true);
      startSeg(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segs]);
  useEffect(() => { anim()?.setSpeed(speed); }, [speed]);

  const onFrame = useCallback((animator, rig, dt) => {
    animator.update(dt);
    const ctl = P.current;
    const sg = ctl.segs[ctl.k];
    if (ctl.playing && sg?.kind === 'word') {
      ctl.wordT += (dt * ctl.speed) / WORD_SECONDS;
      setWprog(Math.min(1, ctl.wordT));
      if (ctl.wordT >= 1.12) startSeg(ctl.k + 1);
    }
  }, [startSeg]);

  const stt = useSpeechRecognition({
    lang: settings.speech.lang,
    onFinal: (_n, raw) => {
      if (!raw) return;
      autoPlay.current = true;
      setInput((prev) => (prev && !prev.endsWith(' ') ? `${prev} ${raw}` : `${prev}${raw}`));
    },
    onError: (e) => notify(e === 'mic-denied' ? t('conv.micDenied') : t('common.error'), 'bad'),
  });

  const toggle = () => {
    const ctl = P.current;
    if (!segs.length) return;
    if (ctl.playing) {
      ctl.playing = false;
      anim()?.pause();
      setPlaying(false);
    } else {
      if (ctl.k >= segs.length) ctl.k = 0;
      ctl.playing = true;
      setPlaying(true);
      if (segs[ctl.k].kind === 'letters') anim()?.play();
    }
  };
  const restart = () => {
    const ctl = P.current;
    ctl.playing = true;
    setPlaying(true);
    startSeg(0);
    anim()?.restart();
  };
  const step = (d) => {
    const ctl = P.current;
    const sg = segs[ctl.k];
    if (!sg) return;
    ctl.playing = false;
    setPlaying(false);
    anim()?.pause();
    if (sg.kind === 'letters') {
      const local = index - sg.start + d;
      if (local < 0 && ctl.k > 0) return startSeg(ctl.k - 1);
      if (local >= sg.chars.length && ctl.k < segs.length - 1) return startSeg(ctl.k + 1);
      anim()?.seek(Math.max(0, Math.min(sg.chars.length - 1, local)));
    } else startSeg(Math.max(0, Math.min(segs.length - 1, ctl.k + d)));
  };

  // ---- xuất video / GIF
  const doExport = async (format) => {
    const ac = new AbortController();
    setExp({ format, p: 0, ac });
    const grad = (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.25, 10, w / 2, h * 0.25, h);
      g.addColorStop(0, '#34397a');
      g.addColorStop(1, '#12162B');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };
    try {
      const blob = await recordCanvas({
        format, width: 640, height: 480, fps: 24, signal: ac.signal,
        onProgress: (p) => setExp((e) => e && { ...e, p }),
        start: () => { restart(); },
        isDone: () => !P.current.playing,
        draw: (ctx, w, h) => {
          const sg = P.current.segs[P.current.k];
          grad(ctx, w, h);
          if (sg?.kind === 'word') drawWordFrame(ctx, sg.seq, Math.min(1, P.current.wordT), w, h, { bg: false });
          else {
            const cv = viewer.current?.renderNow();
            if (cv) {
              const s = Math.max(w / cv.width, h / cv.height);
              ctx.drawImage(cv, (w - cv.width * s) / 2, (h - cv.height * s) / 2, cv.width * s, cv.height * s);
            }
          }
          const label = sg?.kind === 'word' ? sg.display : (norm[index] || '').trim();
          if (label) {
            ctx.font = '700 64px Lexend, system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 8;
            ctx.strokeStyle = '#12162B';
            ctx.strokeText(label, w / 2, h - 32);
            ctx.fillStyle = '#FFC93C';
            ctx.fillText(label, w / 2, h - 32);
          }
        },
      });
      downloadBlob(blob, `signbridge.${format === 'gif' ? 'gif' : 'webm'}`);
      notify(t('text.exported'), 'ok');
    } catch (e) {
      if (e?.name !== 'AbortError') notify(t('text.exportFail', { e: e?.message || e }), 'bad');
    } finally {
      setExp(null);
    }
  };

  const append = (s) => setInput((v) => v + s);
  const sugg = useMemo(() => (showKb ? suggest(input, loadFreq(), 4).map((s) => ({ label: s.display, onPick: () => setInput(applySuggestion(input, s)) })) : []), [input, showKb]);
  const total = chars.length;
  const sg = segs[segNo];
  const wordsUsed = segs.filter((s) => s.kind === 'word').length;
  const cur = chars[index];
  const hasPhrase = input.trim() && !phrases.includes(input.trim());

  return (
    <>
      <PageHeader kicker={t('text.kicker')} title={t('text.title')}>{t('text.lead')}</PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-label={t('text.ask')} className="flex flex-col gap-5">
          <div className={`surface p-5 transition ${stt.listening ? '!border-bad shadow-[0_0_0_6px_rgb(var(--bad)/0.2)]' : ''}`}>
            <label htmlFor="text-input" className="mb-2 block text-[1.05rem] font-bold">{t('text.ask')} <span className="font-medium text-muted">{t('text.askHint')}</span></label>
            <textarea
              id="text-input" value={input} onChange={(e) => setInput(e.target.value)} rows={3} spellCheck={false} placeholder={t('text.placeholder')}
              className="min-h-[120px] w-full resize-y rounded-2xl border-2 border-line bg-paper p-4 font-display text-[1.7rem] font-semibold leading-snug text-ink placeholder:font-sans placeholder:text-[1.1rem] placeholder:font-medium placeholder:text-muted"
            />
            <p className="mt-2 text-[0.92rem] text-muted">
              {t('text.willSign')} <strong className="font-mono text-ink">{norm.trim() || '—'}</strong> <span>{t('text.noDiacritics')}</span>
            </p>
            {wordsUsed > 0 && <p className="mt-1"><Badge tone="ok">{t('text.recordedUsed', { n: wordsUsed })}</Badge></p>}
            {stt.listening && (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-bad bg-bad-soft px-4 py-3 font-bold" role="status">
                <span className="h-4 w-4 animate-pulse rounded-full bg-bad" aria-hidden /> {t('text.listening')} <span className="font-medium">{stt.interimRaw}</span>
              </div>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <BigButton icon={stt.listening ? MicOff : Mic} variant={stt.listening ? 'bad' : 'primary'} disabled={!stt.supported} onClick={stt.toggle}>{stt.listening ? t('text.stopSay') : t('text.say')}</BigButton>
              <BigButton icon={Keyboard} active={showKb} onClick={() => setShowKb((v) => !v)}>{t('text.kb')}</BigButton>
              <BigButton icon={Trash2} variant="bad" disabled={!input} onClick={() => setInput('')}>{t('common.clear')}</BigButton>
            </div>
            {!stt.supported && <p className="mt-3 font-bold text-warn">{t('text.noStt')}</p>}
            <div className="mt-5 border-t border-rule pt-4">
              <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                <p className="kicker">{t('text.phrases')}</p>
                <div className="flex gap-2">
                  {hasPhrase && <BigButton size="sm" icon={BookmarkPlus} onClick={() => { const n = [...phrases, input.trim()]; setPhrases(n); savePhrases(n); notify(t('text.phraseSaved'), 'ok'); }}>{t('text.savePhrase')}</BigButton>}
                  <BigButton size="sm" icon={Pencil} active={editPh} onClick={() => setEditPh((v) => !v)}>{t('text.editPhrases')}</BigButton>
                </div>
              </div>
              <div className="flex flex-wrap gap-2" aria-label={t('text.phrases')}>
                {phrases.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1">
                    <BigButton size="sm" variant="ghost" className="border-line" onClick={() => { autoPlay.current = true; setInput(p); }}>{p}</BigButton>
                    {editPh && <BigButton size="sm" iconOnly icon={X} variant="bad" aria-label={t('common.delete')} onClick={() => { const n = phrases.filter((x) => x !== p); setPhrases(n); savePhrases(n); }} />}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[0.85rem] text-muted">{t('text.phraseHint')}</p>
            </div>
          </div>

          {showKb && <OnScreenKeyboard onKey={append} onSpace={() => append(' ')} onBackspace={() => setInput((v) => v.slice(0, -1))} onClear={() => setInput('')} suggestions={sugg} phrases={phrases.slice(0, 6)} onPhrase={(p) => { autoPlay.current = true; setInput(p); }} />}

          <Card>
            <Slider label={t('text.speed')} value={speed} min={SPEEDS[0]} max={SPEEDS[SPEEDS.length - 1]} step={0.25} onChange={(v) => patch(null, { playbackSpeed: v })} format={(v) => `${v.toFixed(2).replace(/\.?0+$/, '')}×`} />
            <div className="mt-4 flex flex-wrap gap-2">
              {SPEEDS.map((s) => <BigButton key={s} size="sm" active={s === speed} onClick={() => patch(null, { playbackSpeed: s })}>{s}×</BigButton>)}
            </div>
          </Card>
        </section>

        <section aria-label={t('hand.label')} className="flex flex-col gap-4">
          <div className="relative">
            <Hand3DViewer ref={viewer} onFrame={onFrame} autoRotate={spin} className="h-[440px] w-full" />
            {word && (
              <div className="absolute inset-0 flex flex-col overflow-hidden rounded-3xl bg-stage">
                <WordCanvas seq={word.seq} progress={wprog} className="h-full w-full object-contain" label={t('text.word2d', { w: word.display })} />
                <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-[0.85rem] font-bold text-primary-on">{t('text.yourSign')}: {word.display}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BigButton icon={playing ? Pause : Play} variant="primary" disabled={!total} onClick={toggle}>{playing ? t('common.pause') : t('common.play')}</BigButton>
            <BigButton icon={RotateCcw} disabled={!total} onClick={restart}>{t('common.replay')}</BigButton>
            <BigButton iconOnly icon={SkipBack} aria-label={t('text.prev')} disabled={!total} onClick={() => step(-1)} />
            <BigButton iconOnly icon={SkipForward} aria-label={t('text.next')} disabled={!total} onClick={() => step(1)} />
            <BigButton icon={Orbit} active={spin} onClick={() => { setSpin((v) => !v); viewer.current?.setAutoRotate(!spin); }}>{t('text.autoRotate')}</BigButton>
            <BigButton icon={LocateFixed} onClick={() => viewer.current?.resetView()}>{t('text.resetView')}</BigButton>
          </div>
          <ProgressBar value={total ? Math.min(1, (index + 1) / total) : 0} label={total ? (wordsUsed ? t('text.segProgress', { i: Math.min(segNo + 1, segs.length), n: segs.length }) : t('text.progress', { i: Math.min(index + 1, total), n: total })) : t('text.none')} />

          <div className="grid items-start gap-4 sm:grid-cols-[1fr_auto]">
            <SubtitleBar chars={chars} index={index} range={sg?.kind === 'word' ? range : null} playing={playing} fontSize={systemConfig.text_voice_to_3d_hand.synchronized_subtitle_bar.font_size_px} />
            {sg?.kind !== 'word' && cur && cur !== ' ' && <div aria-hidden><HandSnap ch={cur} size={130} /></div>}
          </div>

          <Card title={t('text.export')} className="!p-4">
            <div className="flex flex-wrap items-center gap-3">
              {exp ? (
                <>
                  <span className="inline-flex items-center gap-2 font-semibold"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {t('text.exporting')}</span>
                  <BigButton size="sm" icon={X} onClick={() => exp.ac.abort()}>{t('common.cancel')}</BigButton>
                </>
              ) : (
                <>
                  <BigButton size="sm" icon={Film} disabled={!total || !canRecordVideo()} onClick={() => doExport('webm')}>{t('text.exportVideo')}</BigButton>
                  <BigButton size="sm" icon={ImageIcon} disabled={!total} onClick={() => doExport('gif')}>{t('text.exportGif')}</BigButton>
                </>
              )}
            </div>
            <p className="mt-2 text-[0.85rem] text-muted">{canRecordVideo() ? t('text.exportHint') : t('text.noVideo')}</p>
          </Card>
        </section>
      </div>
    </>
  );
}
