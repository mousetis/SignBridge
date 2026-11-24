import { useMemo, useState } from 'react';
import { Download, Upload, Trash2, FilePlus2, FileDown, UserCheck } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader.jsx';
import Card from '../components/ui/Card.jsx';
import BigButton from '../components/ui/BigButton.jsx';
import ProgressBar from '../components/ui/ProgressBar.jsx';
import { Segmented, Field, FIELD, Badge, EmptyState } from '../components/ui/kit.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { LETTERS, DIGITS } from '../config/systemConfig.js';
import { LEVELS, expandLevel } from '../data/lessons.js';
import { load as loadProgress, buildReport, levelOf } from '../lib/learn/progress.js';
import * as A from '../lib/learn/assignments.js';
import { downloadJson, downloadBlob, pickJson } from '../lib/backup.js';
import { useT } from '../i18n/index.jsx';

/** Chế độ giáo viên: giao bài (xuất tệp cho học sinh), nhận báo cáo tiến độ (nhập tệp từ học sinh), xuất CSV. Không cần máy chủ. */
export default function TeacherPage() {
  const { t } = useT();
  const { profiles } = useSettings();
  const { notify } = useToast();
  const [tab, setTab] = useState('assign');
  const [reports, setReports] = useState(A.loadReports);
  const [mine, setMine] = useState(A.loadAssignments);
  const [form, setForm] = useState({ title: '', note: '', due: '', items: [] });
  const progress = useMemo(() => loadProgress(), []);

  const toggle = (c) => setForm((f) => ({ ...f, items: f.items.includes(c) ? f.items.filter((x) => x !== c) : [...f.items, c] }));
  const preset = (lv) => setForm((f) => ({ ...f, items: [...new Set([...(lv.items || expandLevel(lv).map((x) => x.ch))])], title: f.title || t(`level.${lv.id}.title`) }));
  const create = () => {
    if (!form.title.trim() || !form.items.length) return;
    const a = A.makeAssignment({ ...form, teacher: profiles.active.name });
    downloadJson(a, `assignment-${a.id}.json`);
    notify(t('teacher.created'), 'ok');
    setForm({ title: '', note: '', due: '', items: [] });
  };
  const importAssign = async () => {
    try {
      const o = await pickJson();
      if (!A.validAssignment(o)) throw new Error('bad');
      const next = [...A.loadAssignments().filter((x) => x.id !== o.id), o];
      A.saveAssignments(next);
      setMine(next);
      notify(t('teacher.imported', { t: o.title }), 'ok');
    } catch { notify(t('set.badFile'), 'bad'); }
  };
  const importReport = async () => {
    try {
      const o = await pickJson();
      if (!A.validReport(o)) throw new Error('bad');
      setReports(A.addReport(o));
      notify(t('teacher.reportIn', { n: o.student.name }), 'ok');
    } catch { notify(t('set.badFile'), 'bad'); }
  };
  const exportMine = () => {
    downloadJson(buildReport(profiles.active, progress), `report-${profiles.active.name.replace(/\W+/g, '_')}.json`);
    notify(t('set.exported'), 'ok');
  };

  return (
    <>
      <PageHeader kicker={t('nav.teacher')} title={t('teacher.title')}>{t('teacher.lead')}</PageHeader>
      <Segmented role="tablist" label={t('nav.teacher')} className="mb-6" value={tab} onChange={setTab} options={[{ id: 'assign', label: t('teacher.tab.assign'), icon: FilePlus2 }, { id: 'reports', label: t('teacher.tab.reports'), icon: UserCheck }, { id: 'student', label: t('teacher.tab.student'), icon: FileDown }]} />

      {tab === 'assign' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t('teacher.newAssign')}>
            <div className="grid gap-4">
              <Field label={t('teacher.name')}><input className={FIELD} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
              <Field label={t('teacher.note')}><input className={FIELD} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
              <Field label={t('teacher.due')}><input type="date" className={FIELD} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></Field>
              <div>
                <p className="mb-2 font-semibold">{t('teacher.items')} <Badge tone="marker">{form.items.length}</Badge></p>
                <div className="mb-3 flex flex-wrap gap-2">{LEVELS.slice(0, 3).map((lv) => <BigButton key={lv.id} size="sm" onClick={() => preset(lv)}>{t(`level.${lv.id}.title`)}</BigButton>)}<BigButton size="sm" variant="ghost" onClick={() => setForm({ ...form, items: [] })}>{t('common.clear')}</BigButton></div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('teacher.items')}>
                  {[...LETTERS, ...DIGITS].map((c) => (
                    <button key={c} type="button" aria-pressed={form.items.includes(c)} onClick={() => toggle(c)} className={`h-11 min-w-[44px] rounded-xl border-2 font-display font-semibold ${form.items.includes(c) ? 'border-primary bg-primary text-primary-on' : 'border-line bg-card'}`}>{c}</button>
                  ))}
                </div>
              </div>
              <BigButton icon={Download} variant="primary" disabled={!form.title.trim() || !form.items.length} onClick={create}>{t('teacher.export')}</BigButton>
              <p className="text-[0.9rem] text-muted">{t('teacher.assignHint')}</p>
            </div>
          </Card>
          <Card title={t('teacher.mineTitle')} aside={<BigButton size="sm" icon={Upload} onClick={importAssign}>{t('teacher.importAssign')}</BigButton>}>
            {mine.length === 0 ? <EmptyState title={t('teacher.noAssign')}>{t('teacher.noAssignHint')}</EmptyState> : (
              <ul className="grid gap-2">
                {mine.map((a) => {
                  const pr = A.assignmentProgress(a, progress.mastered);
                  return (
                    <li key={a.id} className="rounded-2xl border border-rule bg-card2/50 p-3">
                      <div className="flex items-center gap-2"><span className="flex-1 font-display font-semibold">{a.title}</span><BigButton size="sm" iconOnly icon={Trash2} aria-label={t('common.delete')} onClick={() => { const n = mine.filter((x) => x.id !== a.id); A.saveAssignments(n); setMine(n); }} /></div>
                      <ProgressBar className="mt-2" value={pr.pct} label={`${pr.done}/${pr.total}`} color="bg-ok" />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'reports' && (
        <Card title={t('teacher.reports')} aside={<div className="flex gap-2"><BigButton size="sm" icon={Upload} onClick={importReport}>{t('teacher.importReport')}</BigButton><BigButton size="sm" icon={FileDown} disabled={!reports.length} onClick={() => { downloadBlob(new Blob(['﻿' + A.reportsToCsv(reports)], { type: 'text/csv;charset=utf-8' }), 'signbridge-reports.csv'); }}>CSV</BigButton></div>}>
          {reports.length === 0 ? <EmptyState title={t('teacher.noReports')}>{t('teacher.noReportsHint')}</EmptyState> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead><tr className="border-b border-rule text-[0.85rem] uppercase tracking-wider text-muted"><th className="py-2">{t('teacher.col.name')}</th><th>XP</th><th>{t('common.level')}</th><th>{t('learn.streak')}</th><th>{t('common.mastered')}</th><th>{t('teacher.col.quiz')}</th><th /></tr></thead>
                <tbody>
                  {reports.map((r) => {
                    const avg = r.quizzes?.length ? Math.round((r.quizzes.reduce((s, q) => s + q.pct, 0) / r.quizzes.length) * 100) : null;
                    return (
                      <tr key={r.student.id} className="border-b border-rule/60">
                        <td className="py-3 font-display font-semibold">{r.student.name}<span className="block text-[0.78rem] font-normal text-muted">{new Date(r.at).toLocaleDateString()}</span></td>
                        <td className="font-mono tabular-nums">{r.xp}</td><td>{r.level ?? levelOf(r.xp)}</td><td>{r.streak}</td>
                        <td><div className="flex max-w-[220px] flex-wrap gap-1">{r.mastered.slice(0, 18).map((c) => <span key={c} className="rounded bg-ok-soft px-1.5 text-[0.8rem] font-bold">{c}</span>)}{r.mastered.length > 18 && <span className="text-[0.8rem] text-muted">+{r.mastered.length - 18}</span>}</div></td>
                        <td>{avg == null ? '—' : <Badge tone={avg >= 80 ? 'ok' : 'warn'}>{avg}%</Badge>}</td>
                        <td><BigButton size="sm" iconOnly icon={Trash2} aria-label={t('common.delete')} onClick={() => setReports(A.removeReport(r.student.id) || A.loadReports())} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'student' && (
        <Card title={t('teacher.studentTitle')}>
          <p className="mb-4 leading-relaxed text-muted">{t('teacher.studentText')}</p>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-card2 p-4"><p className="kicker">XP</p><p className="font-display text-[1.8rem] font-semibold">{progress.xp}</p></div>
            <div className="rounded-2xl bg-card2 p-4"><p className="kicker">{t('common.mastered')}</p><p className="font-display text-[1.8rem] font-semibold">{progress.mastered.length}</p></div>
            <div className="rounded-2xl bg-card2 p-4"><p className="kicker">{t('learn.tab.badges')}</p><p className="font-display text-[1.8rem] font-semibold">{progress.badges.length}</p></div>
          </div>
          <BigButton icon={Download} variant="primary" onClick={exportMine}>{t('teacher.exportMine')}</BigButton>
        </Card>
      )}
    </>
  );
}
