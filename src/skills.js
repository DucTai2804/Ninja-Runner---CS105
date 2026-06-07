import { scene, camera, controls } from './core.js';
import { fireTex } from './assets.js';
import { state } from './state.js';
import { sasuke, sasukeAnimations, sasukeAnimList, susanooModel, sasukeModel, susanooMixer, middleFingerBone, rightHandBone, susanooSwordHitbox, stopSusanooAnimation } from './character.js';
import { treeInstancedMeshes } from './environment.js';
import { GLSL_NOISE } from './utils.js';
import { MAX_PARTICLES } from './config.js';

// ==========================================
// KỸ NĂNG: ĐẠI HỎA CẦU (SKILL 1)
// ==========================================

export let fireballs = [];
export let fireParticles = [];
export let particlePool = [];
export let particleIndex = 0;

export function getNextParticle() {
    let p = particlePool[particleIndex];
    particleIndex = (particleIndex + 1) % MAX_PARTICLES;
    return p;
}

export const fireballCoreGeo = new THREE.SphereGeometry(0.8, 16, 16);
export const fireballCoreMat = new THREE.MeshBasicMaterial({
    map: fireTex,
    color: 0xffffff
});

export const fireballAuraGeo = new THREE.SphereGeometry(1.2, 16, 16);
export const fireballAuraMat = new THREE.MeshBasicMaterial({
    map: fireTex,
    color: 0xff4500,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

const particleGeo = new THREE.DodecahedronGeometry(1.0, 0);
const particleMat = new THREE.MeshBasicMaterial({
    map: fireTex,
    color: 0xff4500, 
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
});

for (let i = 0; i < MAX_PARTICLES; i++) {
    let p = new THREE.Mesh(particleGeo, particleMat);
    p.visible = false;
    p.castShadow = false;
    p.receiveShadow = false;
    scene.add(p);
    particlePool.push(p);
}

export function spawnFireball(sasukePos) {
    const fireballGroup = new THREE.Group();
    const core = new THREE.Mesh(fireballCoreGeo, fireballCoreMat);
    fireballGroup.add(core);

    const aura1 = new THREE.Mesh(fireballAuraGeo, fireballAuraMat);
    const aura2 = new THREE.Mesh(fireballAuraGeo, fireballAuraMat);
    const aura3 = new THREE.Mesh(fireballAuraGeo, fireballAuraMat);

    aura1.scale.set(1.0, 1.1, 0.9);
    aura2.scale.set(0.9, 1.0, 1.1);
    aura3.scale.set(1.1, 0.9, 1.0);

    fireballGroup.add(aura1);
    fireballGroup.add(aura2);
    fireballGroup.add(aura3);

    const fireLight = new THREE.PointLight(0xff4500, 15.0, 40);
    fireballGroup.add(fireLight);

    if (sasukePos) {
        fireballGroup.position.copy(sasukePos);
        fireballGroup.position.y += 2.2;
    }

    scene.add(fireballGroup);
    fireballs.push({ group: fireballGroup, core: core, aura1: aura1, aura2: aura2, aura3: aura3 });
}

// ==========================================
// KỸ NĂNG: CHIDORI (SKILL 2)
// ==========================================

export const chidoriGroup = new THREE.Group();
chidoriGroup.visible = false;

const chidoriLight = new THREE.PointLight(0x66ccff, 5.0, 40);
chidoriGroup.add(chidoriLight);

const chidoriCoreGeo = new THREE.IcosahedronGeometry(0.35, 2);
export const chidoriCoreMat = new THREE.MeshBasicMaterial({
    color: 0x66ccff,
    wireframe: false,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
});
export const chidoriCore = new THREE.Mesh(chidoriCoreGeo, chidoriCoreMat);
chidoriGroup.add(chidoriCore);

const chidoriInnerGeo = new THREE.SphereGeometry(0.20, 16, 16);
export const chidoriInnerMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0
});
export const chidoriInner = new THREE.Mesh(chidoriInnerGeo, chidoriInnerMat);
chidoriGroup.add(chidoriInner);

export const sparkMaterial = new THREE.LineBasicMaterial({ color: 0x33ccff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
export const sparksLines = [];
export const sparksCount = 30;
export const sparksGroup = new THREE.Group();
chidoriGroup.add(sparksGroup);
for (let i = 0; i < sparksCount; i++) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * 3), 3));
    let line = new THREE.Line(geo, sparkMaterial);
    sparksGroup.add(line);
    sparksLines.push(line);
}

export const coneLightningCount = 20;
export const coneLightningMat = new THREE.LineBasicMaterial({ color: 0x66eeff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending });
export const coneLightningLines = [];
export const coneGroup = new THREE.Group();
coneGroup.visible = false;
chidoriGroup.add(coneGroup);
for (let i = 0; i < coneLightningCount; i++) {
    let geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(5 * 3), 3));
    let line = new THREE.Line(geo, coneLightningMat);
    coneGroup.add(line);
    coneLightningLines.push(line);
}

// ==========================================
// KỸ NĂNG: SUSANOO (SKILL 3) VÀ QUÁN TÍNH
// ==========================================

export const susanooMaterialsList = [];

export const susanooBodyMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0.0 },
        color1: { value: new THREE.Color(0xa866ff) }, 
        color2: { value: new THREE.Color(0xffffff) },
        blenderMap: { value: null },
        hasMap: { value: 0.0 }
    },
    vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vNorm;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            #include <skinbase_vertex>
            #include <beginnormal_vertex>
            #include <skinnormal_vertex>
            #include <defaultnormal_vertex>
            
            vNorm = normalize(transformedNormal);
            
            #include <begin_vertex>
            #include <skinning_vertex>
            #include <project_vertex>
            
            vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
            vWorldPos = worldPosition.xyz;
            vViewDir = normalize(cameraPosition - vWorldPos);
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;
        uniform sampler2D blenderMap;
        uniform float hasMap;
        
        varying vec3 vWorldPos;
        varying vec3 vViewDir;
        varying vec3 vNorm;
        varying vec2 vUv;

        ${GLSL_NOISE}

        void main() {
            vec3 normal = normalize(vNorm);
            vec3 viewDir = normalize(vViewDir);
            float fresnel = 1.0 - max(dot(viewDir, normal), 0.0);
            fresnel = pow(fresnel, 2.0);
            
            vec4 texColor = vec4(1.0);
            if (hasMap > 0.5) texColor = texture2D(blenderMap, vUv);
            
            float n1 = noise(vWorldPos * 0.8 + vec3(time * 1.0, -time * 3.0, time * 1.2));
            float n2 = noise(vWorldPos * 1.6 + vec3(time * 1.5, -time * 6.0, time * 1.8));
            float intensity = smoothstep(0.3, 0.8, n1 * 0.6 + n2 * 0.4);
            
            vec3 finalColor = mix(color1, color2, intensity) + color1 * fresnel;
            
            if (hasMap > 0.5) {
                finalColor *= texColor.rgb * 1.5;
            }
            
            gl_FragColor = vec4(finalColor, 0.85);
        }
    `,
    blending: THREE.NormalBlending,
    depthWrite: true,
    transparent: false,
    side: THREE.DoubleSide
});
susanooMaterialsList.push(susanooBodyMaterial);

export const susanooSwordMaterial = new THREE.ShaderMaterial({
    uniforms: {
        color2: { value: new THREE.Color(0xFF77FF) },
        colorEdge: { value: new THREE.Color(0x8A00FF) },
        blenderMap: { value: null },
        hasMap: { value: 0.0 }
    },
    vertexShader: `
        #include <common>
        #include <skinning_pars_vertex>
        
        varying vec3 vViewDir;
        varying vec3 vNorm;
        varying vec2 vUv;

        void main() {
            vUv = uv;
            #include <skinbase_vertex>
            #include <beginnormal_vertex>
            #include <skinnormal_vertex>
            #include <defaultnormal_vertex>
            
            vNorm = normalize(transformedNormal);
            
            #include <begin_vertex>
            #include <skinning_vertex>
            #include <project_vertex>
            
            vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
            vViewDir = normalize(cameraPosition - worldPosition.xyz);
        }
    `,
    fragmentShader: `
        uniform vec3 color2;
        uniform vec3 colorEdge;
        uniform sampler2D blenderMap;
        uniform float hasMap;
        
        varying vec3 vViewDir;
        varying vec3 vNorm;
        varying vec2 vUv;

        void main() {
            vec3 finalColor = vec3(1.0, 1.0, 1.0) * 3.5;
            gl_FragColor = vec4(finalColor, 0.95);
        }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: true, 
    side: THREE.DoubleSide
});

export const susanooFireAuraMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0.0 },
        fireColor: { value: new THREE.Color(0x8A00FF) },
        auraThickness: { value: 0.02 }
    },
    vertexShader: `
        uniform float time;
        uniform float auraThickness;
        #include <common>
        
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        ${GLSL_NOISE}

        void main() {
            #include <beginnormal_vertex>
            #include <defaultnormal_vertex>
            #include <begin_vertex>
            
            vLocalPos = position;
            
            vec3 noiseLoc = position * 15.0 + vec3(time * 3.0, -time * 10.0, time * 4.0);
            float displacement = noise(noiseLoc) * 0.15; 
            transformed += objectNormal * (auraThickness + displacement); 
            
            #include <project_vertex>
            
            vec3 radialPos = vec3(position.x, 0.0, position.z);
            vec3 fakeNormal = normalize(radialPos);
            if (length(radialPos) < 0.001) fakeNormal = normal;
            
            vNormal = normalize(normalMatrix * fakeNormal);
            vViewPosition = -mvPosition.xyz;
        }
    `,
    fragmentShader: `
        uniform float time;
        uniform vec3 fireColor;
        
        varying vec3 vLocalPos;
        varying vec3 vNormal;
        varying vec3 vViewPosition;

        ${GLSL_NOISE}

        void main() {
            vec3 normal = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);
            
            float rim = 1.0 - abs(dot(normal, viewDir));
            rim = pow(rim, 2.0); 
            
            vec3 noiseLoc = vec3(vLocalPos.x * 20.0 + time * 10.0, vLocalPos.y * 5.0 - time * 30.0, vLocalPos.z * 20.0 + time * 15.0);
            float n = noise(noiseLoc);
            
            vec3 finalColor = mix(fireColor * 0.5, fireColor, n);
            float alpha = mix(0.7, 1.0, rim) * (0.5 + n * 0.8);
            
            gl_FragColor = vec4(finalColor, alpha);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending, 
    depthWrite: false,
    side: THREE.DoubleSide
});
susanooMaterialsList.push(susanooFireAuraMaterial);

export const susanooInertiaOffset = new THREE.Vector3();
export const susanooPreviousSwordPos = new THREE.Vector3();
export const susanooSwordAuraMats = [];
export let susanooSwordMesh = null;

export function injectInertiaShader(auraMat) {
    auraMat.uniforms.inertiaOffset = { value: new THREE.Vector3(0, 0, 0) };
    auraMat.vertexShader = "uniform vec3 inertiaOffset;\n" + auraMat.vertexShader;
    auraMat.vertexShader = auraMat.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec3 viewInertia = (viewMatrix * vec4(inertiaOffset, 0.0)).xyz;
        vec3 viewNormal = normalize(normalMatrix * objectNormal);
        vec3 stretchDirection = -viewInertia;
        float stretchFactor = max(0.0, dot(viewNormal, normalize(stretchDirection + vec3(0.0001))));
        float inertiaWeight = 1.0 + abs(position.y) * 0.2; 
        mvPosition.xyz += stretchDirection * inertiaWeight * stretchFactor;
        gl_Position = projectionMatrix * mvPosition;
        `
    );
    susanooSwordAuraMats.push(auraMat);
}

export function setupSusanooSwordGuard(child, auraMeshesToAdd) {
    child.visible = false;
    let wobblingGuardMat = susanooSwordMaterial.clone();
    wobblingGuardMat.uniforms = THREE.UniformsUtils.clone(susanooSwordMaterial.uniforms);
    wobblingGuardMat.uniforms.time = { value: 0 };
    wobblingGuardMat.vertexShader = `
        uniform float time;
        ${GLSL_NOISE}
        varying vec3 vViewDir;
        varying vec3 vNorm;
        varying vec2 vUv;
        void main() {
            vUv = uv;
            #include <skinbase_vertex>
            #include <beginnormal_vertex>
            #include <skinnormal_vertex>
            #include <defaultnormal_vertex>
            vNorm = normalize(transformedNormal);
            #include <begin_vertex>
            #include <skinning_vertex>
            
            vec3 noiseLoc = position * 15.0 + vec3(0.0, -time * 10.0, 0.0);
            float displacement = noise(noiseLoc) * 0.15; 
            transformed += objectNormal * (0.00 + displacement);
            
            #include <project_vertex>
            vec4 worldPosition = modelMatrix * vec4(transformed, 1.0);
            vViewDir = normalize(cameraPosition - worldPosition.xyz);
        }
    `;

    let auraMat = susanooFireAuraMaterial.clone();
    auraMat.uniforms = THREE.UniformsUtils.clone(susanooFireAuraMaterial.uniforms);
    auraMat.uniforms.auraThickness.value = 0.0;
    auraMat.vertexShader = auraMat.vertexShader.replace(
        "vNormal = normalize(normalMatrix * fakeNormal);",
        "vNormal = normalize(normalMatrix * normal);"
    );

    child.geometry.computeBoundingBox();
    let center = new THREE.Vector3();
    child.geometry.boundingBox.getCenter(center);

    let centeredGeo = child.geometry.clone();
    centeredGeo.translate(-center.x, -center.y, -center.z);

    let guardOuter = new THREE.Group();
    guardOuter.position.copy(child.position);
    guardOuter.rotation.copy(child.rotation);
    guardOuter.scale.copy(child.scale);

    let wobblingGuard = new THREE.Mesh(centeredGeo, wobblingGuardMat);
    wobblingGuard.name = "wobbling_sword_guard";
    wobblingGuard.position.copy(center);
    
    let guardAura = new THREE.Mesh(centeredGeo, auraMat);
    guardAura.name = "wobbling_sword_guard_aura";
    guardAura.position.copy(center);
    guardAura.scale.set(1.2, 1.2, 1.2); 
    guardAura.frustumCulled = false;

    guardOuter.add(wobblingGuard);
    guardOuter.add(guardAura);
    
    injectInertiaShader(auraMat);
    auraMeshesToAdd.push({ parent: child.parent, mesh: guardOuter });
    
    susanooMaterialsList.push(wobblingGuardMat, auraMat);
}

export function setupSusanooSwordBlade(child, auraMeshesToAdd) {
    let coreMat = susanooSwordMaterial.clone();
    coreMat.uniforms = THREE.UniformsUtils.clone(susanooSwordMaterial.uniforms);
    child.material = coreMat;

    let auraMat = susanooFireAuraMaterial.clone();
    auraMat.uniforms = THREE.UniformsUtils.clone(susanooFireAuraMaterial.uniforms);

    let auraMesh = new THREE.Mesh(child.geometry, auraMat);
    auraMesh.name = child.name + "_aura";
    auraMesh.position.copy(child.position);
    auraMesh.rotation.copy(child.rotation);
    auraMesh.scale.copy(child.scale);
    auraMesh.frustumCulled = false;

    injectInertiaShader(auraMat); 
    susanooSwordMesh = child;
    if (susanooSwordHitbox) {
        child.geometry.computeBoundingBox();
        let size = new THREE.Vector3();
        child.geometry.boundingBox.getSize(size);
        let center = new THREE.Vector3();
        child.geometry.boundingBox.getCenter(center);

        // Phóng to hitbox gốc (1x1x1) lên cho bằng đúng kích thước thanh kiếm
        susanooSwordHitbox.scale.copy(size);
        susanooSwordHitbox.position.copy(center);
        susanooSwordMesh.add(susanooSwordHitbox);
    }

    auraMeshesToAdd.push({ parent: child.parent, mesh: auraMesh });
    susanooMaterialsList.push(coreMat, auraMat);
}

export function setSusanooSwordMesh(mesh) {
    susanooSwordMesh = mesh;
}

export function updateSkills(delta) {
    // --- SKILL 1 (HỎA CẦU) ---
    if (state.fireballSpawnDelay > 0) {
        state.fireballSpawnDelay -= delta;
        if (state.fireballSpawnDelay <= 0) {
            spawnFireball(sasuke.position);
        }
    }

    // --- SKILL 2 (CHIDORI) ---
    if (state.isCastingChidori || state.chidoriFadeTimer > 0) {
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

    if (state.isCastingChidori) {
        state.chidoriTimer -= delta;

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
        if (state.chidoriTimer <= 0) {
            state.isCastingChidori = false;
            state.chidoriFadeTimer = 0.1;
            state.currentSpeed = state.baseSpeed;
        }
    }
    else if (state.chidoriFadeTimer > 0) {
        state.chidoriFadeTimer -= delta;
        if (state.chidoriFadeTimer <= 0) {
            chidoriGroup.visible = false;
            coneGroup.visible = false;
        } else {
            let ratio = state.chidoriFadeTimer / 0.1;
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

    // --- CẬP NHẬT TRẠNG THÁI SUSANOO ---
    let targetFov = state.isSusanooActive ? 90 : 60; // Góc nhìn rộng hơn
    if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * (delta * 4); // Nội suy mượt mà
        camera.updateProjectionMatrix();
    }

    // Giảm lớp sương đằng xa để nhìn được xa hơn khi bay cao
    let targetFogFar = state.isSusanooActive ? 300 : 100;
    if (scene.fog && scene.fog.far !== targetFogFar) {
        scene.fog.far += (targetFogFar - scene.fog.far) * (delta * 4);
    }

    if (state.isSusanooActive) {
        state.susanooTimer -= delta;

        // Cập nhật thanh thời gian UI
        let susanooBarInner = document.getElementById('susanooBarInner');
        if (susanooBarInner) {
            let scale = state.susanooTimer / 20.0;
            if (scale < 0) scale = 0;
            susanooBarInner.style.transform = 'scaleX(' + scale + ')';
        }

        // 1. Quá trình biến hình: Đếm ngược 0.1s bung luồng khí Aura
        if (state.susanooTransformTimer > 0) {
            state.susanooTransformTimer -= delta;
            if (state.susanooTransformTimer <= 0) {
                // Bung Aura, VÀ Ẩn Sasuke đi vì Susanoo là model riêng
                if (sasukeModel) sasukeModel.visible = false;
                import('./main.js').then(m => m.createFlameBlast()); // Gọi FlameBlast
            }
        }

        if (state.susanooTimer <= 0) {
            state.isSusanooActive = false;
            state.isSusanooSlashing = false;
            let susanooBarContainer = document.getElementById('susanooBarContainer');
            if (susanooBarContainer) susanooBarContainer.style.display = 'none';
            state.currentSpeed = state.baseSpeed; // Trả lại tốc độ bình thường
            if (susanooModel) susanooModel.visible = false;
            if (sasukeModel) sasukeModel.visible = true; // Hiện lại Sasuke
            stopSusanooAnimation();
            import('./main.js').then(m => m.createFlameBlast()); // Bùng nổ lửa tím trắng xóa khi hết Susanoo
            state.cameraTransitionTime = 1.0; // Bắt đầu chuyển đổi góc camera về Sasuke

            // Tắt âm thanh bay mượt mà (Có pause)
            if (window.susanooFlyAudio && window.fadeToVolume) {
                window.fadeToVolume(window.susanooFlyAudio, 0, 150, true);
            }

            // Ẩn các ngọn núi khổng lồ
            if (treeInstancedMeshes.length >= 4) {
                treeInstancedMeshes[0].mesh.visible = false;
                treeInstancedMeshes[1].mesh.visible = false;
                treeInstancedMeshes[2].mesh.visible = false;
            }
        }
    }

    // --- CẬP NHẬT QUÁN TÍNH HÀO QUANG KIẾM ---
    if (susanooSwordMesh) {
        susanooSwordMesh.updateMatrixWorld(true);
        let currentPos = new THREE.Vector3();

        // Mẹo: Lấy vị trí tâm của Lưỡi Kiếm
        susanooSwordMesh.geometry.computeBoundingBox();
        let center = new THREE.Vector3();
        susanooSwordMesh.geometry.boundingBox.getCenter(center);
        currentPos.copy(center).applyMatrix4(susanooSwordMesh.matrixWorld);

        if (susanooPreviousSwordPos.lengthSq() > 0) {
            // Vận tốc = Khoảng cách di chuyển / Khung hình
            let velocity = currentPos.clone().sub(susanooPreviousSwordPos);

            // Nếu kiếm đang chém (vận tốc cực cao), quán tính sẽ kéo Hào Quang giãn ra
            // Giới hạn max stretch để không bay tuột khỏi màn hình
            if (velocity.length() > 8.0) velocity.setLength(8.0);

            // Cập nhật Vector Quán tính (Lerp để tạo cảm giác dây thun đàn hồi)
            susanooInertiaOffset.lerp(velocity, delta * 20.0);
        }
        susanooPreviousSwordPos.copy(currentPos);

        // Khi kiếm dừng lại, quán tính tự động trả về 0 (như lò xo)
        susanooInertiaOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 8.0);

        // Cập nhật Uniforms cho tất cả các phần của kiếm (Lưỡi + Chắn)
        if (susanooSwordAuraMats) {
            susanooSwordAuraMats.forEach(mat => {
                if (mat.uniforms.inertiaOffset) {
                    mat.uniforms.inertiaOffset.value.copy(susanooInertiaOffset);
                }
            });
        }
    }

    // Cập nhật biến thời gian cho Shader của Susanoo
    if (susanooMaterialsList) {
        susanooMaterialsList.forEach(mat => {
            if (mat.uniforms && mat.uniforms.time) {
                mat.uniforms.time.value += delta;
            }
        });
    }
}
