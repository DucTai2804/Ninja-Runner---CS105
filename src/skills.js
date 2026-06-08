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

let globalSkillTime = 0; // Thêm biến lưu trữ thời gian tổng cho Shader

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

const chidoriLight = new THREE.PointLight(0x66ccff, 5.0, 15.0); // Giảm tầm chiếu sáng từ 40 xuống 15 để cứu FPS (tránh GPU phải tính toán ánh sáng cho núi và cây ở xa)
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

// Kỹ thuật GPU Lightning: Gộp toàn bộ tia sét vào 1 BufferGeometry duy nhất
function createGPULightning(lineCount, pointsPerLine, isCone) {
    const segmentsPerLine = pointsPerLine - 1;
    const vertexCount = lineCount * segmentsPerLine * 2;
    
    const positions = new Float32Array(vertexCount * 3);
    const pointIndices = new Float32Array(vertexCount);
    const seeds = new Float32Array(vertexCount * 3);
    const params = new Float32Array(vertexCount * 3); // angle, radiusBase, backwardTotal

    let vIdx = 0;
    for (let i = 0; i < lineCount; i++) {
        let seedX = Math.random() * 100.0;
        let seedY = Math.random() * 100.0;
        let seedZ = Math.random() * 100.0;
        
        let angle = Math.random() * Math.PI * 2;
        let radiusBase = Math.random() * 3.5;
        let backwardTotal = Math.random() * 8.0 + 4.0;
        
        for (let j = 0; j < segmentsPerLine; j++) {
            // Đỉnh 1 của đoạn thẳng
            pointIndices[vIdx] = j;
            seeds[vIdx * 3] = seedX; seeds[vIdx * 3 + 1] = seedY; seeds[vIdx * 3 + 2] = seedZ;
            params[vIdx * 3] = angle; params[vIdx * 3 + 1] = radiusBase; params[vIdx * 3 + 2] = backwardTotal;
            vIdx++;
            
            // Đỉnh 2 của đoạn thẳng
            pointIndices[vIdx] = j + 1;
            seeds[vIdx * 3] = seedX; seeds[vIdx * 3 + 1] = seedY; seeds[vIdx * 3 + 2] = seedZ;
            params[vIdx * 3] = angle; params[vIdx * 3 + 1] = radiusBase; params[vIdx * 3 + 2] = backwardTotal;
            vIdx++;
        }
    }
    
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('pointIndex', new THREE.BufferAttribute(pointIndices, 1));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 3));
    if (isCone) geo.setAttribute('params', new THREE.BufferAttribute(params, 3));
    
    return geo;
}

const lightningFragmentShader = `
    uniform vec3 color;
    uniform float opacity;
    varying float vAlpha;
    void main() {
        if(vAlpha < 0.5) discard;
        gl_FragColor = vec4(color, opacity);
    }
`;

export const sparksCount = 30;
const sparksGeo = createGPULightning(sparksCount, 4, false);
export const sparksMat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        drawRatio: { value: 4.0 }, // 4 điểm
        color: { value: new THREE.Color(0x33ccff) },
        opacity: { value: 0.9 }
    },
    vertexShader: `
        uniform float time;
        uniform float drawRatio;
        attribute float pointIndex;
        attribute vec3 seed;
        varying float vAlpha;
        
        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        
        void main() {
            vAlpha = (pointIndex <= drawRatio) ? 1.0 : 0.0;
            float t = floor(time * 30.0); // Rung giật 30 lần/giây
            
            float px = 0.0; float py = 0.0; float pz = -0.35;
            for(int i = 1; i <= 4; i++) {
                if(float(i) > pointIndex) break;
                px += (hash(seed.x + float(i) * 1.2 + t) - 0.5) * 1.5;
                py += (hash(seed.y + float(i) * 1.5 + t) - 0.5) * 1.5;
                pz += (hash(seed.z + float(i) * 1.1 + t) * 0.8 + 0.2) * 2.0;
            }
            
            vec3 finalPos = vec3(px, py, pz);
            if(pointIndex == 0.0) finalPos = vec3(0.0, 0.0, -0.35);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
        }
    `,
    fragmentShader: lightningFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
export const sparksMesh = new THREE.LineSegments(sparksGeo, sparksMat);
chidoriGroup.add(sparksMesh);

export const coneLightningCount = 20;
const coneGeo = createGPULightning(coneLightningCount, 5, true);
export const coneLightningMat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        drawRatio: { value: 5.0 }, // 5 điểm
        color: { value: new THREE.Color(0x66eeff) },
        opacity: { value: 0.8 }
    },
    vertexShader: `
        uniform float time;
        uniform float drawRatio;
        attribute float pointIndex;
        attribute vec3 seed;
        attribute vec3 params; // angle, radiusBase, backwardTotal
        varying float vAlpha;
        
        float hash(float n) { return fract(sin(n) * 43758.5453123); }
        
        void main() {
            vAlpha = (pointIndex <= drawRatio) ? 1.0 : 0.0;
            float t = floor(time * 30.0); 
            
            float angle = params.x; float radiusBase = params.y; float backwardTotal = params.z;
            float px = 0.0; float py = 0.0; float pz = -0.35;
            
            for(int i = 1; i <= 5; i++) {
                if(float(i) > pointIndex) break;
                px += cos(angle) * (radiusBase / 4.0) + (hash(seed.x + float(i) * 1.2 + t) - 0.5) * 1.5;
                py += sin(angle) * (radiusBase / 4.0) + (hash(seed.y + float(i) * 1.5 + t) - 0.5) * 1.5;
                pz += (backwardTotal / 4.0);
            }
            
            vec3 finalPos = vec3(px, py, pz);
            if(pointIndex == 0.0) finalPos = vec3(0.0, 0.0, -0.35);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
        }
    `,
    fragmentShader: lightningFragmentShader,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
export const coneMesh = new THREE.LineSegments(coneGeo, coneLightningMat);
coneMesh.visible = false;
chidoriGroup.add(coneMesh);

// Tạo Texture hình cầu phát sáng (Radial Gradient)
function createGlowingParticleTexture(r = 102, g = 238, b = 255) {
    let canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    let context = canvas.getContext('2d');
    let gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
}

// Tạo Texture dạng Khói (Mềm, mờ hơn)
function createSmokeTexture(r = 255, g = 255, b = 255) {
    let canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    let context = canvas.getContext('2d');
    let gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    // Khói cần to dần và rất mờ ở viền để khi đè lên nhau không bị lộ hình tròn
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.8)`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, 0.5)`);
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, 0.1)`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

// Đốm sáng (Particles) cho Chidori (Tối ưu hóa GPU)
export const chidoriParticleCount = 40;
export const chidoriParticleGeo = new THREE.BufferGeometry();
const chidoriParticlePositions = new Float32Array(chidoriParticleCount * 3);
const chidoriParticleSeeds = new Float32Array(chidoriParticleCount * 3);

for (let i = 0; i < chidoriParticleCount; i++) {
    chidoriParticleSeeds[i * 3] = Math.random() * 100.0;
    chidoriParticleSeeds[i * 3 + 1] = Math.random() * 100.0;
    chidoriParticleSeeds[i * 3 + 2] = Math.random() * 100.0;
}
chidoriParticleGeo.setAttribute('position', new THREE.BufferAttribute(chidoriParticlePositions, 3));
chidoriParticleGeo.setAttribute('seed', new THREE.BufferAttribute(chidoriParticleSeeds, 3));

export const chidoriParticleMat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        speedMultiplier: { value: 1.0 },
        particleTex: { value: createGlowingParticleTexture() },
        opacity: { value: 1.0 },
        size: { value: 0.35 }
    },
    vertexShader: `
        uniform float time;
        uniform float speedMultiplier;
        uniform float size;
        attribute vec3 seed;
        
        varying float vAlpha;
        
        float hash(float n) { return fract(sin(n) * 12345.6789); }
        
        void main() {
            float rawLife = hash(seed.x) - time * 2.5;
            float cycle = floor(rawLife);
            float life = fract(rawLife); // 1.0 -> 0.0
            float t = 1.0 - life; // 0.0 -> 1.0
            
            float localSeed = seed.x + cycle * 123.45;
            
            float startX = (hash(localSeed + 1.0) - 0.5) * 0.4;
            float startY = (hash(localSeed + 2.0) - 0.5) * 0.4;
            float startZ = -0.3;
            
            float angle = hash(localSeed + 3.0) * 6.283;
            float radiusSpeed = 0.2 + hash(localSeed + 4.0) * 0.8;
            
            float speedX = cos(angle) * radiusSpeed;
            float speedY = sin(angle) * radiusSpeed;
            float speedZ = 2.0 + hash(localSeed + 5.0) * 3.0;
            
            vec3 pos = vec3(startX, startY, startZ);
            // 0.4 is max lifetime (1.0 / 2.5)
            pos.x += speedX * speedMultiplier * t * 0.4;
            pos.y += speedY * speedMultiplier * t * 0.4;
            pos.z += speedZ * speedMultiplier * t * 0.4;
            
            vAlpha = 1.0; // CPU không có fade, giữ nguyên độ sáng
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            float pointZ = max(abs(mvPosition.z), 1.0);
            gl_PointSize = size * (400.0 / pointZ); // Hạ tỉ lệ xuống 400 để khớp với kích thước của CPU PointsMaterial
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D particleTex;
        uniform float opacity;
        varying float vAlpha;
        void main() {
            vec4 texColor = texture2D(particleTex, gl_PointCoord);
            gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha * opacity);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
export const chidoriParticles = new THREE.Points(chidoriParticleGeo, chidoriParticleMat);
chidoriGroup.add(chidoriParticles);

// Đốm sáng (Particles) cho Susanoo (Tối ưu hóa GPU)
export const susanooParticleCount = 80;
export const susanooParticleGeo = new THREE.BufferGeometry();
const susanooParticlePositions = new Float32Array(susanooParticleCount * 3);
const susanooParticleSeeds = new Float32Array(susanooParticleCount * 3);

for (let i = 0; i < susanooParticleCount; i++) {
    susanooParticleSeeds[i * 3] = Math.random() * 100.0;
    susanooParticleSeeds[i * 3 + 1] = Math.random() * 100.0;
    susanooParticleSeeds[i * 3 + 2] = Math.random() * 100.0;
}
susanooParticleGeo.setAttribute('position', new THREE.BufferAttribute(susanooParticlePositions, 3));
susanooParticleGeo.setAttribute('seed', new THREE.BufferAttribute(susanooParticleSeeds, 3));

export const susanooParticleMat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        particleTex: { value: createGlowingParticleTexture(255, 119, 255) },
        opacity: { value: 0.8 },
        size: { value: 0.6 }
    },
    vertexShader: `
        uniform float time;
        uniform float size;
        attribute vec3 seed;
        varying float vAlpha;
        float hash(float n) { return fract(sin(n) * 12345.6789); }
        void main() {
            float rawLife = hash(seed.x) - time * 1.0;
            float cycle = floor(rawLife);
            float life = fract(rawLife); // 1.0 -> 0.0
            float t = 1.0 - life;
            
            float localSeed = seed.x + cycle * 123.45;
            
            float startX = (hash(localSeed + 1.0) - 0.5) * 20.0;
            float startY = hash(localSeed + 2.0) * 20.0;
            float startZ = (hash(localSeed + 3.0) - 0.5) * 20.0;
            
            float speedX = (hash(localSeed + 4.0) - 0.5) * 1.5;
            float speedY = 10.0 + hash(localSeed + 5.0) * 10.0;
            float speedZ = (hash(localSeed + 6.0) - 0.5) * 1.5;
            
            vec3 pos = vec3(startX, startY, startZ);
            pos.x += speedX * t; // duration is 1.0s
            pos.y += speedY * t;
            pos.z += speedZ * t;
            
            vAlpha = 1.0; // Giữ nguyên độ sáng như CPU
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            float pointZ = max(abs(mvPosition.z), 1.0);
            gl_PointSize = size * (400.0 / pointZ); // Hạ tỉ lệ xuống 400 để đốm sáng nhỏ lại, sắc nét như cũ
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D particleTex;
        uniform float opacity;
        varying float vAlpha;
        void main() {
            vec4 texColor = texture2D(particleTex, gl_PointCoord);
            gl_FragColor = vec4(texColor.rgb, texColor.a * vAlpha * opacity);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});
export const susanooParticles = new THREE.Points(susanooParticleGeo, susanooParticleMat);
susanooParticles.position.y = 10.0;
susanooParticles.visible = false;

// Vì swordParticles vẫn ở lại CPU nên cần có material riêng (trước đây xài chung susanooParticleMat)
const swordParticleMat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.6,
    map: createGlowingParticleTexture(255, 119, 255),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false
});

// Đốm sáng (Particles) cho kiếm Susanoo chuyển động theo quán tính
export const swordParticleCount = 100;
export const swordParticleGeo = new THREE.BufferGeometry();
export const swordParticlePositions = new Float32Array(swordParticleCount * 3);
export const swordParticleData = [];
for (let i = 0; i < swordParticleCount; i++) {
    swordParticlePositions[i * 3] = 9999;
    swordParticlePositions[i * 3 + 1] = 9999;
    swordParticlePositions[i * 3 + 2] = 9999;
    
    swordParticleData.push({
        life: 0,
        speedX: 0,
        speedY: 0,
        speedZ: 0
    });
}
swordParticleGeo.setAttribute('position', new THREE.BufferAttribute(swordParticlePositions, 3));
export const swordParticles = new THREE.Points(swordParticleGeo, swordParticleMat);
swordParticles.frustumCulled = false; // QUAN TRỌNG: Ngăn Three.js culling vì bounding sphere ban đầu ở 9999
swordParticles.visible = false;

// GPU Instanced Smoke: Gộp 25 Sprite vào 1 InstancedBufferGeometry để GPU tự tính toán vật lý
export const susanooSmokeCount = 25; 
const susanooSmokeGeo = new THREE.InstancedBufferGeometry();
susanooSmokeGeo.copy(new THREE.PlaneGeometry(1, 1)); // Mặt phẳng vuông 1x1

const smokeOffsets = new Float32Array(susanooSmokeCount * 3);
const smokeParams = new Float32Array(susanooSmokeCount * 4); // x: seed, y: speedY, z: baseScale, w: rotSpeed

for (let i = 0; i < susanooSmokeCount; i++) {
    // Offset ban đầu bao quanh thân
    smokeOffsets[i * 3] = (Math.random() - 0.5) * 8.0;
    smokeOffsets[i * 3 + 1] = (Math.random() - 0.5) * 16.0;
    smokeOffsets[i * 3 + 2] = (Math.random() - 0.5) * 8.0;
    
    // Params
    smokeParams[i * 4] = Math.random() * 100.0; // seed
    smokeParams[i * 4 + 1] = 4.0 + Math.random() * 5.0; // speedY
    smokeParams[i * 4 + 2] = 6.0 + Math.random() * 8.0; // baseScale
    smokeParams[i * 4 + 3] = (Math.random() - 0.5) * 2.0; // rotSpeed
}

susanooSmokeGeo.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(smokeOffsets, 3));
susanooSmokeGeo.setAttribute('instanceParams', new THREE.InstancedBufferAttribute(smokeParams, 4));

export const susanooSmokeMat = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        smokeTex: { value: createSmokeTexture(255, 255, 255) },
        color: { value: new THREE.Color(0x5a0099) }
    },
    vertexShader: `
        uniform float time;
        attribute vec3 instanceOffset;
        attribute vec4 instanceParams;
        
        varying vec2 vUv;
        varying float vAlpha;
        
        float hash(float n) { return fract(sin(n) * 12345.6789); }
        
        void main() {
            vUv = uv;
            float seed = instanceParams.x;
            float baseSpeedY = instanceParams.y;
            float baseScale = instanceParams.z;
            float rotSpeed = instanceParams.w;
            
            // Calculate looping life: 1.0 -> 0.0
            float decay = 0.4 + hash(seed) * 0.4;
            float rawLife = hash(seed + 10.0) - time * decay;
            float cycle = floor(rawLife);
            float life = fract(rawLife);
            float lifeInv = 1.0 - life;
            
            float localSeed = seed + cycle * 123.45;
            
            // Movement
            float speedX = (hash(localSeed + 1.0) - 0.5) * 1.5;
            float speedZ = (hash(localSeed + 2.0) - 0.5) * 1.5;
            float angleTime = hash(seed + 3.0) * 6.28 + time * 2.0;
            
            vec3 pos = instanceOffset;
            pos.x += speedX * lifeInv * 8.0;
            pos.y += baseSpeedY * lifeInv * 8.0;
            pos.z += (speedZ + cos(angleTime) * 0.5) * lifeInv * 8.0;
            
            // Smooth alpha
            if (life > 0.8) vAlpha = (1.0 - life) / 0.2;
            else if (life < 0.3) vAlpha = life / 0.3;
            else vAlpha = 1.0;
            vAlpha *= 0.3; // Max opacity 0.3
            
            // Scale up
            float currentScale = baseScale * (1.0 + lifeInv * 0.3);
            
            // Billboarding
            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            
            // Rotation
            float rot = rotSpeed * time;
            float c = cos(rot);
            float s = sin(rot);
            mat2 rotMat = mat2(c, -s, s, c);
            
            vec2 rotatedPos = rotMat * position.xy;
            mvPosition.xy += rotatedPos * currentScale;
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D smokeTex;
        uniform vec3 color;
        varying vec2 vUv;
        varying float vAlpha;
        
        void main() {
            vec4 texColor = texture2D(smokeTex, vUv);
            gl_FragColor = vec4(color, texColor.a * vAlpha);
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
});

// QUAN TRỌNG: Phải dùng THREE.InstancedMesh thay vì THREE.Mesh để WebGL không bị crash khi vẽ InstancedBufferAttribute
export const susanooSmokeParticles = new THREE.InstancedMesh(susanooSmokeGeo, susanooSmokeMat, susanooSmokeCount);
susanooSmokeParticles.position.y = 32.0;
susanooSmokeParticles.frustumCulled = false; // Ngăn chặn tự động ẩn khi camera quay đi
susanooSmokeParticles.visible = false;

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
    globalSkillTime += delta;

    // --- SKILL 2 (CHIDORI) ---
    if (state.isCastingChidori || state.chidoriFadeTimer > 0) {
        // GPU Lightning: Chỉ việc cập nhật biến time cho shader chạy, CPU không cần làm gì cả!
        sparksMat.uniforms.time.value = globalSkillTime;
        coneLightningMat.uniforms.time.value = globalSkillTime;
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
        coneMesh.visible = true; // Bật sét hình nón lên CÙNG LÚC với quả cầu

        // Đảm bảo opacity và drawRange đầy đủ khi đang cast
        chidoriCoreMat.opacity = 0.8;
        chidoriInnerMat.opacity = 1.0;
        sparksMat.uniforms.drawRatio.value = 4.0;
        coneLightningMat.uniforms.drawRatio.value = 5.0;
        chidoriParticleMat.opacity = 1.0;

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
            coneMesh.visible = false;
        } else {
            let ratio = state.chidoriFadeTimer / 0.1;
            // Khối cầu mờ dần đi
            chidoriCoreMat.opacity = 0.8 * ratio;
            chidoriInnerMat.opacity = 1.0 * ratio;

            // Các tia sét biến mất từng khúc (fade drawRatio)
            sparksMat.uniforms.drawRatio.value = Math.max(0.0, ratio * 4.0);
            coneLightningMat.uniforms.drawRatio.value = Math.max(0.0, ratio * 5.0);
            chidoriParticleMat.opacity = 0.8 * ratio;
        }
    }

    // Cập nhật đốm sáng Chidori (GPU Particles)
    if (state.isCastingChidori || state.chidoriFadeTimer > 0) {
        let speedMultiplier = state.baseSpeed > 0 ? (state.currentSpeed / state.baseSpeed) : 1;
        chidoriParticleMat.uniforms.time.value = globalSkillTime;
        chidoriParticleMat.uniforms.speedMultiplier.value = speedMultiplier;
    }

    // --- CẬP NHẬT TRẠNG THÁI SUSANOO ---
    let targetFov = state.isSusanooActive ? 90 : 60; // Góc nhìn rộng hơn
    if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * (delta * 4); // Nội suy mượt mà
        camera.updateProjectionMatrix();
    }

    // Giảm lớp sương đằng xa để nhìn được xa hơn khi bay cao
    let targetFogFar = state.isSusanooActive ? 300 : 100;
    let targetCamFar = state.isSusanooActive ? 320 : 120; // Luôn giữ camera.far lớn hơn sương mù một chút
    
    if (scene.fog && Math.abs(scene.fog.far - targetFogFar) > 0.1) {
        scene.fog.far += (targetFogFar - scene.fog.far) * (delta * 4);
    }
    
    // Mở rộng tầm nhìn vật lý của Camera để không bị cắt hụt khi sương mù lùi ra xa
    if (Math.abs(camera.far - targetCamFar) > 0.1) {
        camera.far += (targetCamFar - camera.far) * (delta * 4);
        camera.updateProjectionMatrix();
    }

    if (state.isSusanooActive) {
        state.susanooTimer -= delta;

        // Cập nhật Hạt Sáng Susanoo và Làn Khói
        if (susanooParticles && susanooSmokeParticles) {
            susanooParticles.visible = true;
            susanooSmokeParticles.visible = true;

            // Cập nhật Khói Mờ (GPU InstancedMesh)
            susanooSmokeMat.uniforms.time.value = globalSkillTime;

            // Cập nhật Hạt Sáng (GPU Particles)
            susanooParticleMat.uniforms.time.value = globalSkillTime;
        }

        // Cập nhật Sword Particles theo quỹ đạo kiếm
        if (swordParticles && susanooSwordHitbox) {
            swordParticles.visible = true;
            let positions = swordParticles.geometry.attributes.position.array;
            let spawnedThisFrame = 0;
            
            // Tính toán kích thước của lưỡi kiếm
            susanooSwordHitbox.geometry.computeBoundingBox();
            let size = new THREE.Vector3();
            let center = new THREE.Vector3();
            susanooSwordHitbox.geometry.boundingBox.getSize(size);
            susanooSwordHitbox.geometry.boundingBox.getCenter(center);
            
            for (let i = 0; i < swordParticleCount; i++) {
                let pData = swordParticleData[i];
                if (pData.life > 0) {
                    pData.life -= delta * 3.0; // Biến mất khá nhanh (1/3 giây) để tạo vệt chém
                    positions[i * 3] += pData.speedX * delta;
                    positions[i * 3 + 1] += pData.speedY * delta;
                    positions[i * 3 + 2] += pData.speedZ * delta;
                } else {
                    positions[i * 3] = 9999; // Giấu đi
                    
                    // Nếu đang chém thì rải đốm sáng dọc theo kiếm
                    if (state.isSusanooSlashing && spawnedThisFrame < 6) { // Sinh ra 6 hạt mỗi frame
                        pData.life = 1.0;
                        
                        let localPt = new THREE.Vector3(
                            center.x + (Math.random() - 0.5) * size.x * 2.0,
                            center.y + (Math.random() - 0.5) * size.y * 1.5, // Dọc theo lưỡi kiếm
                            center.z + (Math.random() - 0.5) * size.z * 2.0
                        );
                        
                        susanooSwordHitbox.localToWorld(localPt); // Chuyển ra world space để đốm sáng nằm lại trên không trung
                        
                        positions[i * 3] = localPt.x;
                        positions[i * 3 + 1] = localPt.y;
                        positions[i * 3 + 2] = localPt.z;
                        
                        // Quán tính lơ lửng sau khi chém
                        pData.speedX = (Math.random() - 0.5) * 5.0;
                        pData.speedY = (Math.random() - 0.5) * 5.0;
                        pData.speedZ = (Math.random() - 0.5) * 5.0;
                        
                        spawnedThisFrame++;
                    }
                }
            }
            swordParticles.geometry.attributes.position.needsUpdate = true;
        }

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
            susanooParticles.visible = false; // Tắt hạt sáng
            susanooSmokeParticles.visible = false; // Tắt khói
            swordParticles.visible = false; // Tắt vệt kiếm
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
