import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, SkipForward, RotateCcw, Orbit, Trophy, CheckCircle2, Video, VideoOff, ChevronRight, Play, Flame, Zap, Star, Sparkles, Hash, GraduationCap, Timer, Repeat, ClipboardCheck, Gamepad2, Target, XCircle,
} from 'lucide-react';
import Hand3DViewer from '../components/hand/Hand3DViewer.jsx';
import HandSnap from '../components/hand/HandSnap.jsx';
import CameraView from '../components/camera/CameraView.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import { Segmented, Badge, Stat, Confetti, EmptyState } from '../components/ui/kit.jsx';
import { LEVELS, expandLevel, isDynamic } from '../data/lessons.js';
import { HINTS } from '../data/poses.js';
import { usePractice, REQ, HOLD_MS } from '../hooks/usePractice.js';
import { expectedCurl } from '../lib/hand/poseLibrary.js';
import * as L from '../lib/learn/progress.js';
import { loadAssignments, assignmentProgress } from '../lib/learn/assignments.js';
import { useToast } from '../context/ToastContext.jsx';
import { useT } from '../i18n/index.jsx';

const ICONS = { Sparkles, Star, Trophy, Hash, Flame, Zap, GraduationCap, Timer };
const RIG_GREEN = '#2E8B57';
const RIG_RED = '#C2412A';

/** Trạng thái tiến độ + hàm thưởng: cập nhật, lưu, báo huy hiệu / lên cấp. */
function useProgress() {
  const { t } = useT();
  const { notify } = useToast();
  const [p, setP] = useState(L.load);
  const [party, setParty] = useState(false);
  const ref = useRef(p);
  ref.current = p;
  const commit = useCallback((next) => { ref.current = next; setP(next); L.save(next); }, []);
  const award = useCallback((xp, note, mut) => {
    let base = ref.current;
    if (mut) base = mut(base);
    const r = L.award(base, xp, Date.now(), note);
    commit(r.p);
    r.newBadges.forEach((b) => notify(`🏅 ${t(`badge.${b}`)}`, 'ok', 5000));
    if (r.levelUp) notify(t('learn.levelUp', { n: L.levelOf(r.p.xp) }), 'ok', 5000);
    if (r.newBadges.length || r.levelUp) setParty(true);
    return r.p;
  }, [commit, notify, t]);
  const mutate = useCallback((fn) => commit(fn(ref.current)), [commit]);
  return { p, award, mutate, party, setParty };
}

export default function LearnPage() {
  const { t } = useT();
  const { p, award, mutate, party, setParty } = useProgress();
  const [run, setRun] = useState(null); // { kind:'learn'|'review'|'quiz'|'reflex', level?, items? }
  const exit = () => setRun(null);
  let body;
  if (!run) body = <Hub p={p} onStart={setRun} />;
  else if (run.kind === 'reflex') body = <Reflex p={p} award={award} mutate={mutate} onExit={exit} />;
  else if (run.kind === 'quiz') body = <Quiz level={run.level} p={p} award={award} mutate={mutate} onExit={exit} />;
  else body = <Session key={`${run.kind}-${run.level?.id || run.title}`} run={run} p={p} award={award} mutate={mutate} onExit={exit} onNext={(lv) => setRun({ kind: 'learn', level: lv })} />;
  return (
    <>
      {!run && <PageHeader kicker={t('learn.kicker')} title={t('learn.title')}>{t('learn.lead')}</PageHeader>}
      {body}
      {party && <Confetti onDone={() => setParty(false)} />}
    </>
  );
}

// ───────────────────────── Trang chính
function Hub({ p, onStart }) {
  const { t } = useT();
  const [tab, setTab] = useState('path');
  const lv = L.levelOf(p.xp);
  const [lo, hi] = L.levelBounds(lv);
  const streak = L.liveStreak(p);
  const today = L.todayXp(p);
  const due = L.dueItems(p);
  const assigns = useMemo(() => loadAssignments(), []);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="surface p-4 sm:col-span-2">
          <div className="flex items-center justify-between"><span className="kicker">{t('common.level')} {lv}</span><span className="font-mono text-[0.9rem] font-bold tabular-nums">{p.xp} XP</span></div>
          <ProgressBar className="mt-2" big value={(p.xp - lo) / (hi - lo)} color="bg-primary" label={t('learn.toNext', { n: hi - p.xp, l: lv + 1 })} />
        </div>
        <Stat icon={Flame} tone={streak ? 'warn' : 'neutral'} label={t('learn.streak')} value={`${streak} ${t('learn.days')}`} sub={`${t('learn.best')} ${p.best}`} />
        <div className="surface flex items-center gap-3 p-4">
          <div className="relative h-14 w-14 shrink-0">
            <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90" aria-hidden>
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(var(--rule))" strokeWidth="4" />
              <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(var(--ok))" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${Math.min(1, today / p.goal) * 94.2} 94.2`} />
            </svg>
            <Target className="absolute inset-0 m-auto h-5 w-5" aria-hidden />
          </div>
          <div><p className="kicker">{t('learn.daily')}</p><p className="font-display text-[1.2rem] font-semibold tabular-nums">{today}/{p.goal} XP</p></div>
        </div>
      </div>

      <Segmented role="tablist" label={t('learn.kicker')} value={tab} onChange={setTab} options={[
        { id: 'path', label: t('learn.tab.path'), icon: Play }, { id: 'review', label: `${t('learn.tab.review')}${due.length ? ` (${due.length})` : ''}`, icon: Repeat },
        { id: 'quiz', label: t('learn.tab.quiz'), icon: ClipboardCheck }, { id: 'game', label: t('learn.tab.game'), icon: Gamepad2 }, { id: 'badges', label: t('learn.tab.badges'), icon: Trophy },
      ]} />

      {tab === 'path' && (
        <>
          {assigns.length > 0 && (
            <Card kicker={t('learn.assigned')} title={t('learn.assignedTitle')}>
              <div className="grid gap-3 md:grid-cols-2">
                {assigns.map((a) => {
                  const pr = assignmentProgress(a, p.mastered);
                  return (
                    <div key={a.id} className="rounded-2xl border border-rule bg-card2/50 p-4">
                      <p className="font-display text-[1.15rem] font-semibold">{a.title}</p>
                      {a.note && <p className="text-[0.9rem] text-muted">{a.note}</p>}
                      {a.due && <p className="text-[0.85rem] text-muted">{t('learn.due')} {a.due}</p>}
                      <ProgressBar className="my-3" value={pr.pct} label={`${pr.done}/${pr.total}`} color="bg-ok" />
                      <BigButton size="sm" variant="primary" icon={Play} onClick={() => onStart({ kind: 'learn', title: a.title, items: a.items })}>{t('learn.doAssign')}</BigButton>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            {LEVELS.map((lv2) => {
              const items = lv2.items || [...new Set(expandLevel(lv2).map((x) => x.ch))];
              const done = items.filter((c) => p.mastered.includes(c)).length;
              return (
                <article key={lv2.id} className="surface flex flex-col gap-4 p-5">
                  <div className="flex items-start gap-4">
                    <span className="font-display text-[3.2rem] font-semibold leading-[0.9] text-primary">{lv2.id}</span>
                    <div className="flex-1">
                      <h2 className="text-[1.3rem] leading-tight">{t(`level.${lv2.id}.title`)}</h2>
                      <p className="mt-1 text-[0.93rem] leading-relaxed text-muted">{t(`level.${lv2.id}.desc`)}</p>
                    </div>
                    <Badge tone={done === items.length ? 'ok' : 'marker'}>{done}/{items.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(lv2.items || lv2.words).map((it, i) => (
                      <span key={i} className={`rounded-lg border px-2 py-0.5 text-[0.9rem] font-bold ${lv2.items && p.mastered.includes(it) ? 'border-ok bg-ok-soft' : 'border-rule bg-paper'}`}>{it}</span>
                    ))}
                  </div>
                  <ProgressBar value={items.length ? done / items.length : 0} label={t('common.mastered')} color="bg-ok" />
                  <BigButton icon={Play} variant="primary" className="mt-auto" onClick={() => onStart({ kind: 'learn', level: lv2 })}>{t('learn.startLevel', { n: lv2.id })}</BigButton>
                </article>
              );
            })}
          </div>
        </>
      )}

      {tab === 'review' && (
        <Card title={t('learn.reviewTitle')}>
          <p className="mb-4 leading-relaxed text-muted">{t('learn.reviewText')}</p>
          {due.length === 0 ? (
            <EmptyState icon={CheckCircle2} title={t('learn.reviewNone')}>{t('learn.reviewNoneHint')}</EmptyState>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">{due.slice(0, 40).map((c) => <Badge key={c} tone={(p.srs[c]?.box || 0) >= 3 ? 'ok' : 'warn'}>{c} · {t('learn.box')} {p.srs[c]?.box || 0}</Badge>)}</div>
              <BigButton icon={Repeat} variant="primary" onClick={() => onStart({ kind: 'review', title: t('learn.tab.review'), items: due.slice(0, 12) })}>{t('learn.reviewStart', { n: Math.min(12, due.length) })}</BigButton>
            </>
          )}
        </Card>
      )}

      {tab === 'quiz' && (
        <Card title={t('learn.quizTitle')}>
          <p className="mb-4 leading-relaxed text-muted">{t('learn.quizText')}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {LEVELS.map((lv2) => {
              const best = Math.max(0, ...p.quizzes.filter((q) => q.level === lv2.id).map((q) => q.pct));
              return (
                <div key={lv2.id} className="flex items-center gap-3 rounded-2xl border border-rule bg-card2/50 p-3">
                  <span className="font-display text-[2rem] font-semibold text-primary">{lv2.id}</span>
                  <div className="flex-1"><p className="font-semibold">{t(`level.${lv2.id}.title`)}</p><p className="text-[0.85rem] text-muted">{t('learn.quizBest')}: {Math.round(best * 100)}%</p></div>
                  <BigButton size="sm" variant="primary" onClick={() => onStart({ kind: 'quiz', level: lv2 })}>{t('common.start')}</BigButton>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === 'game' && (
        <Card title={t('learn.reflexTitle')}>
          <p className="mb-4 leading-relaxed text-muted">{t('learn.reflexText')}</p>
          <p className="mb-4"><Badge tone="marker" icon={Timer}>{t('learn.reflexBest')}: {p.reflexBest}</Badge></p>
          <BigButton icon={Gamepad2} variant="primary" onClick={() => onStart({ kind: 'reflex' })}>{t('common.start')}</BigButton>
        </Card>
      )}

      {tab === 'badges' && (
        <Card title={t('learn.tab.badges')}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {L.BADGES.map((b) => {
              const Icon = ICONS[b.icon] || Star;
              const got = p.badges.includes(b.id);
              return (
                <div key={b.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${got ? 'border-marker bg-marker/15' : 'border-rule bg-card2/50 opacity-70'}`}>
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full ${got ? 'bg-marker text-[#101428]' : 'bg-card2 text-muted'}`}><Icon className="h-6 w-6" aria-hidden /></span>
                  <div><p className="font-display font-semibold">{t(`badge.${b.id}`)}</p><p className="text-[0.85rem] text-muted">{t(`badge.${b.id}.d`)}</p></div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ───────────────────────── Mẫu chuẩn 3D (tô màu ngón duỗi / gập)
function ReferencePanel({ ch, spin, setSpin, viewerRef, hide = false }) {
  const { t } = useT();
  useEffect(() => {
    const v = viewerRef.current;
    if (!v || !ch) return;
    const a = v.animator;
    a.onIndex = null;
    a.onEnd = null;
    a.load([ch]);
    a.mode = isDynamic(ch) ? 'loop-dynamic' : 'once';
    a.setSpeed(1);
    a.play();
    const c = expectedCurl(ch);
    const colors = {};
    for (const f of Object.keys(c)) colors[f] = c[f] >= 0.45 ? RIG_RED : RIG_GREEN;
    v.rig.setFingerColors(colors);
  }, [ch, viewerRef]);
  return (
    <section className="surface flex flex-col gap-4 p-4" aria-label={t('learn.ref')}>
      <h2 className="flex items-center gap-3 text-[1.1rem]">
        <Badge tone="neutral">{t('learn.ref')}</Badge>
        <span className="font-display text-[3rem] font-semibold leading-none text-primary">{ch}</span>
      </h2>
      <div className={`grid items-start gap-4 sm:grid-cols-[1fr_auto] ${hide ? 'blur-md' : ''}`} aria-hidden={hide}>
        <Hand3DViewer ref={viewerRef} autoRotate={spin} className="h-[360px]" label={`${t('hand.label')} ${ch}`} onFrame={(a, rig, dt) => a.update(dt)} />
        <HandSnap ch={ch} size={150} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <BigButton size="sm" icon={Orbit} active={spin} onClick={() => { setSpin((v) => !v); viewerRef.current?.setAutoRotate(!spin); }}>{t('learn.rotate')}</BigButton>
        <BigButton size="sm" icon={RotateCcw} onClick={() => { const a = viewerRef.current?.animator; a?.restart(); a?.play(); }}>{t('learn.again')}</BigButton>
        <span className="flex items-center gap-2 text-[0.88rem] font-semibold"><i className="inline-block h-4 w-4 rounded" style={{ background: RIG_GREEN }} /> {t('learn.extended')}</span>
        <span className="flex items-center gap-2 text-[0.88rem] font-semibold"><i className="inline-block h-4 w-4 rounded" style={{ background: RIG_RED }} /> {t('learn.bent')}</span>
      </div>
      <p className="text-[1rem] leading-relaxed">{HINTS[ch]}{isDynamic(ch) && ` — ${t('learn.trailNote')}`}</p>
    </section>
  );
}

// ───────────────────────── Khung thực hành (camera + HUD chấm điểm)
function PracticeCamera({ practice, cameraOn, ch, holdLabel }) {
  const { t } = useT();
  const { live, onFrame, border, req } = practice;
  const accTone = live.acc >= req ? 'text-ok' : live.acc >= 0.5 ? 'text-warn' : 'text-bad';
  return (
    <CameraView enabled={cameraOn} onFrame={onFrame} border={border}>
      {cameraOn && (
        <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-stage/85 p-3 text-onstage backdrop-blur">
          <div className="mb-1 flex items-end justify-between">
            <span className="font-semibold">{t('common.accuracy')}</span>
            <span className={`font-display text-[2.2rem] font-semibold leading-none tabular-nums ${live.acc >= req ? 'text-[#6EE7A8]' : live.acc >= 0.5 ? 'text-[#FFC93C]' : 'text-[#FF8A7A]'}`}>{Math.round(live.acc * 100)}%</span>
          </div>
          <div className="relative h-5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={Math.round(live.acc * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t('common.accuracy')}>
            <div className={`h-full transition-[width] duration-100 ${live.acc >= req ? 'bg-ok' : live.acc >= 0.5 ? 'bg-marker' : 'bg-bad'}`} style={{ width: `${Math.round(live.acc * 100)}%` }} />
            <div className="absolute inset-y-0 w-1 bg-white" style={{ left: `${req * 100}%` }} />
          </div>
          <ProgressBar className="mt-2 [&_*]:!text-onstage" value={live.hold} label={holdLabel || (isDynamic(ch) ? t('learn.holdDyn') : t('learn.hold1s'))} color="bg-primary" />
          <span className="sr-only">{accTone}</span>
        </div>
      )}
      {live.success && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ok/25">
          <CheckCircle2 className="h-32 w-32 animate-pop rounded-full bg-card text-ok" aria-label={t('learn.correct')} />
        </div>
      )}
    </CameraView>
  );
}

// ───────────────────────── Phiên học / ôn tập
function Session({ run, p, award, mutate, onExit, onNext }) {
  const { t } = useT();
  const { notify } = useToast();
  const review = run.kind === 'review';
  const level = run.level;
  const targets = useMemo(() => (run.items ? run.items.map((ch) => ({ ch })) : expandLevel(level)), [run, level]);
  const title = run.title || t(`level.${level.id}.title`);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [spin, setSpin] = useState(false);
  const [stats, setStats] = useState({ ok: 0, skip: 0, xp: 0 });
  const viewer = useRef(null);
  const target = targets[pos];

  const next = useCallback((success, ch) => {
    let gain = 0;
    if (success) {
      const first = !p.mastered.includes(ch);
      gain = review ? 5 : first ? 15 : 8;
      award(gain, `${review ? 'review' : 'learn'}:${ch}`, (q) => ({ ...L.srsReview(q, ch, true), mastered: review ? q.mastered : Array.from(new Set([...q.mastered, ch])) }));
    } else mutate((q) => L.srsReview(q, ch, false));
    setStats((s) => ({ ok: s.ok + (success ? 1 : 0), skip: s.skip + (success ? 0 : 1), xp: s.xp + gain }));
    if (pos + 1 >= targets.length) {
      setDone(true);
      notify(t('learn.levelDone'), 'ok');
    } else setPos((x) => x + 1);
  }, [p.mastered, review, award, mutate, pos, targets.length, notify, t]);

  const practice = usePractice({ ch: target?.ch, runKey: pos, onSuccess: (ch) => next(true, ch) });

  if (done) {
    const nextLv = level && level.id < LEVELS.length ? LEVELS[level.id] : null;
    return (
      <div className="surface animate-rise mx-auto mt-6 max-w-2xl p-10 text-center">
        <Trophy className="mx-auto h-20 w-20 text-marker" aria-hidden />
        <h2 className="mt-4 text-[2rem] leading-tight">{t('learn.finished', { t: title })}</h2>
        <p className="mt-2 text-[1.1rem] text-muted">{t('learn.finishedStats', { ok: stats.ok, n: targets.length, xp: stats.xp })}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <BigButton icon={RotateCcw} onClick={() => { setPos(0); setDone(false); setStats({ ok: 0, skip: 0, xp: 0 }); }}>{t('learn.redo')}</BigButton>
          {nextLv && <BigButton icon={ChevronRight} variant="primary" onClick={() => onNext(nextLv)}>{t('learn.nextLevel')}</BigButton>}
          <BigButton icon={ArrowLeft} onClick={onExit}>{t('learn.pickOther')}</BigButton>
        </div>
      </div>
    );
  }
  const word = target.word;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4 border-b border-rule pb-4">
        <BigButton icon={ArrowLeft} onClick={onExit}>{t('learn.exit')}</BigButton>
        <div><p className="kicker">{t('learn.kicker')}</p><h1 className="text-[1.5rem] leading-tight">{title}</h1></div>
        <div className="ml-auto min-w-[220px] flex-1 sm:max-w-md"><ProgressBar value={pos / targets.length} label={t('learn.lessonOf', { i: pos + 1, n: targets.length })} color="bg-ok" /></div>
      </div>
      {word && (
        <div className="surface px-5 py-3 font-display text-[2.2rem] font-semibold tracking-wider" aria-label={word}>
          {word.split('').map((c, i) => {
            const idx = word.slice(0, i).replace(/ /g, '').length;
            const cur = c !== ' ' && idx === target.pos;
            const past = c !== ' ' && idx < target.pos;
            return <span key={i} className={`mx-0.5 inline-block rounded-lg px-1.5 ${cur ? 'bg-marker text-[#101428] shadow-press' : past ? 'text-ok' : 'text-muted'}`}>{c === ' ' ? '  ' : c}</span>;
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5" aria-label={t('learn.list')}>
        {targets.map((x, i) => (
          <span key={i} className={`flex h-11 min-w-[44px] items-center justify-center rounded-xl border px-2 font-display text-[1.1rem] font-semibold ${i === pos ? 'border-primary bg-primary text-primary-on' : i < pos ? 'border-ok bg-ok-soft' : 'border-rule bg-card text-muted'}`}>
            {i < pos ? <CheckCircle2 className="h-5 w-5 text-ok" aria-label={x.ch} /> : x.ch}
          </span>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReferencePanel ch={target.ch} spin={spin} setSpin={setSpin} viewerRef={viewer} />
        <section className="surface flex flex-col gap-4 p-4" aria-label={t('learn.you')}>
          <h2 className="flex items-center gap-3 text-[1.1rem]"><Badge tone="primary">{t('learn.you')}</Badge><span className="font-medium text-muted">{t('learn.youHint')}</span></h2>
          <PracticeCamera practice={practice} cameraOn={cameraOn} ch={target.ch} />
          <div className="flex flex-wrap gap-3">
            <BigButton icon={cameraOn ? VideoOff : Video} onClick={() => setCameraOn((v) => !v)}>{cameraOn ? t('common.cameraOff') : t('common.cameraOn')}</BigButton>
            <BigButton icon={SkipForward} variant="warn" onClick={() => next(false, target.ch)}>{t('learn.skip')}</BigButton>
          </div>
          <p className="text-[0.9rem] leading-relaxed text-muted">{t('learn.colorHelp')}</p>
        </section>
      </div>
    </div>
  );
}

// ───────────────────────── Kiểm tra theo cấp
function Quiz({ level, p, award, mutate, onExit }) {
  const { t } = useT();
  const items = useMemo(() => L.makeQuiz([...new Set(level.items || expandLevel(level).map((x) => x.ch))], 8), [level]);
  const [i, setI] = useState(0);
  const [res, setRes] = useState([]);
  const [left, setLeft] = useState(15);
  const [cameraOn] = useState(true);
  const ch = items[i];
  const finished = i >= items.length;
  const resRef = useRef(res);
  resRef.current = res;

  const answer = useCallback((ok) => {
    setRes((r) => [...r, { ch: items[i], ok }]);
    setI((x) => x + 1);
    setLeft(15);
  }, [i, items]);
  const practice = usePractice({ ch: finished ? null : ch, runKey: i, holdMs: 700, onSuccess: () => answer(true) });

  useEffect(() => {
    if (finished) return undefined;
    const tm = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(tm);
  }, [i, finished]);
  useEffect(() => { if (left <= 0 && !finished) answer(false); }, [left, finished, answer]);

  const saved = useRef(false);
  useEffect(() => {
    if (!finished || saved.current) return;
    saved.current = true;
    const correct = res.filter((r) => r.ok).length;
    const pct = correct / items.length;
    award(correct * 5 + (pct >= 0.8 ? 20 : 0), `quiz:${level.id}`, (q) => {
      let n = L.recordQuiz(q, level.id, correct, items.length);
      for (const r of res) n = L.srsReview(n, r.ch, r.ok);
      return n;
    });
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  if (finished) {
    const correct = res.filter((r) => r.ok).length;
    const pct = correct / items.length;
    return (
      <div className="surface animate-rise mx-auto mt-6 max-w-2xl p-10 text-center">
        <GraduationCap className="mx-auto h-20 w-20 text-marker" aria-hidden />
        <h2 className="mt-4 text-[2rem]">{t('learn.quizResult', { a: correct, n: items.length })}</h2>
        <p className={`mt-1 font-display text-[3rem] font-semibold ${pct >= 0.8 ? 'text-ok' : 'text-warn'}`}>{Math.round(pct * 100)}%</p>
        <div className="my-5 flex flex-wrap justify-center gap-2">{res.map((r, k) => <Badge key={k} tone={r.ok ? 'ok' : 'bad'} icon={r.ok ? CheckCircle2 : XCircle}>{r.ch}</Badge>)}</div>
        <div className="flex flex-wrap justify-center gap-3"><BigButton icon={ArrowLeft} variant="primary" onClick={onExit}>{t('learn.pickOther')}</BigButton></div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4 border-b border-rule pb-4">
        <BigButton icon={ArrowLeft} onClick={onExit}>{t('learn.exit')}</BigButton>
        <div><p className="kicker">{t('learn.tab.quiz')}</p><h1 className="text-[1.5rem]">{t(`level.${level.id}.title`)}</h1></div>
        <div className="ml-auto min-w-[200px] flex-1 sm:max-w-sm"><ProgressBar value={i / items.length} label={t('learn.lessonOf', { i: i + 1, n: items.length })} color="bg-ok" /></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="surface flex flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="kicker">{t('learn.quizAsk')}</p>
          <span className="font-display text-[9rem] font-semibold leading-none text-primary">{ch}</span>
          <Badge tone={left <= 5 ? 'bad' : 'neutral'} icon={Timer}>{left}s</Badge>
          <p className="text-muted">{t('learn.quizNoRef')}</p>
        </div>
        <PracticeCamera practice={practice} cameraOn={cameraOn} ch={ch} holdLabel={t('learn.hold07')} />
      </div>
    </div>
  );
}

// ───────────────────────── Trò chơi phản xạ (60 giây)
function Reflex({ p, award, mutate, onExit }) {
  const { t } = useT();
  const pool = useMemo(() => 'ABCDEFGHIKLMNOPQRSTUVWXY'.split(''), []);
  const pick = useCallback(() => pool[Math.floor(Math.random() * pool.length)], [pool]);
  const [state, setState] = useState('ready'); // ready | play | over
  const [ch, setCh] = useState(pick);
  const [n, setN] = useState(0);
  const [round, setRound] = useState(0);
  const [left, setLeft] = useState(60);
  const nRef = useRef(0);
  const practice = usePractice({ ch: state === 'play' ? ch : null, runKey: round, holdMs: 500, req: 0.75, active: state === 'play', onSuccess: () => { nRef.current += 1; setN(nRef.current); setCh((c) => { let x = pick(); while (x === c) x = pick(); return x; }); setRound((r) => r + 1); } });

  useEffect(() => {
    if (state !== 'play') return undefined;
    const tm = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(tm);
  }, [state]);
  useEffect(() => {
    if (state === 'play' && left <= 0) {
      setState('over');
      const best = nRef.current > p.reflexBest;
      award(nRef.current + (best ? 10 : 0), 'reflex', (q) => ({ ...q, reflexBest: Math.max(q.reflexBest, nRef.current) }));
    }
  }, [left, state]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => { nRef.current = 0; setN(0); setLeft(60); setCh(pick()); setRound((r) => r + 1); setState('play'); };
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4 border-b border-rule pb-4">
        <BigButton icon={ArrowLeft} onClick={onExit}>{t('learn.exit')}</BigButton>
        <div><p className="kicker">{t('learn.tab.game')}</p><h1 className="text-[1.5rem]">{t('learn.reflexTitle')}</h1></div>
        <div className="ml-auto flex gap-2"><Badge tone="marker" icon={Timer}>{left}s</Badge><Badge tone="ok" icon={Zap}>{n}</Badge></div>
      </div>
      {state === 'over' ? (
        <div className="surface animate-rise mx-auto max-w-xl p-10 text-center">
          <Zap className="mx-auto h-16 w-16 text-marker" aria-hidden />
          <h2 className="mt-3 text-[2rem]">{t('learn.reflexScore', { n })}</h2>
          {n >= p.reflexBest && n > 0 && <p className="mt-1 font-semibold text-ok">{t('learn.newBest')}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3"><BigButton icon={RotateCcw} variant="primary" onClick={start}>{t('learn.redo')}</BigButton><BigButton icon={ArrowLeft} onClick={onExit}>{t('learn.exit')}</BigButton></div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="surface flex flex-col items-center justify-center gap-3 p-8 text-center">
            {state === 'ready' ? (
              <><p className="max-w-xs text-muted">{t('learn.reflexText')}</p><BigButton icon={Play} variant="primary" onClick={start}>{t('common.start')}</BigButton></>
            ) : (
              <><p className="kicker">{t('learn.quizAsk')}</p><span className="font-display text-[9rem] font-semibold leading-none text-primary">{ch}</span></>
            )}
          </div>
          <PracticeCamera practice={practice} cameraOn ch={ch} holdLabel={t('learn.hold05')} />
        </div>
      )}
    </div>
  );
}
