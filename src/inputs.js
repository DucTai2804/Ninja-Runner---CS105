
import { state } from './state.js';
import { LANE_POSITIONS } from './config.js';
import { playAnimation, sasukeAnimations, sasukeAnimList, susanooAnimations, susanooModel, sasukeHitbox } from './character.js';
import { chidoriGroup } from './skills.js';
import { treeInstancedMeshes } from './environment.js';
import { showHitbox, toggleHitboxes } from './physics.js';
import { susanooBarContainer, susanooBarInner } from './ui.js';
import { resetGame } from './logic.js';

export function setupInputs() {
    state.currentLane = 1; // Bắt đầu ở làn giữa (0: Trái, 1: Giữa, 2: Phải)
    state.targetLaneX = 0; // Tọa độ X mục tiêu để nội suy (Lerp) di chuyển mượt

    // Lắng nghe phím bấm
    document.addEventListener('keydown', (event) => {
        // Bật/tắt Debug Hitbox
        if (event.key === 'h' || event.key === 'H') {
            toggleHitboxes(!showHitbox);
            // Chỉ hiện hộp Mesh nghiêng OBB, hộp vuông góc AABB vứt đi!
            sasukeHitbox.visible = showHitbox;
            console.log("Chế độ Debug Hitbox:", showHitbox ? "BẬT" : "TẮT");
        }

        // Di chuyển Trái (A / Phím Trái)
        if ((event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') && state.currentLane > 0 && !state.isSusanooActive) {
            state.currentLane--;
            state.targetLaneX = LANE_POSITIONS[state.currentLane];
        }

        // Di chuyển Phải (D / Phím Phải)
        if ((event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') && state.currentLane < 2 && !state.isSusanooActive) {
            state.currentLane++;
            state.targetLaneX = LANE_POSITIONS[state.currentLane];
        }

        // Nhảy (Jump) - Phím Lên / W
        if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
            if (!state.isJumping && !state.isSliding && !state.isCastingSkill1) {
                state.isJumping = true;

                // Tìm animation có chữ jump
                let jumpAnim = Object.keys(sasukeAnimations).find(k => k.includes('jump')) || sasukeAnimList[1]?.name || sasukeAnimList[0].name;
                let action = playAnimation(jumpAnim, false);

                // Đồng bộ thời gian nhảy bằng đúng thời lượng Animation
                if (action) {
                    state.jumpTimer = action.getClip().duration;
                    state.jumpDuration = state.jumpTimer;
                } else {
                    state.jumpTimer = 1.0;
                    state.jumpDuration = 1.0;
                }
            }
        }

        // Trượt (Slide) - Phím Xuống / S
        if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
            if (!state.isJumping && !state.isSliding && !state.isCastingSkill1) {
                state.isSliding = true;

                // Tìm animation trượt
                let slideAnim = Object.keys(sasukeAnimations).find(k => k.includes('slide')) || sasukeAnimList[2]?.name || sasukeAnimList[0].name;
                let action = playAnimation(slideAnim, false);

                // Đồng bộ thời gian trượt bằng đúng thời lượng của Animation trong Blender!
                if (action) {
                    state.slideTimer = action.getClip().duration;
                } else {
                    state.slideTimer = 1.0; // Dự phòng
                }
            }
        }

        // Chơi lại (Restart Game) - Phím Backspace
        if (event.key === 'Backspace' || event.keyCode === 8) {
            if (state.currentSpeed === 0) { // Chỉ cho phép khởi động lại khi đã Game Over
                resetGame();
            }
        }

        // Tạm dừng (Pause) - Phím Space
        if (event.key === ' ' || event.code === 'Space') {
            event.preventDefault(); // Tránh cuộn trang
            let btnPause = document.getElementById('btnPause');
            if (btnPause) {
                btnPause.click(); // Giả lập click nút Tạm Dừng
            }
        }

        // Skill 1: Hỏa cầu
        if (event.key === '1') {
            // Kích hoạt Hoạt ảnh Tung chiêu (nếu không bận làm gì khác và không bật Susanoo)
            if (!state.isJumping && !state.isSliding && !state.isCastingSkill1 && !state.isSusanooActive) {
                state.isCastingSkill1 = true;
                let skillAnim = Object.keys(sasukeAnimations).find(k => k.includes('fireball')) || sasukeAnimList[0].name;

                // Ép fadeDuration = 0 vì user đã đồng bộ mượt sẵn từ Blender
                playAnimation(skillAnim, false, 0);

                // Hẹn giờ ném Hỏa cầu (Tôn trọng delay của user)
                state.fireballSpawnDelay = 2.0;

                // Phát âm thanh
                if (window.katonAudio) {
                    window.katonAudio.currentTime = 0;
                    window.katonAudio.play().catch(e => console.log("Lỗi phát audio:", e));
                }
            }
        }

        // Skill 2: Chidori
        if (event.key === '2') {
            if (!state.isJumping && !state.isSliding && !state.isCastingSkill1 && !state.isCastingChidori && !state.isSusanooActive) {
                state.isCastingChidori = true;
                state.chidoriFadeTimer = 0;
                state.currentSpeed = state.baseSpeed * 4; // Tăng tốc cảnh vật chạy

                let chidoriAnim = Object.keys(sasukeAnimations).find(k => k.includes('chidori')) || sasukeAnimList[0].name;

                playAnimation(chidoriAnim, false, 0);

                let action = sasukeAnimations[chidoriAnim];
                state.chidoriTimer = action ? action.getClip().duration : 2.0;

                chidoriGroup.visible = true;

                if (window.chidoriAudio) {
                    window.chidoriAudio.currentTime = 0;
                    window.chidoriAudio.play().catch(e => console.log("Lỗi phát audio chidori:", e));
                }
            }
        }

        // Skill 3: Susanoo (Bất tử & Bay)
        if (event.key === '3') {
            if (!state.isSusanooActive) {
                state.isSusanooActive = true;
                state.susanooTimer = 20.0;
                if (susanooBarContainer) susanooBarContainer.style.display = 'block';
                if (susanooBarInner) susanooBarInner.style.transform = 'scaleX(1)';
                state.currentSpeed = state.baseSpeed * 4; // Bức tốc (giống Chidori)
                state.susanooTransformTimer = 0.1; // Chờ 0.1s rồi bung luồng khí (không ẩn Sasuke)
                state.cameraTransitionTime = 1.0; // Bắt đầu chuyển đổi góc camera (1 giây)

                // Phát âm thanh bay
                if (window.susanooFlyAudio) {
                    window.susanooFlyAudio.currentTime = 0;
                    window.susanooFlyAudio.play().catch(e => console.log("Lỗi phát audio susanoo:", e));
                }

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
            } else if (!state.isSusanooSlashing) {
                // Chờ hoạt ảnh chém xong mới cho phép chém tiếp
                state.isSusanooSlashing = true;
                let slashAnim = Object.keys(susanooAnimations).find(k => k.includes('slash'));
                if (slashAnim && susanooAnimations[slashAnim]) {
                    let action = susanooAnimations[slashAnim];
                    action.reset().fadeIn(0.1).play();
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;

                    // Ghi nhận thời lượng hoạt ảnh chém để bật tắt Dư Ảnh Kiếm
                    state.susanooSlashTimeRemaining = action.getClip().duration || 1.5;
                    console.log("Bắt đầu chém! Thời gian:", state.susanooSlashTimeRemaining);

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
    // FPS, PAUSE & UI NÚT BẤM
    // ==========================================

    let btnJump = document.getElementById('btnJump');
    if (btnJump) btnJump.addEventListener('click', () => dispatchKey('w'));
    
    let btnSlide = document.getElementById('btnSlide');
    if (btnSlide) btnSlide.addEventListener('click', () => dispatchKey('s'));

    let btnSkill1 = document.getElementById('btnSkill1');
    if (btnSkill1) btnSkill1.addEventListener('click', () => dispatchKey('1'));

    let btnSkill2 = document.getElementById('btnSkill2');
    if (btnSkill2) btnSkill2.addEventListener('click', () => dispatchKey('2'));

    let btnSkill3 = document.getElementById('btnSkill3');
    if (btnSkill3) btnSkill3.addEventListener('click', () => dispatchKey('3'));

    let btnRestart = document.getElementById('btnRestart');
    if (btnRestart) btnRestart.addEventListener('click', () => dispatchKey('Backspace'));

    function dispatchKey(keyChar) {
        document.dispatchEvent(new KeyboardEvent('keydown', { 'key': keyChar }));
    }

    // --- XỬ LÝ VUỐT MÀN HÌNH (MOBILE) ---
    let touchStartX = 0;
    let touchStartY = 0;

    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    document.addEventListener('touchend', e => {
        let touchEndX = e.changedTouches[0].screenX;
        let touchEndY = e.changedTouches[0].screenY;

        let dx = touchEndX - touchStartX;
        let dy = touchEndY - touchStartY;

        if (Math.abs(dx) > Math.abs(dy)) {
            // Vuốt ngang
            if (!state.isSusanooActive) {
                if (dx > 50) dispatchKey('d'); // Phải
                else if (dx < -50) dispatchKey('a'); // Trái
            }
        } else {
            // Vuốt dọc
            if (dy > 50) dispatchKey('s'); // Trượt
            else if (dy < -50) dispatchKey('w'); // Nhảy
        }
    }, { passive: true });

    // --- MENU CHẾ ĐỘ LUYỆN TẬP ---
    // Đã được xử lý ở main.js để tránh xung đột
}
