import { useCallback, useEffect, useState } from 'react';
import { Circle, Trash2, Plus, Download, Upload, Info } from 'lucide-react';
import Dialog from '../ui/Dialog.jsx';
import BigButton from '../ui/BigButton.jsx';
import { Badge, FIELD } from '../ui/kit.jsx';
import { loadWords, removeWord, STARTER_WORDS, exportWords, importWords } from '../../lib/words/store.js';
import { normalizeForSign } from '../../lib/text.js';
import { downloadJson, pickJson } from '../../lib/backup.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useT } from '../../i18n/index.jsx';

/** Quản lý từ/cụm từ do CHÍNH BẠN ghi (không có dữ liệu ký hiệu dựng sẵn). Mỗi từ nên có 3–6 mẫu để nhận dạng ổn định. */
export default function WordsDialog({ open, onClose, input }) {
  const { t } = useT();
  const { notify } = useToast();
  const [words, setWords] = useState({});
  const [name, setName] = useState('');
  const refresh = useCallback(async () => setWords(await loadWords()), []);
  useEffect(() => { if (open) refresh(); }, [open, refresh, input.wordCount]);

  const rec = async (display) => {
    onClose();
    const r = await input.record(display);
    if (r.ok) notify(t('words.saved', { w: display, n: r.count }), 'ok');
    else notify(t('words.nohand'), 'warn');
    refresh();
  };
  const known = Object.entries(words);
  const starters = STARTER_WORDS.filter((w) => !words[normalizeForSign(w).trim()]);

  return (
    <Dialog open={open} onClose={onClose} title={t('words.title')} wide>
      <p className="mb-4 flex gap-3 rounded-2xl border border-info bg-info-soft p-3 text-[0.95rem] leading-relaxed"><Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /> {t('words.honest')}</p>
      <form className="mb-5 flex flex-wrap gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { rec(name.trim()); setName(''); } }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('words.newPlaceholder')} className={`${FIELD} flex-1`} aria-label={t('words.newPlaceholder')} />
        <BigButton type="submit" icon={Circle} variant="bad" disabled={!name.trim()}>{t('words.recordNew')}</BigButton>
      </form>

      {known.length > 0 && (
        <ul className="mb-5 grid gap-2">
          {known.map(([key, w]) => (
            <li key={key} className="flex flex-wrap items-center gap-2 rounded-2xl border border-rule bg-card p-2 pl-4">
              <span className="min-w-0 flex-1 font-display text-[1.15rem] font-semibold">{w.display}</span>
              <Badge tone={w.samples.length >= 3 ? 'ok' : 'warn'}>{w.samples.length} {t('common.samples')}</Badge>
              <BigButton size="sm" icon={Plus} onClick={() => rec(w.display)}>{t('words.addSample')}</BigButton>
              <BigButton size="sm" iconOnly icon={Trash2} aria-label={t('common.delete')} onClick={async () => { await removeWord(key); input.reloadWords(); refresh(); }} />
            </li>
          ))}
        </ul>
      )}
      {starters.length > 0 && (
        <>
          <p className="kicker mb-2">{t('words.starter')}</p>
          <div className="mb-5 flex flex-wrap gap-2">
            {starters.map((w) => <BigButton key={w} size="sm" variant="ghost" className="border-line" icon={Circle} onClick={() => rec(w)}>{w}</BigButton>)}
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <BigButton size="sm" icon={Download} disabled={!known.length} onClick={async () => { downloadJson(await exportWords(), 'signbridge-words.json'); notify(t('set.exported'), 'ok'); }}>{t('common.export')}</BigButton>
        <BigButton size="sm" icon={Upload} onClick={async () => { try { const n = await importWords(await pickJson()); notify(t('words.imported', { n }), 'ok'); input.reloadWords(); refresh(); } catch { notify(t('set.badFile'), 'bad'); } }}>{t('common.import')}</BigButton>
      </div>
    </Dialog>
  );
}
