import { scene } from './core.js';
import { state } from './state.js';
import { sasuke, sasukeAnimations, sasukeAnimList, playAnimation, sasukeHitbox, susanooHitbox, susanooSwordHitbox } from './character.js';
import { fireballs, fireParticles, getNextParticle } from './skills.js';
import { obstacleRows, spawnObstaclePattern } from './obstacles.js';
import { coinUI } from './ui.js';

// ==========================================
// VẬT LÝ VÀ HITBOX
// ==========================================

export let showHitbox = false;

// Box3 dùng cho chướng ngại vật (AABB) và hỏa cầu
export const obsBox = new THREE.Box3();
export const fireballBox = new THREE.Box3();

// OBB dùng cho Sasuke (Được xoay nghiêng theo mô hình)
export const sasukeOBB_base = new THREE.OBB(new THREE.Vector3(), new THREE.Vector3(1.5 / 2, 3.5 / 2, 1.5 / 2));
export const sasukeOBB = new THREE.OBB();

export function toggleHitboxes(visible) {
    showHitbox = visible;
    if (susanooHitbox) susanooHitbox.material.visible = visible;
    if (susanooSwordHitbox) susanooSwordHitbox.material.visible = visible;
}

export function updatePhysics(delta, moveDistance) {
    // 1. Cập nhật vị trí Làn (Lerp ngang) và Hiệu ứng nghiêng người
    const lerpFactor = Math.min(15 * delta, 1.0); // Tốc độ rẽ
    sasuke.position.x += (state.targetLaneX - sasuke.position.x) * lerpFactor;
    let leanTarget = (state.targetLaneX - sasuke.position.x) * -0.15;
    sasuke.rotation.z += (leanTarget - sasuke.rotation.z) * lerpFactor;

    // 2. Logic Nhảy (Sử dụng hàm Sin mượt mà)
    if (state.isJumping) {
        state.jumpTimer -= delta;

        // Tính tỷ lệ % thời gian nhảy (từ 0.0 đến 1.0)
        let progress = 1.0 - (state.jumpTimer / state.jumpDuration);
        // Dùng nửa vòng đầu của hàm Sin (tạo thành hình Parabol) để nhấc bổng nhân vật lên thêm tối đa 2 mét
        sasuke.position.y = Math.sin(progress * Math.PI) * 2.0;

        if (sasuke.position.y < 0) sasuke.position.y = 0;

        if (state.jumpTimer <= 0) {
            state.isJumping = false;
            sasuke.position.y = 0;

            // Nếu đang slide dở khi nhảy xong, hoặc không làm gì thì về chạy
            if (state.isSliding) {
                let slideAnim = Object.keys(sasukeAnimations).find(k => k.includes('slide')) || sasukeAnimList[2]?.name || sasukeAnimList[0].name;
                playAnimation(slideAnim, false);
            } else if (!state.isCastingSkill1) {
                let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                playAnimation(runAnim, true, 0.2); // Pha mượt về chạy
            }
        }
    }

    // 3. Logic Trượt (Giới hạn hitbox, không ảnh hưởng Y)
    if (state.isSliding) {
        state.slideTimer -= delta;
        if (state.slideTimer <= 0) {
            state.isSliding = false;
            // Nếu đang trên mặt đất thì trở về dáng chạy
            if (!state.isJumping && !state.isCastingSkill1) {
                let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                playAnimation(runAnim, true, 0.2); // Dùng fade 0.2 để đứng lên mượt hơn
            }
        }
    }

    // --- CẬP NHẬT HITBOX OBB CỦA SASUKE ---
    if (sasukeHitbox) {
        sasukeHitbox.updateMatrixWorld(true);
        // Copy hình dáng gốc rồi áp dụng ma trận xoay/nghiêng của Mesh vào OBB
        sasukeOBB.copy(sasukeOBB_base);
        sasukeOBB.applyMatrix4(sasukeHitbox.matrixWorld);
    }

    // --- CẬP NHẬT HITBOX KIẾM & THÂN THỂ SUSANOO ---
    let swordBox = new THREE.Box3();
    let susanooBox = new THREE.Box3();
    let isSwordSlashing = false;

    if (state.isSusanooActive) {
        if (susanooHitbox) {
            susanooHitbox.updateMatrixWorld(true);
            susanooBox.setFromObject(susanooHitbox);
        }
        if (state.isSusanooSlashing && susanooSwordHitbox) {
            susanooSwordHitbox.updateMatrixWorld(true);
            swordBox.setFromObject(susanooSwordHitbox);
            isSwordSlashing = true;
        }
    }

    // 4. Xử lý Chướng ngại vật (Đá lở) & Va chạm Sasuke
    for (let i = 0; i < obstacleRows.length; i++) {
        let row = obstacleRows[i];
        row.group.position.z += moveDistance;

        // Reset vị trí nếu vượt qua sau lưng camera
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
                    if (obs.shadow) {
                        let progress = 1.0 - ((mesh.position.y - obs.targetY) / (obs.startY - obs.targetY));
                        if (progress > 1.0) progress = 1.0;
                        if (progress < 0) progress = 0;

                        obs.shadow.scale.setScalar(0.5 + progress * 1.0);
                        obs.shadow.material.opacity = 0.4 + (progress * 0.4);
                    }

                    if (row.group.position.z >= obs.triggerZ) {
                        let dropRate = (obs.startY - obs.targetY) / Math.abs(obs.triggerZ);
                        let baseMoveDistance = state.baseSpeed * (delta * 60);
                        let actualDrop = dropRate * baseMoveDistance * obs.fallSpeedMult;
                        mesh.position.y -= actualDrop;

                        if (obs.activeType === 'rock') {
                            obs.rotSpeedX = -0.6;
                            obs.rotSpeedY = -0.4;
                        } else if (obs.activeType === 'tree') {
                            obs.rotSpeedX = -0.5; // Lăn siêu tốc
                        }

                        mesh.rotation.x += obs.rotSpeedX;
                        mesh.rotation.y += obs.rotSpeedY;

                        if (mesh.position.y <= obs.targetY) {
                            mesh.position.y = obs.targetY;
                            obs.isFalling = false;
                            if (obs.shadow) obs.shadow.material.opacity = 0.9;
                        }
                    } else {
                        mesh.position.y = obs.startY;
                    }
                } else if (obs.rotSpeedX !== 0 || obs.rotSpeedY !== 0) {
                    obs.rotSpeedX *= 0.93;
                    obs.rotSpeedY *= 0.93;
                    mesh.rotation.x += obs.rotSpeedX;
                    mesh.rotation.y += obs.rotSpeedY;

                    if (Math.abs(obs.rotSpeedX) < 0.01) obs.rotSpeedX = 0;
                    if (Math.abs(obs.rotSpeedY) < 0.01) obs.rotSpeedY = 0;
                }

                if (mesh && mesh.visible) {
                    if (obs.activeType === 'shuriken') {
                        mesh.rotation.y += 0.5;
                        let shurikenSpeed = 0.4; // Tốc độ xé gió
                        mesh.position.z += shurikenSpeed * (delta * 60);
                    }

                    let oldRot = mesh.rotation.clone();
                    if (obs.activeType === 'rock' || obs.activeType === 'tree' || obs.activeType === 'giantRock') {
                        mesh.rotation.set(0, 0, 0);
                        mesh.updateMatrixWorld(true); // Chỉ cập nhật khi bị ép xoay về 0
                    }

                    if (mesh.geometry) {
                        if (!mesh.geometry.boundingBox) {
                            mesh.geometry.computeBoundingBox();
                        }
                        
                        // Tối ưu cực mạnh (O(1)) cho các Mesh nặng
                        obsBox.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
                    } else if (mesh.userData && mesh.userData.baseBox) {
                        // Tối ưu O(1) cho THREE.Group nặng (như Shuriken 5.1MB)
                        obsBox.copy(mesh.userData.baseBox).applyMatrix4(mesh.matrixWorld);
                    } else {
                        // Fallback cho THREE.Group không được cache
                        obsBox.setFromObject(mesh);
                    }

                    if (obs.activeType === 'rock' || obs.activeType === 'tree' || obs.activeType === 'giantRock') {
                        mesh.rotation.copy(oldRot);
                        mesh.updateMatrixWorld(true); // Cập nhật lại ma trận để render đúng
                    }

                    if (obs.activeType === 'shuriken') {
                        let center = new THREE.Vector3();
                        let size = new THREE.Vector3();
                        obsBox.getCenter(center);
                        obsBox.getSize(size);

                        if (size.x > 1.8) size.x = 1.8;
                        if (size.z > 1.8) size.z = 1.8;

                        obsBox.setFromCenterAndSize(center, size);
                    } else if (obs.activeType === 'giantRock' || obs.activeType === 'mountainWall') {
                        let center = new THREE.Vector3();
                        let size = new THREE.Vector3();
                        obsBox.getCenter(center);
                        obsBox.getSize(size);

                        if (obs.hitboxCut) {
                            size.x -= obs.hitboxCut.x;
                            size.y -= obs.hitboxCut.y;
                            size.z -= obs.hitboxCut.z;
                            if (obs.hitboxCut.offsetX) center.x += obs.hitboxCut.offsetX;
                            if (obs.hitboxCut.offsetY) center.y += obs.hitboxCut.offsetY;
                            if (obs.hitboxCut.offsetZ) center.z += obs.hitboxCut.offsetZ;
                        }

                        if (size.x < 0.1) size.x = 0.1;
                        if (size.y < 0.1) size.y = 0.1;
                        if (size.z < 0.1) size.z = 0.1;

                        obsBox.setFromCenterAndSize(center, size);
                    }

                    if (showHitbox && obs.helper) {
                        obs.helper.visible = true;
                        obs.helperBox.copy(obsBox);
                    } else if (obs.helper) {
                        obs.helper.visible = false;
                    }

                    // --- KIỂM TRA KIẾM CHÉM TRÚNG CHƯỚNG NGẠI ---
                    // Thanh kiếm được chém xuống chạm đất (hoặc vật cản) từ giây thứ 0.23 đến 0.5
                    if (isSwordSlashing && state.slashElapsedTime >= 0.23 && state.slashElapsedTime <= 0.5) {
                        if (swordBox.intersectsBox(obsBox)) {
                            mesh.visible = false;
                            obs.activeType = 'none';
                            if (obs.helper) obs.helper.visible = false;
                            continue; // Đã chém nát thì không cần xét va chạm thân thể Sasuke nữa
                        }
                    }

                    // --- XÉT VA CHẠM THÂN THỂ ---
                    if (state.isSusanooActive) {
                        // NẾU SUSANOO ĐANG BẬT, DÙNG HITBOX CỦA SUSANOO THAY VÌ SASUKE
                        if (susanooBox.intersectsBox(obsBox)) {
                            let isLargeObstacle = (obs.activeType === 'mountainWall') ||
                                (obs.activeType === 'giantRock' && obs.hitboxCut && obs.hitboxCut.offsetY > 0) ||
                                (obs.isFalling === true && obs.activeType === 'rock');

                            if (isLargeObstacle) {
                                state.susanooTimer -= 1.0;
                                mesh.visible = false;
                                obs.activeType = 'none';
                                if (obs.helper) obs.helper.visible = false;
                            }
                        }
                    } else if (sasukeOBB.intersectsBox3(obsBox)) {
                        // NẾU SUSANOO TẮT, DÙNG OBB CỦA SASUKE ĐỂ XÉT GAME OVER
                        if (state.currentSpeed > state.baseSpeed) {
                            mesh.visible = false;
                            obs.activeType = 'none';
                            if (obs.helper) obs.helper.visible = false;
                        } else {
                            console.log("GAME OVER! Nhấn F5 để chơi lại.");
                            state.currentSpeed = 0; // Chết
                            let gameOverUI = document.getElementById('gameOverUI');
                            if (gameOverUI) gameOverUI.style.display = 'flex';
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
                    coinObj.mesh.rotation.z += 0.1;

                    let coinPos = new THREE.Vector3();
                    coinObj.mesh.getWorldPosition(coinPos);

                    let sasukePos = new THREE.Vector3();
                    if (sasuke) sasuke.getWorldPosition(sasukePos);
                    sasukePos.y += 0.9;

                    if (sasukePos.distanceTo(coinPos) < 1.2) {
                        coinObj.collected = true;
                        coinObj.mesh.visible = false;
                        state.gameCoins += 1;
                        state.gameScore += 100;
                        if (coinUI) coinUI.innerText = state.gameCoins + " 🪙";
                    }
                }
            }
        }
    }

    // ==========================================
    // 5. XỬ LÝ HỎA CẦU BAY VÀ VA CHẠM
    // ==========================================
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
            let particle = getNextParticle();

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
}
