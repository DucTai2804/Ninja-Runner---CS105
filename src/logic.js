import { scene, camera, controls } from './core.js';
import { state } from './state.js';
import { groundPlanes, updateTreeMatrices, treeData, treeInstancedMeshes } from './environment.js';
import { obstacleRows, spawnObstaclePattern } from './obstacles.js';
import { TOTAL_TREES, LANE_POSITIONS } from './config.js';
import { sasuke, mixer, sasukeAnimations, sasukeAnimList, playAnimation, susanooModel, susanooMixer, stopSusanooAnimation, susanooLight } from './character.js';
import { fireballs, fireParticles, chidoriGroup, fireLight } from './skills.js';
import { scoreUI, coinUI, susanooBarContainer, susanooBarInner } from './ui.js';

// ==========================================
// HÀM RESET GAME (CHƠI LẠI TRỰC TIẾP KHÔNG LOAD LẠI TRANG)
// ==========================================
window.resetGame = resetGame;
export function resetGame() {
    // Ẩn UI Game Over
    let gameOverUI = document.getElementById('gameOverUI');
    if (gameOverUI) gameOverUI.style.display = 'none';

    // Đặt lại Sasuke
    state.currentSpeed = state.baseSpeed;
    state.currentLane = 1;
    state.targetLaneX = 0;
    sasuke.position.set(0, 0, 0);
    sasuke.rotation.set(0, 0, 0);
    state.isJumping = false;
    state.isSliding = false;
    state.isCastingSkill1 = false;
    state.isCastingChidori = false;
    state.chidoriFadeTimer = 0;
    if (typeof chidoriGroup !== 'undefined') chidoriGroup.visible = false;
    state.fireballSpawnDelay = 0;
    state.isSusanooActive = false;
    state.susanooTimer = 0;
    if (susanooBarContainer) susanooBarContainer.style.display = 'none';
    if (susanooModel) susanooModel.visible = false;
    if (susanooLight) susanooLight.visible = false;
    stopSusanooAnimation();
    if (window.susanooFlyAudio && window.fadeToVolume) {
        window.fadeToVolume(window.susanooFlyAudio, 0, 150, true);
    }

    // --- RESET ĐIỂM SỐ & TIỀN VÀNG ---
    state.gameScore = 0;
    state.gameCoins = 0;
    if (scoreUI) scoreUI.innerText = "0";
    if (coinUI) coinUI.innerText = "0 🪙";

    // Phát lại hoạt ảnh chạy
    if (mixer && sasukeAnimations) {
        let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
        playAnimation(runAnim, true, 0.2);
    }

    // Xóa hết hỏa cầu đang bay
    fireballs.forEach(fbObj => {
        fbObj.group.visible = false;
        fbObj.active = false;
    });
    if (fireLight) fireLight.visible = false;
    fireballs.length = 0;

    // Xóa hết hạt lửa bằng cách ẩn đi trả về Pool
    fireParticles.forEach(pObj => {
        pObj.mesh.visible = false;
    });
    fireParticles.length = 0;

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

// ==========================================
// HỆ THỐNG AI BOT (TỰ ĐỘNG CHƠI)
// ==========================================
export function updateAIBot(delta) {
    if (!window.autoPlayEnabled || state.currentSpeed <= 0 || state.isSusanooActive) return;

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
