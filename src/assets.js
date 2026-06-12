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


export const bgmAudio = new Audio('audios/rune_factory_3_ancient_bone.mp4');
bgmAudio.volume = 0.15; // Để mức 15% để không lấn át tiếng hiệu ứng
// Fix lỗi khựng nhạc (Gapless Loop): Tua lại ngay trước khi file kịp dừng hẳn
bgmAudio.addEventListener('timeupdate', function () {
    let buffer = 0.2; // Tua lại trước 0.2s
    if (this.currentTime > this.duration - buffer) {
        this.currentTime = 0;
        this.play();
    }
});
window.bgmAudio = bgmAudio;

export const susanooSlashAudio = new Audio('audios/susanoo_slash.wav');
susanooSlashAudio.volume = 1.0;
susanooSlashAudio.dataset.origVol = 2.0; // Khuếch đại x2
window.susanooSlashAudio = susanooSlashAudio;

export const susanooActAudio = new Audio('audios/susanoo_activation.wav');
susanooActAudio.volume = 1.0;
window.susanooActAudio = susanooActAudio;

// Cải tiến cấp độ Phần cứng (Hardware-level): Sử dụng Web Audio API
// Triệt tiêu 100% lỗi Zipper Noise (rụt rụt) do trình duyệt xử lý volume thay đổi quá chậm
const AudioContext = window.AudioContext || window.webkitAudioContext;
window.audioCtx = new AudioContext();

// Tải Audio Buffer cho tiếng chém và tiếng bay
export let susanooSlashBuffer = null;
export let susanooFlyBuffer = null;

fetch('audios/susanoo_fly.wav')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => window.audioCtx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        susanooFlyBuffer = audioBuffer;
    })
    .catch(e => console.log("Lỗi tải audio fly:", e));

export const susanooFlyAudio = {
    isCustomWebAudio: true,
    source: null,
    gainNode: null,
    isPlaying: false,
    fadeTimeout: null,
    play: function() {
        if (this.fadeTimeout) {
            clearTimeout(this.fadeTimeout);
            this.fadeTimeout = null;
        }
        if (!susanooFlyBuffer || this.isPlaying) return;
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        
        this.source = window.audioCtx.createBufferSource();
        this.source.buffer = susanooFlyBuffer;
        this.source.loop = true; // Vòng lặp gapless hoàn hảo ở cấp độ phần cứng
        
        this.gainNode = window.audioCtx.createGain();
        this.gainNode.gain.value = 0; 
        
        this.source.connect(this.gainNode);
        this.gainNode.connect(window.audioCtx.destination);
        
        this.source.start(0);
        this.isPlaying = true;
    },
    stop: function() {
        if (this.fadeTimeout) {
            clearTimeout(this.fadeTimeout);
            this.fadeTimeout = null;
        }
        if (this.source && this.isPlaying) {
            this.source.stop();
            this.source.disconnect();
            this.source = null;
            this.isPlaying = false;
        }
    },
    fadeTo: function(targetVol, durationMs, pauseAfter = false) {
        if (!this.gainNode) return;
        if (this.fadeTimeout) {
            clearTimeout(this.fadeTimeout);
            this.fadeTimeout = null;
        }
        let now = window.audioCtx.currentTime;
        let durationSec = durationMs / 1000;
        this.gainNode.gain.cancelScheduledValues(now);
        this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
        this.gainNode.gain.linearRampToValueAtTime(targetVol, now + durationSec);
        
        if (pauseAfter && targetVol === 0) {
            this.fadeTimeout = setTimeout(() => {
                this.stop();
            }, durationMs + 50);
        }
    }
};
window.susanooFlyAudio = susanooFlyAudio;

fetch('audios/susanoo_slash.wav')
    .then(response => response.arrayBuffer())
    .then(arrayBuffer => window.audioCtx.decodeAudioData(arrayBuffer))
    .then(audioBuffer => {
        susanooSlashBuffer = audioBuffer;
    })
    .catch(e => console.log("Lỗi tải audio buffer:", e));

window.playSusanooSlashSfx = function() {
    if (!susanooSlashBuffer) return false;
    if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
    
    let source = window.audioCtx.createBufferSource();
    source.buffer = susanooSlashBuffer;
    
    let gainNode = window.audioCtx.createGain();
    gainNode.gain.value = 2.0; // Khuếch đại x2
    
    source.connect(gainNode);
    gainNode.connect(window.audioCtx.destination);
    
    source.start(0);
    return true;
};

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
    
    // Nếu là đối tượng âm thanh WebAudio tự tạo
    if (audio.isCustomWebAudio) {
        audio.fadeTo(targetVol, durationMs, pauseAfter);
        return;
    }

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

export const shurikenAudio = new Audio('audios/shuriken_extend.wav');
shurikenAudio.volume = 0;
window.shurikenAudio = shurikenAudio;
