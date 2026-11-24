# SignBridge v2 – Cầu nối ngôn ngữ ký hiệu (Web AI + ESP32-S3)

Ứng dụng React (Vite + Tailwind) chạy hoàn toàn trên trình duyệt: nhận dạng ký hiệu tay bằng camera, hiển thị chữ thành bàn tay 3D, hội thoại hai chiều, học tập có chấm điểm, và điều khiển bằng mạch **ESP32-S3** (Joystick + cảm biến áp suất) qua WebSocket trong mạng Wi-Fi nội bộ. Không cần máy chủ; hình ảnh không rời khỏi máy.

Bản v2 là bản làm lại toàn diện giao diện và bổ sung nhiều tính năng so với v1 (xem “Có gì mới”).

## Chức năng

| Chức năng | Trang | Ghi chú |
|---|---|---|
| Trang chủ + hướng dẫn lần đầu | `#/` · `#/welcome` | chọn ngôn ngữ, giao diện, cỡ chữ; tiến độ học trong ngày |
| Ký hiệu → chữ → giọng nói | `#/recognize` | chữ cái/chữ số (AI) + **từ/cụm từ** (mẫu bạn tự ghi, so khớp DTW), 1–2 tay, gợi ý từ, sửa lỗi, nói thành tiếng |
| Chữ / giọng nói → bàn tay 3D | `#/text` | diễn hoạt **theo từ**, phát lại ký hiệu bạn đã ghi, tay trái/phải, màu da, phụ đề đồng bộ, **xuất video WebM / GIF** |
| Hội thoại hai người | `#/converse` | một bên ký, một bên gõ/nói; khung chat, lịch sử, xuất văn bản |
| Phụ đề trực tiếp | `#/captions` | chữ lớn, dễ đọc; nhận giọng nói liên tục |
| Học tập | `#/learn` | lộ trình 4 cấp, XP – cấp – chuỗi ngày – huy hiệu, **ôn tập ngắt quãng (Leitner)**, kiểm tra theo cấp, trò chơi phản xạ 60 s, bài giáo viên giao |
| Từ điển | `#/dict` | tra chữ/số/từ của bạn, tay 3D xoay 360° |
| Giáo viên | `#/teacher` | tạo bài tập (xuất tệp), nhập báo cáo học sinh, xuất CSV – **không cần máy chủ** |
| Hiệu chỉnh | `#/train` | thu mẫu của chính bạn, huấn luyện lại MLP/LSTM ngay trong trình duyệt, trình hướng dẫn hiệu chỉnh từng bước |
| Cài đặt | `#/settings` | giao diện (sáng/tối/tương phản cao), cỡ chữ, giảm chuyển động, ngôn ngữ vi/en, camera, hồ sơ, sao lưu, ESP32, hơi thở, chế độ quét |

## Có gì mới so với v1

* **Giao diện thiết kế lại**: 3 chủ đề (sáng / tối / tương phản cao), 4 cỡ chữ, giảm chuyển động, bố cục điện thoại; mọi cặp chữ/nền ≥ 7:1 trong cả 3 chủ đề (kiểm tra tự động).
* **Hiệu năng**: suy luận AI chạy trong **Web Worker** (không giật giao diện), tự đo và chọn backend **WebGPU / WebGL / CPU**, chọn camera, lật gương.
* **Hồ sơ nhiều người** trên cùng máy (mẫu, tiến độ, cài đặt tách riêng); sao lưu/khôi phục JSON.
* **Bàn tay 3D** nạp từ tệp mô hình `.glb` trong `public/models/` (ba kiểu: *Hoạt hình*, *Chi tiết* và *Búp bê gỗ*, chọn trong Cài đặt; nhiều màu da, tay trái/phải), được điều khiển bởi chính khung xương 21 khớp của ứng dụng. Muốn thêm mô hình khác: thả tệp `.glb` vào `public/models/` rồi khai báo ghép xương trong `src/lib/hand/handModels.js`. Credit tác giả: xem `public/models/CREDITS.txt`.
* **ESP32**: dò thiết bị bằng quét dải IP / tên máy + nhớ thiết bị đã dùng; trình hướng dẫn hiệu chỉnh hơi thở (nghỉ – thổi – hút → ngưỡng riêng); **chế độ quét (switch-access)** để điều khiển bằng 1–2 cử chỉ; bàn phím ảo có gợi ý từ và cụm từ nói nhanh tự đặt.
* **PWA / ngoại tuyến**: cài được như ứng dụng, chạy khi mất mạng (service worker lưu khung ứng dụng, mô hình và MediaPipe khi dùng lần đầu).

## Về từ và cụm từ (đọc kỹ)

Gói **không** kèm dữ liệu ký hiệu tiếng Việt (VSL) có sẵn, và ứng dụng **không** khẳng định ký hiệu nào là “đúng chuẩn VSL”. Nhận dạng từ/cụm từ hoạt động bằng **mẫu do chính bạn ghi** (3–10 lần mỗi từ, đếm ngược 3 giây rồi ghi 3 giây): máy so khớp chuỗi chuyển động bằng DTW, không cần huấn luyện. Ký hiệu bạn ghi cũng được dùng lại để bàn tay 3D “ký” cụm từ đó ở trang Chữ → Ký hiệu. Muốn dùng ký hiệu chuẩn, hãy nhờ người ký thành thạo hoặc giáo viên ghi mẫu.

## Chạy nhanh (Windows)

**Cách dễ nhất:** giải nén zip, bấm đúp **`chay.bat`**. Lần đầu nó tự cài thư viện (cần Internet), sau đó tự mở trình duyệt tại `http://localhost:5173` với camera bật sẵn. Các lần sau chỉ cần bấm đúp lại. (Cần cài Node.js LTS một lần: https://nodejs.org)

Hoặc dùng PowerShell:

```powershell
Expand-Archive sign-bridge.zip -DestinationPath .
cd sign-bridge
npm.cmd install      # tự sao chép MediaPipe Hands (kèm mô hình) vào public/mediapipe -> chạy OFFLINE
npm.cmd run dev      # tự mở http://localhost:5173
```

(Nếu PowerShell chặn `npm`, dùng `npm.cmd` như trên, hoặc chạy một lần `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.)

* Camera chỉ hoạt động trên `http://localhost` hoặc `https` — **hãy dùng địa chỉ `localhost`, không dùng địa chỉ "Network" (192.168…)** mà Vite in ra. Nếu lỡ mở bằng 192.168…, trang tự chuyển sang localhost (khi cùng máy). `npm run dev:lan` chỉ dùng khi muốn mở từ thiết bị khác (khi đó camera cần https). `ws://` tới ESP32 bị chặn nếu trang chạy qua **https** → dùng `http://localhost:5173` hoặc `http://<IP-máy-tính>:5173` trong mạng LAN.
* **Theo dõi bàn tay chạy offline**: gói `@mediapipe/hands` chứa sẵn mô hình, `npm install` chép vào `public/mediapipe/hands/`. Nếu lỗi, chạy `npm.cmd run setup:assets` rồi tải lại trang. Chỉ khi bộ này hỏng, ứng dụng mới thử bộ `tasks-vision` (cần tải mô hình từ Internet).
* Khi camera lỗi, thông báo trên trang nêu rõ nguyên nhân (bị chặn quyền, camera đang bị ứng dụng khác dùng, hay thiếu tệp mô hình).
* Dùng Chrome/Edge để có nhận giọng nói (Web Speech API).

Các lệnh khác: `npm run build` · `npm run preview` · `npm test` (119 phép kiểm tra tự động) · `npm run mock:esp32` (ESP32 giả lập) · `npm run train:real` (huấn luyện lại từ dữ liệu bàn tay thật) · `npm run train:real:eval` (kèm đánh giá leave-one-dataset-out).

## Thử khi chưa có phần cứng

```bash
node tools/esp32-mock-server.mjs --port=8081            # gửi JSON có trường "event"
node tools/esp32-mock-server.mjs --port=8082 --raw   # chỉ gửi áp suất thô, Web tự nhận cử chỉ thổi/hút
```
Nhập `localhost:8081` vào ô địa chỉ IP rồi bấm **Kết nối**: con trỏ ảo sẽ chạy theo "Joystick" và tự nhấn chuột theo kịch bản.


## Giao thức ESP32 ↔ Web

Kênh: `ws://<IP>:81/ws` (mặc định `ws://192.168.1.100:81/ws`, tự nối lại sau 3 giây). Mỗi **20 ms** ESP32 gửi:

```json
{"x": -0.35, "y": 0.80, "kpa": 0.12, "event": null}
```

* `x`, `y`: Joystick −1…1 (giá trị ADC thô 0…4095 cũng được tự chuẩn hoá). `kpa`: áp suất MPXV7002DP (−2…2).
* `event` (luôn có khoá này, giá trị `null` khi không có lệnh): `LEFT_CLICK`/`PUFF_CLICK`, `DOUBLE_CLICK`, `RIGHT_CLICK`/`SIP_RIGHT_CLICK`, `DRAG_START`, `DRAG_END`, `HOLD_DRAG` (bắt đầu kéo; Web tự kết thúc khi `kpa` giảm, hoặc khi nhận `DRAG_END`).
* Nếu firmware **không** có khoá `event`, Web tự nhận cử chỉ từ `kpa`: thổi ngắn → nhấn trái; thổi lần 2 trong 350 ms → nhấn đúp; thổi giữ ≥ 600 ms → kéo-thả; hút ≤ −0,45 kPa → nhấn phải (mọi ngưỡng chỉnh được ở Cài đặt).
* Web → ESP32 khi kết nối và mỗi lần kéo thanh trượt: `{"type":"config","joystick":{"deadzone":0.12,"cursor_speed":1.5},"pressure":{"puff_left_click_kpa":0.45,"sip_right_click_kpa":-0.45,"double_puff_window_ms":350,"hold_drag_duration_ms":600}}`. Nếu WebSocket đang đóng, gửi `POST http://<IP>:80/config` (cần bật CORS trên firmware).
* Tên khoá khác cũng được chấp nhận (`joystick.x`, `p`, `pressure`, `evt`, `cmd`…) – xem `src/lib/esp32/protocol.js`.

Con trỏ ảo di chuyển bằng Joystick (vùng chết 0,12 · trung bình trượt 5 mẫu · tốc độ 1,5×), phát sự kiện `pointer/mouse` thật vào trang nên mọi nút, thanh trượt (kể cả kéo-thả) đều điều khiển được. Chạm mép trên/dưới màn hình để cuộn.


## Cấu trúc thư mục

```
src/
  App.jsx, main.jsx          định tuyến (hash), nạp trang theo nhu cầu
  pages/                     Home, Welcome, Recognize, Converse, Captions, TextToHand, Learn, Dictionary, Teacher, Train, Settings
  components/                ui (bộ nút/thẻ/hộp thoại), layout (AppShell), camera, hand (3D), chat, esp32
  hooks/                     useHandTracker, useSignInput, useConversation, usePractice, useSpeech…
  lib/ml/                    mô hình MLP/LSTM/kNN, bộ chốt ký tự, Web Worker suy luận, đo backend
  lib/words/                 DTW, cắt đoạn ký hiệu, kho từ (IndexedDB)
  lib/hand/                  khung xương 3D, tư thế, diễn hoạt
  lib/learn/                 XP/cấp/huy hiệu/ôn ngắt quãng, bài tập & báo cáo
  lib/esp32/                 giao thức, bộ lọc Joystick/áp suất, dò thiết bị, chế độ quét, hiệu chỉnh hơi thở
  lib/                       store, idb, profiles, history, backup, smart (sửa lỗi, gợi ý), pwa
  i18n/areas/                chuỗi giao diện vi/en theo từng khu vực
public/                      icon, manifest, sw.js, models, mediapipe (chép bởi npm install)
scripts/selftest.mjs         119 phép kiểm tra tự động
tools/esp32-mock-server.mjs  ESP32 giả lập
```

## Nhận diện: cách làm và độ chính xác (đọc kỹ)

**Cách làm (bản cải tiến).** Mô hình tĩnh không còn học từ dữ liệu tổng hợp mà từ **~24.000 mẫu khung xương bàn tay thật** (3 bộ CSV MediaPipe trong `data/real/`), tăng cường bằng xoay 3D, co giãn, nhiễu, lật trái/phải và cân bằng lớp. Kết quả là một **tổ hợp**: MLP (63→128→64→34) + kNN trên các mẫu đại diện (24 mẫu/lớp) + làm mượt theo thời gian (EMA). Mẫu bạn tự thu ở trang **Hiệu chỉnh** vào kNN ngay lập tức (không cần huấn luyện), và có thể tinh chỉnh thêm MLP ngay trong trình duyệt.

**Con số trung thực.** Đánh giá bằng cách *giữ lại hẳn một bộ dữ liệu chưa từng thấy* (người, camera, ánh sáng khác):

| | Mô hình cũ (tổng hợp) | Bản này |
|---|---|---|
| Chữ cái trên bộ dữ liệu chưa thấy | ~54% | **~81%** (tổ hợp) |
| Trên chính dữ liệu đã học | – | ~98,7% (số này lạc quan, đừng tin) |

Tức là với người lạ, kỳ vọng **khoảng 75–82%** cho chữ cái. Các ký tự khó nhất vẫn là nhóm hình tay gần giống nhau: **M/N/T/S/A/E, G/P, U/X**. Cách cải thiện hiệu quả nhất là **thu ~30 mẫu mỗi ký tự của chính bạn** ở `#/train` (mất vài phút).

**Quy tắc chốt chữ (đã nới so với đặc tả):** độ tin cậy ≥ 70%, hơn ký tự đứng thứ hai ≥ 20 điểm %, giữ ổn định 10 khung hình (`src/config/systemConfig.js`). Vẫn có thể chỉnh lại nếu muốn chặt hơn.

**Điểm bài học** dùng mẫu thật gần nhất làm chuẩn (hình học) kết hợp xác suất mô hình, nên khớp với cách người thật ra dấu hơn là tư thế dựng tay.

* **Bảng 36 ký hiệu chuẩn không có trong các file đính kèm.** Bàn tay 3D dạy học (`src/data/poses.js`) dựng theo chữ cái ngón tay quốc tế/ASL; một số chữ (A, G, H, M, P, Q, S, T, U) trong bản 3D còn lệch so với tay thật. Nhận diện và chấm điểm không dựa vào bảng này nữa, nhưng hình 3D thì có thể cần chỉnh.
* **Cặp giống hệt nhau về hình tay:** O–0, V–2, W–6, F–9 → phân biệt bằng chế độ **Chữ cái / Chữ số / Tự động**.
* **J, Z:** tạo tư thế (út duỗi / trỏ duỗi) rồi vẽ nét ngay; LSTM phân tích quỹ đạo đầu ngón. LSTM huấn luyện trên dữ liệu tổng hợp (100% trên tập tổng hợp, quy tắc co ngón đạt ~96–97% trên khung thật); chưa có dữ liệu chuyển động thật nên nên hiệu chỉnh `Huấn luyện J/Z` nếu nhầm.
* **Nguồn và giấy phép dữ liệu:** 3 bộ CSV lấy từ một kho GitHub công khai **không kèm tệp giấy phép**. Dữ liệu không nằm trong gói zip; chỉ các trọng số mô hình đã huấn luyện (~240 KB) được đưa kèm. Nếu dùng cho mục đích thương mại/công bố, hãy kiểm tra giấy phép với tác giả bộ dữ liệu, hoặc tự thu dữ liệu thay thế rồi chạy `npm run train:real`.


## Khác biệt so với tài liệu gốc (theo yêu cầu mới nhất)

| Mục | Tài liệu gốc | Bản này |
|---|---|---|
| Đường dẫn WebSocket | `ws://IP:81` | `ws://IP:81/ws` (cấu hình được) |
| Cấp độ học | A–I · J–R · S–Z · 0–9 | **A–M · N–Z (+J, Z) · 0–9 · ghép từ** (J học cùng Z vì là ký tự động) |
| Ngưỡng tự chuyển bài | ≥ 85% | **≥ 80%**, giữ 1 giây (`systemConfig.js`) |
| Chốt ký tự | ≥ 90% | **≥ 70%, hơn ký tự thứ hai ≥ 20 điểm %, 10 khung** |
| Cửa sổ LSTM | 20 khung gần nhất | 20 mẫu lấy cách 1 khung (`STRIDE=2`) ≈ 1,3 giây để kịp vẽ J/Z |
| Lớp LSTM | `J`, `Z` | `J`, `Z`, `NONE` (nội bộ) |

Điểm bài học = so khớp hình học với mẫu thật gần nhất (góc gập từng ngón, không phụ thuộc hướng tay hay tay trái/phải) kết hợp xác suất mô hình; khớp xương hiện **xanh/vàng/đỏ** theo từng ngón.


## Giao diện và hỗ trợ tiếp cận

3 chủ đề chọn ở góc trên hoặc trong Cài đặt; màu lưu dưới dạng biến CSS (`src/index.css`). Mọi cặp chữ/nền ≥ 7:1 (WCAG AAA) ở cả 3 chủ đề và viền điều khiển ≥ 3:1 – kiểm tra trong `npm test`. Nút ≥ 56 px, viền focus dày, trạng thái luôn có màu + biểu tượng + chữ, **không có âm báo** (chỉ đọc thành tiếng khi bạn bật). Thanh trượt có nút −/+; có bàn phím ảo, chế độ quét và con trỏ ảo cho người không dùng được chuột.

## Giới hạn đã biết

* **Chưa thử với phần cứng thật.** Đã kiểm thử tự động (119 phép: tư thế/IK/SLERP, mô hình, bộ chốt ký tự, DTW và cắt đoạn, dò thiết bị bằng WebSocket giả, hiệu chỉnh hơi thở, XP/chuỗi/huy hiệu/ôn tập, báo cáo giáo viên, tương phản màu, đủ khoá i18n) và build thành công. **Chưa chạy với webcam thật, mạch ESP32-S3, micro thật, WebGPU thật**; ngưỡng cắt đoạn từ (`WordSegmenter`) chưa được tinh chỉnh trên người dùng thật nên có thể cần chỉnh.
* Dò ESP32 không dùng mDNS (trình duyệt không hỗ trợ): ứng dụng thử tên `esp32.local…` (nếu hệ điều hành phân giải được) và quét dải IP; cần ESP32 cùng mạng và mở WebSocket `ws://IP:81/ws`.
* Nhận giọng nói tiếng Việt phụ thuộc Chrome/Edge (gửi âm thanh tới dịch vụ của trình duyệt). Đọc thành tiếng tự khôi phục dấu cho từ có trong từ điển (`src/data/vocabulary.js`), từ lạ sẽ đọc không dấu.
* Không dùng TypeScript (theo yêu cầu); mã là JavaScript/JSX.
