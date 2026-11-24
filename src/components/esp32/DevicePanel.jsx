import { useRef, useState } from 'react';
import { Plug, Unplug, RefreshCw, Radar, CheckCircle2, X, HardDrive } from 'lucide-react';
import { useEsp32 } from '../../context/Esp32Context.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { normalizeWsUrl } from '../../lib/esp32/protocol.js';
import { candidateHosts, scan } from '../../lib/esp32/discover.js';
import BigButton from '../ui/BigButton.jsx';
import StatusLight from '../ui/StatusLight.jsx';
import ProgressBar from '../ui/ProgressBar.jsx';
import { Badge, FIELD, Field } from '../ui/kit.jsx';
import TelemetryPanel from './TelemetryPanel.jsx';
import { useT } from '../../i18n/index.jsx';

/** Nội dung kết nối ESP32-S3: nhập IP, dò thiết bị trong mạng, thiết bị đã lưu, theo dõi Joystick / áp suất. */
export default function DevicePanel({ showTelemetry = true }) {
  const { t } = useT();
  const { snap, connect, disconnect, rememberDevice } = useEsp32();
  const { settings, patch } = useSettings();
  const [ip, setIp] = useState(settings.ip);
  const [scanState, setScanState] = useState(null); // null | { done, total, found:[] , running }
  const abort = useRef(null);
  const connected = snap.state === 'connected';
  const busy = snap.state === 'connecting';
  const active = connected || busy || snap.reconnectIn > 0;
  const url = normalizeWsUrl(ip, { port: settings.port, path: settings.path });

  const submit = (e) => {
    e.preventDefault();
    if (connect(ip)) rememberDevice(ip);
  };

  const runScan = async () => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const hosts = candidateHosts({ hint: settings.ip, saved: settings.devices, pageHost: location.hostname });
    setScanState({ done: 0, total: hosts.length, found: [], running: true });
    const found = await scan({
      hosts, port: settings.port, path: settings.path, timeoutMs: 900, concurrency: 28, signal: ctl.signal,
      onProgress: (done, total) => setScanState((s) => (s ? { ...s, done, total } : s)),
      onFound: (r) => setScanState((s) => (s ? { ...s, found: [...s.found, r] } : s)),
    });
    setScanState((s) => ({ ...(s || {}), found, running: false, done: hosts.length, total: hosts.length }));
  };
  const stopScan = () => {
    abort.current?.abort();
    setScanState((s) => (s ? { ...s, running: false } : s));
  };
  const useFound = (h) => {
    setIp(h.host);
    patch(null, { port: h.port, path: h.path });
    connect(h.host, { port: h.port, path: h.path });
    rememberDevice(h.host);
  };

  return (
    <div className="grid gap-6">
      <form onSubmit={submit} aria-label={t('esp.formAria')} className="grid gap-4">
        <Field label={t('esp.ip')}>
          <input value={ip} onChange={(e) => setIp(e.target.value)} disabled={connected || busy} inputMode="url" placeholder="192.168.1.100" spellCheck={false} className={FIELD} aria-describedby="ws-url" />
        </Field>
        <p id="ws-url" className="-mt-2 text-[0.95rem] text-muted">
          {t('esp.willConnect')} <code className="rounded-md bg-card2 px-2 py-0.5 font-mono text-ink">{url || t('esp.invalid')}</code>
          {snap.error && !connected && <span className="mt-1 block font-semibold text-bad">{snap.error}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {active ? (
            <BigButton key="d" icon={Unplug} variant="bad" onClick={disconnect}>{t('esp.disconnect')}</BigButton>
          ) : (
            <BigButton key="c" type="submit" icon={Plug} variant="primary">{t('esp.connect')}</BigButton>
          )}
          <StatusLight state={snap.state} stale={snap.stale} extra={connected ? t('device.rate', { n: snap.rate }) : undefined} />
          {snap.reconnectIn > 0 && (
            <span className="inline-flex items-center gap-2 font-semibold text-warn"><RefreshCw className="h-5 w-5 animate-spin" aria-hidden /> {t('device.retry')}</span>
          )}
        </div>
      </form>

      <div className="rounded-2xl border border-rule bg-card2/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[1.1rem]">{t('esp.discover')}</h3>
            <p className="text-[0.92rem] text-muted">{t('esp.discoverHint')}</p>
          </div>
          {scanState?.running ? (
            <BigButton icon={X} variant="warn" onClick={stopScan}>{t('common.stop')}</BigButton>
          ) : (
            <BigButton icon={Radar} variant="primary" disabled={active} onClick={runScan}>{t('esp.scan')}</BigButton>
          )}
        </div>
        {scanState && (
          <div className="mt-4 grid gap-3">
            {scanState.running && <ProgressBar value={scanState.total ? scanState.done / scanState.total : 0} label={`${t('esp.scanning')} ${scanState.done}/${scanState.total}`} />}
            {scanState.found.length === 0 && !scanState.running && <p className="font-semibold text-muted">{t('esp.noneFound')}</p>}
            {scanState.found.map((h) => (
              <div key={h.host} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ok bg-ok-soft px-4 py-3">
                <span className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-5 w-5 text-ok" aria-hidden /> {h.host}:{h.port}{h.path}
                  <Badge tone={h.telemetry ? 'ok' : 'warn'}>{h.telemetry ? t('esp.isBoard') : t('esp.isWs')}</Badge></span>
                <BigButton size="sm" variant="primary" icon={Plug} onClick={() => useFound(h)}>{t('esp.connect')}</BigButton>
              </div>
            ))}
          </div>
        )}
        {settings.devices?.length > 0 && (
          <div className="mt-4">
            <p className="kicker mb-2">{t('esp.saved')}</p>
            <div className="flex flex-wrap gap-2">
              {settings.devices.map((d) => (
                <BigButton key={d} size="sm" icon={HardDrive} onClick={() => { setIp(d); if (!active) connect(d); }}>{d}</BigButton>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('esp.port')}>
          <input type="number" value={settings.port} onChange={(e) => patch(null, { port: Number(e.target.value) || 81 })} className={FIELD} />
        </Field>
        <Field label={t('esp.path')}>
          <input value={settings.path} onChange={(e) => patch(null, { path: e.target.value || '/ws' })} className={FIELD} />
        </Field>
      </div>
      <label className="flex min-h-[64px] cursor-pointer items-center gap-4 rounded-2xl border-2 border-line bg-card px-4 text-[1.02rem] font-semibold">
        <input type="checkbox" className="h-7 w-7 accent-[rgb(var(--primary))]" checked={settings.autoConnect} onChange={(e) => patch(null, { autoConnect: e.target.checked })} />
        {t('esp.auto')}
      </label>
      {showTelemetry && <TelemetryPanel />}
      <p className="rounded-xl bg-card2 p-4 text-[0.92rem] leading-relaxed text-muted">{t('esp.httpsNote')}</p>
    </div>
  );
}
