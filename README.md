# 🏃‍♂️ Ninja Runner - Đồ án Đồ họa Máy tính (CS105)

Chào mừng bạn đến với **Ninja Runner**, một dự án game 3D thuộc thể loại Infinite Runner (Chạy vô tận) được phát triển dưới dạng Đồ án môn học **Đồ họa Máy tính (CS105)**. 

Trò chơi được xây dựng trên nền tảng WebGL thông qua thư viện **Three.js**, mang đến trải nghiệm đồ họa 3D mượt mà ngay trên trình duyệt web mà không cần cài đặt thêm bất kỳ plugin nào.

---

## 👥 Thành viên thực hiện
* **23521379**
* **23521452**
* **23521706**

---

## 🎮 Cách chơi (Controls)
* **Di chuyển qua lại:** Sử dụng các phím mũi tên **Trái (Left)** / **Phải (Right)** hoặc phím **A** / **D** để chuyển làn đường (Trái, Giữa, Phải).
* **Nhảy (Jump):** Sử dụng phím mũi tên **Lên (Up)** hoặc phím **W** để nhảy lên né các chướng ngại vật tầm thấp (đá nhỏ, phi tiêu chìm...).
* **Trượt (Slide):** Sử dụng phím mũi tên **Xuống (Down)** hoặc phím **S** để trượt người xuống né các vật cản trên cao (phi tiêu tầm cao, đá khổng lồ treo cao...).
* **Kích hoạt Kỹ năng:**
  * **Phím 1:** **Đại Hỏa Cầu (Fireball)** 🔥 - Bắn ra quả cầu lửa bay dọc theo đường để tiêu diệt các vật cản phía trước.
  * **Phím 2:** **Chidori (Thiên Điểu)** ⚡ - Kích hoạt tốc độ sấm sét, lướt nhanh về phía trước và bay xuyên qua mọi vật cản một cách an toàn.
  * **Phím 3:** **Susanoo** 🛡️ - Triệu hồi giáp bảo vệ khổng lồ giúp **bất tử trong vòng 20 giây** (có thanh thời gian hiển thị). Susanoo còn có khả năng tự động vung kiếm chém nát các chướng ngại vật lớn.
* **Điều khiển hệ thống:**
  * **Phím Backspace** hoặc click nút: Chơi lại khi Game Over.
  * **Phím Space (Phím cách)** hoặc click nút Tạm dừng: Tạm ngưng game.
  * **Nút Ẩn/Hiện Núi:** Tối ưu hóa hiệu năng (FPS) bằng cách ẩn bớt các mô hình nền.
  * **Chế độ Thời gian:** Chuyển đổi linh hoạt giữa Tự động (Theo điểm), Sáng, hoặc Tối.
  * **Chế độ Luyện tập (Practice Mode):** Lựa chọn giữa các mẫu chướng ngại vật ngẫu nhiên hoặc các mẫu thử thách thiết kế sẵn (từ Mẫu 1 đến Mẫu 9).
  * **Phím H:** Bật/tắt chế độ hiển thị hitbox (dành cho mục đích debug).

---

## ✨ Các tính năng nổi bật
* **Đồ họa 3D sinh động:** Sử dụng mô hình 3D định dạng `.glb`/`.gltf` (Nhân vật Ninja Sasuke, Susanoo, Chướng ngại vật, môi trường núi non, cây cối).
* **Xử lý va chạm chuẩn xác:** Tích hợp thuật toán **OBB (Oriented Bounding Box)** của Three.js để tính toán va chạm vật lý nghiêng chính xác tới từng góc độ của cơ thể nhân vật.
* **Hệ thống Kỹ năng phức tạp:** Mỗi kỹ năng đều kèm theo các hiệu ứng đồ họa đặc trưng (hào quang chidori, lửa volumetric, sét) và hệ thống âm thanh, hoạt ảnh 3D riêng biệt được đồng bộ mượt mà.
* **Kiến trúc Code Mô-đun (ES6):** Dự án được refactor và chia nhỏ thành nhiều module chuyên biệt (`physics.js`, `character.js`, `skills.js`...) giúp dễ quản lý và phát triển.
* **Hệ thống AI Auto-play:** Hỗ trợ tính năng tự động né tránh chướng ngại vật khi không có thao tác từ người dùng.
* **Hệ thống UI hiện đại:** Hiển thị điểm số (Score), số tiền vàng thu thập được (Coins), thanh năng lượng Susanoo trực quan và bộ đếm FPS thời gian thực.
* **Hiệu ứng Môi trường (Ngày/Đêm):** Bầu trời và ánh sáng tự động chuyển đổi giữa ngày và đêm dựa trên điểm số hoặc tùy chỉnh của người chơi.

---

## 🛠️ Công nghệ sử dụng
* **Core:** HTML5, CSS3, Vanilla JavaScript (ES6+ Modules).
* **Đồ họa 3D:** [Three.js](https://threejs.org/) (phiên bản r128).
* **Bộ nạp mô hình:** GLTFLoader.
* **Xử lý va chạm:** Three.js OBB (Oriented Bounding Box) & AABB.
* **Âm thanh:** HTML5 Audio API.

---

## 📂 Cấu trúc thư mục dự án
```text
23521379-23521452-23521706/
├── index.html          # Giao diện hiển thị, cấu trúc UI và nạp thư viện
├── README.md           # Tài liệu hướng dẫn dự án (File này)
├── src/                # Chứa mã nguồn JavaScript đã chia module
│   ├── main.js         # Khởi tạo core (Renderer, Scene, Loop, Camera)
│   ├── state.js        # Quản lý trạng thái toàn cục của game
│   ├── config.js       # Các tham số cấu hình tĩnh (Màu sắc, Tọa độ làn)
│   ├── physics.js      # Tính toán va chạm (Hitbox, OBB, AABB)
│   ├── character.js    # Nạp mô hình Sasuke & Susanoo, quản lý animation
│   ├── skills.js       # Logic xử lý các kỹ năng (Fireball, Chidori, Susanoo)
│   ├── inputs.js       # Quản lý tương tác bàn phím (Jump, Slide, Skills)
│   ├── environment.js  # Khởi tạo môi trường (Núi, Cây, Ánh sáng, Mặt đất)
│   ├── obstacles.js    # Spawn chướng ngại vật (Đá, Cột gỗ, Phi tiêu)
│   ├── logic.js        # Logic game over, tính điểm, reset game
│   ├── assets.js       # Nạp và quản lý âm thanh (Audio)
│   └── ui.js           # Quản lý cập nhật giao diện (Score, FPS, Thanh năng lượng)
├── models/             # Chứa các file mô hình 3D (.glb, .gltf)
├── textures/           # Chứa các hình ảnh texture cho map, bầu trời, hiệu ứng
└── audios/             # Chứa các tệp âm thanh hiệu ứng và nhạc nền
```

---

## 🚀 Hướng dẫn khởi chạy dự án
Để chạy dự án này trên máy tính cá nhân của bạn, bạn có thể thực hiện theo các cách sau:

### Cách 1: Sử dụng Extension VS Code (Khuyên dùng)
1. Cài đặt extension **Live Server** trong VS Code.
2. Mở thư mục dự án bằng VS Code.
3. Nhấp chuột phải vào tệp `index.html` và chọn **Open with Live Server** (hoặc nhấn tổ hợp phím `Alt + L, Alt + O`).
4. Trình duyệt sẽ tự động mở game tại địa chỉ `http://127.0.0.1:5500`.

### Cách 2: Sử dụng NodeJS (HTTP-Server)
Nếu máy bạn đã cài NodeJS, bạn có thể chạy một local server nhanh chóng:
1. Mở terminal tại thư mục dự án.
2. Cài đặt http-server (nếu chưa có):
   ```bash
   npm install -g http-server
   ```
3. Khởi chạy server:
   ```bash
   http-server .
   ```
4. Truy cập địa chỉ `http://localhost:8080` hiển thị trên màn hình terminal.

---

Chúc bạn có những trải nghiệm chơi game vui vẻ và đạt điểm số thật cao! 🎯
