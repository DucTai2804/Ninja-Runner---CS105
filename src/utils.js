// ==========================================
// HÀM TIỆN ÍCH DÙNG CHUNG (UTILS)
// ==========================================

// Hàm tạo số ngẫu nhiên giả (pseudo-random) dựa trên tọa độ gốc. 
export function hash(val) {
    let r = Math.sin(val) * 43758.5453123;
    return r - Math.floor(r);
}

// --- HÀM TẠO NHIỄU DÙNG CHUNG CHO CẢ VERTEX LẪN FRAGMENT SHADER ---
export const GLSL_NOISE = `
    float hash(vec3 p) {
        p = fract(p * 0.3183099 + .1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float noise(vec3 x) {
        vec3 i = floor(x);
        vec3 f = fract(x);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                       mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                       mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
`;
