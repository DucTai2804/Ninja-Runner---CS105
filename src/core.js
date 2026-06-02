// ==========================================
// KHỞI TẠO CƠ BẢN (Scene, Camera, Renderer)
// ==========================================

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88aacc); // Màu sương mù khu rừng
scene.fog = new THREE.Fog(0x88aacc, 20, 100); // Đẩy sương mù lùi ra xa

export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 6, 9);
camera.lookAt(0, 0, -10);

export const clock = new THREE.Clock(); // Đồng hồ đếm thời gian thực

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

export const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 2.5, -15);

// Xử lý sự kiện Resize cửa sổ
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
