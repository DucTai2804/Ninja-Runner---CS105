import { scene, camera, controls } from './core.js';
import { state } from './state.js';
import { groundPlanes, updateTreeMatrices, treeData, treeInstancedMeshes } from './environment.js';
import { obstacleRows, spawnObstaclePattern } from './obstacles.js';
import { TOTAL_TREES } from './config.js';
import { sasuke, mixer, sasukeAnimations, sasukeAnimList, playAnimation, susanooModel, susanooMixer, stopSusanooAnimation } from './character.js';
import { fireballs, fireParticles, chidoriGroup } from './skills.js';
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
    fireballs.forEach(fbObj => scene.remove(fbObj.group));
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
