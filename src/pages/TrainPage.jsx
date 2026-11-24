import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Brain, Trash2, RotateCcw, CheckCircle2, Loader2, Info } from 'lucide-react';
import CameraView from '../components/camera/CameraView.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { signEngine } from '../lib/ml/signEngine.js';
import { STATIC_CLASSES } from '../config/systemConfig.js';
import { tf, buildStaticModel, buildDynamicModel, fitDataset, STATIC_URL, DYNAMIC_URL, removeUserModels } from '../lib/ml/models.js';
import { makeDynamicDataset, SEQ_LEN, DYN_CLASSES } from '../lib/ml/synthetic.js';
import { store } from '../lib/store.js';
import { pkey, activeId } from '../lib/profiles.js';
import { useT } from '../i18n/index.jsx';
import { staticDbKey, dynamicDbKey } from '../lib/ml/models.js';
import HandSnap from '../components/hand/HandSnap.jsx';
import { Badge } from '../components/ui/kit.jsx';

const STATIC_GOAL = 30;
const DYN_GOAL = 15;
const DYN_LABEL = { J: 'J', Z: 'Z', NONE: '∅' };
const ALL = [...STATIC_CLASSES.map((c) => ({ id: c, kind: 'static' })), ...DYN_CLASSES.map((c) => ({ id: c, kind: 'dynamic' }))];

const load = () => {
  const v = store.read(pkey('samples'), null);
  return { ...(v || {}), static: v?.static || {}, dynamic: v?.dynamic || {} };
};
const saveSamples = (v) => store.write(pkey('samples'), v);
const WIZARD = 'ABCDEFGHIKLMNOPQRSTUVWXY'.split('');
const round = (a) => Array.from(a, (v) => Math.round(v * 1000) / 1000);

function flipSeq(seq) {
  const o = new Float32Array(seq.length);
  for (let i = 0; i < seq.length; i += 2) {
    o[i] = -seq[i];
    o[i + 1] = seq[i + 1];
  }
  return o;
}
function concatDs(parts, dim, classes) {
  const count = parts.reduce((n, p) => n + p.ys.length, 0);
  const xs = new Float32Array(count * dim);
  const ys = new Int32Array(count);
  let k = 0;
  for (const p of parts) {
    xs.set(p.xs, k * dim);
    ys.set(p.ys, k);
    k += p.ys.length;
  }
  return { xs, ys, count, classes };
}

export default function TrainPage() {
  const { t } = useT();
  const { notify } = useToast();
  const [samples, setSamples] = useState(load);
  const [sel, setSel] = useState('A');
  const [countdown, setCountdown] = useState(0);
  const [rec, setRec] = useState(null); // { pct }
  const [train, setTrain] = useState(null); // { kind, pct, msg }
  const [engine, setEngine] = useState({ ...signEngine.status, userSamples: signEngine.userSamples || 0 });
  const recRef = useRef(null);
  const selInfo = ALL.find((c) => c.id === sel);

  useEffect(() => {
    signEngine.load().then((s) => setEngine({ ...s, userSamples: signEngine.userSamples || 0 }));
    return () => {
      signEngine.suspendDynamic = false;
    };
  }, []);

  // Mẫu của người dùng có tác dụng NGAY (kNN) – không cần huấn luyện lại
  useEffect(() => {
    const n = signEngine.reloadUserSamples();
    setEngine((e) => ({ ...e, userSamples: n }));
  }, [samples]);

  const persist = useCallback((next) => {
    setSamples(next);
    saveSamples(next);
    if (store.lastError) notify(t('train.full'), 'bad');
  }, [notify]);

  const count = (c) => (c.kind === 'static' ? samples.static[c.id]?.length : samples.dynamic[c.id]?.length) || 0;

  const onFrame = useCallback((lm, W, H) => {
    const f = signEngine.process(lm, W, H, { mode: 'auto' });
    const r = recRef.current;
    if (r && r.kind === 'static' && f.present) {
      r.frame++;
      if (r.frame % 3 === 0) {
        r.buf.push(round(f.feat));
        setRec({ pct: r.buf.length / r.n });
        if (r.buf.length >= r.n) {
          recRef.current = null;
          setRec(null);
          setSamples((s) => {
            const next = { ...s, static: { ...s.static, [r.cls]: [...(s.static[r.cls] || []), ...r.buf] } };
            saveSamples(next);
            r.done?.();
            return next;
          });
        }
      }
    }
    return {};
  }, []);

  const startRecording = (cls = sel) => new Promise((resolve) => {
    if (recRef.current || countdown) return resolve(false);
    const info = ALL.find((c) => c.id === cls);
    let n = 3;
    setCountdown(n);
    const t = setInterval(() => {
      n--;
      setCountdown(n);
      if (n > 0) return;
      clearInterval(t);
      if (info.kind === 'static') {
        recRef.current = { kind: 'static', cls, n: 30, buf: [], frame: 0, done: () => resolve(true) };
        setRec({ pct: 0 });
      } else {
        signEngine.suspendDynamic = true;
        signEngine.hist.length = 0;
        setRec({ pct: 0 });
        const t0 = performance.now();
        const prog = setInterval(() => setRec({ pct: Math.min(1, (performance.now() - t0) / 1700) }), 80);
        setTimeout(() => {
          clearInterval(prog);
          signEngine.suspendDynamic = false;
          setRec(null);
          const keys = cls === 'J' ? ['p'] : cls === 'Z' ? ['a'] : ['a', 'p'];
          const got = keys.map((k) => signEngine.buildSequence(k)).filter(Boolean);
          if (!got.length) {
            notify(t('train.nohand'), 'warn');
            return resolve(false);
          }
          setSamples((s) => {
            const next = { ...s, dynamic: { ...s.dynamic, [cls]: [...(s.dynamic[cls] || []), ...got.map((g) => round(g.seq))] } };
            saveSamples(next);
            return next;
          });
          resolve(true);
        }, 1700);
      }
    }, 1000);
  });

  async function trainStatic() {
    try {
      setTrain({ kind: 'static', pct: 0, msg: t('train.prep') });
      await tf.ready();
      await signEngine.load();
      const gauss = () => Math.sqrt(-2 * Math.log(Math.random() + 1e-12)) * Math.cos(2 * Math.PI * Math.random());
      const jitter = (f, sigma, flip) => {
        const o = new Float32Array(63);
        for (let k = 0; k < 63; k++) o[k] = (flip && k % 3 === 0 ? -f[k] : f[k]) + gauss() * sigma;
        return o;
      };
      const xs = [];
      const ys = [];
      // (1) "Ôn lại" kiến thức gốc: mẫu thật đóng gói sẵn (mỗi lớp ~24 mẫu đại diện) để không quên các ký tự chưa thu
      const knn = signEngine.knn;
      if (knn) {
        for (let i = 0; i < knn.size; i++) {
          if (knn.weight[i] !== 1) continue;
          for (let r = 0; r < 8; r++) {
            xs.push(jitter(knn.vecs[i], 0.04, Math.random() < 0.5));
            ys.push(knn.cls[i]);
          }
        }
      }
      // (2) Mẫu của chính bạn: nhân bản có nhiễu nhẹ, thỉnh thoảng lật trái/phải
      let mine = 0;
      STATIC_CLASSES.forEach((c, ci) => {
        for (const smp of samples.static[c] || []) {
          const f = Float32Array.from(smp);
          mine++;
          for (let w = 0; w < 14; w++) {
            xs.push(jitter(f, 0.03, w % 4 === 3));
            ys.push(ci);
          }
        }
      });
      const user = { xs: new Float32Array(xs.length * 63), ys: Int32Array.from(ys), count: xs.length, classes: STATIC_CLASSES };
      xs.forEach((f, i) => user.xs.set(f, i * 63));
      let model = null;
      try {
        model = await tf.loadLayersModel(staticDbKey(activeId()));
      } catch {
        try {
          model = await tf.loadLayersModel(STATIC_URL);
        } catch {
          /* dùng mô hình mới */
        }
      }
      if (!model) model = buildStaticModel();
      model.compile({ optimizer: tf.train.adam(0.0008), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
      await fitDataset(model, user, { epochs: 12, batchSize: 128, onEpoch: (e, n, l) => setTrain({ kind: 'static', pct: e / n, msg: `${t('train.epoch')} ${e}/${n} · loss ${l.loss.toFixed(3)} · acc ${((l.acc ?? l.accuracy) * 100).toFixed(1)}%` }) });
      await model.save(staticDbKey(activeId()));
      model.dispose();
      setEngine({ ...(await signEngine.reloadModels()), userSamples: signEngine.userSamples || 0 });
      setTrain(null);
      notify(t('train.doneStatic', { n: mine }), 'ok');
    } catch (e) {
      setTrain(null);
      notify(t('train.err', { e: e.message }), 'bad');
    }
  }

  async function trainDynamic() {
    try {
      setTrain({ kind: 'dynamic', pct: 0, msg: t('train.prep') });
      await tf.ready();
      const synth = makeDynamicDataset({ perClass: 300, seed: (Date.now() % 100000) + 7 });
      const W = 6;
      const ux = [];
      const uy = [];
      DYN_CLASSES.forEach((c, ci) => {
        for (const s of samples.dynamic[c] || []) {
          const f = Float32Array.from(s);
          for (let w = 0; w < W; w++) {
            ux.push(f, flipSeq(f));
            uy.push(ci, ci);
          }
        }
      });
      const user = { xs: new Float32Array(ux.length * SEQ_LEN * 4), ys: Int32Array.from(uy) };
      ux.forEach((f, i) => user.xs.set(f, i * SEQ_LEN * 4));
      const ds = concatDs([synth, user], SEQ_LEN * 4, DYN_CLASSES);
      let model = null;
      try {
        model = await tf.loadLayersModel(DYNAMIC_URL);
      } catch {
        /* mới */
      }
      if (!model) model = buildDynamicModel();
      model.compile({ optimizer: tf.train.adam(0.001), loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
      await fitDataset(model, ds, { epochs: 10, batchSize: 64, shape: [SEQ_LEN, 4], onEpoch: (e, n, l) => setTrain({ kind: 'dynamic', pct: e / n, msg: `${t('train.epoch')} ${e}/${n} · loss ${l.loss.toFixed(3)}` }) });
      await model.save(dynamicDbKey(activeId()));
      model.dispose();
      setEngine({ ...(await signEngine.reloadModels()), userSamples: signEngine.userSamples || 0 });
      setTrain(null);
      notify(t('train.doneDyn'), 'ok');
    } catch (e) {
      setTrain(null);
      notify(t('train.err', { e: e.message }), 'bad');
    }
  }

  const totalStatic = useMemo(() => Object.values(samples.static).reduce((n, a) => n + a.length, 0), [samples]);
  const totalDyn = useMemo(() => Object.values(samples.dynamic).reduce((n, a) => n + a.length, 0), [samples]);

  const srcLabel = (src) => t(src === 'user' ? 'train.srcUser' : src === 'bundled' ? 'train.srcBundled' : 'train.srcNone');

  // ---- Trình hướng dẫn hiệu chỉnh: lần lượt từng ký tự, tự đếm ngược và thu mẫu
  const [wiz, setWiz] = useState(null); // { i, running }
  const wizStop = useRef(false);
  const runWizard = async () => {
    wizStop.current = false;
    for (let i = 0; i < WIZARD.length && !wizStop.current; i++) {
      setWiz({ i, running: true });
      setSel(WIZARD[i]);
      const ok = await startRecording(WIZARD[i]);
      if (!ok) { await new Promise((r) => setTimeout(r, 700)); i--; if (wizStop.current) break; }
      await new Promise((r) => setTimeout(r, 500));
    }
    setWiz(null);
    if (!wizStop.current) notify(t('train.wizDone'), 'ok');
  };

  return (
    <>
      <PageHeader kicker={t('train.kicker')} title={t('train.title')}>{t('train.lead')}</PageHeader>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)]">
        <section className="flex flex-col gap-4" aria-label={t('train.camera')}>
          <CameraView enabled onFrame={onFrame} border={rec ? 'warn' : 'idle'}>
            {countdown > 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stage/60">
                <span className="font-display text-[9rem] font-semibold leading-none text-marker">{countdown}</span>
              </div>
            )}
            {rec && (
              <div className="absolute inset-x-5 bottom-5 rounded-2xl bg-stage/85 p-3 text-onstage backdrop-blur">
                <ProgressBar value={rec.pct} label={selInfo.kind === 'static' ? t('train.recStatic') : t('train.recDyn')} color="bg-marker" big className="[&_*]:!text-onstage" />
              </div>
            )}
          </CameraView>
          <Card title={t('train.why')} className="!p-4">
            <p className="leading-relaxed text-muted">{t('train.whyText', { n: STATIC_GOAL, m: DYN_GOAL })}</p>
            <p className="mt-3 rounded-xl bg-card2 px-3 py-2 text-[0.93rem] font-bold">
              {t('train.status', { a: srcLabel(engine.staticSource), n: engine.userSamples || 0, b: srcLabel(engine.dynamicSource) })}
            </p>
          </Card>
        </section>

        <section className="flex flex-col gap-5" aria-label={t('train.pick')}>
          <Card kicker={t('train.guided')} title={t('train.guidedTitle')}>
            <p className="mb-4 leading-relaxed text-muted">{t('train.guidedText', { n: WIZARD.length })}</p>
            {wiz ? (
              <div className="grid items-center gap-4 sm:grid-cols-[auto_1fr]">
                <HandSnap ch={WIZARD[wiz.i]} size={130} />
                <div>
                  <p className="font-display text-[1.4rem] font-semibold">{t('train.wizStep', { c: WIZARD[wiz.i], i: wiz.i + 1, n: WIZARD.length })}</p>
                  <ProgressBar className="my-3" value={(wiz.i + (rec?.pct || 0)) / WIZARD.length} label={t('train.wizProgress')} />
                  <BigButton variant="warn" onClick={() => { wizStop.current = true; recRef.current = null; setRec(null); setCountdown(0); setWiz(null); }}>{t('common.stop')}</BigButton>
                </div>
              </div>
            ) : (
              <BigButton icon={Circle} variant="primary" disabled={!!rec || countdown > 0 || !!train} onClick={runWizard}>{t('train.wizStart')}</BigButton>
            )}
          </Card>

          <Card kicker={t('train.step1')} title={t('train.pickTitle')}>
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label={t('train.pickTitle')}>
              {ALL.map((c) => {
                const n = count(c);
                const goal = c.kind === 'static' ? STATIC_GOAL : DYN_GOAL;
                const ok = n >= goal;
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={sel === c.id} onClick={() => setSel(c.id)}
                    className={`flex min-h-[64px] min-w-[64px] flex-col items-center justify-center rounded-2xl border-2 px-3 font-display text-[1.45rem] font-semibold leading-none transition ${sel === c.id ? 'border-primary bg-primary text-primary-on shadow-press' : ok ? 'border-ok bg-ok-soft text-ink' : 'border-line bg-card text-ink hover:bg-card2'}`}>
                    {c.kind === 'dynamic' && c.id === 'NONE' ? '∅' : c.id}
                    <span className="mt-1 font-sans text-[0.75rem] font-bold">{ok && <CheckCircle2 className="mr-0.5 inline h-3.5 w-3.5" aria-hidden />}{n}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-2">{t('train.selected')} <Badge tone="marker">{selInfo.kind === 'dynamic' ? `${DYN_LABEL[sel]} · ${t(`train.dyn.${sel}`)}` : sel}</Badge> · {t('train.have', { n: count(selInfo) })}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <BigButton icon={Circle} variant="primary" disabled={!!rec || countdown > 0 || !!train || !!wiz} onClick={() => startRecording()}>{selInfo.kind === 'static' ? t('train.rec30') : t('train.rec1')}</BigButton>
              <BigButton icon={Trash2} variant="ghost" disabled={!count(selInfo)} onClick={() => persist({ ...samples, [selInfo.kind]: { ...samples[selInfo.kind], [sel]: [] } })}>{t('train.delOne')}</BigButton>
            </div>
          </Card>

          <Card kicker={t('train.step2')} title={t('train.fineTitle')}>
            <p className="mb-4 leading-relaxed text-muted">{t('train.fineText', { a: totalStatic, b: totalDyn })}</p>
            <div className="flex flex-wrap gap-3">
              <BigButton icon={Brain} variant="primary" disabled={!totalStatic || !!train} onClick={trainStatic}>{t('train.fineStatic')}</BigButton>
              <BigButton icon={Brain} variant="primary" disabled={!totalDyn || !!train} onClick={trainDynamic}>{t('train.fineDyn')}</BigButton>
              <BigButton icon={RotateCcw} variant="warn" disabled={!!train} onClick={async () => { await removeUserModels(activeId()); setEngine({ ...(await signEngine.reloadModels()), userSamples: signEngine.userSamples || 0 }); notify(t('train.restored'), 'ok'); }}>{t('train.restore')}</BigButton>
              <BigButton icon={Trash2} variant="bad" disabled={!!train || (!totalStatic && !totalDyn)} onClick={() => persist({ static: {}, dynamic: {} })}>{t('train.delAll')}</BigButton>
            </div>
            {train && (
              <div className="mt-4 rounded-2xl border border-rule bg-paper p-4" role="status">
                <p className="mb-2 flex items-center gap-3 font-bold"><Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden /> {t('train.training')} {train.msg}</p>
                <ProgressBar value={train.pct} big />
              </div>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
