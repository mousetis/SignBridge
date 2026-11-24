import { useState } from 'react';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import Dialog from '../ui/Dialog.jsx';
import BigButton from '../ui/BigButton.jsx';
import { Avatar, FIELD } from '../ui/kit.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { COLORS } from '../../lib/profiles.js';
import { useT } from '../../i18n/index.jsx';

/** Quản lý hồ sơ người dùng: mỗi hồ sơ có mẫu ký hiệu, mô hình, tiến độ học và cài đặt riêng. */
export default function ProfileDialog({ open, onClose }) {
  const { t } = useT();
  const { profiles } = useSettings();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null); // {id,name}
  const [confirm, setConfirm] = useState(null);

  const add = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    profiles.add(name);
    setName('');
  };

  return (
    <Dialog open={open} onClose={onClose} title={t('profile.title')}>
      <p className="mb-4 text-muted">{t('profile.hint')}</p>
      <ul className="grid gap-3">
        {profiles.list.map((p) => {
          const on = p.id === profiles.active.id;
          return (
            <li key={p.id} className={`rounded-2xl border-2 p-3 ${on ? 'border-primary bg-primary/5' : 'border-line bg-card'}`}>
              {editing?.id === p.id ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); profiles.rename(p.id, editing.name, editing.color); setEditing(null); }}>
                  <input autoFocus value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={`${FIELD} !min-h-[52px] flex-1`} aria-label={t('profile.name')} />
                  <div className="flex gap-1.5" role="radiogroup" aria-label={t('profile.color')}>
                    {COLORS.map((c) => (
                      <button key={c} type="button" role="radio" aria-checked={editing.color === c} aria-label={c} onClick={() => setEditing({ ...editing, color: c })}
                        className={`h-9 w-9 rounded-full border-4 ${editing.color === c ? 'border-ink' : 'border-transparent'}`} style={{ background: c }} />
                    ))}
                  </div>
                  <BigButton size="sm" type="submit" variant="primary" icon={Check}>{t('common.save')}</BigButton>
                </form>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={p.name} color={p.color} size={48} />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { profiles.switchTo(p.id); onClose(); }} aria-current={on ? 'true' : undefined}>
                    <span className="block truncate font-display text-[1.1rem] font-semibold">{p.name}</span>
                    <span className="text-[0.88rem] text-muted">{on ? t('profile.current') : t('profile.switch')}</span>
                  </button>
                  <BigButton size="sm" iconOnly icon={Pencil} aria-label={t('common.edit')} onClick={() => setEditing({ id: p.id, name: p.name, color: p.color })} />
                  {profiles.list.length > 1 && (
                    confirm === p.id ? (
                      <BigButton size="sm" variant="danger" icon={Trash2} onClick={() => { profiles.remove(p.id); setConfirm(null); }}>{t('profile.confirmDelete')}</BigButton>
                    ) : (
                      <BigButton size="sm" iconOnly icon={Trash2} aria-label={t('common.delete')} onClick={() => setConfirm(p.id)} />
                    )
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <form onSubmit={add} className="mt-5 flex flex-wrap gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile.newName')} className={`${FIELD} flex-1`} aria-label={t('profile.newName')} />
        <BigButton type="submit" variant="primary" icon={Plus} disabled={!name.trim()}>{t('common.add')}</BigButton>
      </form>
    </Dialog>
  );
}
