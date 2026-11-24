// Chế độ giáo viên: giao bài (xuất tệp), học sinh nhập bài, giáo viên nhập báo cáo của học sinh.
import { store } from '../store.js';
import { pkey } from '../profiles.js';

const KEY = () => pkey('assignments');
export const loadAssignments = () => store.read(KEY(), []);
export const saveAssignments = (a) => store.write(KEY(), a);

export function makeAssignment({ title, items, note = '', due = null, teacher = '' }) {
  return { version: 1, kind: 'signbridge-assignment', id: 'a' + Date.now().toString(36), title, items: [...new Set(items)], note, due, teacher, at: Date.now() };
}
export function validAssignment(o) {
  return !!(o && o.kind === 'signbridge-assignment' && Array.isArray(o.items) && o.items.length && typeof o.title === 'string');
}
export function validReport(o) {
  return !!(o && o.kind === 'signbridge-report' && o.student && Array.isArray(o.mastered));
}
/** Tiến độ của học sinh với một bài: các mục đã thành thạo / tổng. */
export function assignmentProgress(a, mastered) {
  const done = a.items.filter((c) => mastered.includes(c)).length;
  return { done, total: a.items.length, pct: a.items.length ? done / a.items.length : 0 };
}

const REP_KEY = () => pkey('reports');
export const loadReports = () => store.read(REP_KEY(), []);
export function addReport(r) {
  const cur = loadReports().filter((x) => x.student.id !== r.student.id || x.at < r.at);
  const next = [...cur.filter((x) => x.student.id !== r.student.id), r];
  store.write(REP_KEY(), next);
  return next;
}
export const removeReport = (id) => store.write(REP_KEY(), loadReports().filter((x) => x.student.id !== id));
export const reportsToCsv = (list) => ['Tên,XP,Cấp,Chuỗi,Ký tự thành thạo,Bài kiểm tra TB,Ngày xuất', ...list.map((r) => {
  const avg = r.quizzes?.length ? Math.round((r.quizzes.reduce((s, q) => s + q.pct, 0) / r.quizzes.length) * 100) : '';
  return [`"${r.student.name}"`, r.xp, r.level, r.streak, r.mastered.length, avg, new Date(r.at).toISOString().slice(0, 10)].join(',');
})].join('\n');
