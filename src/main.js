import { scene, camera, renderer, clock, controls } from './core.js';
import { CONFIG, LANE_POSITIONS, DAY_COLORS, NIGHT_COLORS, TOTAL_TREES } from './config.js';
import { state } from './state.js';
import {
    groundPlanes, updateTreeMatrices, treeData, treeInstancedMeshes,
    ambientLight, hemiLight, dirLight, toggleMountains, resetGrounds, applyTimeMode
} from './environment.js';
import { obstacleRows, spawnObstaclePattern } from './obstacles.js';
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

    // --- BOT TỰ ĐỘNG CHƠI (AUTO-PLAY AI) ---
    if (window.autoPlayEnabled && state.currentSpeed > 0 && !state.isSusanooActive) {
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
            let currentLaneIndex = LANE_POSITIONS.indexOf(state.targetLaneX);
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
                state.targetLaneX = LANE_POSITIONS[bestLane];
            }

            // --- HÀNH ĐỘNG 2: NHẢY / TRƯỢT ---
            currentLaneIndex = LANE_POSITIONS.indexOf(state.targetLaneX);
            let targetObs = nearestRow.obstacles[currentLaneIndex];

            // Kiểm tra xem ở làn an toàn (hoặc hiện tại) có phi tiêu không
            if (targetObs && targetObs.activeType === 'shuriken') {
                if (targetObs.shuriken.position.y > 1.5) needsSlide = true;
                else needsJump = true;
            }

            // Kích hoạt kỹ năng đúng thời điểm vàng (Z từ -30 đến -10 để không bị hụt và khớp animation)
            if (minZ > -30 && minZ < -10) {
                if (needsJump && !state.isJumping && !state.isSliding) {
                    state.isJumping = true;
                    state.jumpTimer = state.jumpDuration;
                    playAnimation(Object.keys(sasukeAnimations).find(k => k.includes('jump')) || sasukeAnimList[0].name, false, 0.1);
                } else if (needsSlide && !state.isSliding && !state.isJumping) {
                    state.isSliding = true;
                    state.slideTimer = state.slideDuration;
                    playAnimation(Object.keys(sasukeAnimations).find(k => k.includes('slide')) || sasukeAnimList[0].name, false, 0.1);
                }
            }
        }
    }

    // Tính toán quãng đường di chuyển

    // Tính toán quãng đường di chuyển
    const moveDistance = state.currentSpeed * (delta * 60);

    // --- GỌI CÁC HÀM CẬP NHẬT ĐÃ TÁCH ---
    updateSkills(delta);
    updatePhysics(delta, moveDistance);

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
