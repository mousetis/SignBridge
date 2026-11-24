import { useState } from 'react';
import { Send, RotateCcw, MousePointer2, Mic, Gauge, Palette, Hand, Camera, Cpu, ScanLine, Database, Download, Upload, Wind, RefreshCw } from 'lucide-react';
import BigButton from '../components/ui/BigButton.jsx';
import Slider from '../components/ui/Slider.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import Card from '../components/ui/Card.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { Segmented, Field } from '../components/ui/kit.jsx';
import BreathWizard from '../components/esp32/BreathWizard.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useEsp32 } from '../context/Esp32Context.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useT } from '../i18n/index.jsx';
import { SKINS } from '../lib/hand/handRig.js';
import { HAND_MODELS, HAND_STYLE_IDS, resolveHandStyle } from '../lib/hand/handModels.js';
import { exportProfile, importProfile, downloadJson, pickJson, validBackup } from '../lib/backup.js';

const Section = ({ icon: Icon, title, children, className = '' }) => (
  <Card title={title} aside={<Icon className="h-7 w-7 text-accent" aria-hidden />} className={className}>
    <div className="flex flex-col gap-5">{children}</div>
  </Card>
);

export default function SettingsPage() {
  const { t } = useT();
  const { settings, patch, reset, profiles } = useSettings();
  const { snap, pushConfig } = useEsp32();
  const { notify } = useToast();
  const [wiz, setWiz] = useState(false);
  const [bench, setBench] = useState(null);
  const [busy, setBusy] = useState(false);
  const j = settings.joystick;
  const p = settings.pressure;
  const h = settings.hand;
  const sc = settings.scan;
  const lang = settings.lang || 'vi';
  const board = snap.state === 'connected';

  const runBench = async () => {
    setBusy(true);
    try {
      const { chooseBackend } = await import('../lib/ml/runtime.js');
      setBench(await chooseBackend('auto'));
    } finally {
      setBusy(false);
    }
  };
  const doExport = async () => {
    downloadJson(await exportProfile(), `signbridge-${profiles.active.name.replace(/\W+/g, '_')}.json`);
    notify(t('set.exported'), 'ok');
  };
  const doImport = async () => {
    try {
      const o = await pickJson();
      if (!validBackup(o)) throw new Error('bad');
      const n = await importProfile(o);
      notify(t('set.imported', { n }), 'ok');
      setTimeout(() => location.reload(), 900);
    } catch {
      notify(t('set.badFile'), 'bad');
    }
  };

  return (
    <>
      <PageHeader kicker={t('set.kicker')} title={t('set.title')}>{t('set.lead')}</PageHeader>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Palette} title={t('set.look')}>
          <Field label={t('set.theme')}>
            <Segmented label={t('set.theme')} value={settings.theme} onChange={(v) => patch(null, { theme: v })} options={['system', 'light', 'dark', 'hc'].map((id) => ({ id, label: t(`theme.${id}`) }))} />
          </Field>
          <Field label={t('set.fs')}>
            <Segmented label={t('set.fs')} value={settings.fs} onChange={(v) => patch(null, { fs: v })} options={['s', 'm', 'l', 'xl'].map((id) => ({ id, label: t(`fs.${id}`) }))} />
          </Field>
          <Field label={t('set.motion')}>
            <Segmented label={t('set.motion')} value={settings.motion} onChange={(v) => patch(null, { motion: v })} options={['auto', 'reduce', 'full'].map((id) => ({ id, label: t(`motion.${id}`) }))} />
          </Field>
          <Field label={t('set.lang')}>
            <Segmented label={t('set.lang')} value={lang} onChange={(v) => patch(null, { lang: v })} options={['vi', 'en'].map((id) => ({ id, label: t(`lang.${id}`) }))} />
          </Field>
        </Section>

        <Section icon={Hand} title={t('set.hand')}>
          <Field label={t('set.style')}>
            <Segmented label={t('set.style')} value={resolveHandStyle(h.style)} onChange={(v) => patch('hand', { style: v })} options={HAND_STYLE_IDS.map((id) => ({ id, label: t(`set.style.${id}`) }))} />
          </Field>
          <Field label={t('set.side')}>
            <Segmented label={t('set.side')} value={h.side} onChange={(v) => patch('hand', { side: v })} options={[{ id: 'right', label: t('set.right') }, { id: 'left', label: t('set.left') }]} />
          </Field>
          {HAND_MODELS[resolveHandStyle(h.style)].skinTone !== false && (
            <Field label={t('set.skin')}>
              <div role="radiogroup" aria-label={t('set.skin')} className="flex flex-wrap gap-3">
                {SKINS.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={h.skin === s.id} aria-label={t(s.name)} title={t(s.name)} onClick={() => patch('hand', { skin: s.id })}
                    className={`h-14 w-14 rounded-full border-4 transition ${h.skin === s.id ? 'scale-110 border-primary shadow-lift' : 'border-card'}`} style={{ background: s.hex }} />
                ))}
              </div>
            </Field>
          )}
          <p className="text-xs text-muted">{t('set.modelCredit', { credit: HAND_MODELS[resolveHandStyle(h.style)].credit })}</p>
        </Section>

        <Section icon={Camera} title={t('set.cam')}>
          <Toggle label={t('set.mirror')} checked={settings.mirror} onChange={(v) => patch(null, { mirror: v })} />
          <p className="text-[0.92rem] leading-relaxed text-muted">{t('set.camHint')}</p>
          {settings.cameraId && <BigButton size="sm" variant="ghost" onClick={() => patch(null, { cameraId: '' })}>{t('camera.default')}</BigButton>}
        </Section>

        <Section icon={Cpu} title={t('set.ai')}>
          <Field label={t('set.backend')}>
            <Segmented label={t('set.backend')} value={settings.backend} onChange={(v) => patch(null, { backend: v })} options={[{ id: 'auto', label: t('common.auto') }, { id: 'webgpu', label: 'WebGPU' }, { id: 'webgl', label: 'WebGL' }, { id: 'cpu', label: 'CPU' }]} />
          </Field>
          <Toggle label={t('set.worker')} hint={t('set.workerHint')} checked={settings.useWorker} onChange={(v) => patch(null, { useWorker: v })} />
          <div>
            <p className="mb-2 font-semibold">{t('set.bench')}</p>
            {(bench?.results || settings.bench) && (
              <ul className="mb-3 flex flex-wrap gap-2">
                {Object.entries(bench?.results || settings.bench).map(([k, v]) => (
                  <li key={k} className={`rounded-xl border px-3 py-2 font-mono text-[0.95rem] ${(bench?.name || settings.backendHint) === k ? 'border-ok bg-ok-soft font-bold' : 'border-rule bg-card2'}`}>{k.toUpperCase()}: {v} ms</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-3">
              <BigButton icon={RefreshCw} onClick={runBench} disabled={busy}>{busy ? t('set.benchBusy') : t('set.benchRun')}</BigButton>
              <BigButton variant="ghost" onClick={() => location.reload()}>{t('set.reload')}</BigButton>
            </div>
            <p className="mt-3 text-[0.9rem] leading-relaxed text-muted">{t('set.benchNote')}</p>
          </div>
        </Section>

        <Section icon={MousePointer2} title={t('set.esp')}>
          <Toggle label={t('set.cursor')} hint={t('set.cursorHint')} checked={j.cursorEnabled} onChange={(v) => patch('joystick', { cursorEnabled: v })} />
          <Slider label={t('set.deadzone')} value={j.deadzone} min={0.02} max={0.4} step={0.01} onChange={(v) => patch('joystick', { deadzone: v })} hint={t('set.deadzoneHint')} />
          <Slider label={t('set.speed')} value={j.cursorSpeed} min={0.5} max={3} step={0.1} onChange={(v) => patch('joystick', { cursorSpeed: v })} format={(v) => `${v.toFixed(1)}×`} hint={t('set.speedHint')} />
          <Toggle label={t('set.invX')} checked={j.invertX} onChange={(v) => patch('joystick', { invertX: v })} />
          <Toggle label={t('set.invY')} checked={j.invertY} onChange={(v) => patch('joystick', { invertY: v })} />
        </Section>

        <Section icon={Gauge} title={t('set.breath')}>
          <BigButton icon={Wind} variant="primary" onClick={() => setWiz(true)}>{t('set.breathWizard')}</BigButton>
          <Slider label={t('set.puff')} value={p.puff} min={0.1} max={1.5} step={0.05} unit=" kPa" onChange={(v) => patch('pressure', { puff: v })} />
          <Slider label={t('set.sip')} value={p.sip} min={-1.5} max={-0.1} step={0.05} unit=" kPa" onChange={(v) => patch('pressure', { sip: v })} />
          <Slider label={t('set.double')} value={p.doubleMs} min={150} max={800} step={10} unit=" ms" onChange={(v) => patch('pressure', { doubleMs: v })} />
          <Slider label={t('set.hold')} value={p.holdMs} min={300} max={1500} step={50} unit=" ms" onChange={(v) => patch('pressure', { holdMs: v })} />
          <div className="flex flex-wrap items-center gap-4">
            <BigButton icon={Send} disabled={!board} onClick={() => { pushConfig(); notify(t('set.sentCfg'), 'ok'); }}>{t('set.sendCfg')}</BigButton>
            {!board && <span className="text-[0.92rem] text-muted">{t('set.needBoard')}</span>}
          </div>
        </Section>

        <Section icon={ScanLine} title={t('set.scan')}>
          <Toggle label={t('set.scanOn')} hint={t('set.scanHint')} checked={sc.enabled} onChange={(v) => patch('scan', { enabled: v })} />
          <Field label={t('set.scanMode')}>
            <Segmented label={t('set.scanMode')} value={sc.mode} onChange={(v) => patch('scan', { mode: v })} options={[{ id: 'auto', label: t('set.scanAuto') }, { id: 'step', label: t('set.scanStep') }]} />
          </Field>
          <Slider label={t('set.scanInterval')} value={sc.intervalMs} min={600} max={4000} step={100} unit=" ms" onChange={(v) => patch('scan', { intervalMs: v })} />
        </Section>

        <Section icon={Mic} title={t('set.speech')}>
          <Field label={t('set.speechLang')}>
            <Segmented label={t('set.speechLang')} value={settings.speech.lang} onChange={(v) => patch('speech', { lang: v })} options={[{ id: 'vi-VN', label: 'Tiếng Việt' }, { id: 'en-US', label: 'English' }]} />
          </Field>
          <Slider label={t('set.rate')} value={settings.speech.rate} min={0.5} max={1.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => patch('speech', { rate: v })} />
          <Toggle label={t('set.speakAuto')} checked={!!settings.speech.auto} onChange={(v) => patch('speech', { auto: v })} />
        </Section>

        <Section icon={Database} title={t('set.data')} className="lg:col-span-2">
          <Toggle label={t('set.history')} checked={settings.history} onChange={(v) => patch(null, { history: v })} />
          <div className="flex flex-wrap gap-3">
            <BigButton icon={Download} onClick={doExport}>{t('set.exportAll')}</BigButton>
            <BigButton icon={Upload} onClick={doImport}>{t('set.importAll')}</BigButton>
            <BigButton icon={RotateCcw} variant="warn" onClick={() => { reset(); notify(t('set.resetDone'), 'ok'); }}>{t('set.reset')}</BigButton>
          </div>
          <p className="text-[0.92rem] leading-relaxed text-muted">{t('set.dataHint')}</p>
        </Section>
      </div>
      <BreathWizard open={wiz} onClose={() => setWiz(false)} />
    </>
  );
}
