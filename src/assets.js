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

export const susanooFlyAudio = new Audio('audios/susanoo_fly.wav');
susanooFlyAudio.volume = 0.8;
susanooFlyAudio.loop = true;

window.susanooFlyAudio = susanooFlyAudio;

export const bgmAudio = new Audio('audios/rune_factory_3_ancient_bone.mp4');
bgmAudio.volume = 0.4; // Để mức 40% để không lấn át tiếng hiệu ứng
bgmAudio.loop = true;
window.bgmAudio = bgmAudio;

export const susanooSlashAudio = new Audio('audios/susanoo_slash.wav');
susanooSlashAudio.volume = 1.0;
window.susanooSlashAudio = susanooSlashAudio;

// Cải tiến cấp độ Phần cứng (Hardware-level): Sử dụng Web Audio API
// Triệt tiêu 100% lỗi Zipper Noise (rụt rụt) do trình duyệt xử lý volume thay đổi quá chậm
const AudioContext = window.AudioContext || window.webkitAudioContext;
window.audioCtx = new AudioContext();

window.initWebAudio = function (audio) {
    if (audio.gainNode) return;
    audio.gainNode = window.audioCtx.createGain();
    audio.sourceNode = window.audioCtx.createMediaElementSource(audio);
    audio.sourceNode.connect(audio.gainNode);
    audio.gainNode.connect(window.audioCtx.destination);

    // Khóa volume gốc của thẻ audio lại mức 1 để Web Audio toàn quyền xử lý
    if (!audio.dataset.origVol) audio.dataset.origVol = audio.volume;
    audio.gainNode.gain.value = audio.volume;
};

window.fadeToVolume = function (audio, targetVol, durationMs = 150, pauseAfter = false) {
    if (!audio) return;
    if (window.audioCtx.state === 'suspended') window.audioCtx.resume();

    // Khởi tạo Web Audio Node cho thẻ audio này nếu chưa có
    window.initWebAudio(audio);

    // Nếu target lớn hơn 0 và nhạc đang dừng, cho nhạc chạy
    if (targetVol > 0 && (audio.paused || audio.gainNode.gain.value === 0)) {
        audio.gainNode.gain.value = 0;
        let playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => console.log(e));
        }
    }

    let now = window.audioCtx.currentTime;
    let durationSec = durationMs / 1000;

    // Hủy các lệnh fade cũ và lấy mốc volume hiện tại
    audio.gainNode.gain.cancelScheduledValues(now);
    audio.gainNode.gain.setValueAtTime(audio.gainNode.gain.value, now);

    // Trượt mượt mà bằng phần cứng (Hardware linear ramp) - Lỗi Zipper Noise biến mất hoàn toàn
    audio.gainNode.gain.linearRampToValueAtTime(targetVol, now + durationSec);

    if (pauseAfter && targetVol === 0) {
        setTimeout(() => {
            // Bước 1: Mute cứng HTML5 Audio để chặn mọi tín hiệu nhiễu khi tua
            audio.muted = true;
            audio.pause();
            audio.currentTime = 0;

            // Bước 2: Đợi thẻ audio hoàn toàn chìm vào giấc ngủ (100ms) rồi mới trả lại âm lượng Web Audio
            setTimeout(() => {
                // Hủy mọi lệnh đặt volume dư thừa
                audio.gainNode.gain.cancelScheduledValues(window.audioCtx.currentTime);
                audio.gainNode.gain.setValueAtTime(parseFloat(audio.dataset.origVol), window.audioCtx.currentTime);
                audio.muted = false; // Mở lại để sẵn sàng cho lần bật Susanoo tiếp theo
            }, 100);
        }, durationMs + 50);
    }
};
