import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Play } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import { Segmented, EmptyState, Badge, FIELD } from '../components/ui/kit.jsx';
import Hand3DViewer from '../components/hand/Hand3DViewer.jsx';
import HandSnap from '../components/hand/HandSnap.jsx';
import WordCanvas from '../components/hand/WordCanvas.jsx';
import { HINTS } from '../data/poses.js';
import { LETTERS, DIGITS } from '../config/systemConfig.js';
import { loadWords } from '../lib/words/store.js';
import { load as loadProgress } from '../lib/learn/progress.js';
import { useT } from '../i18n/index.jsx';

export default function DictionaryPage({ go }) {
  const { t } = useT();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [words, setWords] = useState({});
  const [open, setOpen] = useState(null); // { type:'char'|'word', id }
  const mastered = useMemo(() => loadProgress().mastered, []);
  useEffect(() => { loadWords().then(setWords); }, []);

  const entries = useMemo(() => {
    const out = [];
    for (const c of LETTERS) out.push({ type: 'char', id: c, kind: 'letters' });
    for (const c of DIGITS) out.push({ type: 'char', id: c, kind: 'digits' });
    for (const [k, w] of Object.entries(words)) out.push({ type: 'word', id: k, label: w.display, kind: 'words', w });
    const s = q.trim().toUpperCase();
    return out.filter((e) => (kind === 'all' || e.kind === kind) && (!s || e.id.includes(s) || (HINTS[e.id] || '').toUpperCase().includes(s) || (e.label || '').toUpperCase().includes(s)));
  }, [q, kind, words]);

  return (
    <>
      <PageHeader kicker={t('nav.dict')} title={t('dict.title')}>{t('dict.lead')}</PageHeader>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('dict.search')} aria-label={t('dict.search')} className={`${FIELD} pl-12`} />
        </label>
        <Segmented label={t('dict.filter')} value={kind} onChange={setKind} options={[{ id: 'all', label: t('common.all') }, { id: 'letters', label: t('common.letters') }, { id: 'digits', label: t('common.digits') }, { id: 'words', label: t('common.words') }]} />
      </div>
      {entries.length === 0 ? (
        <EmptyState title={t('dict.none')}>{kind === 'words' ? <>{t('dict.noWords')} <a className="font-bold text-accent underline" href="#/recognize">{t('nav.recognize')}</a></> : t('dict.noneHint')}</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {entries.map((e) => (
            <li key={`${e.type}-${e.id}`}>
              <button type="button" onClick={() => setOpen(e)} className="surface group flex w-full flex-col items-center gap-2 p-3 text-center transition hover:-translate-y-0.5 hover:shadow-lift">
                {e.type === 'char' ? (
                  <span className="relative block">
                    <HandSnap ch={e.id} size={132} />
                    {(e.id === 'J' || e.id === 'Z') && <span className="absolute bottom-1.5 left-1.5 right-1.5 rounded-full bg-black/55 px-2 py-0.5 text-center whitespace-nowrap text-[0.72rem] font-bold text-white backdrop-blur">↻ {t('dict.dynamic')}</span>}
                  </span>
                ) : <WordCanvas seq={e.w.samples[0]} progress={0.5} className="h-[112px] w-[150px] rounded-xl" label={e.label} />}
                <span className="font-display text-[1.5rem] font-semibold leading-none">{e.type === 'char' ? e.id : e.label}</span>
                {e.type === 'char' && mastered.includes(e.id) && <Badge tone="ok">{t('common.mastered')}</Badge>}
                {e.type === 'word' && <Badge tone="primary">{t('dict.mine')}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Detail entry={open} onClose={() => setOpen(null)} go={go} />
    </>
  );
}

function Detail({ entry, onClose, go }) {
  const { t } = useT();
  const viewer = useRef(null);
  const [prog, setProg] = useState(0);
  useEffect(() => {
    if (!entry) return undefined;
    if (entry.type === 'word') {
      let raf; const t0 = performance.now();
      const loop = (now) => { setProg(((now - t0) / 1800) % 1.4 > 1 ? 1 : ((now - t0) / 1800) % 1.4); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }
    const tm = setTimeout(() => {
      const a = viewer.current?.animator;
      if (!a) return;
      a.onIndex = null; a.onEnd = null;
      a.load([entry.id]);
      a.mode = entry.id === 'J' || entry.id === 'Z' ? 'loop-dynamic' : 'once';
      a.play();
    }, 120);
    return () => clearTimeout(tm);
  }, [entry]);
  if (!entry) return null;
  return (
    <Dialog open onClose={onClose} title={entry.type === 'char' ? entry.id : entry.label} wide>
      {entry.type === 'char' ? (
        <div className="grid gap-4 md:grid-cols-[1fr_auto]">
          <Hand3DViewer ref={viewer} className="h-[340px]" onFrame={(a, r, dt) => a.update(dt)} />
          <div className="flex flex-row justify-center gap-3 md:flex-col md:items-center">
            <figure className="m-0 flex flex-col items-center gap-1"><HandSnap ch={entry.id} size={150} /><figcaption className="text-[0.85rem] font-semibold text-muted">{t('dict.front')}</figcaption></figure>
            <figure className="m-0 flex flex-col items-center gap-1"><HandSnap ch={entry.id} size={150} yaw={62} pitch={8} /><figcaption className="text-[0.85rem] font-semibold text-muted">{t('dict.side')}</figcaption></figure>
          </div>
          <p className="md:col-span-2 text-[1.05rem] leading-relaxed">{HINTS[entry.id]}</p>
          <div className="md:col-span-2 flex flex-wrap gap-3">
            <BigButton icon={Play} onClick={() => { const a = viewer.current?.animator; a?.restart(); a?.play(); }}>{t('learn.again')}</BigButton>
            <BigButton variant="primary" onClick={() => { onClose(); go('learn'); }}>{t('dict.practice')}</BigButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          <WordCanvas seq={entry.w.samples[0]} progress={prog} className="w-full rounded-2xl" label={entry.label} />
          <p className="text-muted">{t('dict.wordNote', { n: entry.w.samples.length })}</p>
        </div>
      )}
    </Dialog>
  );
}
