// Hiệu chỉnh hơi thở: người dùng thở nhẹ / thổi / hút theo hướng dẫn, ta đo áp suất rồi đề xuất ngưỡng riêng.
const pct = (arr, p) => {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
};
const median = (a) => pct(a, 0.5);

/**
 * rest: mẫu kPa khi nghỉ (không thổi/hút), puff: mẫu khi thổi nhẹ–vừa, sip: mẫu khi hút nhẹ–vừa.
 * Trả về { puff, sip, noise, ok, issues[] } — ngưỡng nằm giữa mức nghỉ và mức thổi/hút (≈ 55% quãng) nhưng luôn
 * cách xa nhiễu ≥ 4σ (dùng độ trải 5–95% của lúc nghỉ) để không bấm nhầm.
 */
export function calibrateBreath({ rest = [], puff = [], sip = [] }, { minSamples = 12 } = {}) {
  const issues = [];
  if (rest.length < minSamples) issues.push('rest');
  if (puff.length < minSamples) issues.push('puff');
  if (sip.length < minSamples) issues.push('sip');
  const base = median(rest);
  const noise = Math.max(0.02, (pct(rest, 0.95) - pct(rest, 0.05)) / 2);
  const pHigh = pct(puff.map((v) => v - base), 0.8); // mức thổi ổn định (80%)
  const sLow = pct(sip.map((v) => v - base), 0.2); // mức hút (âm)
  let puffThr = base + pHigh * 0.55;
  let sipThr = base + sLow * 0.55;
  if (pHigh < noise * 6) issues.push('puffWeak');
  if (-sLow < noise * 6) issues.push('sipWeak');
  const clamp = (v) => Math.max(-2, Math.min(2, v));
  puffThr = clamp(Math.max(puffThr, base + noise * 4));
  sipThr = clamp(Math.min(sipThr, base - noise * 4));
  return {
    puff: Number(puffThr.toFixed(2)), sip: Number(sipThr.toFixed(2)), noise: Number(noise.toFixed(3)), base: Number(base.toFixed(2)),
    ok: issues.length === 0, issues,
  };
}
