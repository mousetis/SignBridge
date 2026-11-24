// Từ vựng gợi ý (có dấu để đọc thành tiếng đúng). Khoá so khớp = bỏ dấu + IN HOA.
import { normalizeForSign } from '../lib/text.js';

export const VI_WORDS = [
  'XIN CHÀO', 'CẢM ƠN', 'XIN LỖI', 'TẠM BIỆT', 'KHÔNG SAO', 'XIN LỖI', 'TÔI', 'BẠN', 'ANH', 'CHỊ', 'EM', 'ÔNG', 'BÀ', 'BỐ', 'MẸ',
  'GIA ĐÌNH', 'BẠN BÈ', 'THẦY CÔ', 'HỌC SINH', 'GIÁO VIÊN', 'BÁC SĨ', 'BỆNH VIỆN', 'THUỐC', 'ĐAU', 'KHỎE', 'MỆT', 'ĐÓI', 'KHÁT',
  'NƯỚC', 'CƠM', 'PHỞ', 'BÁNH MÌ', 'CÀ PHÊ', 'TRÀ', 'SỮA', 'ĂN', 'UỐNG', 'NGỦ', 'ĐI', 'ĐẾN', 'VỀ', 'Ở', 'NHÀ', 'TRƯỜNG',
  'CHỢ', 'CÔNG VIỆC', 'LÀM VIỆC', 'HỌC', 'ĐỌC', 'VIẾT', 'NÓI', 'NGHE', 'NHÌN', 'THẤY', 'BIẾT', 'HIỂU', 'KHÔNG HIỂU', 'MUỐN',
  'CẦN', 'GIÚP', 'GIÚP ĐỠ', 'LÀM ƠN', 'VÂNG', 'DẠ', 'ĐƯỢC', 'KHÔNG', 'CÓ', 'RẤT', 'TỐT', 'VUI', 'BUỒN', 'YÊU', 'THƯƠNG',
  'HÔM NAY', 'NGÀY MAI', 'HÔM QUA', 'BÂY GIỜ', 'SÁNG', 'TRƯA', 'CHIỀU', 'TỐI', 'ĐÂU', 'GÌ', 'AI', 'KHI NÀO', 'TẠI SAO',
  'BAO NHIÊU', 'MỘT', 'HAI', 'BA', 'BỐN', 'NĂM', 'SÁU', 'BẢY', 'TÁM', 'CHÍN', 'MƯỜI', 'VIỆT NAM', 'HÀ NỘI', 'SÀI GÒN',
  'ĐIỆN THOẠI', 'MÁY TÍNH', 'INTERNET', 'XE', 'TIỀN', 'GIÁ', 'MUA', 'BÁN', 'GIÚP TÔI', 'TÔI TÊN', 'TÔI YÊU BẠN',
  'CHÚC MỪNG', 'SINH NHẬT', 'HẸN GẶP LẠI', 'CHÀO BUỔI SÁNG', 'NGÔN NGỮ KÝ HIỆU', 'NGƯỜI KHIẾM THÍNH',
];

export const EN_WORDS = [
  'HELLO', 'HI', 'THANK YOU', 'THANKS', 'PLEASE', 'SORRY', 'GOODBYE', 'YES', 'NO', 'OK', 'HELP', 'WATER', 'FOOD', 'EAT', 'DRINK',
  'FAMILY', 'FRIEND', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER', 'TEACHER', 'STUDENT', 'DOCTOR', 'HOSPITAL', 'SCHOOL', 'HOME',
  'WORK', 'LOVE', 'HAPPY', 'SAD', 'GOOD', 'BAD', 'MORNING', 'NIGHT', 'TODAY', 'TOMORROW', 'YESTERDAY', 'NAME', 'MY NAME IS',
  'WHAT', 'WHERE', 'WHO', 'WHEN', 'WHY', 'HOW', 'I LOVE YOU', 'I NEED HELP', 'NICE TO MEET YOU', 'HOW ARE YOU', 'I AM FINE',
  'UNDERSTAND', 'DONT UNDERSTAND', 'AGAIN', 'SLOW', 'FAST', 'COMPUTER', 'PHONE', 'SIGN LANGUAGE', 'DEAF', 'HEARING',
  'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
];


// ---- Từ vựng mở rộng (nhóm theo chủ đề) ----
export const VI_EXTRA = [
  // gia đình & con người
  'CON', 'CHÁU', 'CHA', 'CON TRAI', 'CON GÁI', 'ANH EM', 'VỢ', 'CHỒNG', 'HÀNG XÓM', 'NGƯỜI', 'TRẺ EM', 'NGƯỜI LỚN', 'BẠN GÁI', 'BẠN TRAI',
  // cảm xúc & trạng thái
  'GIẬN', 'SỢ', 'LO LẮNG', 'HẠNH PHÚC', 'BÌNH TĨNH', 'NGẠC NHIÊN', 'XẤU', 'ĐẸP', 'NHANH', 'CHẬM', 'LỚN', 'NHỎ', 'NÓNG', 'LẠNH', 'MỚI', 'CŨ',
  // sức khỏe
  'ĐAU ĐẦU', 'ĐAU BỤNG', 'SỐT', 'HO', 'CẤP CỨU', 'GỌI BÁC SĨ', 'NHÀ THUỐC', 'DỊ ỨNG', 'UỐNG THUỐC', 'NGHỈ NGƠI',
  // đồ ăn thức uống
  'BÁNH', 'TRÁI CÂY', 'THỊT', 'CÁ', 'RAU', 'TRỨNG', 'MÌ', 'BIA', 'NƯỚC LỌC', 'ĐÓI BỤNG', 'NGON', 'CHO TÔI NƯỚC', 'TÍNH TIỀN',
  // di chuyển & địa điểm
  'ĐƯỜNG', 'XE BUÝT', 'TAXI', 'SÂN BAY', 'GA TÀU', 'KHÁCH SẠN', 'NHÀ VỆ SINH', 'SIÊU THỊ', 'NGÂN HÀNG', 'CÔNG AN', 'BƯU ĐIỆN', 'CÔNG VIÊN',
  'BÊN TRÁI', 'BÊN PHẢI', 'THẲNG', 'GẦN', 'XA', 'DỪNG LẠI', 'Ở ĐÂU',
  // thời gian
  'TUẦN', 'THÁNG', 'NĂM NAY', 'THỨ HAI', 'THỨ BA', 'THỨ TƯ', 'THỨ NĂM', 'THỨ SÁU', 'THỨ BẢY', 'CHỦ NHẬT', 'LÚC NÀO', 'SỚM', 'MUỘN',
  // học tập & công việc
  'LỚP HỌC', 'BÀI TẬP', 'SÁCH', 'BÚT', 'THI', 'ĐIỂM', 'CÔNG TY', 'ĐỒNG NGHIỆP', 'HỌP', 'LƯƠNG', 'XIN NGHỈ',
  // giao tiếp thường ngày
  'CHÀO BUỔI TỐI', 'CHÚC NGỦ NGON', 'CHÚC MAY MẮN', 'RẤT VUI ĐƯỢC GẶP BẠN', 'BẠN TÊN GÌ', 'BẠN Ở ĐÂU', 'BẠN BAO NHIÊU TUỔI', 'NÓI CHẬM LẠI', 'NHẮC LẠI',
  'ĐỢI MỘT CHÚT', 'KHÔNG CÓ GÌ', 'ĐỒNG Ý', 'KHÔNG ĐỒNG Ý', 'TÔI ĐỒNG Ý', 'CHẮC CHẮN', 'CÓ THỂ', 'KHÔNG THỂ', 'TÔI KHÔNG BIẾT', 'GIÚP TÔI VỚI',
  // số & đơn vị
  'MƯỜI MỘT', 'HAI MƯƠI', 'TRĂM', 'NGÀN', 'TRIỆU', 'ĐỒNG', 'NỬA', 'NHIỀU', 'ÍT',
];
export const EN_EXTRA = [
  'GOOD MORNING', 'GOOD NIGHT', 'GOOD LUCK', 'EXCUSE ME', 'YOU ARE WELCOME', 'WHAT IS YOUR NAME', 'WHERE IS THE TOILET', 'I AM HUNGRY', 'I AM THIRSTY',
  'I AM LOST', 'CALL AN AMBULANCE', 'CALL THE POLICE', 'MEDICINE', 'PAIN', 'FEVER', 'EMERGENCY', 'ALLERGY', 'RESTAURANT', 'HOTEL', 'AIRPORT', 'BUS', 'TAXI',
  'LEFT', 'RIGHT', 'STRAIGHT', 'STOP', 'WAIT', 'PLEASE REPEAT', 'SPEAK SLOWLY', 'I AGREE', 'MAYBE', 'I DONT KNOW', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY',
  'FRIDAY', 'SATURDAY', 'SUNDAY', 'WEEK', 'MONTH', 'YEAR', 'MONEY', 'PRICE', 'BUY', 'SELL', 'BOOK', 'PEN', 'EXAM', 'MEETING', 'OFFICE', 'BIG', 'SMALL',
  'HOT', 'COLD', 'NEW', 'OLD', 'ANGRY', 'AFRAID', 'TIRED', 'HUNGRY', 'THIRSTY',
];

const seen = new Set();
export const VOCAB = [...VI_WORDS, ...VI_EXTRA, ...EN_WORDS, ...EN_EXTRA]
  .map((display) => ({ display, key: normalizeForSign(display) }))
  .filter((w) => (seen.has(w.key) ? false : (seen.add(w.key), true)));

const byKey = new Map(VOCAB.map((w) => [w.key, w.display]));

/** Khôi phục dấu tiếng Việt cho văn bản đã bỏ dấu (khi đọc thành tiếng). Khớp cụm dài nhất trước. */
export function restoreDiacritics(text) {
  const words = normalizeForSign(text).trim().split(' ').filter(Boolean);
  const out = [];
  for (let i = 0; i < words.length; ) {
    let hit = false;
    for (let k = Math.min(4, words.length - i); k >= 1; k--) {
      const key = words.slice(i, i + k).join(' ');
      if (byKey.has(key)) {
        out.push(byKey.get(key));
        i += k;
        hit = true;
        break;
      }
    }
    if (!hit) out.push(words[i++]);
  }
  return out.join(' ');
}

// Câu mẫu hội thoại dùng cho luyện ghép từ (cấp 4) và nút nhập nhanh.
export const PRACTICE_WORDS = ['XIN CHAO', 'CAM ON', 'TOI YEU BAN', 'GIA DINH', 'HELLO', 'THANK YOU', 'MY NAME', 'BAN KHOE', 'AN COM', 'NHA', 'LOVE', 'HELP'];
export const QUICK_PHRASES = ['XIN CHAO', 'CAM ON', 'XIN LOI', 'TOI CAN GIUP DO', 'HELLO', 'THANK YOU', 'HELP ME', '2024'];
