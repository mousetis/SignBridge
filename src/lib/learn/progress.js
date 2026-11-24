// Tiến độ học: điểm kinh nghiệm (XP), cấp độ, chuỗi ngày, huy hiệu, lặp lại ngắt quãng (Leitner), kết quả bài kiểm tra.
import { store } from '../store.js';
import { pkey } from '../profiles.js';

const KEY = () => pkey('learn2');
export const DAY = 86400000;
export const dayOf = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / DAY);

export const EMPTY = { mastered: [], xp: 0, streak: 0, best: 0, lastDay: null, days: {}, badges: [], srs: {}, quizzes: [], reflexBest: 0, goal: 30, log: [] };

export function load() {
  const p = store.read(KEY(), null);
  if (p) return { ...EMPTY, ...p };
  // di chuyển từ bản v1 (chỉ có `mastered`)
  const old = store.read(pkey('learn'), null);
  return { ...EMPTY, mastered: old?.mastered || [] };
}
export function save(p) {
  store.write(KEY(), p);
  return p;
}

// ---- XP & cấp độ: cấp n cần 100·n·(n+1)/2... → đơn giản: cấp = floor(sqrt(xp/50))+1
export const levelOf = (xp) => Math.floor(Math.sqrt(xp / 50)) + 1;
export const levelBounds = (lv) => [50 * (lv - 1) ** 2, 50 * lv ** 2];

export const BADGES = [
  { id: 'first', icon: 'Sparkles', test: (p) => p.mastered.length >= 1 },
  { id: 'ten', icon: 'Star', test: (p) => p.mastered.length >= 10 },
  { id: 'alphabet', icon: 'Trophy', test: (p) => 'ABCDEFGHIKLMNOPQRSTUVWXY'.split('').every((c) => p.mastered.includes(c)) },
  { id: 'digits', icon: 'Hash', test: (p) => '0123456789'.split('').every((c) => p.mastered.includes(c)) },
  { id: 'streak3', icon: 'Flame', test: (p) => p.best >= 3 },
  { id: 'streak7', icon: 'Flame', test: (p) => p.best >= 7 },
  { id: 'xp500', icon: 'Zap', test: (p) => p.xp >= 500 },
  { id: 'quiz', icon: 'GraduationCap', test: (p) => p.quizzes.some((q) => q.pct >= 0.8) },
  { id: 'reflex', icon: 'Timer', test: (p) => p.reflexBest >= 10 },
];

/** Ghi nhận hoạt động: cộng XP, cập nhật chuỗi ngày, mở huy hiệu mới. Trả về { p, newBadges, levelUp }. */
export function award(p, xp, now = Date.now(), note = '') {
  const today = dayOf(now);
  const next = { ...p, days: { ...p.days }, log: [...p.log] };
  const lvBefore = levelOf(p.xp);
  next.xp = p.xp + xp;
  next.days[today] = (next.days[today] || 0) + xp;
  if (p.lastDay !== today) {
    next.streak = p.lastDay === today - 1 ? p.streak + 1 : 1;
    next.lastDay = today;
    next.best = Math.max(p.best, next.streak);
  }
  const oldDays = Object.keys(next.days).map(Number).sort((a, b) => a - b);
  for (const d of oldDays.slice(0, Math.max(0, oldDays.length - 120))) delete next.days[d];
  if (note) next.log = [...next.log, { at: now, xp, note }].slice(-200);
  const newBadges = BADGES.filter((b) => !next.badges.includes(b.id) && b.test(next)).map((b) => b.id);
  next.badges = [...next.badges, ...newBadges];
  return { p: next, newBadges, levelUp: levelOf(next.xp) > lvBefore };
}

/** Chuỗi ngày còn hiệu lực nếu hôm nay hoặc hôm qua có học. */
export const liveStreak = (p, now = Date.now()) => (p.lastDay != null && dayOf(now) - p.lastDay <= 1 ? p.streak : 0);
export const todayXp = (p, now = Date.now()) => p.days[dayOf(now)] || 0;

// ---- Lặp lại ngắt quãng (Leitner 5 hộp): đúng → lên hộp, sai → về hộp 1
export const BOX_DAYS = [0, 1, 2, 4, 8, 16];
export function srsReview(p, item, correct, now = Date.now()) {
  const cur = p.srs[item] || { box: 0, due: 0, seen: 0 };
  const box = correct ? Math.min(5, cur.box + 1) : 1;
  return { ...p, srs: { ...p.srs, [item]: { box, seen: cur.seen + 1, due: dayOf(now) + BOX_DAYS[box], last: now } } };
}
/** Các mục cần ôn hôm nay: đã đến hạn; mục chưa từng ôn nhưng đã "thành thạo" được thêm vào hộp 1. */
export function dueItems(p, now = Date.now()) {
  const d = dayOf(now);
  const set = new Set(p.mastered);
  Object.keys(p.srs).forEach((k) => set.add(k));
  return [...set].filter((k) => !p.srs[k] || p.srs[k].due <= d).sort((a, b) => (p.srs[a]?.box ?? 0) - (p.srs[b]?.box ?? 0));
}

// ---- Bài kiểm tra theo cấp
export function makeQuiz(items, n = 8, rng = Math.random) {
  const pool = [...items];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(n, pool.length));
}
export function recordQuiz(p, level, correct, total, now = Date.now()) {
  return { ...p, quizzes: [...p.quizzes, { level, correct, total, pct: total ? correct / total : 0, at: now }].slice(-50) };
}

// ---- Báo cáo cho giáo viên
export function buildReport(profile, p, now = Date.now()) {
  return {
    version: 1, kind: 'signbridge-report', at: now,
    student: { name: profile.name, id: profile.id },
    xp: p.xp, level: levelOf(p.xp), streak: liveStreak(p, now), bestStreak: p.best,
    mastered: p.mastered, badges: p.badges, quizzes: p.quizzes.slice(-20), reflexBest: p.reflexBest,
    srs: Object.fromEntries(Object.entries(p.srs).map(([k, v]) => [k, v.box])),
    activeDays: Object.keys(p.days).length,
  };
}
