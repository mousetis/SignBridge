import { useMemo, useState } from 'react';
import { Volume2, VolumeX, Delete, Eraser, SpaceIcon, Video, VideoOff, Sparkles, Brain, Send, History, MessageSquarePlus, BookMarked, Maximize2, SpellCheck, Circle, X } from 'lucide-react';
import CameraView from '../components/camera/CameraView.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import { Segmented, Badge } from '../components/ui/kit.jsx';
import ChatThread from '../components/chat/ChatThread.jsx';
import HistoryDialog from '../components/chat/HistoryDialog.jsx';
import WordsDialog from '../components/chat/WordsDialog.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useTTS } from '../hooks/useSpeech.js';
import { useSignInput, CONF_THR, MARGIN_THR } from '../hooks/useSignInput.js';
import { useConversation } from '../hooks/useConversation.js';
import { suggest, applySuggestion } from '../lib/ml/assembly.js';
import { autocorrect, loadFreq, bumpFreq } from '../lib/smart.js';
import { useT } from '../i18n/index.jsx';

export default function RecognizePage() {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const { notify } = useToast();
  const tts = useTTS({ lang: settings.speech.lang, rate: settings.speech.rate });
  const [cameraOn, setCameraOn] = useState(true);
  const [showHist, setShowHist] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [big, setBig] = useState(false);
  const mode = settings.recognition.mode;
  const unit = settings.recognition.unit;
  const input = useSignInput({ enabled: cameraOn, mode, unit });
  const conv = useConversation('sign');
  const { text, live, flash, engine, wordLive, rec } = input;
  const names = { me: t('chat.me'), other: t('chat.other') };

  const suggestions = useMemo(() => (unit === 'letters' ? suggest(text, loadFreq()) : []), [text, unit]);
  const fix = useMemo(() => autocorrect(text), [text]);
  const confident = live.present && live.conf >= CONF_THR && (live.margin ?? 1) >= MARGIN_THR;
  const hintKey = !live.present ? 'rec.hintShow' : live.conf < 0.6 ? 'rec.hintWeak' : (live.margin ?? 1) < 0.15 ? 'rec.hintAmb' : live.progress >= 0.9 && !confident ? 'rec.hintClearer' : null;
  const border = !cameraOn ? 'idle' : rec?.phase === 'rec' ? 'bad' : flash ? 'ok' : unit === 'letters' && confident ? 'ok' : wordLive.state === 'collecting' ? 'warn' : 'idle';
  const modeKey = engine.staticSource === 'none' ? 'rec.model.none' : engine.staticSource === 'user' ? 'rec.model.user' : 'rec.model.bundled';
  const dyn = live.dyn;

  const send = (speak = false) => {
    const m = conv.send('me', text, unit === 'words' ? 'sign' : 'sign');
    if (!m) return;
    input.clear();
    if (speak || settings.speech.auto) tts.speak(m.text);
  };
  const useSuggestion = (s) => {
    bumpFreq(s.key);
    input.set(applySuggestion(text, s));
  };

  return (
    <>
      <PageHeader kicker={t('rec.kicker')} title={t('rec.title')}>{unit === 'words' ? t('rec.leadWords') : t('rec.lead')}</PageHeader>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <section aria-label={t('common.camera')} className="flex flex-col gap-4">
          <CameraView enabled={cameraOn} onFrame={input.onFrame} border={border} maxHands={unit === 'words' ? 2 : 1}>
            {cameraOn && unit === 'letters' && !rec && (
              <div className="absolute bottom-5 left-5 right-5 flex items-end gap-3">
                <div className={`flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 font-display text-[3.6rem] font-semibold leading-none transition-colors sm:h-28 sm:w-28 sm:text-[4.4rem] ${confident ? 'border-ok bg-ok text-paper' : 'border-white/20 bg-stage/80 text-onstage backdrop-blur'}`} aria-label={t('rec.current', { c: live.top || t('rec.none') })}>
                  {live.present ? live.top || '?' : '–'}
                </div>
                <div className="flex-1 rounded-2xl bg-stage/80 p-3 text-onstage backdrop-blur">
                  <ProgressBar value={live.progress} label={t('rec.holdToCommit', { p: Math.round(CONF_THR * 100) })} color={confident ? 'bg-ok' : 'bg-primary'} className="[&_*]:!text-onstage" />
                  <ProgressBar className="mt-2 [&_*]:!text-onstage" value={live.conf} label={t('rec.certainty')} color={confident ? 'bg-ok' : 'bg-marker'} />
                  {hintKey && <p className="mt-2 text-[0.9rem] font-semibold leading-snug text-[#FFD66B]" role="status">{t(hintKey)}</p>}
                </div>
              </div>
            )}
            {cameraOn && unit === 'words' && !rec && (
              <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-center gap-3 rounded-2xl bg-stage/80 p-3 text-onstage backdrop-blur">
                <span className={`inline-flex h-3.5 w-3.5 rounded-full ${wordLive.state === 'collecting' ? 'animate-pulse bg-marker' : 'bg-white/40'}`} aria-hidden />
                <span className="flex-1 font-semibold">
                  {wordLive.state === 'collecting' ? t('rec.collecting') : wordLive.ambiguous ? t('rec.ambiguous', { a: wordLive.ambiguous }) : wordLive.last?.key === null ? t('rec.unknownWord') : wordLive.last?.display ? `✓ ${wordLive.last.display}` : input.wordCount ? t('rec.idleWord') : t('rec.noWords')}
                </span>
                <Badge tone="neutral">{t('rec.wordsCount', { n: input.wordCount })}</Badge>
              </div>
            )}
            {rec && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-stage/60 p-6 text-center text-onstage backdrop-blur-sm">
                {rec.phase === 'count' && <p className="font-display text-[1.6rem] font-semibold">{t('words.countdown', { w: rec.display })}</p>}
                {rec.phase === 'rec' && <p className="flex items-center gap-3 font-display text-[1.6rem] font-semibold text-[#ff8a8a]"><Circle className="h-6 w-6 animate-pulse fill-current" aria-hidden />{t('words.recording', { w: rec.display })}</p>}
                {rec.phase === 'done' && <p className="font-display text-[2rem] font-semibold text-[#6ee7a8]">{t('words.done')}</p>}
                {rec.phase !== 'done' && <p className="font-display text-[6rem] font-bold leading-none tabular-nums">{rec.left}</p>}
                {rec.phase === 'count' && <BigButton icon={X} variant="secondary" onClick={input.cancelRecord}>{t('words.cancel')}</BigButton>}
              </div>
            )}
            {flash && !rec && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ok/20">
                <span className="animate-pop rounded-3xl bg-marker px-10 py-3 font-display text-7xl font-semibold text-[#101428] shadow-lift">{flash}</span>
              </div>
            )}
          </CameraView>

          <div className="flex flex-wrap items-center gap-3">
            <BigButton icon={cameraOn ? VideoOff : Video} variant={cameraOn ? 'secondary' : 'primary'} onClick={() => setCameraOn((v) => !v)}>
              {cameraOn ? t('common.cameraOff') : t('common.cameraOn')}
            </BigButton>
            <Segmented label={t('rec.unit')} value={unit} onChange={(v) => patch('recognition', { unit: v })} options={[{ id: 'letters', label: t('rec.letters') }, { id: 'words', label: t('rec.words') }]} />
            {unit === 'letters' ? (
              <Segmented label={t('rec.mode')} value={mode} onChange={(v) => patch('recognition', { mode: v })} options={[{ id: 'auto', label: t('rec.modeAuto') }, { id: 'letters', label: t('rec.modeLetters') }, { id: 'digits', label: t('rec.modeDigits') }]} />
            ) : (
              <BigButton icon={BookMarked} variant="primary" onClick={() => setShowWords(true)}>{t('rec.myWords')}</BigButton>
            )}
          </div>

          <div className="surface flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 text-[0.93rem]">
            <Brain className="h-5 w-5 text-accent" aria-hidden />
            <span className="font-bold">{t(modeKey)}</span>
            <span className="text-muted">· {t('rec.backendInfo', { b: engine.backend || '…', w: engine.mode === 'worker' ? t('rec.worker') : '' })}</span>
            {engine.userSamples > 0 && <span className="text-muted">· {t('rec.samples', { n: engine.userSamples })}</span>}
            {engine.staticSource === 'bundled' && !engine.userSamples && <a href="#/train" className="font-bold text-accent underline underline-offset-4">{t('rec.calibrate')}</a>}
            {dyn?.candidate && <Badge tone="marker" icon={Sparkles} className="ml-auto">{t('rec.dynTrack', { c: dyn.candidate })} {dyn.conf > 0 ? `(${Math.round(dyn.conf * 100)}%)` : ''}</Badge>}
          </div>
          {unit === 'letters' && <p className="text-[0.92rem] leading-relaxed text-muted">{t('rec.tip')}</p>}
        </section>

        <section aria-label={t('rec.result')} className="flex min-h-0 flex-col gap-4">
          <Card className="flex flex-col !p-0">
            <div className="flex items-center justify-between gap-2 border-b border-rule px-4 py-2.5">
              <p className="kicker">{t('chat.thread')}</p>
              <div className="flex gap-1.5">
                <BigButton size="sm" iconOnly icon={Maximize2} aria-label={t('rec.fullscreen')} title={t('rec.fullscreen')} onClick={() => setBig(true)} />
                <BigButton size="sm" iconOnly icon={History} aria-label={t('rec.history')} title={t('rec.history')} onClick={() => setShowHist(true)} />
                <BigButton size="sm" iconOnly icon={MessageSquarePlus} aria-label={t('rec.newChat')} title={t('rec.newChat')} onClick={conv.reset} />
              </div>
            </div>
            <ChatThread messages={conv.messages} names={names} onSpeak={tts.supported ? tts.speak : undefined} onRemove={conv.remove} className="h-[260px] p-4" />
            <div className="border-t border-rule p-4">
              <div className="min-h-[88px] whitespace-pre-wrap break-words rounded-2xl border-2 border-line bg-paper p-4 font-display text-[2rem] font-semibold leading-[1.15]" aria-live="polite" aria-label={t('rec.result')}>
                {text || <span className="font-sans text-[1.15rem] font-medium text-muted">{t('rec.waiting')}</span>}
                <span className="ml-1 inline-block h-7 w-1 translate-y-1 animate-pulse bg-primary" aria-hidden />
              </div>
              {unit === 'letters' && <ProgressBar className="mt-3" value={input.pause} label={input.pause > 0 ? t('rec.pauseSoon') : t('rec.pauseTimer')} color="bg-marker" />}
              {(suggestions.length > 0 || (fix.changes.length > 0 && fix.text !== text.trim())) && (
                <div className="mt-3 flex flex-wrap items-center gap-2" aria-label={t('rec.suggest')}>
                  <Sparkles className="h-5 w-5 text-accent" aria-hidden />
                  {suggestions.map((s) => <BigButton key={s.key} size="sm" onClick={() => useSuggestion(s)}>{s.display}</BigButton>)}
                  {fix.changes.length > 0 && fix.text !== text.trim() && (
                    <BigButton size="sm" variant="warn" icon={SpellCheck} onClick={() => { input.set(`${fix.text} `); notify(t('rec.fixed', { c: fix.changes.map((c) => `${c.from}→${c.to}`).join(', ') }), 'ok'); }}>{t('rec.fix')}: {fix.changes.map((c) => c.to).join(', ')}</BigButton>
                  )}
                </div>
              )}
            </div>
          </Card>

          <div className="flex flex-wrap gap-3">
            <BigButton icon={Send} variant="primary" disabled={!text.trim()} onClick={() => send(false)}>{t('rec.send')}</BigButton>
            <BigButton icon={Volume2} disabled={!text.trim() || !tts.supported} onClick={() => send(true)}>{t('rec.sendSpeak')}</BigButton>
            <BigButton icon={tts.speaking ? VolumeX : Volume2} variant="ghost" disabled={!tts.speaking} onClick={tts.cancel}>{t('common.stopSpeak')}</BigButton>
            <BigButton icon={SpaceIcon} onClick={input.space}>{t('rec.space')}</BigButton>
            <BigButton icon={Delete} variant="warn" onClick={input.backspace}>{t('rec.back')}</BigButton>
            <BigButton icon={Eraser} variant="bad" onClick={() => { input.clear(); notify(t('toast.cleared'), 'info', 2000); }}>{t('common.clear')}</BigButton>
          </div>
          {!tts.supported && <p className="font-bold text-warn">{t('rec.ttsNo')}</p>}
        </section>
      </div>

      <HistoryDialog open={showHist} onClose={() => setShowHist(false)} names={names} />
      <WordsDialog open={showWords} onClose={() => setShowWords(false)} input={input} />
      <Dialog open={big} onClose={() => setBig(false)} title={t('rec.fullscreen')} wide>
        <ChatThread messages={conv.messages} names={names} onSpeak={tts.supported ? tts.speak : undefined} big className="max-h-[70vh]" />
        <p className="mt-4 break-words font-display text-[3rem] font-semibold leading-tight">{text}</p>
      </Dialog>
    </>
  );
}
