import { scene } from './core.js';
import { gltfLoader } from './assets.js';
import {
    chidoriGroup,
    susanooBodyMaterial,
    susanooSwordMaterial,
    setupSusanooSwordGuard,
    setSusanooSwordMesh,
    injectInertiaShader,
    susanooMaterialsList,
    susanooFireAuraMaterial,
    setupSusanooSwordBlade,
    susanooParticles,
    swordParticles,
    susanooSmokeParticles
} from './skills.js';
import { state } from './state.js';

// ==========================================
// NHÂN VẬT SASUKE
// ==========================================
export const sasuke = new THREE.Group();
scene.add(sasuke);
scene.add(swordParticles); // Thêm vệt kiếm vào scene vì chúng di chuyển trong không gian thế giới
sasuke.add(chidoriGroup);
sasuke.add(susanooParticles);
sasuke.add(susanooSmokeParticles); // Làn khói tím ở dưới chân Susanoo

export const sasukeHitboxGeo = new THREE.BoxGeometry(1.0, 1.8, 1.0);
export const sasukeHitboxMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
export const sasukeHitbox = new THREE.Mesh(sasukeHitboxGeo, sasukeHitboxMat);
sasukeHitbox.visible = false;

export let sasukeModel = null;
export let hipsBone = null;
export let rightHandBone = null;
export let middleFingerBone = null;
export let rightArmBone = null;
export let rightForeArmBone = null;

export let mixer = null;
export const sasukeAnimations = {};
export const sasukeAnimList = [];
export let currentAction = null;

export function playAnimation(name, loop = true, fadeTime = 0.2, force = false) {
    if (!mixer || !sasukeAnimations[name]) return null;
    const action = sasukeAnimations[name];
    if (currentAction === action && !force) return action;

    if (currentAction) {
        if (fadeTime > 0) {
            action.crossFadeFrom(currentAction, fadeTime, false);
        } else {
            currentAction.stop();
        }
    }

    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);

    if (loop) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
    } else {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
    }

    action.play();
    currentAction = action;
    return action;
}

gltfLoader.load('models/Characters/sasuke/sasuke_with_chidori.glb', function (gltf) {
    const model = gltf.scene;
    model.scale.set(5, 5, 5);
    model.rotation.y = Math.PI;
    model.position.y = 0;
    model.updateMatrixWorld(true);

    model.traverse(function (child) {
        if (child.isBone) {
            let name = child.name.toLowerCase();
            if (!hipsBone && (name.includes('hip') || name.includes('spine') || name.includes('pelvis') || name.includes('root'))) {
                hipsBone = child;
                hipsBone.add(sasukeHitbox);

                let worldScale = new THREE.Vector3();
                hipsBone.getWorldScale(worldScale);
                sasukeHitbox.scale.set(1 / worldScale.x, 1 / worldScale.y, 1 / worldScale.z);
                sasukeHitbox.position.set(0, 0, 0);
            }

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
            child.frustumCulled = false;

            if (child.material) {
                child.material.metalness = 0.0;
                child.material.roughness = 0.8;
                child.material.transparent = false;
                child.material.depthWrite = true;
                child.material.side = THREE.DoubleSide;
            }
        }
    });

    mixer = new THREE.AnimationMixer(model);

    mixer.addEventListener('finished', function (e) {
        if (state.isCastingSkill1) {
            state.isCastingSkill1 = false;
            if (!state.isJumping && !state.isSliding && !state.isCastingChidori) {
                let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                playAnimation(runAnim, true, 0);
            }
        }
        if (state.isCastingChidori) {
            state.isCastingChidori = false;
            state.currentSpeed = state.baseSpeed;
            state.chidoriFadeTimer = 0.5;
            if (!state.isJumping && !state.isSliding && !state.isCastingSkill1) {
                let runAnim = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
                playAnimation(runAnim, true, 0);
            }
        }
    });

    if (gltf.animations && gltf.animations.length > 0) {
        let i = 0;
        gltf.animations.forEach((clip) => {
            let name = clip.name.toLowerCase();
            if (sasukeAnimations[name]) name = name + "_" + i;
            let action = mixer.clipAction(clip);
            sasukeAnimations[name] = action;
            sasukeAnimList.push({ name: name, action: action });
            i++;
        });

        let runAnimName = Object.keys(sasukeAnimations).find(k => k === 'run' || (k.includes('run') && !k.includes('skill'))) || sasukeAnimList[0].name;
        playAnimation(runAnimName, true);
    }

    sasukeModel = model;
    sasuke.add(sasukeModel);
});

// ==========================================
// NHÂN VẬT SUSANOO
// ==========================================

export let susanooModel = null;
export let susanooMixer = null;
export const susanooAnimations = {};
export let currentSusanooAction = null;

// Hitbox cho Susanoo
export const susanooHitbox = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 4.8, 1.4), // Kích thước này sẽ được nhân 5 do nằm trong susanooModel
    new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true, visible: false })
);
susanooHitbox.position.set(0, 2.4, 0);
susanooHitbox.name = "hitbox";

// Hitbox cho Lưỡi kiếm (Size 1x1x1 để dễ scale)
export const susanooSwordHitboxGeo = new THREE.BoxGeometry(1, 1, 1);
export const susanooSwordHitbox = new THREE.Mesh(
    susanooSwordHitboxGeo,
    new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true, visible: false })
);
susanooSwordHitbox.name = "hitbox";

export function playSusanooAnimation(name, force = false, fadeTime = 0.2) {
    if (!susanooMixer || !susanooAnimations[name]) return;
    const action = susanooAnimations[name];
    if (currentSusanooAction === action && !force) return;

    let prevAction = currentSusanooAction;

    // Chỉ crossfade nếu prevAction tồn tại, khác action mới và đang có trọng số (để tránh lỗi T-pose khi vừa stopAllAction)
    let canCrossFade = prevAction && prevAction !== action && prevAction.getEffectiveWeight() > 0;

    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);

    if (name.includes('slash')) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
    } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
    }

    action.play();

    if (canCrossFade) {
        if (fadeTime > 0) {
            action.crossFadeFrom(prevAction, fadeTime, false);
            // Dừng hẳn action cũ sau khi fade xong để xóa triệt để trọng số (weight)
            setTimeout(() => {
                // Chỉ stop nếu action cũ thực sự cần stop, để tránh stop nhầm nếu user spam nhanh
                if (currentSusanooAction !== prevAction) {
                    prevAction.stop();
                }
            }, fadeTime * 1000);
        } else {
            prevAction.stop();
        }
    } else if (prevAction && prevAction !== action) {
        prevAction.stop();
    }

    currentSusanooAction = action;
}

export function stopSusanooAnimation() {
    if (susanooMixer) susanooMixer.stopAllAction();
    currentSusanooAction = null;
}

export const susanooLight = new THREE.PointLight(0x8A00FF, 0.0, 80); // Đặt cường độ 0

gltfLoader.load('models/Characters/sasuke/susanoo_animation_clean.glb', function (gltf) {
    susanooModel = gltf.scene;
    susanooModel.visible = false;
    susanooModel.scale.set(5, 5, 5);
    susanooModel.position.y = 17.0;
    susanooModel.rotation.y = Math.PI;

    // Tích hợp Đèn chiếu sáng cho Susanoo (Thêm vào sasuke thay vì susanooModel để luôn nằm trong cảnh, tránh biên dịch lại Shader)
    susanooLight.position.set(0, 3, 0);
    sasuke.add(susanooLight);

    let auraMeshesToAdd = [];

    susanooModel.traverse(function (child) {
        if (child.isMesh && child.name !== "hitbox") {
            child.castShadow = false;
            child.receiveShadow = false;
            child.frustumCulled = false;

            let name = child.name;

            if (name === 'sword_guard') {
                setupSusanooSwordGuard(child, auraMeshesToAdd);
            }
            else if (name === 'sword_blade') {
                setupSusanooSwordBlade(child, auraMeshesToAdd);
            }
            else {
                let mat = susanooBodyMaterial.clone();
                mat.uniforms = THREE.UniformsUtils.clone(susanooBodyMaterial.uniforms);

                // Bật tính năng Skinning nếu đây là SkinnedMesh
                if (child.isSkinnedMesh) mat.skinning = true;

                // TRUYỀN TEXTURE BLENDER VÀO SHADER (NẾU VẬT LIỆU CÓ HỖ TRỢ)
                if (child.material && child.material.map) {
                    if (mat.uniforms.blenderMap) {
                        mat.uniforms.blenderMap.value = child.material.map;
                        mat.uniforms.hasMap.value = 1.0;
                    }
                }

                child.material = mat;
                susanooMaterialsList.push(mat);
            }
        }
    });

    auraMeshesToAdd.forEach(item => {
        item.parent.add(item.mesh);
    });

    sasuke.add(susanooModel);
    susanooModel.add(susanooHitbox); // Thêm Hitbox vào Susanoo

    susanooMixer = new THREE.AnimationMixer(susanooModel);

    susanooMixer.addEventListener('finished', function(e) {
        if (state.isSusanooSlashing) {
            state.isSusanooSlashing = false;
            state.susanooSlashTimeRemaining = 0;
            let flyAnim = Object.keys(susanooAnimations).find(k => k.includes('fly')) || Object.keys(susanooAnimations)[0];
            if (flyAnim) playSusanooAnimation(flyAnim, true, 0.3);
            
            // Tiếp tục phát lại âm thanh bay đồng bộ với Animation (kéo volume lên lại mượt mà)
            if (window.susanooFlyAudio && window.fadeToVolume) {
                window.fadeToVolume(window.susanooFlyAudio, 0.8, 150);
            }
        }
    });

    if (gltf.animations && gltf.animations.length > 0) {
        gltf.animations.forEach((clip) => {
            let name = clip.name.toLowerCase();
            let action = susanooMixer.clipAction(clip);
            susanooAnimations[name] = action;
        });
        let idleAnim = Object.keys(susanooAnimations).find(k => k.includes('idle')) || Object.keys(susanooAnimations)[0];
        if (idleAnim) playSusanooAnimation(idleAnim, true);
    }
    
    // Đảm bảo biên dịch shaders của Susanoo ngay khi tải xong (nếu game đã Start hoặc chuẩn bị Start)
    import('./skills.js').then(module => {
        if (module.precompileShaders) {
            module.precompileShaders();
        }
    });
});
