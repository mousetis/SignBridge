# TÀI LIỆU CẤU TRÚC HOẠT ĐỘNG HỆ THỐNG WEB & AI

## 1. Kiến trúc tổng thể & Kết nối ESP32-S3 qua địa chỉ IP

Hệ thống vận hành theo mô hình **Xử lý tại biên (Edge & Client-side Computing)**, kết nối trực tiếp giữa phần cứng **ESP32-S3** và nền tảng **Web AI** thông qua mạng Wi-Fi nội bộ mà không cần máy chủ trung gian:

1. **Thiết lập kết nối IP:** Trên thanh điều hướng của Web, người dùng nhập địa chỉ IP của mạch ESP32-S3 (ví dụ: `192.168.1.100`) và nhấn **Kết nối**. Trình duyệt khởi tạo kênh truyền hai chiều **WebSocket** tại cổng `81` (`ws://192.168.1.100:81`).
2. **Luồng dữ liệu Phần cứng $\rightarrow$ Web:** Mỗi `20ms`, ESP32-S3 gửi gói tin JSON chứa tọa độ trục X–Y của **Joystick 4 trục** và giá trị áp suất (`kPa`) từ cảm biến **MPXV7002DP** (`PUFF_CLICK`, `SIP_RIGHT_CLICK`, `HOLD_DRAG`), giúp người khuyết tật chi trên điều khiển trực tiếp các nút chức năng trên Web.
3. **Luồng dữ liệu Web $\rightarrow$ Phần cứng:** Khi người dùng thay đổi thanh trượt độ nhạy Joystick hoặc ngưỡng áp suất thổi/hút trên giao diện Web, hệ thống gửi lệnh cấu hình qua WebSocket/HTTP để cập nhật thông số xuống bộ nhớ của ESP32-S3 ngay lập tức.

---

## 2. Phân hệ 1: Nhập Văn bản & Giọng nói $\rightarrow$ Mô hình bàn tay 3D kèm phụ đề đồng bộ

Phân hệ này giúp người bình thường giao tiếp với người khiếm thính thông qua lời nói hoặc chữ viết:

* **Bước 1 – Thu nhận & Chuẩn hóa đầu vào:**
  * **Nhập văn bản:** Người dùng gõ từ hoặc câu trực tiếp vào khung nhập liệu kích thước lớn.
  * **Nhập giọng nói (Voice-to-Text):** Nhấn biểu tượng Micro, bộ nhận diện **Web Speech API** chuyển lời nói tiếng Việt/Anh thành văn bản theo thời gian thực, tự động loại bỏ dấu thanh (ví dụ: `"XIN CHÀO"` $\rightarrow$ `"XIN CHAO"`) và tách thành chuỗi ký tự chuẩn (`A–Z`, `0–9`).
* **Bước 2 – Diễn hoạt mô hình bàn tay 3D (`Three.js`):**
  * Mỗi ký tự được ánh xạ tới bộ góc quay khung xương 21 khớp của bàn tay 3D (bao gồm cả hướng lòng bàn tay: hướng ra trước với đa số chữ cái, xoay ngang với `G, H`, chúc xuống với `P, Q`).
  * **Xử lý ký tự động (`J` và `Z`):** Tự động kích hoạt quỹ đạo chuyển động không gian (ngón út vẽ nét móc chữ `J`, ngón trỏ vẽ đường ziczac chữ `Z`).
  * Sử dụng thuật toán nội suy **Quaternion SLERP** giúp các ngón tay chuyển tiếp mượt mà giữa các chữ cái.
* **Bước 3 – Dải từ ngữ đồng bộ bên dưới mô hình 3D:**
  * Ngay phía dưới khung hình bàn tay 3D là thanh phụ đề hiển thị toàn bộ câu đang dịch với cỡ chữ lớn (`36px`).
  * Khi bàn tay 3D mô phỏng đến ký tự nào, **ký tự đó lập tức được tô sáng nổi bật (Highlight)** kèm hình minh họa 2D đối chiếu bên cạnh để người khiếm thính dễ dàng theo dõi và ghép từ.

---

## 3. Phân hệ 2: AI Nhận diện cử chỉ tay $\rightarrow$ Văn bản & Giọng nói

Giúp người câm điếc giao tiếp tự nhiên bằng ngôn ngữ ký hiệu trước camera thông thường:

* **Giai đoạn 1 – Trích xuất khung xương (`MediaPipe Hands`):**
  * Thu luồng video ở tốc độ `30 FPS`, xác định tọa độ không gian $(x, y, z)$ của **21 điểm khớp bàn tay**.
  * Chuẩn hóa tọa độ theo gốc cổ tay và tỷ lệ lòng bàn tay để AI nhận diện chính xác bất kể người dùng đưa tay lại gần hay ra xa camera.
* **Giai đoạn 2 – Mô hình phân loại kép (`TensorFlow.js`):**
  * **Mạng nơ-ron MLP (34 ký tự tĩnh):** Phân loại các tư thế ngón tay cố định (`A–I`, `K–Y`, `0–9`), phân biệt chuẩn xác vị trí ngón cái trong nhóm nắm tay dễ nhầm (`A, E, M, N, S, T`). Hệ thống yêu cầu độ tin cậy $\ge 85\%$ duy trì trong **12 khung hình liên tiếp** mới chốt ký tự để tránh nhận nhầm khi đang chuyển tay.
  * **Mạng chuỗi thời gian LSTM (2 ký tự động `J, Z`):** Theo dõi quỹ đạo di chuyển trong 20 khung hình gần nhất của đầu ngón út (khớp số `8` / `20`) để nhận diện chính xác hai chữ cái chuyển động.
* **Giai đoạn 3 – Ghép từ & Xuất kết quả:**
  * Các ký tự nhận diện được tự động ghép thành từ trong khung văn bản lớn; nếu ngừng tay `1.8 giây` hệ thống tự chèn dấu cách và gợi ý từ hoàn chỉnh.
  * Tích hợp nút **Phát âm thanh (Text-to-Speech)** để đọc thành tiếng câu văn bản cho người nghe xung quanh hiểu.

---

## 4. Phân hệ 3: Hỗ trợ học tập ngôn ngữ ký hiệu trực quan cho người câm điếc

Được thiết kế theo nguyên tắc **100% phản hồi bằng hình ảnh (Không phụ thuộc âm thanh)** dựa trên bảng 36 ký tự chuẩn (`A–Z`, `0–9`):

1. **Chia lộ trình 4 cấp độ trực quan:** Bài 1 (`A–I`), Bài 2 (`J–R`), Bài 3 (`S–Z`) và Bài 4 (`0–9`) với thẻ hình minh họa bàn tay rõ nét.
2. **Chế độ luyện tập soi gương chia đôi màn hình:**
   * **Bên trái (Mẫu chuẩn):** Hiển thị mô hình bàn tay 3D xoay 360 độ kèm sơ đồ tô màu hướng dẫn (màu xanh ở ngón cần duỗi, màu đỏ ở ngón cần gập).
   * **Bên phải (Thực hành Camera AI):** Hiển thị hình ảnh bàn tay người học kèm khung xương AI theo thời gian thực.
3. **Chấm điểm bằng hiệu ứng thị giác:** Khi người học làm đúng động tác và giữ trong `1 giây`, viền màn hình sáng **Xanh ngọc**, thanh tiến độ đầy 100% và tự chuyển sang chữ tiếp theo; nếu đặt sai ngón tay (ví dụ nhầm ngón cái giữa chữ `M` và `N`), khớp xương trên màn hình sẽ báo màu **Vàng/Đỏ** tại đúng ngón bị sai để người học tự điều chỉnh.

---

## 5. Nguyên tắc thiết kế giao diện (UI/UX) thân thiện với người câm điếc & khuyết tật

* **Giao tiếp hoàn toàn bằng thị giác:** Mọi trạng thái (kết nối IP thành công, đang thu giọng nói, nhận diện đúng ký tự) đều hiển thị qua đèn báo màu sắc, thanh tiến độ và biểu tượng động thay vì tiếng bíp thông báo.
* **Biểu tượng trực quan đi kèm chữ ngắn gọn:** Sử dụng các nút bấm kích thước lớn ($\ge 64 \times 64\text{ px}$), khoảng cách rộng rãi giúp người khiếm thính dễ nhận biết và giúp người khuyết tật chi trên dễ dàng điều khiển bằng Joystick – hơi thở.
* **Nền tối tương phản cao (High-Contrast Dark Theme):** Giảm mỏi mắt khi người dùng phải tập trung quan sát chuyển động của mô hình bàn tay 3D trong thời gian dài.