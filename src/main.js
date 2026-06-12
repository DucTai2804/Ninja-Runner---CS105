import { scene, camera, renderer, clock, controls } from './core.js';
import { CONFIG, LANE_POSITIONS, DAY_COLORS, NIGHT_COLORS, TOTAL_TREES } from './config.js';
import { state } from './state.js';
import {
    ambientLight, hemiLight, dirLight, toggleMountains, resetGrounds, applyTimeMode, updateEnvironment
} from './environment.js';
import { updateObstacles } from './obstacles.js';
import { updateAIBot } from './logic.js';
import {
    sasuke, mixer, sasukeAnimations, sasukeAnimList, playAnimation,
    sasukeHitbox, susanooModel, susanooMixer, susanooAnimations, playSusanooAnimation, sasukeModel,
    middleFingerBone, rightHandBone
} from './character.js';
import {
    fireballs, fireParticles, particlePool, spawnFireball, getNextParticle,
    chidoriGroup, chidoriCore, chidoriInner,
    susanooSwordMesh, susanooSwordAuraMats, susanooInertiaOffset, susanooPreviousSwordPos, susanooMaterialsList, sparksCount, coneLightningCount,
    chidoriCoreMat, chidoriInnerMat, coneLightningMat
} from './skills.js';
import {
    showHitbox, obsBox, fireballBox, sasukeOBB, sasukeOBB_base, toggleHitboxes
} from './physics.js';
import { scoreUI, coinUI, fpsCounter } from './ui.js';

window.sasukeAnimations = sasukeAnimations;
window.sasukeAnimList = sasukeAnimList;
window.susanooAnimations = susanooAnimations;

import { setupInputs } from './inputs.js';
import { updatePhysics } from './physics.js';
import { updateSkills } from './skills.js';

setupInputs();

// 7. FPS, PAUSE & VÒNG LẶP RENDER
// ==========================================
// Logic Pause đã được chuyển hoàn toàn sang inputs.js để quản lý tập trung cùng nhạc nền

let frameCount = 0;
let lastFpsTime = performance.now();

// --- CẬP NHẬT BIẾN THỜI GIAN CHÉM KIẾM ---
state.slashElapsedTime = 0;



function animate() {
    requestAnimationFrame(animate);
    let delta = clock.getDelta();
    if (delta > 0.1) delta = 0.1;

    // --- CẬP NHẬT CHU KỲ NGÀY/ĐÊM ---
    let timeModeEl = document.getElementById('timeMode');
    let mode = timeModeEl ? timeModeEl.value : 'auto';
    let isNight = false;

    if (mode === 'auto') {
        let cycle = state.gameScore % 30000;
        isNight = (cycle >= 20000);
    } else {
        isNight = (mode === 'night');
    }

    let targetColors = isNight ? NIGHT_COLORS : DAY_COLORS;
    let lerpSpeed = delta * 0.5; // Tốc độ chuyển đổi màu (mượt mà)

    scene.background.lerp(targetColors.background, lerpSpeed);
    if (scene.fog) scene.fog.color.lerp(targetColors.background, lerpSpeed);
    ambientLight.color.lerp(targetColors.ambient, lerpSpeed);
    ambientLight.intensity += (targetColors.ambientIntensity - ambientLight.intensity) * lerpSpeed;

    hemiLight.color.lerp(targetColors.hemiSky, lerpSpeed);
    hemiLight.groundColor.lerp(targetColors.hemiGround, lerpSpeed);
    hemiLight.intensity += (targetColors.hemiIntensity - hemiLight.intensity) * lerpSpeed;

    dirLight.color.lerp(targetColors.dir, lerpSpeed);
    dirLight.intensity += (targetColors.dirIntensity - dirLight.intensity) * lerpSpeed;

    // Đo FPS
    frameCount++;
    let now = performance.now();
    if (now - lastFpsTime >= 1000) {
        if (fpsCounter) fpsCounter.innerText = `FPS: ${frameCount}`;
        frameCount = 0;
        lastFpsTime = now;
    }

    if (controls) controls.update();

    // NẾU PAUSE: Dừng cập nhật logic nhưng vẫn render khung hình tĩnh
    if (state.isPaused) {
        renderer.render(scene, camera);
        return;
    }

    // --- CẬP NHẬT ANIMATION NGAY ĐẦU VÒNG LẶP ---
    if (mixer) {
        mixer.update(delta);
    }
    if (susanooMixer) {
        susanooMixer.update(delta);
    }

    // --- CẬP NHẬT ĐIỂM SỐ CHẠY (SCORE) ---
    if (state.currentSpeed > 0 && !state.isSusanooActive) {
        // Điểm tăng theo quãng đường chạy (vận tốc càng cao điểm càng nhanh)
        state.gameScore += (state.currentSpeed * 0.1) * (delta * 60);
        if (scoreUI) scoreUI.innerText = Math.floor(state.gameScore);
    }

    // --- CẬP NHẬT THỜI GIAN CHÉM KIẾM ---
    if (state.isSusanooSlashing) {
        state.slashElapsedTime += delta;
    } else {
        state.slashElapsedTime = 0;
    }

    // Tính toán quãng đường di chuyển
    const moveDistance = state.currentSpeed * (delta * 60);

    // --- GỌI CÁC HÀM CẬP NHẬT ĐÃ TÁCH KHỎI VÒNG LẶP ---
    updateEnvironment(delta, moveDistance);
    updateObstacles(delta, moveDistance);
    updateAIBot(delta);
    updateSkills(delta);
    updatePhysics(delta, moveDistance);


    // --- HIỆU ỨNG LỬA BÙNG NỔ (AURA BLAST) ---
    // Đã được chuyển vào skills.js

    // --- CAMERA PANNING & ZOOM (SUBWAY SURFERS STYLE) ---
    if (sasuke && typeof controls !== 'undefined' && controls) {
        // 1. Trượt ngang X theo Sasuke để tạo cảm giác tốc độ
        let targetCameraX = sasuke.position.x * 0.7;
        let dx = (targetCameraX - controls.target.x) * (delta * 6);
        camera.position.x += dx;
        controls.target.x += dx;

        // 2. Nội suy Y, Z theo trạng thái Susanoo (CHỈ TRONG LÚC CHUYỂN ĐỔI ĐỂ KHÔNG KHÓA CHUỘT)
        if (state.cameraTransitionTime > 0) {
            state.cameraTransitionTime -= delta;

            // Susanoo được đặt ở độ cao Y = 17, tức là cao hơn 12 đơn vị so với mốc cũ (5.0).
            // Do đó ta tịnh tiến tọa độ Y của Camera và LookTarget lên tương ứng 12 đơn vị.
            let targetCamY = state.isSusanooActive ? 56.22 : 6.0;
            let targetCamZ = state.isSusanooActive ? 14.34 : 9.0;
            let targetLookY = state.isSusanooActive ? 31.25 : 2.5;
            let targetLookZ = state.isSusanooActive ? -17.45 : -15.0;

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
