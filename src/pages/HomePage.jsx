import { useMemo } from 'react';
import { ScanLine, Type, MessagesSquare, Captions, GraduationCap, BookOpen, SlidersHorizontal, Flame, Play, Sparkles } from 'lucide-react';
import { Badge } from '../components/ui/kit.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { load as loadProgress, liveStreak, todayXp, levelOf, dueItems } from '../lib/learn/progress.js';
import { useT } from '../i18n/index.jsx';

const TILES = [
  { r: 'recognize', icon: ScanLine, tone: 'bg-primary text-primary-on', big: true },
  { r: 'text', icon: Type, tone: 'bg-card' },
  { r: 'converse', icon: MessagesSquare, tone: 'bg-card' },
  { r: 'captions', icon: Captions, tone: 'bg-card' },
  { r: 'learn', icon: GraduationCap, tone: 'bg-card' },
  { r: 'dict', icon: BookOpen, tone: 'bg-card' },
  { r: 'train', icon: SlidersHorizontal, tone: 'bg-card' },
];

export default function HomePage({ go }) {
  const { t } = useT();
  const { settings, profiles } = useSettings();
  const p = useMemo(() => loadProgress(), []);
  const due = dueItems(p).length;
  const streak = liveStreak(p);
  const today = todayXp(p);
  return (
    <div className="grid gap-8">
      <section className="surface relative overflow-hidden p-6 sm:p-10">
        <div className="relative z-10 max-w-2xl">
          <p className="kicker">{t('home.hello', { name: profiles.active.name })}</p>
          <h1 className="mt-2 text-[clamp(2rem,5vw,3.4rem)] leading-[1.05]">{t('home.title')}</h1>
          <p className="mt-4 text-[1.1rem] leading-relaxed text-muted">{t('home.lead')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <BigButton size="lg" variant="primary" icon={ScanLine} onClick={() => go('recognize')}>{t('home.ctaRecognize')}</BigButton>
            <BigButton size="lg" icon={MessagesSquare} onClick={() => go('converse')}>{t('home.ctaConverse')}</BigButton>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full bg-marker/25 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-16 right-24 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
      </section>

      <section aria-label={t('home.today')} className="grid gap-4 md:grid-cols-3">
        <button type="button" onClick={() => go('learn')} className="surface flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
          <Flame className={`h-9 w-9 ${streak ? 'text-warn' : 'text-muted'}`} aria-hidden />
          <div><p className="kicker">{t('learn.streak')}</p><p className="font-display text-[1.5rem] font-semibold">{streak} {t('learn.days')}</p></div>
        </button>
        <button type="button" onClick={() => go('learn')} className="surface p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
          <p className="kicker">{t('learn.daily')} · {t('common.level')} {levelOf(p.xp)}</p>
          <ProgressBar className="mt-2" big value={Math.min(1, today / p.goal)} label={`${today}/${p.goal} XP`} color="bg-ok" />
        </button>
        <button type="button" onClick={() => go('learn')} className="surface flex items-center gap-4 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lift">
          <Sparkles className="h-9 w-9 text-primary" aria-hidden />
          <div><p className="kicker">{t('learn.tab.review')}</p><p className="font-display text-[1.5rem] font-semibold">{due ? t('home.due', { n: due }) : t('home.dueNone')}</p></div>
        </button>
      </section>

      <section aria-label={t('nav.aria')}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map(({ r, icon: Icon, tone, big }) => (
            <li key={r} className={big ? 'sm:col-span-2' : ''}>
              <button type="button" onClick={() => go(r)} className={`${tone} group flex h-full min-h-[148px] w-full flex-col items-start justify-between gap-6 rounded-3xl border border-rule p-5 text-left shadow-card transition hover:-translate-y-1 hover:shadow-lift`}>
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${big ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}><Icon className="h-6 w-6" aria-hidden /></span>
                <span>
                  <span className="block font-display text-[1.3rem] font-semibold leading-tight">{t(`nav.${r}`)}</span>
                  <span className={`mt-1 block text-[0.93rem] leading-snug ${big ? 'opacity-90' : 'text-muted'}`}>{t(`home.d.${r}`)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="surface flex flex-wrap items-center gap-4 p-5">
        <Badge tone="info">{t('home.tipTitle')}</Badge>
        <p className="min-w-[240px] flex-1 leading-relaxed">{t('home.tip')}</p>
        <BigButton size="sm" icon={Play} onClick={() => go('welcome')}>{t('nav.welcome')}</BigButton>
        {!settings.onboarded && <Badge tone="warn">{t('home.new')}</Badge>}
      </section>
    </div>
  );
}
