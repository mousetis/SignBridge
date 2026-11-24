import { useEffect, useRef, useState } from 'react';
import { Video, VideoOff, Send, Mic, MicOff, Maximize2, History, MessageSquarePlus } from 'lucide-react';
import CameraView from '../components/camera/CameraView.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import Toggle from '../components/ui/Toggle.jsx';
import Card from '../components/ui/Card.jsx';
import { FIELD } from '../components/ui/kit.jsx';
import ChatThread from '../components/chat/ChatThread.jsx';
import HistoryDialog from '../components/chat/HistoryDialog.jsx';
import Dialog from '../components/ui/Dialog.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSignInput } from '../hooks/useSignInput.js';
import { useConversation } from '../hooks/useConversation.js';
import { useSpeechRecognition, useTTS } from '../hooks/useSpeech.js';
import { beautify } from '../lib/smart.js';
import { useT } from '../i18n/index.jsx';

/** Hội thoại trực tiếp giữa người ký hiệu (camera → chữ) và người nghe (micro / bàn phím → chữ). */
export default function ConversePage() {
  const { t } = useT();
  const { settings, patch } = useSettings();
  const { notify } = useToast();
  const [cameraOn, setCameraOn] = useState(true);
  const [autoSend, setAutoSend] = useState(true);
  const [speakIn, setSpeakIn] = useState(true);
  const [draft, setDraft] = useState('');
  const [hist, setHist] = useState(false);
  const [big, setBig] = useState(false);
  const unit = settings.recognition.unit;
  const input = useSignInput({ enabled: cameraOn, mode: settings.recognition.mode, unit });
  const conv = useConversation('converse');
  const tts = useTTS({ lang: settings.speech.lang, rate: settings.speech.rate });
  const names = { me: t('chat.signer'), other: t('chat.hearer') };
  const textRef = useRef('');
  textRef.current = input.text;
  const speakRef = useRef(speakIn);
  speakRef.current = speakIn;

  const sendSigned = () => {
    const m = conv.send('me', textRef.current, 'sign');
    if (!m) return;
    input.clear();
    if (speakRef.current) tts.speak(m.text);
  };
  const sendRef = useRef(sendSigned);
  sendRef.current = sendSigned;

  // Tự gửi khi ngừng tay (ký tự) hoặc ngay sau mỗi từ nhận được
  useEffect(() => input.onCommit((kind) => {
    if (!autoSend) return;
    if (kind === 'space' || kind === 'word') setTimeout(() => sendRef.current(), kind === 'word' ? 700 : 50);
  }), [input, autoSend]);

  const sr = useSpeechRecognition({
    lang: settings.speech.lang,
    onFinal: (_n, raw) => raw && conv.send('other', raw, 'speech'),
    onError: (e) => notify(e === 'mic-denied' ? t('conv.micDenied') : t('common.error'), 'bad'),
  });
  const typed = (e) => {
    e.preventDefault();
    if (draft.trim()) { conv.send('other', draft, 'typed'); setDraft(''); }
  };

  return (
    <>
      <PageHeader kicker={t('conv.kicker')} title={t('conv.title')}>{t('conv.lead')}</PageHeader>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <section aria-label={t('conv.signer')} className="flex flex-col gap-4">
          <p className="kicker">{t('conv.signer')}</p>
          <CameraView enabled={cameraOn} onFrame={input.onFrame} maxHands={unit === 'words' ? 2 : 1} border={input.flash ? 'ok' : 'idle'} aspect="aspect-[16/11]" />
          <Card className="!p-4">
            <div className="min-h-[64px] break-words font-display text-[1.8rem] font-semibold leading-tight" aria-live="polite">
              {beautify(input.text) || <span className="font-sans text-[1.05rem] font-medium text-muted">{t('rec.waiting')}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <BigButton size="sm" icon={Send} variant="primary" disabled={!input.text.trim()} onClick={sendSigned}>{t('rec.send')}</BigButton>
              <BigButton size="sm" icon={cameraOn ? VideoOff : Video} onClick={() => setCameraOn((v) => !v)}>{cameraOn ? t('common.cameraOff') : t('common.cameraOn')}</BigButton>
            </div>
          </Card>
          <Toggle label={t('conv.autoSend')} checked={autoSend} onChange={setAutoSend} />
          <Toggle label={t('conv.speakIncoming')} checked={speakIn} onChange={setSpeakIn} />
        </section>

        <section aria-label={t('conv.hearer')} className="flex min-h-0 flex-col gap-4">
          <p className="kicker">{t('conv.hearer')}</p>
          <Card className="flex flex-col !p-0">
            <div className="flex items-center justify-end gap-1.5 border-b border-rule px-4 py-2.5">
              <BigButton size="sm" iconOnly icon={Maximize2} aria-label={t('conv.big')} title={t('conv.big')} onClick={() => setBig(true)} />
              <BigButton size="sm" iconOnly icon={History} aria-label={t('rec.history')} title={t('rec.history')} onClick={() => setHist(true)} />
              <BigButton size="sm" iconOnly icon={MessageSquarePlus} aria-label={t('rec.newChat')} title={t('rec.newChat')} onClick={conv.reset} />
            </div>
            <ChatThread messages={conv.messages} names={names} onSpeak={tts.supported ? tts.speak : undefined} onRemove={conv.remove} className="h-[360px] p-4" />
            {sr.listening && <p className="border-t border-rule px-5 py-2 text-[1.05rem] italic text-muted" aria-live="polite">🎤 {sr.interimRaw || t('conv.interim')}</p>}
            <form onSubmit={typed} className="flex flex-wrap gap-2 border-t border-rule p-3">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('conv.type')} className={`${FIELD} min-w-0 flex-1`} aria-label={t('conv.type')} />
              <BigButton type="submit" icon={Send} variant="primary" disabled={!draft.trim()}>{t('rec.send')}</BigButton>
              <BigButton icon={sr.listening ? MicOff : Mic} variant={sr.listening ? 'bad' : 'secondary'} disabled={!sr.supported} onClick={sr.toggle} aria-pressed={sr.listening}>{sr.listening ? t('conv.micStop') : t('conv.mic')}</BigButton>
            </form>
          </Card>
          {!sr.supported && <p className="font-semibold text-warn">{t('conv.noMic')}</p>}
        </section>
      </div>
      <HistoryDialog open={hist} onClose={() => setHist(false)} names={names} />
      <Dialog open={big} onClose={() => setBig(false)} title={t('conv.big')} wide>
        <ChatThread messages={conv.messages} names={names} onSpeak={tts.supported ? tts.speak : undefined} big className="max-h-[75vh]" />
      </Dialog>
    </>
  );
}
