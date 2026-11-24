import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Maximize2, Minimize2, Eraser, Save } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import Slider from '../components/ui/Slider.jsx';
import { Segmented } from '../components/ui/kit.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSpeechRecognition } from '../hooks/useSpeech.js';
import { newSession, saveSession } from '../lib/history.js';
import { useT } from '../i18n/index.jsx';

/** Phụ đề trực tiếp: micro nghe người đối diện → chữ rất lớn, nền tương phản cao, có chế độ toàn màn hình. */
export default function CaptionsPage() {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const { notify } = useToast();
  const [lines, setLines] = useState([]);
  const [size, setSize] = useState(3.2);
  const [keep, setKeep] = useState(4);
  const [full, setFull] = useState(false);
  const [lang, setLang] = useState(settings.speech.lang);
  const stage = useRef(null);
  const all = useRef([]);
  const sr = useSpeechRecognition({
    lang,
    onFinal: (_n, raw) => {
      if (!raw) return;
      all.current.push({ at: Date.now(), text: raw });
      setLines((l) => [...l, raw]);
    },
    onError: (e) => notify(e === 'mic-denied' ? t('conv.micDenied') : t('common.error'), 'bad'),
  });
  const shown = lines.slice(-keep);

  useEffect(() => {
    const h = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : stage.current?.requestFullscreen?.());

  const save = async () => {
    if (!all.current.length) return;
    const s = newSession('captions');
    s.messages = all.current.map((m, i) => ({ id: `c${i}`, who: 'other', text: m.text, at: m.at, src: 'speech' }));
    await saveSession(s);
    notify(t('cap.saved'), 'ok');
  };

  return (
    <>
      <PageHeader kicker={t('cap.kicker')} title={t('cap.title')}>{t('cap.lead')}</PageHeader>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <BigButton icon={sr.listening ? MicOff : Mic} variant={sr.listening ? 'bad' : 'primary'} disabled={!sr.supported} onClick={sr.toggle} aria-pressed={sr.listening}>{sr.listening ? t('cap.stop') : t('cap.start')}</BigButton>
        <BigButton icon={full ? Minimize2 : Maximize2} onClick={toggleFull}>{full ? t('common.exitFullscreen') : t('common.fullscreen')}</BigButton>
        <BigButton icon={Eraser} variant="warn" onClick={() => setLines([])}>{t('cap.clear')}</BigButton>
        <BigButton icon={Save} disabled={!all.current.length} onClick={save}>{t('cap.save')}</BigButton>
        <Segmented label={t('cap.lang')} value={lang} onChange={(v) => { setLang(v); patch('speech', { lang: v }); }} options={[{ id: 'vi-VN', label: 'Tiếng Việt' }, { id: 'en-US', label: 'English' }]} />
      </div>
      {!sr.supported && <p className="mb-4 font-semibold text-warn">{t('conv.noMic')}</p>}

      <div ref={stage} className={`flex flex-col justify-end overflow-hidden rounded-3xl bg-stage p-6 text-onstage sm:p-10 ${full ? 'h-screen rounded-none' : 'min-h-[52vh]'}`} role="log" aria-live="polite" aria-label={t('cap.title')}>
        {shown.length === 0 && !sr.interimRaw && <p className="m-auto text-center text-[1.4rem] text-onstage/60">{sr.listening ? t('cap.listening') : t('cap.idle')}</p>}
        <div className="flex flex-col gap-4">
          {shown.map((l, i) => (
            <p key={lines.length - shown.length + i} className="animate-rise break-words font-display font-semibold leading-tight" style={{ fontSize: `${size}rem`, opacity: 0.45 + (0.55 * (i + 1)) / shown.length }}>{l}</p>
          ))}
          {sr.interimRaw && <p className="break-words font-display font-semibold leading-tight text-[#FFC93C]" style={{ fontSize: `${size}rem` }}>{sr.interimRaw}</p>}
        </div>
        {full && <button type="button" onClick={toggleFull} className="absolute right-4 top-4 rounded-full bg-white/15 p-3 text-onstage" aria-label={t('common.exitFullscreen')}><Minimize2 className="h-6 w-6" aria-hidden /></button>}
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Slider label={t('cap.size')} value={size} min={1.6} max={6} step={0.2} format={(v) => `${v.toFixed(1)}×`} onChange={setSize} />
        <Slider label={t('cap.lines')} value={keep} min={1} max={10} step={1} onChange={setKeep} format={(v) => String(v)} />
      </div>
    </>
  );
}
