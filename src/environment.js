import { scene } from './core.js';
import { DAY_COLORS, NIGHT_COLORS, TOTAL_TREES } from './config.js';
import { groundTex, mountainTex } from './assets.js';
import { state } from './state.js';

// ==========================================
// ÁNH SÁNG & NGÀY ĐÊM
// ==========================================

export const ambientLight = new THREE.AmbientLight(DAY_COLORS.ambient, DAY_COLORS.ambientIntensity);
scene.add(ambientLight);

export const hemiLight = new THREE.HemisphereLight(DAY_COLORS.hemiSky, DAY_COLORS.hemiGround, DAY_COLORS.hemiIntensity);
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

export const dirLight = new THREE.DirectionalLight(DAY_COLORS.dir, DAY_COLORS.dirIntensity);
dirLight.position.set(-20, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;

const d = 30;
dirLight.shadow.camera.left = -d;
dirLight.shadow.camera.right = d;
dirLight.shadow.camera.top = d;
dirLight.shadow.camera.bottom = -d;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);

export function applyTimeMode(mode) {
    let colors = mode === 'night' ? NIGHT_COLORS : DAY_COLORS;
    scene.background = colors.background;
    scene.fog.color = colors.background;
    ambientLight.color = colors.ambient;
    ambientLight.intensity = colors.ambientIntensity;
    
    hemiLight.color = colors.hemiSky;
    hemiLight.groundColor = colors.hemiGround;
    hemiLight.intensity = colors.hemiIntensity;
    
    dirLight.color = colors.dir;
    dirLight.intensity = colors.dirIntensity;
}

// ==========================================
// MẶT ĐẤT
// ==========================================

export const groundGeo = new THREE.PlaneGeometry(250, 202, 50, 40);
export const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
export let groundPlanes = [];

for (let i = 0; i < 3; i++) {
    const segmentGroup = new THREE.Group();
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    segmentGroup.add(ground);

    segmentGroup.position.z = -i * 200;
    segmentGroup.position.y = -i * 0.01;
    scene.add(segmentGroup);
    groundPlanes.push(segmentGroup);
}

export function resetGrounds() {
    for (let i = 0; i < 3; i++) {
        groundPlanes[i].position.z = -i * 200;
    }
}

// ==========================================
// DÃY NÚI (CẢNH QUAN 2 BÊN)
// ==========================================

export const treeData = [];
export const treeInstancedMeshes = [];
const dummy = new THREE.Object3D();

for (let i = 0; i < TOTAL_TREES; i++) {
    let isLeft = i < 22;
    let localIndex = isLeft ? i : (i - 22);
    let isLowHill = localIndex < 14; 
    let posIndex = isLowHill ? localIndex : (localIndex - 14);

    let zSpacing = isLowHill ? (400 / 14) : (400 / 8);
    let zPos = 15 - posIndex * zSpacing;

    let type = isLowHill ? 3 : (posIndex % 3);
    let baseRadius = 0;
    if (type === 3) baseRadius = 25;
    else baseRadius = type === 0 ? 60 : (type === 1 ? 70 : 50);

    let targetEdge = isLowHill ? (3 + Math.random() * 2) : (35 + Math.random() * 15);
    let xPos = baseRadius + targetEdge;

    treeData.push({
        x: isLeft ? -xPos : xPos,
        y: isLowHill ? -5 : -10,
        z: zPos,
        r: Math.random() * Math.PI * 2,
        s: 1.0,
        type: type,
        isLeft: isLeft,
        isLowHill: isLowHill
    });
}

const treeGeos = [
    new THREE.ConeGeometry(60, 140, 4),
    new THREE.ConeGeometry(70, 120, 5),
    new THREE.ConeGeometry(50, 160, 3),
    new THREE.ConeGeometry(25, 40, 4)
];
treeGeos[0].translate(0, 70, 0);
treeGeos[1].translate(0, 60, 0);
treeGeos[2].translate(0, 80, 0);
treeGeos[3].translate(0, 20, 0);

const treeMat = new THREE.MeshLambertMaterial({
    map: mountainTex,
    color: 0xdddddd
});

treeGeos.forEach((geo, index) => {
    let typeCount = treeData.filter(t => t.type === index).length;
    let instanced = new THREE.InstancedMesh(geo, treeMat, typeCount);
    instanced.castShadow = false;
    instanced.receiveShadow = true;
    if (index < 3) {
        instanced.visible = false;
    }
    scene.add(instanced);
    treeInstancedMeshes.push({ mesh: instanced, type: index });
});

export function updateTreeMatrices() {
    let typeIndices = { 0: 0, 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < treeData.length; i++) {
        let t = treeData[i];
        dummy.position.set(t.x, t.y, t.z);
        dummy.rotation.set(0, t.r, 0);
        dummy.scale.set(t.s, t.s, t.s);
        dummy.updateMatrix();

        let instanceIdx = typeIndices[t.type];
        for (let j = 0; j < treeInstancedMeshes.length; j++) {
            if (treeInstancedMeshes[j].type === t.type) {
                treeInstancedMeshes[j].mesh.setMatrixAt(instanceIdx, dummy.matrix);
                treeInstancedMeshes[j].mesh.instanceMatrix.needsUpdate = true;
            }
        }
        typeIndices[t.type]++;
    }
}
updateTreeMatrices();

export function toggleMountains(forceState) {
    if (forceState !== undefined) {
        state.hideTrees = forceState;
    }
    if (treeInstancedMeshes.length >= 4) {
        let show = !state.hideTrees;
        treeInstancedMeshes[0].mesh.visible = show;
        treeInstancedMeshes[1].mesh.visible = show;
        treeInstancedMeshes[2].mesh.visible = show;
        treeInstancedMeshes[3].mesh.visible = show;
    }
}
