import { renderer } from './core.js';

// ==========================================
// TẢI TÀI NGUYÊN (Textures, Models, Audio)
// ==========================================

export const textureLoader = new THREE.TextureLoader();
export const gltfLoader = new THREE.GLTFLoader(); // Dùng chung cho cả nhân vật và cây cối

export const groundTex = textureLoader.load('textures/ground.jpg');
groundTex.colorSpace = THREE.SRGBColorSpace;
groundTex.wrapS = groundTex.wrapT = THREE.MirroredRepeatWrapping;
groundTex.repeat.set(4, 40);
groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

export const woodTex = textureLoader.load('textures/wood.jpg');
woodTex.colorSpace = THREE.SRGBColorSpace;

export const fireTex = textureLoader.load('textures/fire.jpg');
fireTex.colorSpace = THREE.SRGBColorSpace;

export const mountainTex = textureLoader.load('textures/mountainjpg.jpg');
mountainTex.colorSpace = THREE.SRGBColorSpace;
mountainTex.wrapS = mountainTex.wrapT = THREE.RepeatWrapping;
mountainTex.repeat.set(3, 3); 

export const treeTex = textureLoader.load('textures/tree.jpg');
treeTex.colorSpace = THREE.SRGBColorSpace;
treeTex.wrapS = treeTex.wrapT = THREE.RepeatWrapping;
treeTex.repeat.set(1, 4);

// FIX LỖI ĐÁ ĐEN: Texture.clone() bị lỗi bất đồng bộ. Phải Load lại Texture mới!
export const giantRockTex = textureLoader.load('textures/mountainjpg.jpg');
giantRockTex.colorSpace = THREE.SRGBColorSpace;
giantRockTex.wrapS = giantRockTex.wrapT = THREE.RepeatWrapping; 
giantRockTex.repeat.set(8, 4);

// Âm thanh
export const katonAudio = new Audio('audios/katon_goukakyou.mp4');
katonAudio.volume = 1.0;
window.katonAudio = katonAudio;

export const chidoriAudio = new Audio('audios/chidori.mp4');
chidoriAudio.volume = 1.0;
window.chidoriAudio = chidoriAudio;

export const susanooFlyAudio = new Audio('audios/susanoo_fly.mp4');
susanooFlyAudio.volume = 0.8;
susanooFlyAudio.loop = true;
window.susanooFlyAudio = susanooFlyAudio;
