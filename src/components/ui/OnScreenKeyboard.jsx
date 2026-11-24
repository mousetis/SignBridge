import { Delete, Eraser, SpaceIcon, Sparkles } from 'lucide-react';
import BigButton from './BigButton.jsx';
import { useT } from '../../i18n/index.jsx';

const ROWS = ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

/**
 * Bàn phím ảo A–Z / 0–9, nút ≥ 56–64 px để dùng với Joystick & hơi thở.
 * `suggestions` = [{label, onPick}] hiện hàng gợi ý từ (bàn phím dự đoán); `phrases` = câu nói nhanh tuỳ chỉnh.
 */
export default function OnScreenKeyboard({ onKey, onBackspace, onClear, onSpace, suggestions = [], phrases = [], onPhrase }) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-rule bg-card2/70 p-4" role="group" aria-label={t('kb.title')}>
      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" aria-label={t('kb.suggest')}>
          <Sparkles className="h-5 w-5 text-accent" aria-hidden />
          {suggestions.map((s) => (
            <BigButton key={s.label} variant="primary" size="sm" onClick={s.onPick}>{s.label}</BigButton>
          ))}
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        {ROWS.map((row) => (
          <div key={row} className="flex flex-wrap justify-center gap-2">
            {row.split('').map((k) => (
              <BigButton key={k} className="w-[3.6rem] font-display text-xl" onClick={() => onKey(k)} aria-label={`${t('kb.key')} ${k}`}>{k}</BigButton>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <BigButton icon={SpaceIcon} className="min-w-[180px] flex-1" onClick={onSpace}>{t('kb.space')}</BigButton>
        <BigButton icon={Delete} variant="warn" onClick={onBackspace}>{t('kb.back')}</BigButton>
        <BigButton icon={Eraser} variant="bad" onClick={onClear}>{t('common.clear')}</BigButton>
      </div>
      {phrases.length > 0 && (
        <div className="mt-3 border-t border-rule pt-3">
          <p className="kicker mb-2">{t('kb.phrases')}</p>
          <div className="flex flex-wrap gap-2">
            {phrases.map((p) => <BigButton key={p} variant="ghost" size="sm" className="border-line" onClick={() => onPhrase?.(p)}>{p}</BigButton>)}
          </div>
        </div>
      )}
    </div>
  );
}
