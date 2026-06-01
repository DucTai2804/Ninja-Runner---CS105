// ==========================================
// 1. KHỞI TẠO CƠ BẢN (Scene, Camera, Renderer)
// ==========================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88aacc); // Màu sương mù khu rừng
// Đẩy sương mù lùi ra xa (từ 20m đến 100m) để mở rộng tầm nhìn phía trước
scene.fog = new THREE.Fog(0x88aacc, 20, 100);

// Giảm FOV xuống 60 để Zoom cận cảnh hơn
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
// Kéo camera lại gần và hạ thấp xuống
camera.position.set(0, 6, 9);
camera.lookAt(0, 0, -10);

let mixer; // Bộ trộn hiệu ứng chuyển động
const clock = new THREE.Clock(); // Đồng hồ đếm thời gian thực

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
// GIỚI HẠN PIXEL RATIO: Ép xuống 1.0 để giải phóng hoàn toàn GPU, giúp game chạm mức 60 FPS dù trên màn hình 2K/4K!
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // Bật bóng đổ
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
// Ngẩng ống kính và quét thẳng về phía chân trời (-15m) để nhìn được đường chạy phía xa
controls.target.set(0, 2.5, -15);
// ==========================================
// 2. HỆ THỐNG CHIẾU SÁNG & BÓNG ĐỔ (Đã nâng cấp)
// ==========================================

// A. Ánh sáng môi trường (Ambient Light): 
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Giảm sáng để góc khuất có bóng râm đen hơn
scene.add(ambientLight);

// B. Đèn bán cầu (Hemisphere Light):
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445544, 0.4);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// C. Đèn định hướng (Directional Light - Nắng xuyên tán lá):
const dirLight = new THREE.DirectionalLight(0xffeedd, 1.5); // Ánh nắng hơi ngả vàng/cam rực rỡ
dirLight.position.set(-20, 25, 10); // Chiếu chéo vắt ngang đường tạo bóng đổ dài
dirLight.castShadow = true;

// Tối ưu hóa bóng đổ: Giảm xuống 1024 để nhẹ GPU gấp 4 lần so với 2048
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;

// Mở rộng phạm vi camera của bóng đổ để bao trọn cả khu vực Sasuke chạy và rừng hai bên
const d = 30;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;

// Bias giúp khử lỗi bóng đổ tự ăn vào bản thân nhân vật (Shadow Acne)
dirLight.shadow.bias = -0.0005;

scene.add(dirLight);

// ==========================================
// 3. TẢI TEXTURE (Vật liệu bề mặt)
// ==========================================
const textureLoader = new THREE.TextureLoader();
const gltfLoader = new THREE.GLTFLoader(); // Dùng chung cho cả nhân vật và cây cối

// Lưu ý: Bạn cần có các file ảnh này trong thư mục 'textures'
// Nếu chưa có ảnh, Threejs sẽ báo lỗi ở console nhưng vẫn rải màu cơ bản
const groundTex = textureLoader.load('textures/ground.jpg');
groundTex.colorSpace = THREE.SRGBColorSpace; // Áp dụng hệ màu chuẩn để cỏ không bị bợt
// Khôi phục MirroredRepeatWrapping để giấu đường nứt bàn cờ do ảnh gốc không liền mạch
groundTex.wrapS = groundTex.wrapT = THREE.MirroredRepeatWrapping;
groundTex.repeat.set(4, 40);
// Tối ưu hóa bộ lọc ảnh khi nhìn ở góc nghiêng (giúp mặt đất xa không bị mờ sọc)
groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const woodTex = textureLoader.load('textures/wood.jpg');
woodTex.colorSpace = THREE.SRGBColorSpace;
const fireTex = textureLoader.load('textures/fire.jpg');
fireTex.colorSpace = THREE.SRGBColorSpace;

const mountainTex = textureLoader.load('textures/mountainjpg.jpg');
mountainTex.colorSpace = THREE.SRGBColorSpace;
mountainTex.wrapS = mountainTex.wrapT = THREE.RepeatWrapping;
mountainTex.repeat.set(3, 3); // Lặp ảnh 3 lần để texture vân đá/vân đất hiển thị sắc nét trên núi khổng lồ

const treeTex = textureLoader.load('textures/tree.jpg');
treeTex.colorSpace = THREE.SRGBColorSpace;
treeTex.wrapS = treeTex.wrapT = THREE.RepeatWrapping;
treeTex.repeat.set(1, 4); // Lặp 4 lần theo chiều dọc để vỏ cây rải đều trên khúc gỗ 10m

// ==========================================
// 4. MẶT ĐẤT, SƯƠNG MÙ, PHÔNG NỀN & CHƯỚNG NGẠI VẬT
// ==========================================

// Mở rộng bề ngang thảm cỏ ra 250m, và kéo dài thành 202m để các tấm cỏ chồng lấn lên nhau 2m ở mép nối
const groundGeo = new THREE.PlaneGeometry(250, 202);
const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: 0.9,
    metalness: 0.05
});

let groundPlanes = [];

for (let i = 0; i < 3; i++) {
    const segmentGroup = new THREE.Group();

    // Mặt đất
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    segmentGroup.add(ground);

    segmentGroup.position.z = -i * 200; // Đứng nối đuôi nhau ở 0, -200, -400
    // Chênh lệch cao độ siêu nhỏ (1cm) để 2m chồng lấn không bị lỗi nhấp nháy (Z-fighting)
    segmentGroup.position.y = -i * 0.01;
    scene.add(segmentGroup);
    groundPlanes.push(segmentGroup); // Mảng này giờ chỉ chứa mặt đất
}

const LANE_POSITIONS = [-3, 0, 3]; // Khai báo 3 làn đường (Trái, Giữa, Phải)

// ==========================================
// CÀI ĐẶT THÔNG SỐ ĐÁ KHỔNG LỒ (Bạn có thể tự do chỉnh sửa tại đây)
// ==========================================
const CONFIG = {
    GIANT_ROCK_RADIUS: 3,      // Bán kính khối đá (1.5m -> Bề dày 3m, cực kỳ to lớn)
    GIANT_ROCK_SLIDE_Y: 7.0,     // Độ cao tâm của Đá Ép Trượt. Mép dưới = 3.0 - 1.5 = 1.5m (Tầm cổ)
    GIANT_ROCK_JUMP_Y: 0     // Độ cao tâm của Đá Ép Nhảy. Mép trên = -0.3 + 1.5 = 1.2m (Tầm ngực)
};

// --- HỆ THỐNG CHƯỚNG NGẠI VẬT & VẬT THỂ RƠI ---
let obstacleRows = [];

// Khởi tạo Đá nhỏ
const obsGeo = new THREE.DodecahedronGeometry(1.2, 0); // Bán kính giảm xuống 1.2 để đá hẹp lại
const obsMat = new THREE.MeshStandardMaterial({
    map: mountainTex,
    color: 0xaaaaaa, // Xám sáng để nổi bật vân đá
    roughness: 1.0,
    flatShading: true
});

// Khởi tạo Đá Khổng Lồ (Đá Tròn To - Sphere)
// Bề ngang và cao cực lớn (Bán kính 20m -> Đường kính 40m), nhưng bề dày (trục Z) vẫn tuân thủ đúng Config của bạn!
const giantRockGeo = new THREE.SphereGeometry(1, 64, 32);
giantRockGeo.scale(20, 20, CONFIG.GIANT_ROCK_RADIUS);
giantRockGeo.rotateZ(Math.PI / 2); // Xoay 2 cực (poles) của khối cầu đâm vào trong vách núi để giấu lỗi UV

// ĐẬP VỠ BỀ MẶT ĐÁ:
const posAttr = giantRockGeo.attributes.position;

// Hàm tạo số ngẫu nhiên giả (pseudo-random) dựa trên tọa độ gốc. 
function hash(val) {
    let r = Math.sin(val) * 43758.5453123;
    return r - Math.floor(r);
}

for (let i = 0; i < posAttr.count; i++) {
    let x = posAttr.getX(i);
    let y = posAttr.getY(i);
    let z = posAttr.getZ(i);

    // Lấy 3 giá trị ngẫu nhiên [0, 1) cố định cho từng tọa độ không gian
    let randX = hash(x * 12.989 + y * 78.233 + z * 37.719);
    let randY = hash(x * 39.346 + y * 11.135 + z * 83.155);
    let randZ = hash(x * 73.156 + y * 52.235 + z * 9.151);

    // Thêm nhiễu ngẫu nhiên. Biên độ vừa phải để không làm sai lệch Hitbox quá mức
    x += (randX - 0.5) * 1.5;
    y += (randY - 0.5) * 1.5;
    z += (randZ - 0.5) * (CONFIG.GIANT_ROCK_RADIUS * 0.4);
    posAttr.setXYZ(i, x, y, z);
}
giantRockGeo.computeVertexNormals(); // Bắt buộc: Tính toán lại góc phản xạ ánh sáng cho bề mặt gồ ghề

// FIX LỖI ĐÁ ĐEN: Texture.clone() bị lỗi bất đồng bộ. Phải Load lại Texture mới!
const giantRockTex = textureLoader.load('textures/mountainjpg.jpg');
giantRockTex.colorSpace = THREE.SRGBColorSpace;
giantRockTex.wrapS = giantRockTex.wrapT = THREE.RepeatWrapping; // Bắt buộc cho .repeat
giantRockTex.repeat.set(8, 4); // Cầu dẹt nên lặp 8x4 là đẹp

const giantRockMat = new THREE.MeshStandardMaterial({
    map: giantRockTex,
    color: 0x999999, // Hơi sẫm hơn đá nhỏ một chút tạo độ ngầu
    roughness: 1.0,
    flatShading: true
});

// Khởi tạo Vách Núi Vuông (Box) để Hitbox và Đồ họa khớp hoàn hảo 100%
const mountainWallGeo = new THREE.BoxGeometry(1, 1, 1, 32, 32, 32);
const mwPosAttr = mountainWallGeo.attributes.position;
for (let i = 0; i < mwPosAttr.count; i++) {
    let x = mwPosAttr.getX(i);
    let y = mwPosAttr.getY(i);
    let z = mwPosAttr.getZ(i);

    let randX = hash(x * 12.989 + y * 78.233 + z * 37.719);
    let randY = hash(x * 39.346 + y * 11.135 + z * 83.155);
    let randZ = hash(x * 73.156 + y * 52.235 + z * 9.151);

    // Gồ ghề bề mặt (Giảm biên độ nhiễu xuống 0.02 để khi bị Scale lên hàng chục lần, các gai nhọn không đâm ra quá xa)
    x += (randX - 0.5) * 0.02;
    y += (randY - 0.5) * 0.02;
    z += (randZ - 0.5) * 0.02;
    mwPosAttr.setXYZ(i, x, y, z);
}
mountainWallGeo.computeVertexNormals();

// Khởi tạo Cây (Khối trụ nằm ngang)
const fallingTreeGeo = new THREE.CylinderGeometry(0.9, 0.9, 30, 8); // Bán kính 0.9 (Rộng 1.8m bằng Sasuke), Dài 30m tạo thành hành lang dài
fallingTreeGeo.rotateX(Math.PI / 2); // Xoay dọc theo Z (chiều chạy của nhân vật)
const barkMat = new THREE.MeshStandardMaterial({ map: treeTex, roughness: 1.0 });
const woodCoreMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1.0 });
const fallingTreeMat = [barkMat, woodCoreMat, woodCoreMat]; // 0: Thân cây, 1 & 2: 2 mặt cắt tròn ở hai đầu

// Khởi tạo Vệt bóng cảnh báo (Vòng tròn đen mờ)
const shadowGeo = new THREE.CircleGeometry(1, 16);
shadowGeo.rotateX(-Math.PI / 2); // Nằm áp sát mặt đất
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
// ==========================================
// HỆ THỐNG TIỀN TỆ & ĐIỂM SỐ
// ==========================================
let gameScore = 0;
let gameCoins = 0;
const scoreUI = document.getElementById('scoreUI');
const coinUI = document.getElementById('coinUI');
const susanooBarContainer = document.getElementById('susanooBarContainer');
const susanooBarInner = document.getElementById('susanooBarInner');

// Khởi tạo Đồng Vàng (Coin)
// Khối trụ mỏng xoay ngang tạo thành đồng xu 3D
const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
coinGeo.rotateX(Math.PI / 2); // Đứng thẳng lên
const coinMat = new THREE.MeshStandardMaterial({
    color: 0xffd700, // Vàng rực rỡ
    metalness: 1.0,
    roughness: 0.3,
    emissive: 0xaa8800,
    emissiveIntensity: 0.2 // Hơi phát sáng nhẹ
});

// ==========================================
// TỐI ƯU HÓA SKILL ĐẠI HỎA CẦU (Chống tụt FPS & Cải thiện Đồ họa)
// ==========================================
// Lõi lửa: Khối cầu sáng chói rực rỡ, sử dụng map lửa
const fireballCoreGeo = new THREE.SphereGeometry(0.8, 16, 16);
const fireballCoreMat = new THREE.MeshBasicMaterial({
    map: fireTex,
    color: 0xffffff // Giữ màu nguyên bản của Texture lửa
});

// Vầng hào quang (Aura) bên ngoài: To hơn, trong suốt, màu cam đỏ rực
const fireballAuraGeo = new THREE.SphereGeometry(1.2, 16, 16);
const fireballAuraMat = new THREE.MeshBasicMaterial({
    map: fireTex, // Đắp Texture ngọn lửa lên hào quang để tạo các vệt cháy không đồng đều
    color: 0xff4500,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending, // Hiệu ứng cộng dồn màu sắc để rực lửa
    depthWrite: false
});

// Hệ thống Hạt Lửa (Particle System) cho Đuôi hỏa cầu
// ÁP DỤNG OBJECT POOLING: Thay vì tạo mới và xóa Mesh liên tục (gây giật lag/tụt FPS),
// ta tạo sẵn 200 hạt lửa và chỉ bật/tắt (visible) để dùng đi dùng lại!
const MAX_PARTICLES = 200;
let fireParticles = []; // Các hạt đang bay
let particlePool = [];  // Kho chứa hạt dự trữ
let particleIndex = 0;

const particleGeo = new THREE.DodecahedronGeometry(1.0, 0);
const particleMat = new THREE.MeshBasicMaterial({
    map: fireTex,
    color: 0xff4500, // Đỏ cam rực
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending, // Trộn màu phát sáng
    depthWrite: false,
    side: THREE.DoubleSide
});

// Khởi tạo Pool Hạt lửa ngay từ đầu để tránh lag lúc tung chiêu
for (let i = 0; i < MAX_PARTICLES; i++) {
    let p = new THREE.Mesh(particleGeo, particleMat);
    p.visible = false;
    // TẮT ĐỔ BÓNG CHO HẠT LỬA để tiết kiệm GPU tối đa
    p.castShadow = false;
    p.receiveShadow = false;
    scene.add(p); // Add sẵn vào scene MỘT LẦN DUY NHẤT
    particlePool.push(p);
}

// Âm thanh Hỏa độn (Katon)
const katonAudio = new Audio('audios/katon_goukakyou.mp4');
katonAudio.volume = 1.0;
window.katonAudio = katonAudio;

// Âm thanh Chidori
const chidoriAudio = new Audio('audios/chidori.mp4');
chidoriAudio.volume = 1.0;
window.chidoriAudio = chidoriAudio;

// ==========================================
// TẠO HIỆU ỨNG CHIDORI
// ==========================================
let isCastingChidori = false;
let chidoriTimer = 0;
let chidoriFadeTimer = 0; // Hiệu ứng từ từ biến mất
let rightHandBone = null;
let middleFingerBone = null;
let rightArmBone = null;
let rightForeArmBone = null;

const chidoriGroup = new THREE.Group();
chidoriGroup.visible = false;

// 1. Quả cầu kín, màu xanh dương, không có lỗ hở
// ĐÂY LÀ ĐOẠN CODE CHỈNH THỂ TÍCH KHỐI CẦU: Thay đổi số 0.35 (lõi ngoài) và 0.20 (lõi trong) để chỉnh độ to nhỏ.
const chidoriCoreGeo = new THREE.IcosahedronGeometry(0.35, 2);
const chidoriCoreMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    wireframe: false, // Hình kín
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});
const chidoriCore = new THREE.Mesh(chidoriCoreGeo, chidoriCoreMat);
chidoriGroup.add(chidoriCore);

const chidoriInnerGeo = new THREE.SphereGeometry(0.20, 16, 16);
const chidoriInnerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0
});
const chidoriInner = new THREE.Mesh(chidoriInnerGeo, chidoriInnerMat);
chidoriGroup.add(chidoriInner);

// 2. Tia điện lòe loẹt xung quanh (Ziczac)
const sparkMaterial = new THREE.LineBasicMaterial({ color: 0x33ccff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
const sparksLines = [];
const sparksCount = 30; // Tăng mật độ tia sét bao quanh
const sparksGroup = new THREE.Group();
chidoriGroup.add(sparksGroup);
for (let i = 0; i < sparksCount; i++) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    let line = new THREE.Line(geo, sparkMaterial);
    sparksGroup.add(line);
    sparksLines.push(line);
}

// 3. Tia sét hình nón bắn ra sau (Tia ziczac bình thường)
const coneLightningCount = 20; // Tăng mật độ tia sét hình nón
const coneLightningMat = new THREE.LineBasicMaterial({ color: 0x66eeff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
const coneLightningLines = [];
const coneGroup = new THREE.Group();
coneGroup.visible = false;
chidoriGroup.add(coneGroup); // Add vào chidoriGroup để dễ scale ngắn lại

for (let i = 0; i < coneLightningCount; i++) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
    let line = new THREE.Line(geo, coneLightningMat);
    coneGroup.add(line);
    coneLightningLines.push(line);
}

// Hàm tạo Hỏa Cầu (Được gọi sau độ trễ)
function spawnFireball() {
    const fireballGroup = new THREE.Group();

    // 1. Lõi lửa
    const core = new THREE.Mesh(fireballCoreGeo, fireballCoreMat);
    fireballGroup.add(core);

    // 2. Hào quang lửa (Gồm 3 lớp lưới lồng vào nhau)
    const aura1 = new THREE.Mesh(fireballAuraGeo, fireballAuraMat);
    const aura2 = new THREE.Mesh(fireballAuraGeo, fireballAuraMat);
    const aura3 = new THREE.Mesh(fireballAuraGeo, fireballAuraMat);

    // Cố tình làm méo nhẹ các lớp ngay từ đầu
    aura1.scale.set(1.0, 1.1, 0.9);
    aura2.scale.set(0.9, 1.0, 1.1);
    aura3.scale.set(1.1, 0.9, 1.0);

    fireballGroup.add(aura1);
    fireballGroup.add(aura2);
    fireballGroup.add(aura3);

    // 3. Nguồn sáng
    const fireLight = new THREE.PointLight(0xff4500, 1.5, 15);
    fireballGroup.add(fireLight);

    if (typeof sasuke !== 'undefined') {
        fireballGroup.position.copy(sasuke.position);
        fireballGroup.position.y += 2.2; // Chiều cao phát nổ từ ĐÚNG MIỆNG SASUKE
    }

    scene.add(fireballGroup);
    fireballs.push({ group: fireballGroup, core: core, aura1: aura1, aura2: aura2, aura3: aura3 });
}

// Hàm tạo các mẫu thế trận chướng ngại vật (Ép người chơi vào thế khó)
function spawnObstaclePattern(rowObstacles, rowCoins = null) {
    // Ẩn hết đá, phi tiêu, cây, bóng, tiền vàng trước khi xếp
    if (rowCoins) {
        rowCoins.forEach(coin => {
            coin.mesh.visible = false;
            coin.collected = false;
        });
    }
    rowObstacles.forEach(obs => {
        obs.rock.visible = false;
        obs.giantRock.visible = false;
        obs.tree.visible = false;
        obs.shadow.visible = false;
        if (obs.shuriken) obs.shuriken.visible = false;

        obs.rock.scale.copy(obs.baseRockScale); // Reset scale về kích thước đá nhỏ mặc định
        obs.rock.castShadow = true; // Reset lại đổ bóng cho đá nhỏ
        obs.tree.scale.set(1, 1, 1); // Reset scale của cây
        obs.giantRock.scale.set(1, 1, 1); // Reset scale của đá khổng lồ
        obs.mountainWall.scale.set(1, 1, 1); // Reset scale của vách núi
        obs.mountainWall.position.set(0, 0, 0);
        obs.mountainWall.visible = false;

        obs.isFalling = false;
        obs.rotSpeedX = 0; // Reset quán tính
        obs.rotSpeedY = 0;
        obs.activeType = 'none';
    });

    let rand = Math.random();

    // ÁP DỤNG CHẾ ĐỘ LUYỆN TẬP
    if (window.practicePattern) {
        let p = window.practicePattern;
        if (p === 1) rand = 0.05;
        else if (p === 2) rand = 0.2;
        else if (p === 3) rand = 0.4;
        else if (p === 4) rand = 0.5;
        else if (p === 5) rand = 0.6;
        else if (p === 6) rand = 0.72;
        else if (p === 7) rand = 0.8;
        else if (p === 8) rand = 0.9;
        else if (p === 9) rand = 0.95;
    }

    if (rand < 0.15) {
        // Mẫu 1 (15%): Dễ - Đá rơi ngẫu nhiên 1 làn
        let lane = Math.floor(Math.random() * 3);
        let obs = rowObstacles[lane];
        obs.activeType = 'rock';
        obs.rock.position.set(LANE_POSITIONS[lane], 1.2, 0);
        obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
        obs.rock.visible = true;
    } else if (rand < 0.30) {
        // Mẫu 2 (15%): Khó - Tường Kép chặn 2 làn (Đá)
        let emptyLane = Math.floor(Math.random() * 3);
        for (let i = 0; i < 3; i++) {
            if (i !== emptyLane) {
                let obs = rowObstacles[i];
                obs.activeType = 'rock';
                obs.rock.position.set(LANE_POSITIONS[i], 1.2, 0);
                obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
                obs.rock.visible = true;
            }
        }
    } else if (rand < 0.45) {
        // Mẫu 3 (15%): Thử thách - Ziczac chéo 3 làn (Đá)
        let lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3; i++) {
            let obs = rowObstacles[i];
            obs.activeType = 'rock';
            obs.rock.position.set(LANE_POSITIONS[lanes[i]], 1.2, -i * 8);
            obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
            obs.rock.visible = true;
        }
    } else if (rand < 0.55) {
        // Mẫu 4 (10%): Phi tiêu lơ lửng - Ép Trượt
        let lane = Math.floor(Math.random() * 3);
        let obs = rowObstacles[lane];
        obs.activeType = 'shuriken';
        if (obs.shuriken) {
            obs.shuriken.position.set(LANE_POSITIONS[lane], 2.5, 0); // Cao 2.5m
            obs.shuriken.visible = true;
        }
    } else if (rand < 0.70) {
        // Mẫu 5 (15%): Cửa tử - 2 đá 2 bên, 1 Phi tiêu lơ lửng ở giữa -> Ép Trượt lách khe
        for (let i = 0; i < 3; i++) {
            let obs = rowObstacles[i];
            if (i === 1) {
                obs.activeType = 'shuriken';
                if (obs.shuriken) {
                    obs.shuriken.position.set(LANE_POSITIONS[i], 2.5, 0);
                    obs.shuriken.visible = true;
                }
            } else {
                obs.activeType = 'rock';
                obs.rock.position.set(LANE_POSITIONS[i], 1.2, 0);
                obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
                obs.rock.visible = true;
            }
        }
    } else if (rand < 0.75) {
        // Mẫu 6 (15%): Thiên thạch rơi trúng đầu! (Tăng tỷ lệ xuất hiện lên)
        let lane = Math.floor(Math.random() * 3);
        let obs = rowObstacles[lane];
        obs.activeType = 'rock';
        obs.isFalling = true;
        obs.rock.castShadow = false; // Tắt đổ bóng thật của thiên thạch để nó không chiếu bóng đen xì lên vách núi!

        obs.startY = 150; // Rớt từ độ cao 150m (Siêu cao)
        obs.targetY = 1.2;
        obs.triggerZ = -100; // Đợi tới 100m mới bắt đầu dội bom! Tốc độ rơi sấm sét!

        obs.rock.position.set(LANE_POSITIONS[lane], obs.startY, 0);
        obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
        obs.rock.visible = true;

        obs.shadow.position.set(LANE_POSITIONS[lane], 0.05, 0);
        obs.shadow.visible = true;
    } else if (rand < 0.85) {
        // Mẫu 7 (10%): Đá khổng lồ mắc kẹt ngang tầm cổ -> Ép TRƯỢT
        let obs = rowObstacles[1];
        obs.activeType = 'giantRock';
        obs.isFalling = false;

        // TÙY CHỈNH HITBOX CHO TẢNG ĐÁ TRƯỢT TẠI ĐÂY (X, Y, Z)
        let cutY = 0.5; // Bạn vừa chốt số này
        obs.hitboxCut = { x: 0.0, y: cutY, z: 5.0, offsetY: cutY / 2 };

        // Tính toán để phần ĐÁY của khối cầu nằm ĐÚNG BẰNG giới hạn clearance bạn đã config
        let bottomY = CONFIG.GIANT_ROCK_SLIDE_Y - CONFIG.GIANT_ROCK_RADIUS;
        obs.giantRock.position.set(0, bottomY + 20, 0); // 20 là bán kính trục Y của khối cầu
        obs.giantRock.visible = true;
    } else if (rand < 0.92) {
        // Mẫu 8 (7%): Đá khổng lồ chìm dưới đất -> Ép NHẢY
        let obs = rowObstacles[1];
        obs.activeType = 'giantRock';
        obs.isFalling = false;

        // TÙY CHỈNH HITBOX CHO TẢNG ĐÁ NHẢY TẠI ĐÂY (X, Y, Z)
        let cutY = 0.5; // Bạn vừa chốt số này
        obs.hitboxCut = { x: 0.0, y: cutY, z: 5.0, offsetY: -cutY / 2 };

        // Tính toán để phần ĐỈNH của khối cầu nằm ĐÚNG BẰNG giới hạn clearance bạn đã config
        let topY = CONFIG.GIANT_ROCK_JUMP_Y + CONFIG.GIANT_ROCK_RADIUS;
        obs.giantRock.position.set(0, topY - 20, 0); // 20 là bán kính trục Y của khối cầu
        obs.giantRock.visible = true;
    } else {
        // Mẫu 9 (8%): Vách núi khổng lồ nhô ra chặn 2 làn + Phi tiêu bay ở làn an toàn
        let isLeft = Math.random() > 0.5;
        let shurikenLane = isLeft ? 2 : 0;  // Bắn phi tiêu ở làn còn lại

        // Vách núi khổng lồ đè 2 làn
        let obsWall = rowObstacles[1];
        obsWall.activeType = 'mountainWall';
        obsWall.isFalling = false;

        // TÙY CHỈNH KÍCH THƯỚC VÀ HITBOX CHO VÁCH NÚI NHÔ RA
        // Base Geometry là BoxGeometry 1x1x1. Scale sẽ trở thành kích thước mét thật!
        // - Trục X: 100m (Vươn dài ra để chạm vào một phần của núi khổng lồ)
        // - Trục Y: 40m (Cao từ đất lên trời)
        // - Trục Z: 100m (Siêu vách núi 100 mét)
        obsWall.mountainWall.scale.set(100.0, 40.0, 100.0);

        // BoxGeometry vuông vắn hoàn hảo, không có góc lừa!
        // Hitbox gọt 4m chiều X (thu vào 2m mỗi bên) để bù trừ phần gai đá đâm ra, đảm bảo tuyệt đối không lấn làn an toàn
        let cutZ = 5.0;
        obsWall.hitboxCut = { x: 4.0, y: 0.0, z: cutZ, offsetX: 0, offsetY: 0, offsetZ: 0 };

        // ScaleX = 100, bán kính = 50. 
        // Đặt ở X = 49.5 thì mép đá sẽ nằm ở 49.5 - 50 = -0.5 (Chặn gọn gàng làn giữa, không lấn làn an toàn)
        let wallX = isLeft ? -49.5 : 49.5;
        obsWall.mountainWall.position.set(wallX, 20, 0); // Y = 20 vì tâm nằm ở giữa khối Box cao 40m
        obsWall.mountainWall.visible = true;

        // Phi tiêu: Ép người chơi trượt để né khi đang đi vào làn an toàn duy nhất
        let obsShuriken = rowObstacles[shurikenLane];
        if (obsShuriken.shuriken) {
            obsShuriken.activeType = 'shuriken';
            // Cố định bay ở độ cao 2.5m (Ép TRƯỢT) để sát thủ hơn, không bị lệt xệt dưới đất
            obsShuriken.shuriken.position.set(LANE_POSITIONS[shurikenLane], 2.5, 0);
            obsShuriken.shuriken.visible = true;
        } else {
            // Backup nếu shuriken chưa load
            obsShuriken.activeType = 'rock';
            obsShuriken.rock.position.set(LANE_POSITIONS[shurikenLane], 1.2, 0);
            obsShuriken.rock.visible = true;
        }
    }

    // --- RẢI TIỀN VÀNG DỌC THEO LÀN AN TOÀN ---
    if (rowCoins) {
        let safeLanes = [0, 1, 2];

        // Quét các chướng ngại vật để loại bỏ làn nguy hiểm
        let centerObs = rowObstacles[1];
        if (centerObs.activeType === 'giantRock') {
            // Đá khổng lồ che hết, không rải vàng dưới đất (người chơi phải nhảy/trượt)
            // Hoặc rải trên không? Để đơn giản ta không rải vàng ở mẫu này
            safeLanes = [];
        } else if (centerObs.activeType === 'mountainWall') {
            // Vách núi che 2 làn, chừa lại 1 làn
            let wallX = centerObs.mountainWall.position.x;
            if (wallX < 0) safeLanes = [2]; // Che trái & giữa -> Phải an toàn
            else safeLanes = [0]; // Che phải & giữa -> Trái an toàn
        } else {
            // Quét từng chướng ngại vật thường
            safeLanes = [];
            for (let i = 0; i < 3; i++) {
                let obs = rowObstacles[i];
                if (obs.activeType === 'none' || obs.activeType === 'shuriken') {
                    // Nếu là làn trống hoặc phi tiêu chìm (ép nhảy) thì vẫn là đường có thể đi
                    safeLanes.push(i);
                }
            }
        }

        // Nếu có làn an toàn, chọn ngẫu nhiên 1 làn để rải 1 dải 5 đồng xu
        if (safeLanes.length > 0) {
            let selectedLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
            let laneX = LANE_POSITIONS[selectedLane];

            // Xếp 5 đồng xu trải dài theo trục Z (khoảng cách 8m mỗi đồng, tổng 32m)
            for (let c = 0; c < 5; c++) {
                let coinObj = rowCoins[c];
                coinObj.mesh.position.set(laneX, 1.0, -c * 8 + 16); // y=1.0 để lơ lửng vừa tầm ăn
                coinObj.mesh.visible = true;
                coinObj.collected = false;
            }
        }
    }
}

// Khởi tạo 8 hàng chướng ngại vật (Che phủ 440m)
for (let i = 0; i < 8; i++) {
    let rowGroup = new THREE.Group();
    let rowObstacles = [];

    // Mỗi hàng nạp sẵn 3 Slot chứa Đá, Phi tiêu, Cây và Bóng
    for (let j = 0; j < 3; j++) {
        let obsSlot = {
            rock: new THREE.Mesh(obsGeo, obsMat),
            giantRock: new THREE.Mesh(giantRockGeo, giantRockMat), // Bổ sung tảng đá khổng lồ Lục Giác
            mountainWall: new THREE.Mesh(mountainWallGeo, giantRockMat), // Bổ sung vách núi hình chữ nhật
            tree: new THREE.Mesh(fallingTreeGeo, fallingTreeMat),
            shadow: new THREE.Mesh(shadowGeo, shadowMat.clone()), // CLONE để mỗi bóng có thể tự thay đổi độ mờ độc lập!
            shuriken: null, // Sẽ load sau
            activeType: 'none',
            // Thuộc tính vật lý cho rơi tự do
            isFalling: false,
            targetY: 0,
            startY: 0,
            fallSpeedMult: 1.0,
            triggerZ: -200, // Điểm kích hoạt bắt đầu rơi (Mặc định rơi ngay từ lúc xuất hiện)
            rotSpeedX: 0,   // Tốc độ xoay (để làm quán tính)
            rotSpeedY: 0,

            helperBox: new THREE.Box3(),
            helper: null
        };

        obsSlot.rock.castShadow = true;
        obsSlot.rock.receiveShadow = true;
        obsSlot.giantRock.castShadow = true;
        obsSlot.giantRock.receiveShadow = true;
        obsSlot.mountainWall.castShadow = true;
        obsSlot.mountainWall.receiveShadow = true;
        obsSlot.tree.castShadow = true;
        obsSlot.tree.receiveShadow = true;

        // Vệt bóng cảnh báo nằm cách mặt đất 0.05m để không bị Z-fighting
        obsSlot.shadow.position.y = 0.05;

        // ÉP CÂN ĐÁ: Cố định bề ngang hẹp (Trục X, Z), nhưng cho phép vươn cao (Trục Y)
        let scaleXZ = 0.8 + Math.random() * 0.3; // Bề ngang tuyệt đối < 2.64m
        let scaleY = 1.0 + Math.random() * 0.8;  // Nhọn lên
        obsSlot.rock.scale.set(scaleXZ, scaleY, scaleXZ);
        obsSlot.baseRockScale = new THREE.Vector3(scaleXZ, scaleY, scaleXZ); // Lưu lại để dùng cho Đá khổng lồ

        // Tạo hộp Helper màu đỏ để debug Hitbox
        obsSlot.helper = new THREE.Box3Helper(obsSlot.helperBox, 0xff0000);
        obsSlot.helper.visible = false;
        scene.add(obsSlot.helper);

        rowGroup.add(obsSlot.rock);
        rowGroup.add(obsSlot.giantRock);
        rowGroup.add(obsSlot.mountainWall);
        rowGroup.add(obsSlot.tree);
        rowGroup.add(obsSlot.shadow);
        rowObstacles.push(obsSlot);
    }

    // Khởi tạo mảng Tiền Vàng (Coins) đi kèm theo từng hàng chướng ngại vật
    let rowCoins = [];
    for (let c = 0; c < 5; c++) { // Tối đa 5 đồng xu nối tiếp nhau
        let coin = new THREE.Mesh(coinGeo, coinMat);
        coin.castShadow = true;
        coin.receiveShadow = true;
        coin.visible = false;
        rowGroup.add(coin);
        rowCoins.push({ mesh: coin, collected: false });
    }

    // Rải 5 hàng cách nhau 55m (Kéo giãn Pacing)
    rowGroup.position.z = -30 - (i * 55);
    spawnObstaclePattern(rowObstacles, rowCoins); // Xếp trận

    scene.add(rowGroup);
    obstacleRows.push({ group: rowGroup, obstacles: rowObstacles, coins: rowCoins });
}

// --- BẮT ĐẦU: HỆ THỐNG DÃY NÚI (Tái sử dụng biến hệ thống Cây để tối ưu) ---
const dummy = new THREE.Object3D();
const TOTAL_TREES = 44; // 22 bên Trái (14 đồi, 8 núi), 22 bên Phải (14 đồi, 8 núi)
const treeData = [];

// 1. Dựng dãy núi Low-poly rải đều (Bao phủ 400m để không bị trống khi Susanoo nhìn xa 300m)
for (let i = 0; i < TOTAL_TREES; i++) {
    let isLeft = i < 22;
    let localIndex = isLeft ? i : (i - 22); // 0 -> 21
    let isLowHill = localIndex < 14; // 14 cái đầu là đồi thấp, 8 cái sau là núi cao
    let posIndex = isLowHill ? localIndex : (localIndex - 14);

    // Đồi thấp chia 400m cho 14, núi cao chia 400m cho 8
    let zSpacing = isLowHill ? (400 / 14) : (400 / 8);
    let zPos = 15 - posIndex * zSpacing;

    let type = isLowHill ? 3 : (posIndex % 3);
    let baseRadius = 0;
    // Làm cho các núi cao to bự ra (phình ra)
    if (type === 3) baseRadius = 25;
    else baseRadius = type === 0 ? 60 : (type === 1 ? 70 : 50);

    // Đồi thấp sát đường, núi cao lùi xa ra phía sau đồi 
    let targetEdge = isLowHill ? (3 + Math.random() * 2) : (35 + Math.random() * 15);
    let xPos = baseRadius + targetEdge;

    treeData.push({
        x: isLeft ? -xPos : xPos,
        y: isLowHill ? -5 : -10,
        z: zPos,
        r: Math.random() * Math.PI * 2,
        s: 1.0,
        type: type,
        isLeft: isLeft,
        isLowHill: isLowHill
    });
}

const treeInstancedMeshes = [];

// Hàm cập nhật ma trận cho toàn bộ cây
function updateTreeMatrices() {
    let typeIndices = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < treeData.length; i++) {
        let t = treeData[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.r, 0);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();

        let instanceIdx = typeIndices[t.type];
        for (let j = 0; j < treeInstancedMeshes.length; j++) {
            if (treeInstancedMeshes[j].type === t.type) {
                treeInstancedMeshes[j].mesh.setMatrixAt(instanceIdx, dummy.matrix);
                treeInstancedMeshes[j].mesh.instanceMatrix.needsUpdate = true;
            }
        }
        typeIndices[t.type]++;
    }
}

// 2. TẠO DÃY NÚI BẰNG TOÁN HỌC NGUYÊN THỦY
const treeGeos = [
    new THREE.ConeGeometry(60, 140, 4), // Núi nhọn, cao vút, phình to
    new THREE.ConeGeometry(70, 120, 5), // Núi béo, lùn, phình to
    new THREE.ConeGeometry(50, 160, 3), // Núi sắc nhọn, phình to
    new THREE.ConeGeometry(25, 40, 4) // Đồi thấp (bề ngang to 25) để không vướng cánh, nối liền nhau
];
// Kéo chân núi lên ngang mặt đất
treeGeos[0].translate(0, 70, 0);
treeGeos[1].translate(0, 60, 0);
treeGeos[2].translate(0, 80, 0);
treeGeos[3].translate(0, 20, 0);

const treeMat = new THREE.MeshStandardMaterial({
    map: mountainTex, // Phủ lớp ảnh vân núi lên các mặt phẳng
    color: 0xdddddd, // Màu nền hơi xám để làm nổi bật Texture gốc
    flatShading: true, // Góc cạnh hầm hố
    roughness: 1.0
});

treeGeos.forEach((geo, index) => {
    let typeCount = treeData.filter(t => t.type === index).length;
    let instanced = new THREE.InstancedMesh(geo, treeMat, typeCount);
    // TẮT HOÀN TOÀN ĐỔ BÓNG CHO RỪNG CÂY: Vẽ bóng cho 300 cây là giết chết GPU.
    instanced.castShadow = false;
    instanced.receiveShadow = true;

    // Mặc định ẩn các núi khổng lồ (type 0, 1, 2) để tiết kiệm GPU, chỉ hiện đồi thấp (type 3)
    if (index < 3) {
        instanced.visible = false;
    }

    scene.add(instanced);
    treeInstancedMeshes.push({ mesh: instanced, type: index });
});

// Không có màn hình chờ (Loading Screen) nữa, gọi luôn hàm xếp cây ra sân!
updateTreeMatrices();

// --- KẾT THÚC HỆ THỐNG CÂY 3D ---

// ==========================================
// 5. NHÂN VẬT SASUKE (Đã có Animation)
// ==========================================
const sasuke = new THREE.Group();
scene.add(sasuke);

// Thêm các hiệu ứng Chidori vào
sasuke.add(chidoriGroup);

// FIX: Hộp va chạm ban đầu cao tới 3.5m (Gấp đôi Sasuke), khiến nó chạm vào cây dù đã trượt xuống!
// Đã giảm xuống còn 1.8m (Đúng bằng chiều cao thật của Sasuke). Rộng 1.0m.
const sasukeHitboxGeo = new THREE.BoxGeometry(1.0, 1.8, 1.0);
const sasukeHitboxMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
const sasukeHitbox = new THREE.Mesh(sasukeHitboxGeo, sasukeHitboxMat);
sasukeHitbox.visible = false; // Tắt mặc định
// Không add vào sasuke nữa, ta sẽ add thẳng vào xương Hông (hipsBone) lúc load model!

// Hàm hiển thị lỗi lên màn hình để dễ debug
function showDebugError(msg) {
    const infoDiv = document.getElementById('info');
    if (infoDiv) {
        const errorP = document.createElement('p');
        errorP.style.color = '#ff4444';
        errorP.style.fontWeight = 'bold';
        errorP.style.textShadow = '1px 1px 2px black';
        errorP.innerText = "❌ Lỗi: " + msg;
        infoDiv.appendChild(errorP);
    }
    console.error(msg);
}

// Tải file model dạng .glb (Mô hình đã được bake sẵn hoạt ảnh)
gltfLoader.load('models/Characters/sasuke/sasuke_with_chidori.glb', function (gltf) {
    // ... Giữ nguyên Sasuke Loader
    const model = gltf.scene;

    // 1. FIX LỖI TÀNG HÌNH DO KÍCH THƯỚC KHỔNG LỒ
    model.scale.set(5, 5, 5); // Thu nhỏ 100 lần. Nếu vẫn không thấy, thử đổi thành 1, 1, 1 (5,5,5) cho sasuke
    model.rotation.y = Math.PI
    model.position.y = 0; // Đặt nhân vật đứng đúng mặt đất

    // Cập nhật ma trận tuyệt đối NGAY LẬP TỨC để đọc đúng Scale của xương
    model.updateMatrixWorld(true);

    model.traverse(function (child) {
        if (child.isBone) {
            let name = child.name.toLowerCase();
            // Truy tìm Xương Hông (Trung tâm cơ thể) để làm mốc
            if (!hipsBone && (name.includes('hip') || name.includes('spine') || name.includes('pelvis') || name.includes('root'))) {
                hipsBone = child;
                console.log("Đã dò thấy xương trung tâm:", child.name);

                // Ý KIẾN CỦA BẠN QUÁ ĐỈNH! Gắn thẳng Hitbox vào xương để nó tự xoay/di chuyển.
                hipsBone.add(sasukeHitbox);

                // Đọc Tỷ lệ tuyệt đối (World Scale) của xương để bù trừ (Chống lỗi Scale 0.01 từ Blender)
                let worldScale = new THREE.Vector3();
                hipsBone.getWorldScale(worldScale);

                // Ép Hitbox luôn giữ đúng kích thước 1.5x3.5x1.5 trong thế giới thực, bất chấp xương bị to/nhỏ cỡ nào!
                sasukeHitbox.scale.set(1 / worldScale.x, 1 / worldScale.y, 1 / worldScale.z);

                // Tâm của xương hông thường nằm ngay thắt lưng, đẩy lên 1 chút để không bị tụt xuống đất
                sasukeHitbox.position.set(0, 0, 0);
            }

            // Truy tìm xương để gắn Chidori và điều khiển tay
            if (name.includes('right')) {
                if (name.includes('hand') && !rightHandBone) rightHandBone = child;
                if (name.includes('middle') && !middleFingerBone) middleFingerBone = child;
                if (name.includes('arm') && !name.includes('fore') && !rightArmBone) rightArmBone = child;
                if (name.includes('forearm') && !rightForeArmBone) rightForeArmBone = child;
            }
        }

        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // 2. FIX LỖI "TÀNG HÌNH KHI QUAY CAMERA"
            // (Chống Three.js tự ý cắt bỏ nhân vật khi camera thay đổi góc)
            child.frustumCulled = false;

            if (child.material) {
                // 3. FIX ĐỘ BÓNG
                child.material.metalness = 0.0;
                child.material.roughness = 0.8;

                // 4. FIX BỆNH "XUYÊN THẤU/LỘN XỘN BỘ PHẬN" (QUAN TRỌNG NHẤT)
                // Ép vật liệu phải đặc ruột và ghi nhớ độ sâu
                child.material.transparent = false;
                child.material.depthWrite = true;

                // 5. FIX LỖI THỦNG LỖ QUẦN ÁO
                // Ép vẽ cả mặt trong lẫn mặt ngoài của lưới
                child.material.side = THREE.DoubleSide;
            }
        }
    });

    // --- QUẢN LÝ VÀ PHÁT ANIMATION (CROSSFADE) ---
    mixer = new THREE.AnimationMixer(model);

    // Lắng nghe sự kiện khi một hoạt ảnh không lặp (như tung chiêu) chạy xong frame cuối cùng
    mixer.addEventListener('finished', function (e) {
        if (isCastingSkill1) {
            isCastingSkill1 = false;
            // Ép trả về chuyển động chạy lập tức, KHÔNG HÒA TRỘN (fade = 0)
            if (!isJumping && !isSliding && !isCastingChidori) {
                let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                playAnimation(runAnim, true, 0);
            }
        }
        if (isCastingChidori) {
            isCastingChidori = false;
            currentSpeed = baseSpeed;
            chidoriFadeTimer = 0.5; // Bắt đầu mờ dần thay vì tắt ngay lập tức
            if (!isJumping && !isSliding && !isCastingSkill1) {
                let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                playAnimation(runAnim, true, 0);
            }
        }
    });

    if (gltf.animations && gltf.animations.length > 0) {
        let i = 0;
        gltf.animations.forEach((clip) => {
            let name = clip.name.toLowerCase();
            // Đề phòng trường hợp người dùng lười đặt tên, tất cả đều là "mixamo.com"
            if (sasukeAnimations[name]) name = name + "_" + i;

            let action = mixer.clipAction(clip);
            sasukeAnimations[name] = action;
            sasukeAnimList.push({ name: name, action: action });
            console.log(`[Animation] Tải thành công: ${name} (Index: ${i})`);
            i++;
        });

        // Tìm tự động và phát Animation chạy (Run)
        let runAnimName = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
        playAnimation(runAnimName, true);

        console.log("Đã tải thành công mô hình GLB và kích hoạt hoạt ảnh!");
    } else {
        console.warn("File này không chứa hoạt ảnh nào!");
    }

    sasukeHitbox.visible = false;
    sasukeModel = model;
    sasuke.add(sasukeModel);
}, undefined, function (error) {
    showDebugError("Không thể tải file sasukefull.glb: " + error.message);
});

// --- LOAD MODEL PHI TIÊU (SHURIKEN) ---
gltfLoader.load('models/Dangers/true_shuriken_scale.glb', function (gltf) {
    let shurikenModel = gltf.scene;

    // Áp dụng tỷ lệ đồng dạng tuyệt đối với Sasuke (5, 5, 5)
    shurikenModel.scale.set(5, 5, 5);

    // Cho phép Phi tiêu đổ bóng nhưng giữ nguyên màu gốc của file GLB
    shurikenModel.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Phân phát Phi tiêu vào toàn bộ các Slot Chướng ngại vật trên đường đua
    obstacleRows.forEach(row => {
        row.obstacles.forEach(obs => {
            let clone = shurikenModel.clone();
            clone.visible = false;
            row.group.add(clone);
            obs.shuriken = clone;
        });
    });
    console.log("Đã trang bị xong hệ thống Phi tiêu Tử thần!");
});

// --- LOAD MODEL SUSANOO ---
gltfLoader.load('models/Characters/sasuke/susanoo_animation.glb', function (gltf) {
    susanooModel = gltf.scene;
    susanooModel.visible = false; // Mặc định ẩn

    // ==========================================
    // BẠN CÓ THỂ CHỈNH SỬA THÔNG SỐ SUSANOO Ở ĐÂY
    // ==========================================
    susanooModel.scale.set(5, 5, 5); // Độ lớn

    // Nâng bổng Susanoo lên cao (Y). Hiện tại đang đặt là 5.0 mét.
    // Nếu vẫn chưa ưng ý, bạn hãy tự thay đổi số 5.0 này nhé!
    susanooModel.position.y = 17.0;

    // Hướng xoay của Susanoo. Math.PI = 180 độ.
    // Nếu muốn đổi hướng, bạn có thể chỉnh thành 0, hoặc Math.PI / 2 (90 độ), -Math.PI / 2...
    susanooModel.rotation.y = Math.PI;
    // ==========================================

    sasuke.add(susanooModel); // Gắn trực tiếp vào Sasuke

    susanooMixer = new THREE.AnimationMixer(susanooModel);

    // Đọc các animation (đề phòng trùng tên, ta duyệt qua)
    if (gltf.animations && gltf.animations.length > 0) {
        gltf.animations.forEach((clip) => {
            let name = clip.name.toLowerCase();
            let action = susanooMixer.clipAction(clip);
            susanooAnimations[name] = action;
            console.log(`[Susanoo Anim] Tải thành công: ${name}`);
        });
    }

    // Lắng nghe sự kiện chém xong
    susanooMixer.addEventListener('finished', function (e) {
        let isSlashAction = (e.action === susanooAnimations['slash'] || e.action === susanooAnimations['slash_0']);
        if (isSusanooSlashing && isSlashAction) {
            isSusanooSlashing = false;
            // Trở về fly mượt mà
            let flyAnim = Object.keys(susanooAnimations).find(k => k.includes('fly'));
            if (flyAnim && susanooAnimations[flyAnim]) {
                let flyAction = susanooAnimations[flyAnim];
                flyAction.reset().fadeIn(0.2).play();
            }
        }
    });

    // Ép GPU biên dịch trước shader để chống giật lag trong lần đầu sử dụng
    susanooModel.visible = true;
    renderer.compile(scene, camera);
    susanooModel.visible = false;

    console.log("Đã tải xong model Susanoo!");
});

// ==========================================
// 6. TRẠNG THÁI GAME, VẬT LÝ & KỸ NĂNG
// ==========================================
let baseSpeed = 0.3;
let currentSpeed = baseSpeed;
let isSusanooActive = false;
let isSusanooSlashing = false;
let susanooTimer = 0;
let susanooTransformTimer = 0; // Đếm ngược 0.1s để biến mất
let cameraTransitionTime = 0; // Thời gian nội suy chuyển đổi góc camera
let susanooMixer = null;
let susanooAnimations = {};
let susanooModel = null;
let sasukeModel = null; // Lưu trữ model Sasuke gốc

// Hệ thống luồng lửa bùng nổ (Aura Blast)
let activeBlasts = [];
function createFlameBlast() {
    let group = new THREE.Group();
    sasuke.add(group);

    // Lõi lửa trắng
    let coreGeo = new THREE.CylinderGeometry(0.1, 4, 15, 32, 1, true);
    let coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    let coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 5;
    group.add(coreMesh);

    // Vầng lửa tím
    let outerGeo = new THREE.CylinderGeometry(1, 8, 20, 32, 1, true);
    let outerMat = new THREE.MeshBasicMaterial({ color: 0xcc00ff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    let outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.y = 5;
    group.add(outerMesh);

    // Quả cầu nổ ở gốc
    let sphereGeo = new THREE.SphereGeometry(4, 32, 32);
    let sphereMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    let sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
    sphereMesh.position.y = 2;
    group.add(sphereMesh);

    activeBlasts.push({
        group: group,
        coreMat: coreMat,
        outerMat: outerMat,
        sphereMat: sphereMat,
        life: 1.0 // Sống 1 giây
    });
}

let fireballs = [];
let hipsBone = null; // Lưu trữ xương hông
let headBone = null; // Lưu trữ xương đầu để bóp Hitbox linh động

let isCastingSkill1 = false;
let skill1Timer = 0;
let fireballSpawnDelay = 0; // Trễ tung hỏa cầu

// Quản lý Animation
let sasukeAnimations = {};
let sasukeAnimList = [];
let currentAction = null;

function playAnimation(animName, loop = true, fadeDuration = 0.2) {
    let newAction = sasukeAnimations[animName];
    if (!newAction || newAction === currentAction) return;

    newAction.reset();
    newAction.setEffectiveTimeScale(1.0);
    newAction.setEffectiveWeight(1.0);

    if (loop) {
        newAction.setLoop(THREE.LoopRepeat, Infinity);
        newAction.clampWhenFinished = false;
    } else {
        newAction.setLoop(THREE.LoopOnce, 1);
        newAction.clampWhenFinished = true; // Dừng lại ở frame cuối cùng khi phát xong
    }

    if (currentAction) {
        if (fadeDuration > 0) {
            // QUAN TRỌNG: warpBoolean = false để KHÔNG BỊ BIẾN DẠNG THỜI GIAN (Slow motion)
            newAction.crossFadeFrom(currentAction, fadeDuration, false);
        } else {
            currentAction.stop(); // Cắt ngay lập tức, không hòa trộn (Tránh bị đơ)
        }
    }

    newAction.play();
    currentAction = newAction;
    return newAction; // Trả về action để có thể đọc thời lượng (duration)
}

// Vật lý (Nhảy & Trượt) - Kết hợp Animation Blender + Bệ phóng Toán học
let isJumping = false;
let jumpTimer = 0;
let jumpDuration = 0; // Lưu tổng thời gian nhảy để tính đường cong Parabol
let isSliding = false;
let slideTimer = 0;


// ==========================================
// HỆ THỐNG DEBUG HITBOX (PHÍM H)
// ==========================================
let showHitbox = false;
// Box3 dùng cho chướng ngại vật (AABB)
const obsBox = new THREE.Box3();
const fireballBox = new THREE.Box3();

// THAY THẾ BOX3 BẰNG OBB CHO SASUKE (Va chạm nghiêng chuẩn xác 100%)
const sasukeOBB_base = new THREE.OBB(new THREE.Vector3(), new THREE.Vector3(1.5 / 2, 3.5 / 2, 1.5 / 2));
const sasukeOBB = new THREE.OBB();

// Tắt khung Xanh lá vuông góc đi, vì giờ ta xài Khung nghiêng OBB!
const sasukeBox = new THREE.Box3();
const sasukeBoxHelper = new THREE.Box3Helper(sasukeBox, 0x00ff00);
sasukeBoxHelper.visible = false; // Bỏ hẳn
scene.add(sasukeBoxHelper);

// ==========================================
// HÀM RESET GAME (CHƠI LẠI TRỰC TIẾP KHÔNG LOAD LẠI TRANG)
// ==========================================
window.resetGame = function () {
    // Ẩn UI Game Over
    document.getElementById('gameOverUI').style.display = 'none';

    // Đặt lại Sasuke
    currentSpeed = baseSpeed;
    currentLane = 1;
    targetLaneX = 0;
    sasuke.position.set(0, 0, 0);
    sasuke.rotation.set(0, 0, 0);
    isJumping = false;
    isSliding = false;
    isCastingSkill1 = false;
    isCastingChidori = false;
    chidoriFadeTimer = 0;
    if (typeof chidoriGroup !== 'undefined') chidoriGroup.visible = false;
    fireballSpawnDelay = 0;
    isSusanooActive = false;
    susanooTimer = 0;
    if (susanooBarContainer) susanooBarContainer.style.display = 'none';
    if (susanooModel) susanooModel.visible = false;
    if (susanooMixer) susanooMixer.stopAllAction();

    // --- RESET ĐIỂM SỐ & TIỀN VÀNG ---
    gameScore = 0;
    gameCoins = 0;
    if (scoreUI) scoreUI.innerText = "0";
    if (coinUI) coinUI.innerText = "0 🪙";

    // Phát lại hoạt ảnh chạy
    if (mixer && sasukeAnimations) {
        let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
        playAnimation(runAnim, true, 0.2);
    }

    // Xóa hết hỏa cầu đang bay
    fireballs.forEach(fbObj => scene.remove(fbObj.group));
    fireballs = [];

    // Xóa hết hạt lửa bằng cách ẩn đi trả về Pool
    fireParticles.forEach(pObj => {
        pObj.mesh.visible = false;
    });
    fireParticles = [];

    // Đặt lại nền đất
    for (let i = 0; i < groundPlanes.length; i++) {
        groundPlanes[i].position.set(0, -0.1, -i * 200);
    }

    // Đặt lại chướng ngại vật về vị trí chờ (-30, -85, -140...)
    for (let i = 0; i < obstacleRows.length; i++) {
        let row = obstacleRows[i];
        row.group.position.set(0, 0, -30 - i * 55);
        spawnObstaclePattern(row.obstacles, row.coins);
    }

    // Đặt lại mảng Instancing rừng núi
    for (let i = 0; i < TOTAL_TREES; i++) {
        let isLeft = treeData[i].isLeft;
        let isLowHill = treeData[i].isLowHill;
        let localIndex = isLeft ? i : (i - 22);
        let posIndex = isLowHill ? localIndex : (localIndex - 14);

        let zSpacing = isLowHill ? (400 / 14) : (400 / 8);
        treeData[i].z = 15 - posIndex * zSpacing;

        let type = treeData[i].type;
        let baseRadius = 0;
        if (type === 3) baseRadius = 25;
        else baseRadius = type === 0 ? 60 : (type === 1 ? 70 : 50);

        let targetEdge = isLowHill ? (3 + Math.random() * 2) : (35 + Math.random() * 15);
        let xPos = baseRadius + targetEdge;
        treeData[i].x = isLeft ? -xPos : xPos;
        treeData[i].y = isLowHill ? -5 : -10;
    }
    updateTreeMatrices();

    // Trả Camera về đúng góc nhìn mặc định như khi ấn F5
    camera.position.set(0, 6, 9);
    if (controls) {
        controls.target.set(0, 2.5, -15);
        controls.update();
    }
}

// Lắng nghe phím bấm
let currentLane = 1; // Bắt đầu ở làn giữa (0: Trái, 1: Giữa, 2: Phải)
let targetLaneX = 0; // Tọa độ X mục tiêu để nội suy (Lerp) di chuyển mượt

document.addEventListener('keydown', (event) => {
    // Bật/tắt Debug Hitbox
    if (event.key === 'h' || event.key === 'H') {
        showHitbox = !showHitbox;
        // Chỉ hiện hộp Mesh nghiêng OBB, hộp vuông góc AABB vứt đi!
        sasukeHitbox.visible = showHitbox;
        console.log("Chế độ Debug Hitbox:", showHitbox ? "BẬT" : "TẮT");
    }

    // Tịnh tiến 3 làn như Subway Surfers
    if ((event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') && currentLane > 0) {
        currentLane--;
        targetLaneX = LANE_POSITIONS[currentLane];
    }
    if ((event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') && currentLane < 2) {
        currentLane++;
        targetLaneX = LANE_POSITIONS[currentLane];
    }

    // Nhảy (Jump) - Phím Lên / W
    if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        if (!isJumping && !isSliding && !isCastingSkill1) {
            isJumping = true;

            // Tìm animation có chữ jump
            let jumpAnim = Object.keys(sasukeAnimations).find(k => k.includes('jump')) || sasukeAnimList[1]?.name || sasukeAnimList[0].name;
            let action = playAnimation(jumpAnim, false);

            // Đồng bộ thời gian nhảy bằng đúng thời lượng Animation
            if (action) {
                jumpTimer = action.getClip().duration;
                jumpDuration = jumpTimer;
            } else {
                jumpTimer = 1.0;
                jumpDuration = 1.0;
            }
        }
    }

    // Trượt (Slide) - Phím Xuống / S
    if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        if (!isJumping && !isSliding && !isCastingSkill1) {
            isSliding = true;

            // Tìm animation trượt
            let slideAnim = Object.keys(sasukeAnimations).find(k => k.includes('slide')) || sasukeAnimList[2]?.name || sasukeAnimList[0].name;
            let action = playAnimation(slideAnim, false);

            // Đồng bộ thời gian trượt bằng đúng thời lượng của Animation trong Blender!
            if (action) {
                slideTimer = action.getClip().duration;
            } else {
                slideTimer = 1.0; // Dự phòng
            }
        }
    }

    // Chơi lại (Restart Game) - Phím Backspace
    if (event.key === 'Backspace' || event.keyCode === 8) {
        if (currentSpeed === 0) { // Chỉ cho phép khởi động lại khi đã Game Over
            resetGame();
        }
    }

    // Skill 1: Hỏa cầu
    if (event.key === '1') {
        // Kích hoạt Hoạt ảnh Tung chiêu (nếu không bận làm gì khác)
        if (!isJumping && !isSliding && !isCastingSkill1) {
            isCastingSkill1 = true;
            let skillAnim = Object.keys(sasukeAnimations).find(k => k.includes('fireball')) || sasukeAnimList[0].name;

            // Ép fadeDuration = 0 vì user đã đồng bộ mượt sẵn từ Blender
            playAnimation(skillAnim, false, 0);

            // Hẹn giờ ném Hỏa cầu (Tôn trọng delay của user)
            fireballSpawnDelay = 2.0;

            // Phát âm thanh
            if (window.katonAudio) {
                window.katonAudio.currentTime = 0;
                window.katonAudio.play().catch(e => console.log("Lỗi phát audio:", e));
            }
        }
    }

    // Skill 2: Chidori
    if (event.key === '2') {
        if (!isJumping && !isSliding && !isCastingSkill1 && !isCastingChidori) {
            isCastingChidori = true;
            chidoriFadeTimer = 0;
            currentSpeed = baseSpeed * 4; // Tăng tốc cảnh vật chạy

            let chidoriAnim = Object.keys(sasukeAnimations).find(k => k.includes('chidori')) || sasukeAnimList[0].name;

            playAnimation(chidoriAnim, false, 0);

            let action = sasukeAnimations[chidoriAnim];
            chidoriTimer = action ? action.getClip().duration : 2.0;

            chidoriGroup.visible = true;

            if (window.chidoriAudio) {
                window.chidoriAudio.currentTime = 0;
                window.chidoriAudio.play().catch(e => console.log("Lỗi phát audio chidori:", e));
            }
        }
    }

    // Skill 3: Susanoo (Bất tử & Bay)
    if (event.key === '3') {
        if (!isSusanooActive) {
            isSusanooActive = true;
            susanooTimer = 20.0;
            if (susanooBarContainer) susanooBarContainer.style.display = 'block';
            if (susanooBarInner) susanooBarInner.style.transform = 'scaleX(1)';
            currentSpeed = baseSpeed * 4; // Bức tốc (giống Chidori)
            susanooTransformTimer = 0.1; // Chờ 0.1s rồi bung luồng khí (không ẩn Sasuke)
            cameraTransitionTime = 1.0; // Bắt đầu chuyển đổi góc camera (1 giây)

            // Hiện các ngọn núi khổng lồ
            if (treeInstancedMeshes.length >= 4) {
                treeInstancedMeshes[0].mesh.visible = true;
                treeInstancedMeshes[1].mesh.visible = true;
                treeInstancedMeshes[2].mesh.visible = true;
            }

            if (susanooModel) {
                susanooModel.visible = true;
                let flyAnim = Object.keys(susanooAnimations).find(k => k.includes('fly'));
                if (flyAnim && susanooAnimations[flyAnim]) {
                    let action = susanooAnimations[flyAnim];
                    action.reset().fadeIn(0.2).play();
                    action.setLoop(THREE.LoopRepeat, Infinity);
                    action.clampWhenFinished = false;
                }
            }
        } else if (!isSusanooSlashing) {
            // Chờ hoạt ảnh chém xong mới cho phép chém tiếp
            isSusanooSlashing = true;
            let slashAnim = Object.keys(susanooAnimations).find(k => k.includes('slash'));
            if (slashAnim && susanooAnimations[slashAnim]) {
                let action = susanooAnimations[slashAnim];
                action.reset().fadeIn(0.1).play();
                action.setLoop(THREE.LoopOnce, 1);
                action.clampWhenFinished = true;

                // Cắt mượt mà fly để nhường chỗ cho slash
                let flyAnim = Object.keys(susanooAnimations).find(k => k.includes('fly'));
                if (flyAnim && susanooAnimations[flyAnim]) {
                    susanooAnimations[flyAnim].fadeOut(0.1);
                }
            }
        }
    }
});

// ==========================================
// 7. FPS, PAUSE & VÒNG LẶP RENDER
// ==========================================
let isPaused = false;
document.getElementById('btnPause').addEventListener('click', (e) => {
    isPaused = !isPaused;
    e.target.innerText = isPaused ? "Tiếp Tục ▶️" : "Tạm Dừng ⏸️";
});

let frameCount = 0;
let lastFpsTime = performance.now();
const fpsElement = document.getElementById('fpsCounter');

function animate() {
    requestAnimationFrame(animate);
    let delta = clock.getDelta();
    if (delta > 0.1) delta = 0.1;

    // --- CẬP NHẬT ANIMATION NGAY ĐẦU VÒNG LẶP ---
    if (mixer) {
        mixer.update(delta);
    }
    if (susanooMixer) {
        susanooMixer.update(delta);
    }

    // Đo FPS
    frameCount++;
    let now = performance.now();
    if (now - lastFpsTime >= 1000) {
        if (fpsElement) fpsElement.innerText = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsTime = now;
    }

    if (controls) controls.update();

    // NẾU PAUSE: Dừng cập nhật logic nhưng vẫn render khung hình tĩnh
    if (isPaused) {
        renderer.render(scene, camera);
        return;
    }

    // --- HIỆU ỨNG CAMERA ZOOM OUT & GIẢM SƯƠNG MÙ CHO SUSANOO ---
    let targetFov = isSusanooActive ? 90 : 60; // Góc nhìn rộng hơn
    if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * (delta * 4); // Nội suy mượt mà
        camera.updateProjectionMatrix();
    }

    // Giảm lớp sương đằng xa để nhìn được xa hơn khi bay cao
    let targetFogFar = isSusanooActive ? 300 : 100;
    if (scene.fog && scene.fog.far !== targetFogFar) {
        scene.fog.far += (targetFogFar - scene.fog.far) * (delta * 4);
    }

    // --- CẬP NHẬT TRẠNG THÁI SUSANOO ---
    if (isSusanooActive) {
        susanooTimer -= delta;

        // Cập nhật thanh thời gian UI
        if (susanooBarInner) {
            let scale = susanooTimer / 20.0;
            if (scale < 0) scale = 0;
            susanooBarInner.style.transform = 'scaleX(' + scale + ')';
        }

        // 1. Quá trình biến hình: Đếm ngược 0.1s bung luồng khí Aura
        if (susanooTransformTimer > 0) {
            susanooTransformTimer -= delta;
            if (susanooTransformTimer <= 0) {
                // Bung Aura, VÀ Ẩn Sasuke đi vì Susanoo là model riêng
                if (sasukeModel) sasukeModel.visible = false;
                createFlameBlast(); // Bùng nổ lửa tím trắng xóa
            }
        }

        if (susanooTimer <= 0) {
            isSusanooActive = false;
            isSusanooSlashing = false;
            if (susanooBarContainer) susanooBarContainer.style.display = 'none';
            currentSpeed = baseSpeed; // Trả lại tốc độ bình thường
            if (susanooModel) susanooModel.visible = false;
            if (sasukeModel) sasukeModel.visible = true; // Hiện lại Sasuke
            if (susanooMixer) susanooMixer.stopAllAction();
            createFlameBlast(); // Bùng nổ lửa tím trắng xóa khi hết Susanoo
            cameraTransitionTime = 1.0; // Bắt đầu chuyển đổi góc camera về Sasuke

            // Ẩn các ngọn núi khổng lồ
            if (treeInstancedMeshes.length >= 4) {
                treeInstancedMeshes[0].mesh.visible = false;
                treeInstancedMeshes[1].mesh.visible = false;
                treeInstancedMeshes[2].mesh.visible = false;
            }
        }
    }

    // --- CẬP NHẬT HIỆU ỨNG LỬA BÙNG NỔ ---
    for (let i = activeBlasts.length - 1; i >= 0; i--) {
        let b = activeBlasts[i];
        b.life -= delta * 2.5; // Tốc độ biến mất

        b.group.scale.x += delta * 12;
        b.group.scale.z += delta * 12;
        b.group.scale.y += delta * 15;
        b.group.position.y += delta * 5;

        b.coreMat.opacity = b.life;
        b.outerMat.opacity = b.life * 0.8;
        b.sphereMat.opacity = b.life * 0.9;

        if (b.life <= 0) {
            b.group.parent.remove(b.group);
            activeBlasts.splice(i, 1);
        }
    }

    // --- CẬP NHẬT ĐIỂM SỐ CHẠY (SCORE) ---
    if (currentSpeed > 0 && !isSusanooActive) {
        // Điểm tăng theo quãng đường chạy (vận tốc càng cao điểm càng nhanh)
        gameScore += (currentSpeed * 0.1) * (delta * 60);
        if (scoreUI) scoreUI.innerText = Math.floor(gameScore);
    }

    // ==========================================
    // BOT TỰ ĐỘNG CHƠI (AUTO-PLAY AI)
    // ==========================================
    if (window.autoPlayEnabled && currentSpeed > 0 && !isSusanooActive) {
        // Tìm hàng chướng ngại vật gần nhất phía trước mặt (Z từ -45 đến 5)
        let nearestRow = null;
        let minZ = -999;
        for (let i = 0; i < obstacleRows.length; i++) {
            let z = obstacleRows[i].group.position.z;
            if (z > -45 && z < 5) {
                if (z > minZ) {
                    minZ = z;
                    nearestRow = obstacleRows[i];
                }
            }
        }

        if (nearestRow) {
            let needsSlide = false;
            let needsJump = false;
            let safeLanes = [0, 1, 2]; // Mặc định giả sử các làn đều an toàn

            // Phân tích Mẫu đặc biệt (Tree và GiantRock) vì chúng chiếm nhiều làn
            let centerObs = nearestRow.obstacles[1];
            if (centerObs.activeType === 'giantRock') {
                if (centerObs.giantRock.position.y > 0) needsSlide = true;
                else needsJump = true;
            } else if (centerObs.activeType === 'tree') {
                // Pattern 9 (Cột gỗ)
                let treeX = centerObs.tree.position.x;
                if (treeX < 0) safeLanes = [2]; // Chặn trái & giữa -> phải an toàn
                else safeLanes = [0]; // Chặn phải & giữa -> trái an toàn

                // Mẫu 9 luôn có phi tiêu chìm ở làn an toàn
                needsJump = true;
            } else {
                // Phân tích Mẫu thông thường 1-6
                safeLanes = [];
                for (let i = 0; i < 3; i++) {
                    let obs = nearestRow.obstacles[i];
                    if (obs.activeType === 'none') {
                        safeLanes.push(i); // Làn trống
                    } else if (obs.activeType === 'shuriken') {
                        // Phi tiêu lơ lửng thì có thể chạy ở dưới hoặc nhảy qua nên vẫn coi là có thể an toàn nếu biết xài chiêu
                        safeLanes.push(i);
                    }
                }
            }

            // --- HÀNH ĐỘNG 1: ĐỔI LÀN ---
            let currentLaneIndex = LANE_POSITIONS.indexOf(targetLaneX);
            // Nếu làn hiện tại bị đá rơi/chặn, TÌM đường thoát!
            if (!safeLanes.includes(currentLaneIndex) && safeLanes.length > 0) {
                let bestLane = safeLanes[0];
                let minDiff = 99;
                for (let sl of safeLanes) {
                    let diff = Math.abs(sl - currentLaneIndex);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestLane = sl;
                    }
                }
                targetLaneX = LANE_POSITIONS[bestLane];
            }

            // --- HÀNH ĐỘNG 2: NHẢY / TRƯỢT ---
            currentLaneIndex = LANE_POSITIONS.indexOf(targetLaneX);
            let targetObs = nearestRow.obstacles[currentLaneIndex];

            // Kiểm tra xem ở làn an toàn (hoặc hiện tại) có phi tiêu không
            if (targetObs && targetObs.activeType === 'shuriken') {
                if (targetObs.shuriken.position.y > 1.5) needsSlide = true;
                else needsJump = true;
            }

            // Kích hoạt kỹ năng đúng thời điểm vàng (Z từ -30 đến -10 để không bị hụt và khớp animation)
            if (minZ > -30 && minZ < -10) {
                if (needsJump && !isJumping && !isSliding) {
                    isJumping = true;
                    jumpTimer = jumpDuration;
                    playAnimation(Object.keys(sasukeAnimations).find(k => k.includes('jump')) || sasukeAnimList[0].name, false, 0.1);
                } else if (needsSlide && !isSliding && !isJumping) {
                    isSliding = true;
                    slideTimer = slideDuration;
                    playAnimation(Object.keys(sasukeAnimations).find(k => k.includes('slide')) || sasukeAnimList[0].name, false, 0.1);
                }
            }
        }
    }

    // Xử lý di chuyển mượt mà (Lerp) sang làn mới
    const lerpFactor = Math.min(15 * delta, 1.0); // CHỐT CHẶN AN TOÀN: Không cho phép di chuyển quá 100% khoảng cách (Fix lỗi văng nhân vật khi lag)
    sasuke.position.x += (targetLaneX - sasuke.position.x) * lerpFactor;

    // Hiệu ứng nghiêng người (ngả người về phía rẽ)
    // Tính toán góc nghiêng dựa trên khoảng cách còn lại tới đích
    let leanTarget = (targetLaneX - sasuke.position.x) * -0.15;
    sasuke.rotation.z += (leanTarget - sasuke.rotation.z) * lerpFactor;

    // Tính toán quãng đường di chuyển dựa trên thời gian thực (Delta Time)
    const moveDistance = currentSpeed * (delta * 60);

    // ==========================================
    // XỬ LÝ VẬT LÝ: NHẢY VÀ TRƯỢT
    // ==========================================
    if (sasuke) {
        // --- NHẢY (KẾT HỢP ANIMATION VÀ SÓNG HÌNH SIN) ---
        if (isJumping) {
            jumpTimer -= delta;

            // Tính tỷ lệ % thời gian nhảy (từ 0.0 đến 1.0)
            let progress = 1.0 - (jumpTimer / jumpDuration);
            // Dùng nửa vòng đầu của hàm Sin (tạo thành hình Parabol) để nhấc bổng nhân vật lên thêm tối đa 2 mét
            sasuke.position.y = Math.sin(progress * Math.PI) * 2.0;

            // Khi Animation nhảy kết thúc
            if (jumpTimer <= 0) {
                isJumping = false;
                sasuke.position.y = 0; // Đảm bảo tiếp đất chính xác

                // Nếu không bị giữ phím trượt thì trở về dáng chạy
                if (!isSliding) {
                    let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                    playAnimation(runAnim, true, 0); // Fade = 0: Nối khung hình ngay lập tức khớp với Blender
                }
            }
        }

        // --- TRƯỢT ---
        if (isSliding) {
            slideTimer -= delta;
            if (slideTimer <= 0) {
                isSliding = false;
                // Nếu đang trên mặt đất thì trở về dáng chạy
                if (!isJumping && !isCastingSkill1) {
                    let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                    playAnimation(runAnim, true, 0.2); // Dùng fade 0.2 để đứng lên mượt hơn
                }
            }
        }

        // --- SKILL 1 (HỎA CẦU) ---
        // Không dùng skill1Timer đếm lùi thủ công nữa, việc kết thúc đã được giao cho sự kiện 'finished' của Mixer!

        // Đếm lùi sinh Hỏa Cầu
        if (fireballSpawnDelay > 0) {
            fireballSpawnDelay -= delta;
            if (fireballSpawnDelay <= 0) {
                spawnFireball();
            }
        }

        // --- SKILL 2 (CHIDORI) ---
        if (isCastingChidori || chidoriFadeTimer > 0) {
            // Cập nhật ziczac liên tục (cả khi đang cast và đang fade để nó giật giật đến lúc mất hẳn)
            for (let i = 0; i < sparksCount; i++) {
                let pos = sparksLines[i].geometry.attributes.position.array;
                // Điểm bắt đầu dời về phía trước (trục -Z) ngay mép quả cầu chỗ các ngón tay
                let px = 0, py = 0, pz = -0.35;
                for (let j = 0; j < 4; j++) {
                    pos[j * 3] = px;
                    pos[j * 3 + 1] = py;
                    pos[j * 3 + 2] = pz;
                    // Tăng độ dài tia sét bao quanh và ép xu hướng ngả về sau (trục Z dương)
                    px += (Math.random() - 0.5) * 1.5;
                    py += (Math.random() - 0.5) * 1.5;
                    pz += (Math.random() * 0.8 + 0.2) * 2.0; // Luôn đẩy giá trị Z lên dương để quặt ra sau
                }
                sparksLines[i].geometry.attributes.position.needsUpdate = true;
            }

            for (let i = 0; i < coneLightningCount; i++) {
                let pos = coneLightningLines[i].geometry.attributes.position.array;
                let angle = Math.random() * Math.PI * 2;
                let radiusBase = Math.random() * 3.5;
                let backwardTotal = Math.random() * 8.0 + 4.0; // Dài 4-12m

                // Điểm bắt đầu dời về phía trước (trục -Z) ngay mép quả cầu chỗ các ngón tay
                let curX = 0, curY = 0, curZ = -0.35;

                for (let j = 0; j < 5; j++) {
                    pos[j * 3] = curX;
                    pos[j * 3 + 1] = curY;
                    pos[j * 3 + 2] = curZ;

                    curX += Math.cos(angle) * (radiusBase / 4) + (Math.random() - 0.5) * 1.5;
                    curY += Math.sin(angle) * (radiusBase / 4) + (Math.random() - 0.5) * 1.5;
                    curZ += (backwardTotal / 4); // Hướng ra sau
                }
                coneLightningLines[i].geometry.attributes.position.needsUpdate = true;
            }
        }

        if (isCastingChidori) {
            chidoriTimer -= delta;

            let handPos = new THREE.Vector3(0.3, 0.3, 0.3);
            let targetBone = middleFingerBone || rightHandBone;
            if (targetBone) {
                targetBone.getWorldPosition(handPos);
                // Nếu chỉ có rightHandBone, đẩy tịnh tiến ra trước
                if (!middleFingerBone) {
                    let handDir = new THREE.Vector3(0, 1, 0);
                    handDir.applyQuaternion(targetBone.getWorldQuaternion(new THREE.Quaternion()));
                    handDir.normalize().multiplyScalar(0.12 * 5);
                    handPos.add(handDir);
                }
                sasuke.worldToLocal(handPos);
            }
            chidoriGroup.position.copy(handPos);
            chidoriGroup.visible = true;
            coneGroup.visible = true; // Bật sét hình nón lên CÙNG LÚC với quả cầu

            // Đảm bảo opacity và drawRange đầy đủ khi đang cast
            chidoriCoreMat.opacity = 0.8;
            chidoriInnerMat.opacity = 1.0;
            sparkMaterial.opacity = 0.9;
            coneLightningMat.opacity = 0.8;
            for (let i = 0; i < sparksLines.length; i++) sparksLines[i].geometry.setDrawRange(0, 4);
            for (let i = 0; i < coneLightningLines.length; i++) coneLightningLines[i].geometry.setDrawRange(0, 5);

            // Hết giờ cast an toàn
            if (chidoriTimer <= 0) {
                isCastingChidori = false;
                chidoriFadeTimer = 0.1;
                currentSpeed = baseSpeed;
            }
        }
        else if (chidoriFadeTimer > 0) {
            chidoriFadeTimer -= delta;
            if (chidoriFadeTimer <= 0) {
                chidoriGroup.visible = false;
                coneGroup.visible = false;
            } else {
                let ratio = chidoriFadeTimer / 0.1;
                // Khối cầu mờ dần đi
                chidoriCoreMat.opacity = 0.8 * ratio;
                chidoriInnerMat.opacity = 1.0 * ratio;

                // Các tia sét biến mất từng khúc (giảm số điểm được vẽ)
                let sparkPointsToDraw = Math.max(1, Math.ceil(ratio * 4));
                for (let i = 0; i < sparksLines.length; i++) {
                    sparksLines[i].geometry.setDrawRange(0, sparkPointsToDraw);
                }

                let conePointsToDraw = Math.max(1, Math.ceil(ratio * 5));
                for (let i = 0; i < coneLightningLines.length; i++) {
                    coneLightningLines[i].geometry.setDrawRange(0, conePointsToDraw);
                }
            }
        }

        // --- CẬP NHẬT HITBOX OBB ---
        sasukeHitbox.updateMatrixWorld(true);
        // Copy hình dáng gốc rồi áp dụng ma trận xoay/nghiêng của Mesh vào OBB
        sasukeOBB.copy(sasukeOBB_base);
        sasukeOBB.applyMatrix4(sasukeHitbox.matrixWorld);
    }

    // Xử lý Hỏa cầu bay lên
    for (let i = fireballs.length - 1; i >= 0; i--) {
        let fbObj = fireballs[i];
        let fb = fbObj.group;
        fb.position.z -= 1.2 * (delta * 60); // Bay nhanh hơn một chút để ngầu hơn

        // Hoạt ảnh xoay cuộn của lửa (Cải thiện thị giác)
        fbObj.core.rotation.x -= 0.2;

        // Xoay 3 lớp hào quang theo 3 trục và tốc độ khác nhau để các vân lửa cuộn vào nhau (Volumetric Fire)
        fbObj.aura1.rotation.x -= 0.15;
        fbObj.aura1.rotation.y += 0.2;

        fbObj.aura2.rotation.y -= 0.15;
        fbObj.aura2.rotation.z += 0.2;

        fbObj.aura3.rotation.z -= 0.15;
        fbObj.aura3.rotation.x += 0.2;

        // Vẫn giữ lại chút nhịp đập (pulse) ngẫu nhiên để lửa bập bùng
        let pulseX = 1.0 + Math.random() * 0.15;
        let pulseY = 1.0 + Math.random() * 0.15;
        let pulseZ = 1.0 + Math.random() * 0.15;

        fbObj.aura1.scale.set(pulseX, pulseY * 1.1, pulseZ * 0.9);
        fbObj.aura2.scale.set(pulseX * 0.9, pulseY, pulseZ * 1.1);
        fbObj.aura3.scale.set(pulseX * 1.1, pulseY * 0.9, pulseZ);

        // --- SPAWN HẠT LỬA BẰNG OBJECT POOLING ---
        for (let p = 0; p < 2; p++) {
            // Lấy hạt từ kho thay vì tạo mới
            let particle = particlePool[particleIndex];
            particleIndex = (particleIndex + 1) % MAX_PARTICLES;

            fb.getWorldPosition(particle.position);
            particle.position.x += (Math.random() - 0.5) * 1.2;
            particle.position.y += (Math.random() - 0.5) * 1.2;
            particle.position.z += (Math.random() - 0.5) * 1.2;
            particle.rotation.z = Math.random() * Math.PI * 2;
            particle.visible = true; // Bật hạt lên

            // Xóa hạt cũ (nếu nó vòng lại mà vẫn còn trong danh sách bay) để đè hạt mới
            let existingIdx = fireParticles.findIndex(fp => fp.mesh === particle);
            if (existingIdx !== -1) fireParticles.splice(existingIdx, 1);

            fireParticles.push({
                mesh: particle,
                life: 1.0,
                decay: 1.5 + Math.random() * 1.5
            });
        }

        fb.updateMatrixWorld(true); // Ép cập nhật tọa độ
        fireballBox.setFromObject(fb);
        let hit = false;

        // Kiểm tra Hỏa Cầu đâm Đá
        for (let j = 0; j < obstacleRows.length; j++) {
            for (let k = 0; k < 3; k++) {
                let obs = obstacleRows[j].obstacles[k];
                if (obs.activeType !== 'none') {
                    let mesh = null;
                    if (obs.activeType === 'shuriken') mesh = obs.shuriken;
                    else if (obs.activeType === 'tree') mesh = obs.tree;
                    else if (obs.activeType === 'giantRock') mesh = obs.giantRock;
                    else mesh = obs.rock;

                    if (mesh && mesh.visible) {
                        obsBox.setFromObject(mesh);
                        if (fireballBox.intersectsBox(obsBox)) {
                            mesh.visible = false; // Bắn vỡ đá/phi tiêu
                            obs.activeType = 'none';
                            hit = true;
                            break;
                        }
                    }
                }
            }
            if (hit) break;
        }

        if (hit) {
            scene.remove(fb);
            fireballs.splice(i, 1);
            continue;
        }

        // Xóa hỏa cầu nếu bay quá xa
        if (fb && fb.position.z < -100) {
            scene.remove(fb);
            fireballs.splice(i, 1);
        }
    }

    // --- CẬP NHẬT HỆ THỐNG HẠT LỬA (PARTICLE POOL) ---
    for (let i = fireParticles.length - 1; i >= 0; i--) {
        let pObj = fireParticles[i];
        pObj.life -= delta * pObj.decay;

        if (pObj.life <= 0) {
            pObj.mesh.visible = false; // Trả lại Pool (ẩn đi) thay vì xóa khỏi Scene
            fireParticles.splice(i, 1);
        } else {
            pObj.mesh.scale.setScalar(pObj.life); // Teo nhỏ dần thành tàn lửa
            pObj.mesh.position.y += delta * 3.0; // Bốc lên cao theo nhiệt

            // Xoay tự do trong không gian 3D thực thụ
            pObj.mesh.rotation.x += delta * 3.0;
            pObj.mesh.rotation.y += delta * 3.0;
            pObj.mesh.rotation.z += delta * 3.0;
        }
    }

    // Xử lý Chướng ngại vật (Đá lở) & Va chạm Sasuke
    for (let i = 0; i < obstacleRows.length; i++) {
        let row = obstacleRows[i];
        row.group.position.z += moveDistance;

        // SỬA LỖI GLITCH TÀNG HÌNH VÁCH NÚI: Đẩy giới hạn Z lên tận 75m!
        // Vì vách núi (Pattern 9) dài tới 100m (kéo lùi về sau 50m). Nếu reset ở 35m, nửa sau của vách núi sẽ bị bốc hơi trước mặt người chơi!
        if (row.group.position.z > 75) {
            row.group.position.z -= 440; // 8 hàng x 55m = 440m
            spawnObstaclePattern(row.obstacles, row.coins); // Đẻ ra trận đồ bát quái mới và rải tiền!
        }

        // Bắt buộc ép Game cập nhật tọa độ tuyệt đối trước khi xét va chạm
        row.group.updateMatrixWorld(true);

        // Kiểm tra va chạm Sasuke với từng chướng ngại vật
        for (let j = 0; j < 3; j++) {
            let obs = row.obstacles[j];
            if (obs.activeType !== 'none') {
                let mesh = null;
                if (obs.activeType === 'shuriken') mesh = obs.shuriken;
                else if (obs.activeType === 'tree') mesh = obs.tree;
                else if (obs.activeType === 'giantRock') mesh = obs.giantRock;
                else if (obs.activeType === 'mountainWall') mesh = obs.mountainWall;
                else mesh = obs.rock;

                // --- XỬ LÝ VẬT THỂ RƠI VÀ BÓNG CẢNH BÁO ---
                if (obs.isFalling) {
                    // 1. Cảnh báo bằng Bóng (Phóng to và đậm dần theo độ cao Y, đúng tính chất vật lý)
                    if (obs.shadow) {
                        let progress = 1.0 - ((mesh.position.y - obs.targetY) / (obs.startY - obs.targetY));
                        if (progress > 1.0) progress = 1.0;
                        if (progress < 0) progress = 0;

                        // FIX: Bóng đá tảng rộng khoảng 2.5m. Khởi điểm scale 0.5 (1m), khi chạm đất scale 1.5 (3m) -> Ôm vừa vặn cục đá!
                        obs.shadow.scale.setScalar(0.5 + progress * 1.0);
                        // Giữ độ mờ tối thiểu là 0.4 để người chơi có thể nhìn thấy vệt đen cảnh báo từ xa!
                        obs.shadow.material.opacity = 0.4 + (progress * 0.4);
                    }

                    // 2. Chỉ rớt xuống khi đã lọt vào vùng TriggerZ
                    if (row.group.position.z >= obs.triggerZ) {
                        let dropRate = (obs.startY - obs.targetY) / Math.abs(obs.triggerZ);
                        // Giữ nguyên tốc độ rơi ngay cả khi người chơi tăng tốc
                        let baseMoveDistance = baseSpeed * (delta * 60);
                        let actualDrop = dropRate * baseMoveDistance * obs.fallSpeedMult;
                        mesh.position.y -= actualDrop;

                        // Cấp vận tốc xoay
                        if (obs.activeType === 'rock') {
                            obs.rotSpeedX = -0.6;
                            obs.rotSpeedY = -0.4;
                        } else if (obs.activeType === 'tree') {
                            obs.rotSpeedX = -0.5; // Lăn siêu tốc
                        }

                        mesh.rotation.x += obs.rotSpeedX;
                        mesh.rotation.y += obs.rotSpeedY;

                        // Chạm đích
                        if (mesh.position.y <= obs.targetY) {
                            mesh.position.y = obs.targetY;
                            obs.isFalling = false; // Kết thúc rơi
                            if (obs.shadow) obs.shadow.material.opacity = 0.9;
                        }
                    } else {
                        // Neo giữ trên trời chờ tới lượt
                        mesh.position.y = obs.startY;
                    }
                } else if (obs.rotSpeedX !== 0 || obs.rotSpeedY !== 0) {
                    // 3. QUÁN TÍNH: Khi chạm đất, vật thể tiếp tục lăn/xoay nhưng chậm dần (Friction)
                    obs.rotSpeedX *= 0.93; // Giảm tốc độ đi 7% mỗi khung hình
                    obs.rotSpeedY *= 0.93;
                    mesh.rotation.x += obs.rotSpeedX;
                    mesh.rotation.y += obs.rotSpeedY;

                    if (Math.abs(obs.rotSpeedX) < 0.01) obs.rotSpeedX = 0;
                    if (Math.abs(obs.rotSpeedY) < 0.01) obs.rotSpeedY = 0;
                }

                if (mesh && mesh.visible) {
                    // Cập nhật Hoạt ảnh Xoay Tít cho Phi Tiêu
                    if (obs.activeType === 'shuriken') {
                        mesh.rotation.y += 0.5;
                        let shurikenSpeed = 0.4; // Tốc độ xé gió
                        mesh.position.z += shurikenSpeed * (delta * 60);
                    }

                    // FIX: Khi vật thể nhào lộn/lăn quán tính, đóng băng tạm thời trạng thái xoay của mesh về (0,0,0) trước khi đo kích thước AABB
                    let oldRot = mesh.rotation.clone();
                    if (obs.activeType === 'rock' || obs.activeType === 'tree' || obs.activeType === 'giantRock') {
                        mesh.rotation.set(0, 0, 0);
                    }

                    obsBox.setFromObject(mesh);

                    if (obs.activeType === 'rock' || obs.activeType === 'tree' || obs.activeType === 'giantRock') {
                        mesh.rotation.copy(oldRot); // Phục hồi lại trạng thái nhào lộn
                    }

                    // --- CẮT GỌT HITBOX (ĐIỀU CHỈNH THỦ CÔNG) ---
                    if (obs.activeType === 'shuriken') {
                        let center = new THREE.Vector3();
                        let size = new THREE.Vector3();
                        obsBox.getCenter(center);
                        obsBox.getSize(size);

                        // Ép chiều ngang và chiều sâu của Phi tiêu tối đa là 1.8m (Mỗi làn rộng 3m)
                        if (size.x > 1.8) size.x = 1.8;
                        if (size.z > 1.8) size.z = 1.8;

                        obsBox.setFromCenterAndSize(center, size);
                    } else if (obs.activeType === 'giantRock' || obs.activeType === 'mountainWall') {
                        let center = new THREE.Vector3();
                        let size = new THREE.Vector3();
                        obsBox.getCenter(center);
                        obsBox.getSize(size);

                        // Áp dụng thông số cắt gọt đã cấu hình sẵn lúc tạo chướng ngại vật
                        if (obs.hitboxCut) {
                            size.x -= obs.hitboxCut.x;
                            size.y -= obs.hitboxCut.y;
                            size.z -= obs.hitboxCut.z;
                            if (obs.hitboxCut.offsetX) center.x += obs.hitboxCut.offsetX;
                            if (obs.hitboxCut.offsetY) center.y += obs.hitboxCut.offsetY;
                            if (obs.hitboxCut.offsetZ) center.z += obs.hitboxCut.offsetZ;
                        }

                        // Tránh trường hợp bạn vô tình gọt quá tay khiến Hitbox bị âm (gây lỗi Game)
                        if (size.x < 0.1) size.x = 0.1;
                        if (size.y < 0.1) size.y = 0.1;
                        if (size.z < 0.1) size.z = 0.1;

                        obsBox.setFromCenterAndSize(center, size);
                    }

                    // --- ĐỒNG BỘ HIỂN THỊ HITBOX ĐỎ ---
                    if (showHitbox && obs.helper) {
                        obs.helper.visible = true;
                        obs.helperBox.copy(obsBox);
                    } else if (obs.helper) {
                        obs.helper.visible = false;
                    }

                    // SỬ DỤNG THUẬT TOÁN OBB ĐỂ XÉT VA CHẠM NGHIÊNG!
                    if (sasukeOBB.intersectsBox3(obsBox)) {
                        if (isSusanooActive) {
                            if (isSusanooSlashing) {
                                // Nếu đang chém -> Phá nát mọi thứ không mất thời gian
                                mesh.visible = false;
                                obs.activeType = 'none';
                                if (obs.helper) obs.helper.visible = false;
                            } else {
                                // Không chém -> Đụng vật lớn thì mất 1 giây và vỡ vật
                                let isLargeObstacle = (obs.activeType === 'mountainWall') ||
                                    (obs.activeType === 'giantRock' && obs.hitboxCut && obs.hitboxCut.offsetY > 0) ||
                                    (obs.isFalling === true && obs.activeType === 'rock');

                                if (isLargeObstacle) {
                                    susanooTimer -= 1.0;
                                    mesh.visible = false;
                                    obs.activeType = 'none';
                                    if (obs.helper) obs.helper.visible = false;
                                }
                                // Còn lại vật nhỏ (đá nhỏ, phi tiêu lơ lửng, đá lún dưới đất ép nhảy) thì Susanoo đang bay trên trời nên bỏ qua
                            }
                        } else if (currentSpeed > baseSpeed) {
                            // Chidori húc vỡ chướng ngại vật
                            mesh.visible = false;
                            obs.activeType = 'none';
                            if (obs.helper) obs.helper.visible = false;
                        } else {
                            // Trạng thái bình thường bị tông trúng -> GAME OVER
                            console.log("GAME OVER! Nhấn F5 để chơi lại.");
                            currentSpeed = 0; // Chết
                            document.getElementById('gameOverUI').style.display = 'flex';
                        }
                    }
                }
            } else {
                if (obs.helper) obs.helper.visible = false;
            }
        }

        // --- XỬ LÝ TIỀN VÀNG (COINS) ---
        if (row.coins) {
            for (let c = 0; c < row.coins.length; c++) {
                let coinObj = row.coins[c];
                if (coinObj.mesh.visible && !coinObj.collected) {
                    // Hiệu ứng xoay tròn quanh trục dọc
                    coinObj.mesh.rotation.z += 0.1;

                    // Đo khoảng cách (Hitbox hình cầu đơn giản)
                    let coinPos = new THREE.Vector3();
                    coinObj.mesh.getWorldPosition(coinPos);

                    let sasukePos = new THREE.Vector3();
                    if (sasuke) sasuke.getWorldPosition(sasukePos);
                    sasukePos.y += 0.9; // Đẩy tâm xét va chạm lên ngang ngực Sasuke (chiều cao 1.8m)

                    if (sasukePos.distanceTo(coinPos) < 1.2) {
                        coinObj.collected = true;
                        coinObj.mesh.visible = false;
                        gameCoins += 1;
                        gameScore += 100; // Ăn 1 đồng xu thưởng 100 điểm
                        if (coinUI) coinUI.innerText = gameCoins + " 🪙";
                    }
                }
            }
        }
    }

    // Di chuyển CÁC TẤM MẶT ĐẤT vật lý
    for (let i = 0; i < groundPlanes.length; i++) {
        groundPlanes[i].position.z += moveDistance;

        // Khi một tấm trôi hoàn toàn ra sau lưng camera (z > 200)
        if (groundPlanes[i].position.z > 200) {
            // Lùi chính xác 600m (3 tấm x 200m) để duy trì cự ly tuyệt đối
            groundPlanes[i].position.z -= 600;
        }
    }

    // Di chuyển dữ liệu ảo của cây cối và cập nhật Instancing
    let treesMoved = false;
    for (let i = 0; i < TOTAL_TREES; i++) {
        treeData[i].z += moveDistance;
        if (treeData[i].z > 15) {
            // Lùi chính xác 400m để duy trì khoảng cách đều đặn vĩnh viễn
            treeData[i].z -= 400;

            // Lấy lại cờ ban đầu để núi không nhảy sang làn đối diện
            let isLeft = treeData[i].isLeft;
            let isLowHill = treeData[i].isLowHill;

            let type = treeData[i].type;
            let baseRadius = 0;
            if (type === 3) baseRadius = 25;
            else baseRadius = type === 0 ? 60 : (type === 1 ? 70 : 50);

            let targetEdge = isLowHill ? (3 + Math.random() * 2) : (35 + Math.random() * 15);
            let xPos = baseRadius + targetEdge;

            treeData[i].x = isLeft ? -xPos : xPos;
            treeData[i].y = isLowHill ? -5 : -10;
        }
        treesMoved = true;
    }
    if (treesMoved) {
        updateTreeMatrices();
    }



    // (Logic xoay hào quang cũ đã được xóa)

    // --- CAMERA PANNING & ZOOM (SUBWAY SURFERS STYLE) ---
    if (sasuke && typeof controls !== 'undefined' && controls) {
        // 1. Trượt ngang X theo Sasuke để tạo cảm giác tốc độ
        let targetCameraX = sasuke.position.x * 0.7;
        let dx = (targetCameraX - controls.target.x) * (delta * 6);
        camera.position.x += dx;
        controls.target.x += dx;

        // 2. Nội suy Y, Z theo trạng thái Susanoo (CHỈ TRONG LÚC CHUYỂN ĐỔI ĐỂ KHÔNG KHÓA CHUỘT)
        if (cameraTransitionTime > 0) {
            cameraTransitionTime -= delta;

            // Susanoo được đặt ở độ cao Y = 17, tức là cao hơn 12 đơn vị so với mốc cũ (5.0).
            // Do đó ta tịnh tiến tọa độ Y của Camera và LookTarget lên tương ứng 12 đơn vị.
            let targetCamY = isSusanooActive ? 48.39 : 6.0;
            let targetCamZ = isSusanooActive ? 19.30 : 9.0;
            let targetLookY = isSusanooActive ? 31.39 : 2.5;
            let targetLookZ = isSusanooActive ? -17.46 : -15.0;

            let speed = delta * 5;
            camera.position.y += (targetCamY - camera.position.y) * speed;
            camera.position.z += (targetCamZ - camera.position.z) * speed;
            controls.target.y += (targetLookY - controls.target.y) * speed;
            controls.target.z += (targetLookZ - controls.target.z) * speed;
        }

        controls.update(); // Cập nhật OrbitControls
    }

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ==========================================
// 8. TÍNH NĂNG ẨN/HIỆN RỪNG CÂY (TỐI ƯU FPS)
// ==========================================
let treesVisible = true;
const btnToggleTrees = document.getElementById('btnToggleTrees');
if (btnToggleTrees) {
    btnToggleTrees.addEventListener('click', () => {
        treesVisible = !treesVisible;
        // Bật/tắt thuộc tính visible của toàn bộ InstancedMesh (Rừng cây)
        treeInstancedMeshes.forEach(t => {
            t.mesh.visible = treesVisible;
        });
        btnToggleTrees.innerText = treesVisible ? "Ẩn Núi ⛰️" : "Hiện Núi ⛰️";
    });
}

// ==========================================
// 9. GIAO DIỆN LUYỆN TẬP
// ==========================================
window.practicePattern = 0;
const practiceModeSelect = document.getElementById('practiceMode');
if (practiceModeSelect) {
    practiceModeSelect.addEventListener('change', (e) => {
        window.practicePattern = parseInt(e.target.value);
        // FIX: Bỏ focus khỏi thẻ Select ngay khi chọn xong, để các phím mũi tên không vô tình đổi chế độ khi đang di chuyển Sasuke
        e.target.blur();
    });
}

animate();