import { useEffect, useState } from 'react';
import {
  Home, Camera, Languages, MessagesSquare, Captions, GraduationCap, BookA, Brain, Users, SlidersHorizontal, HelpCircle,
  Sun, Moon, Contrast, Globe, Type, ScanLine, MoreHorizontal, WifiOff, ChevronDown,
} from 'lucide-react';
import ConnectionBar from '../esp32/ConnectionBar.jsx';
import Logo from '../ui/Logo.jsx';
import Dialog from '../ui/Dialog.jsx';
import { Avatar } from '../ui/kit.jsx';
import ProfileDialog from './ProfileDialog.jsx';
import ScanHost from './ScanHost.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { useT } from '../../i18n/index.jsx';

export const NAV = [
  { id: 'home', icon: Home, group: 'main' },
  { id: 'recognize', icon: Camera, group: 'talk' },
  { id: 'converse', icon: MessagesSquare, group: 'talk' },
  { id: 'text', icon: Languages, group: 'talk' },
  { id: 'captions', icon: Captions, group: 'talk' },
  { id: 'learn', icon: GraduationCap, group: 'learn' },
  { id: 'dict', icon: BookA, group: 'learn' },
  { id: 'train', icon: Brain, group: 'learn' },
  { id: 'teacher', icon: Users, group: 'more' },
  { id: 'settings', icon: SlidersHorizontal, group: 'more' },
  { id: 'welcome', icon: HelpCircle, group: 'more' },
];
const GROUPS = ['main', 'talk', 'learn', 'more'];
const TABS = ['home', 'recognize', 'text', 'learn'];
const THEME_ORDER = ['system', 'light', 'dark', 'hc'];
const FS_ORDER = ['s', 'm', 'l', 'xl'];

function NavButton({ n, on, go, t, tab = false }) {
  const Icon = n.icon;
  return tab ? (
    <button type="button" onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
      className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[0.78rem] font-semibold ${on ? 'text-primary' : 'text-muted'}`}>
      <span className={`flex h-8 w-14 items-center justify-center rounded-full transition ${on ? 'bg-primary/15' : ''}`}><Icon className="h-6 w-6" aria-hidden /></span>
      <span className="leading-none">{t(`nav.${n.id}`)}</span>
    </button>
  ) : (
    <button type="button" onClick={() => go(n.id)} aria-current={on ? 'page' : undefined}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3.5 text-left text-[1.02rem] font-semibold transition ${on ? 'bg-primary text-primary-on shadow-lift' : 'text-ink hover:bg-card'}`}>
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1 leading-tight">{t(`nav.${n.id}`)}</span>
    </button>
  );
}

function QuickControls({ className = '' }) {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const cycle = (list, v) => list[(list.indexOf(v) + 1) % list.length];
  const ThemeIcon = settings.theme === 'dark' ? Moon : settings.theme === 'hc' ? Contrast : Sun;
  const btn = 'inline-flex h-12 min-w-11 items-center justify-center gap-1 rounded-xl border border-rule bg-card px-2 text-[0.82rem] font-bold text-ink hover:bg-card2';
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className}`}>
      <button type="button" className={btn} title={`${t('quick.theme')}: ${t(`theme.${settings.theme}`)}`} aria-label={`${t('quick.theme')}: ${t(`theme.${settings.theme}`)}`} onClick={() => patch(null, { theme: cycle(THEME_ORDER, settings.theme) })}>
        <ThemeIcon className="h-5 w-5" aria-hidden />{settings.theme === 'system' && <span aria-hidden>A</span>}
      </button>
      <button type="button" className={btn} title={t('quick.lang')} aria-label={`${t('quick.lang')}: ${settings.lang === 'en' ? 'English' : 'Tiếng Việt'}`} onClick={() => patch(null, { lang: settings.lang === 'en' ? 'vi' : 'en' })}>
        <Globe className="h-5 w-5" aria-hidden />{settings.lang === 'en' ? 'EN' : 'VI'}
      </button>
      <button type="button" className={btn} title={`${t('quick.font')}: ${t(`fs.${settings.fs}`)}`} aria-label={`${t('quick.font')}: ${t(`fs.${settings.fs}`)}`} onClick={() => patch(null, { fs: cycle(FS_ORDER, settings.fs) })}>
        <Type className="h-5 w-5" aria-hidden />{settings.fs.toUpperCase()}
      </button>
      <button type="button" className={`${btn} ${settings.scan.enabled ? '!border-primary !bg-primary !text-primary-on' : ''}`} aria-pressed={settings.scan.enabled} title={t('quick.scan')} aria-label={t('quick.scan')} onClick={() => patch('scan', { enabled: !settings.scan.enabled })}>
        <ScanLine className="h-5 w-5" aria-hidden />
      </button>
    </div>
  );
}

function ProfileChip({ onOpen, className = '' }) {
  const { t } = useT();
  const { profiles } = useSettings();
  const p = profiles.active;
  return (
    <button type="button" onClick={onOpen} aria-label={`${t('quick.profile')}: ${p.name}`} className={`flex min-h-[56px] items-center gap-3 rounded-2xl border border-rule bg-card px-3 text-left hover:bg-card2 ${className}`}>
      <Avatar name={p.name} color={p.color} size={36} />
      <span className="min-w-0 flex-1 truncate font-display font-semibold">{p.name}</span>
      <ChevronDown className="h-5 w-5 text-muted" aria-hidden />
    </button>
  );
}

function useSwUpdate() {
  const [reg, setReg] = useState(null);
  useEffect(() => {
    const h = (e) => setReg(e.detail);
    window.addEventListener('sb-sw-update', h);
    return () => window.removeEventListener('sb-sw-update', h);
  }, []);
  return reg;
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

export default function AppShell({ route, go, children, bare = false }) {
  const { t } = useT();
  const online = useOnline();
  const swUpdate = useSwUpdate();
  const [more, setMore] = useState(false);
  const [prof, setProf] = useState(false);
  const goClose = (id) => { setMore(false); go(id); };

  useEffect(() => { document.getElementById('main')?.focus?.({ preventScroll: true }); window.scrollTo?.(0, 0); }, [route]);

  if (bare) return <>{children}<ScanHost /></>;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[296px_minmax(0,1fr)]">
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:font-bold focus:text-primary-on">{t('nav.skip')}</a>

      {/* Thanh trên (điện thoại / máy tính bảng) */}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-paper/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button type="button" onClick={() => go('home')} className="flex items-center gap-2.5" aria-label={t('nav.home')}>
          <Logo size={34} />
          <span className="hidden font-display text-[1.25rem] font-semibold tracking-tight min-[520px]:inline">SignBridge</span>
        </button>
        <span className="flex-1" />
        <QuickControls />
        <button type="button" onClick={() => setProf(true)} aria-label={t('quick.profile')}><ProfileAvatar /></button>
      </header>

      {/* Thanh bên (máy tính) */}
      <aside className="hidden flex-col gap-5 overflow-y-auto border-r border-rule bg-card2/60 p-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <button type="button" onClick={() => go('home')} className="flex items-center gap-3.5 text-left" aria-label={t('nav.home')}>
          <Logo />
          <span>
            <span className="block font-display text-[1.65rem] font-semibold leading-none tracking-tight">SignBridge</span>
            <span className="mt-1 block text-[0.8rem] font-medium leading-tight text-muted">{t('app.tagline')}</span>
          </span>
        </button>
        <ProfileChip onOpen={() => setProf(true)} />
        <nav aria-label={t('nav.aria')} className="grid gap-4">
          {GROUPS.map((g) => (
            <div key={g} className="grid gap-1">
              {g !== 'main' && <p className="kicker px-3.5 pb-1 pt-2">{t(`nav.group.${g}`)}</p>}
              {NAV.filter((n) => n.group === g).map((n) => <NavButton key={n.id} n={n} on={route === n.id} go={go} t={t} />)}
            </div>
          ))}
        </nav>
        <div className="mt-auto grid gap-4">
          <QuickControls />
          <ConnectionBar />
        </div>
      </aside>

      <main id="main" tabIndex={-1} className="min-w-0 px-4 pb-28 pt-6 outline-none sm:px-8 lg:px-12 lg:pb-12 lg:pt-10">
        {!online && (
          <div role="status" className="mb-5 flex items-center gap-3 rounded-2xl border border-warn bg-warn-soft px-4 py-3 font-semibold"><WifiOff className="h-5 w-5" aria-hidden />{t('offline.banner')}</div>
        )}
        {swUpdate && (
          <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-info bg-info-soft px-4 py-3 font-semibold">
            {t('update.available')}
            <button type="button" className="min-h-[48px] rounded-xl bg-primary px-4 font-display text-primary-on" onClick={() => { swUpdate.waiting?.postMessage('skipWaiting'); }}>{t('update.reload')}</button>
          </div>
        )}
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>

      {/* Thanh dưới (điện thoại) */}
      <nav aria-label={t('nav.aria')} className="fixed inset-x-0 bottom-0 z-30 flex border-t border-rule bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => TABS.includes(n.id)).map((n) => <NavButton key={n.id} n={n} on={route === n.id} go={go} t={t} tab />)}
        <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={`flex min-h-[64px] flex-1 flex-col items-center justify-center gap-1 text-[0.78rem] font-semibold ${!TABS.includes(route) ? 'text-primary' : 'text-muted'}`}>
          <span className={`flex h-8 w-14 items-center justify-center rounded-full ${!TABS.includes(route) ? 'bg-primary/15' : ''}`}><MoreHorizontal className="h-6 w-6" aria-hidden /></span>
          <span className="leading-none">{t('nav.more')}</span>
        </button>
      </nav>

      <Dialog open={more} onClose={() => setMore(false)} title={t('nav.menu')}>
        <div className="grid gap-1">
          {NAV.filter((n) => !TABS.includes(n.id)).map((n) => <NavButton key={n.id} n={n} on={route === n.id} go={goClose} t={t} />)}
        </div>
        <div className="mt-5"><ConnectionBar compact /></div>
      </Dialog>
      <ProfileDialog open={prof} onClose={() => setProf(false)} />
      <ScanHost />
    </div>
  );
}

function ProfileAvatar() {
  const { profiles } = useSettings();
  return <Avatar name={profiles.active.name} color={profiles.active.color} size={44} />;
}
