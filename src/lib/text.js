// Chuẩn hoá văn bản cho ngôn ngữ ký hiệu: bỏ dấu thanh, chỉ giữ A–Z, 0–9 và dấu cách.
export function stripDiacritics(s) {
  return s
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function normalizeForSign(s) {
  return stripDiacritics(String(s || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trimStart();
}

/** Danh sách ký tự (có thể kèm ' ' = nghỉ giữa các từ) để diễn hoạt. */
export function toSignChars(s) {
  return normalizeForSign(s).trimEnd().split('');
}
