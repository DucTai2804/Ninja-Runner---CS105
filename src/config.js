// ==========================================
// THÔNG SỐ CẤU HÌNH GLOBAL (CONFIG)
// ==========================================

export const DAY_COLORS = {
    background: new THREE.Color(0x88aacc),
    ambient: new THREE.Color(0xffffff),
    hemiSky: new THREE.Color(0xffffff),
    hemiGround: new THREE.Color(0x445544),
    dir: new THREE.Color(0xffeedd),
    ambientIntensity: 0.4,
    hemiIntensity: 0.4,
    dirIntensity: 1.5
};

export const NIGHT_COLORS = {
    background: new THREE.Color(0x1a2235), // Xanh đêm sáng mờ (thay vì đen kịt)
    ambient: new THREE.Color(0x7788aa), // Tăng màu ambient để thấy rõ vách núi
    hemiSky: new THREE.Color(0x556688),
    hemiGround: new THREE.Color(0x223344),
    dir: new THREE.Color(0x88aadd), // Trăng sáng xanh
    ambientIntensity: 0.4, // Giữ bằng ban ngày để không bị mù
    hemiIntensity: 0.4, // Giữ bằng ban ngày
    dirIntensity: 0.7 // Trăng dịu hơn nắng (1.5)
};

export const LANE_POSITIONS = [-3, 0, 3]; // Khai báo 3 làn đường (Trái, Giữa, Phải)

// CÀI ĐẶT THÔNG SỐ ĐÁ KHỔNG LỒ
export const CONFIG = {
    GIANT_ROCK_RADIUS: 3,      // Bán kính khối đá (1.5m -> Bề dày 3m, cực kỳ to lớn)
    GIANT_ROCK_SLIDE_Y: 7.0,   // Độ cao tâm của Đá Ép Trượt.
    GIANT_ROCK_JUMP_Y: 0       // Độ cao tâm của Đá Ép Nhảy.
};

// Cấu hình Hệ thống Hạt Lửa
export const MAX_PARTICLES = 200;

// Cấu hình Hệ thống Cây / Núi
export const TOTAL_TREES = 44; // 22 bên Trái, 22 bên Phải
