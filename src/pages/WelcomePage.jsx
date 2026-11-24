import { useState } from 'react';
import { ArrowRight, ArrowLeft, Camera, Hand, MessagesSquare, GraduationCap, Check, Globe, Sun, Type as TypeIcon } from 'lucide-react';
import Logo from '../components/ui/Logo.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import { Segmented } from '../components/ui/kit.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useT } from '../i18n/index.jsx';

const STEPS = ['intro', 'look', 'camera', 'ways'];

export default function WelcomePage({ go }) {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const finish = (to = 'home') => { patch(null, { onboarded: true }); go(to); };
  return (
    <main id="main" className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-5 py-10">
      <div className="flex items-center gap-3"><Logo size={48} /><span className="font-display text-[1.6rem] font-semibold">SignBridge</span>
        <button type="button" className="ml-auto rounded-xl px-4 py-3 font-semibold text-muted underline" onClick={() => finish()}>{t('common.skip')}</button>
      </div>

      <div className="flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={i + 1} aria-label={t('welcome.progress', { i: i + 1, n: STEPS.length })}>
        {STEPS.map((s, k) => <span key={s} className={`h-2 flex-1 rounded-full ${k <= i ? 'bg-primary' : 'bg-rule'}`} />)}
      </div>

      <section className="surface animate-rise p-6 sm:p-10" aria-live="polite">
        {step === 'intro' && (
          <div className="grid gap-5">
            <Hand className="h-14 w-14 text-primary" aria-hidden />
            <h1 className="text-[clamp(1.9rem,4.5vw,2.8rem)] leading-tight">{t('welcome.intro.title')}</h1>
            <p className="text-[1.1rem] leading-relaxed text-muted">{t('welcome.intro.text')}</p>
            <div className="grid gap-3">
              <p className="flex items-center gap-2 font-semibold"><Globe className="h-5 w-5" aria-hidden /> {t('set.lang')}</p>
              <Segmented label={t('set.lang')} value={settings.lang} onChange={(v) => patch(null, { lang: v })} options={[{ id: 'vi', label: t('lang.vi') }, { id: 'en', label: t('lang.en') }]} />
            </div>
          </div>
        )}
        {step === 'look' && (
          <div className="grid gap-6">
            <h1 className="text-[clamp(1.7rem,4vw,2.4rem)] leading-tight">{t('welcome.look.title')}</h1>
            <p className="text-[1.05rem] leading-relaxed text-muted">{t('welcome.look.text')}</p>
            <div className="grid gap-3"><p className="flex items-center gap-2 font-semibold"><Sun className="h-5 w-5" aria-hidden /> {t('set.theme')}</p>
              <Segmented label={t('set.theme')} value={settings.theme} onChange={(v) => patch(null, { theme: v })} options={['system', 'light', 'dark', 'hc'].map((x) => ({ id: x, label: t(`theme.${x}`) }))} /></div>
            <div className="grid gap-3"><p className="flex items-center gap-2 font-semibold"><TypeIcon className="h-5 w-5" aria-hidden /> {t('set.fs')}</p>
              <Segmented label={t('set.fs')} value={settings.fs} onChange={(v) => patch(null, { fs: v })} options={['s', 'm', 'l', 'xl'].map((x) => ({ id: x, label: t(`fs.${x}`) }))} /></div>
          </div>
        )}
        {step === 'camera' && (
          <div className="grid gap-5">
            <Camera className="h-14 w-14 text-primary" aria-hidden />
            <h1 className="text-[clamp(1.7rem,4vw,2.4rem)] leading-tight">{t('welcome.camera.title')}</h1>
            <ul className="grid gap-3 text-[1.05rem] leading-relaxed">
              {['light', 'distance', 'private', 'one'].map((k) => (
                <li key={k} className="flex items-start gap-3"><Check className="mt-1 h-5 w-5 shrink-0 text-ok" aria-hidden /><span>{t(`welcome.camera.${k}`)}</span></li>
              ))}
            </ul>
          </div>
        )}
        {step === 'ways' && (
          <div className="grid gap-5">
            <h1 className="text-[clamp(1.7rem,4vw,2.4rem)] leading-tight">{t('welcome.ways.title')}</h1>
            <p className="text-muted">{t('welcome.ways.text')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <BigButton size="lg" variant="primary" icon={MessagesSquare} onClick={() => finish('recognize')}>{t('welcome.ways.talk')}</BigButton>
              <BigButton size="lg" icon={GraduationCap} onClick={() => finish('learn')}>{t('welcome.ways.learn')}</BigButton>
            </div>
          </div>
        )}
      </section>

      <div className="flex justify-between gap-3">
        <BigButton icon={ArrowLeft} disabled={i === 0} onClick={() => setI((x) => x - 1)}>{t('common.back')}</BigButton>
        {i < STEPS.length - 1
          ? <BigButton variant="primary" icon={ArrowRight} onClick={() => setI((x) => x + 1)}>{t('common.next')}</BigButton>
          : <BigButton variant="primary" icon={Check} onClick={() => finish()}>{t('welcome.finish')}</BigButton>}
      </div>
    </main>
  );
}
