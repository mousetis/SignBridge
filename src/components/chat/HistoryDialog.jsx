import { useCallback, useEffect, useState } from 'react';
import { Download, Upload, Trash2, ArrowLeft, FileText } from 'lucide-react';
import Dialog from '../ui/Dialog.jsx';
import BigButton from '../ui/BigButton.jsx';
import { EmptyState } from '../ui/kit.jsx';
import ChatThread from './ChatThread.jsx';
import { listSessions, deleteSession, clearHistory, exportHistory, importHistory, sessionToText } from '../../lib/history.js';
import { downloadJson, downloadBlob, pickJson } from '../../lib/backup.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useT } from '../../i18n/index.jsx';

/** Lịch sử các cuộc hội thoại: xem lại, xuất (JSON / văn bản), nhập, xoá. */
export default function HistoryDialog({ open, onClose, names }) {
  const { t } = useT();
  const { notify } = useToast();
  const [list, setList] = useState([]);
  const [view, setView] = useState(null);
  const refresh = useCallback(async () => setList(await listSessions()), []);
  useEffect(() => { if (open) { refresh(); setView(null); } }, [open, refresh]);

  const doImport = async () => {
    try {
      const n = await importHistory(await pickJson());
      notify(t('hist.imported', { n }), 'ok');
      refresh();
    } catch { notify(t('set.badFile'), 'bad'); }
  };
  const when = (s) => new Date(s.at).toLocaleString();

  return (
    <Dialog open={open} onClose={onClose} title={t('hist.title')} wide>
      {view ? (
        <>
          <div className="mb-3 flex flex-wrap gap-2">
            <BigButton size="sm" icon={ArrowLeft} onClick={() => setView(null)}>{t('common.back')}</BigButton>
            <BigButton size="sm" icon={FileText} onClick={() => downloadBlob(new Blob([sessionToText(view, names)], { type: 'text/plain;charset=utf-8' }), `signbridge-${view.id}.txt`)}>{t('hist.txt')}</BigButton>
          </div>
          <ChatThread messages={view.messages} names={names} className="max-h-[55vh]" />
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            <BigButton size="sm" icon={Download} disabled={!list.length} onClick={async () => { downloadJson(await exportHistory(), 'signbridge-history.json'); notify(t('set.exported'), 'ok'); }}>{t('common.export')}</BigButton>
            <BigButton size="sm" icon={Upload} onClick={doImport}>{t('common.import')}</BigButton>
            <BigButton size="sm" variant="danger" icon={Trash2} disabled={!list.length} onClick={async () => { if (confirm(t('common.confirmDelete'))) { await clearHistory(); refresh(); } }}>{t('common.clear')}</BigButton>
          </div>
          {list.length === 0 ? (
            <EmptyState title={t('hist.none')}>{t('hist.noneHint')}</EmptyState>
          ) : (
            <ul className="grid gap-2">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-2xl border border-rule bg-card p-2">
                  <button type="button" className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => setView(s)}>
                    <span className="block text-[0.82rem] font-semibold text-muted">{when(s)} · {s.messages.length} {t('hist.msgs')}</span>
                    <span className="block truncate text-[1.02rem] font-semibold">{s.messages[s.messages.length - 1]?.text}</span>
                  </button>
                  <BigButton size="sm" iconOnly icon={Trash2} aria-label={t('common.delete')} onClick={async () => { await deleteSession(s.id); refresh(); }} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Dialog>
  );
}
