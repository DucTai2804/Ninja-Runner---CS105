import { scene } from './core.js';
import { CONFIG, LANE_POSITIONS } from './config.js';
import { mountainTex, giantRockTex, treeTex, gltfLoader } from './assets.js';
import { hash } from './utils.js';

// ==========================================
// HỆ THỐNG CHƯỚNG NGẠI VẬT & TIỀN VÀNG
// ==========================================
export let obstacleRows = [];

// Khởi tạo Đá nhỏ
export const obsGeo = new THREE.DodecahedronGeometry(1.2, 0);
export const obsMat = new THREE.MeshLambertMaterial({
    map: mountainTex,
    color: 0xaaaaaa
});

// Khởi tạo Đá Khổng Lồ (Đá Tròn To - Sphere)
export const giantRockGeo = new THREE.SphereGeometry(1, 24, 16);
giantRockGeo.scale(20, 20, CONFIG.GIANT_ROCK_RADIUS);
giantRockGeo.rotateZ(Math.PI / 2);

const posAttr = giantRockGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    let x = posAttr.getX(i);
    let y = posAttr.getY(i);
    let z = posAttr.getZ(i);

    let randX = hash(x * 12.989 + y * 78.233 + z * 37.719);
    let randY = hash(x * 39.346 + y * 11.135 + z * 83.155);
    let randZ = hash(x * 73.156 + y * 52.235 + z * 9.151);

    x += (randX - 0.5) * 1.5;
    y += (randY - 0.5) * 1.5;
    z += (randZ - 0.5) * (CONFIG.GIANT_ROCK_RADIUS * 0.4);
    posAttr.setXYZ(i, x, y, z);
}
giantRockGeo.computeVertexNormals();

export const giantRockMat = new THREE.MeshLambertMaterial({
    map: giantRockTex,
    color: 0x999999
});

// Khởi tạo Vách Núi Vuông (Giữ nguyên 32x32x32 theo yêu cầu để giữ nguyên 100% ngoại hình)
export const mountainWallGeo = new THREE.BoxGeometry(1, 1, 1, 32, 32, 32);
const mwPosAttr = mountainWallGeo.attributes.position;
for (let i = 0; i < mwPosAttr.count; i++) {
    let x = mwPosAttr.getX(i);
    let y = mwPosAttr.getY(i);
    let z = mwPosAttr.getZ(i);

    let randX = hash(x * 12.989 + y * 78.233 + z * 37.719);
    let randY = hash(x * 39.346 + y * 11.135 + z * 83.155);
    let randZ = hash(x * 73.156 + y * 52.235 + z * 9.151);

    x += (randX - 0.5) * 0.02;
    y += (randY - 0.5) * 0.02;
    z += (randZ - 0.5) * 0.02;
    mwPosAttr.setXYZ(i, x, y, z);
}
mountainWallGeo.computeVertexNormals();
mountainWallGeo.computeBoundingBox();
mountainWallGeo.computeBoundingSphere();

// Khởi tạo Cây gỗ
export const fallingTreeGeo = new THREE.CylinderGeometry(0.9, 0.9, 30, 8); 
fallingTreeGeo.rotateX(Math.PI / 2); 
export const barkMat = new THREE.MeshStandardMaterial({ map: treeTex, roughness: 1.0 });
export const woodCoreMat = new THREE.MeshStandardMaterial({ color: 0x4a3b2c, roughness: 1.0 });
export const fallingTreeMat = [barkMat, woodCoreMat, woodCoreMat];

// Khởi tạo Tiền Vàng
export const coinGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
coinGeo.rotateX(Math.PI / 2); // Đứng thẳng lên
export const coinMat = new THREE.MeshStandardMaterial({
    color: 0xffea00, // Màu vàng chanh rực rỡ hơn
    metalness: 1.0, // Phản chiếu ánh sáng max
    roughness: 0.1, // Bề mặt nhẵn bóng
    emissive: 0xffaa00, // Tỏa sáng nhẹ màu vàng cam
    emissiveIntensity: 0.6 // Cường độ tỏa sáng vừa phải để không bị chói
});

// Khởi tạo Phi Tiêu (Kunai/Shuriken)
export const kunaiGeo = new THREE.ConeGeometry(0.3, 2.5, 4);
kunaiGeo.rotateX(-Math.PI / 2); // Chĩa mũi nhọn về phía trước (-Z)
export const kunaiMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.9,
    roughness: 0.3,
    flatShading: true
});

export function spawnObstaclePattern(rowObstacles, rowCoins = null, practicePattern = 0) {
    // Ẩn hết đá, phi tiêu, cây, bóng, tiền vàng trước khi xếp
    if (rowCoins) {
        rowCoins.forEach(coin => {
            coin.mesh.visible = false;
            coin.collected = false;
        });
    }
    rowObstacles.forEach(obs => {
        obs.rock.visible = false;
        obs.giantRock.visible = false;
        obs.tree.visible = false;
        obs.shadow.visible = false;
        if (obs.shuriken) obs.shuriken.visible = false;

        obs.rock.scale.copy(obs.baseRockScale); // Reset scale về kích thước đá nhỏ mặc định
        obs.rock.castShadow = true; 
        obs.tree.scale.set(1, 1, 1); 
        obs.giantRock.scale.set(1, 1, 1); 
        obs.mountainWall.scale.set(1, 1, 1); 
        obs.mountainWall.position.set(0, 0, 0);
        obs.mountainWall.visible = false;

        obs.isFalling = false;
        obs.rotSpeedX = 0; // Reset quán tính
        obs.rotSpeedY = 0;
        obs.activeType = 'none';
        obs.isRolling = false;
    });

    let rand = Math.random();

    // ÁP DỤNG CHẾ ĐỘ LUYỆN TẬP
    let p = practicePattern || window.practicePattern;
    if (p) {
        if (p === 1) rand = 0.05;
        else if (p === 2) rand = 0.2;
        else if (p === 3) rand = 0.4;
        else if (p === 4) rand = 0.5;
        else if (p === 5) rand = 0.6;
        else if (p === 6) rand = 0.72;
        else if (p === 7) rand = 0.8;
        else if (p === 8) rand = 0.9;
        else if (p === 9) rand = 0.95;
    }

    if (rand < 0.15) {
        // Mẫu 1 (15%): Dễ - Đá rơi ngẫu nhiên 1 làn
        let lane = Math.floor(Math.random() * 3);
        let obs = rowObstacles[lane];
        obs.activeType = 'rock';
        obs.rock.position.set(LANE_POSITIONS[lane], 1.2, 0);
        obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
        obs.rock.visible = true;
    } else if (rand < 0.30) {
        // Mẫu 2 (15%): Khó - Tường Kép chặn 2 làn (Đá)
        let emptyLane = Math.floor(Math.random() * 3);
        for (let i = 0; i < 3; i++) {
            if (i !== emptyLane) {
                let obs = rowObstacles[i];
                obs.activeType = 'rock';
                obs.rock.position.set(LANE_POSITIONS[i], 1.2, 0);
                obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
                obs.rock.visible = true;
            }
        }
    } else if (rand < 0.45) {
        // Mẫu 3 (15%): Thử thách - Ziczac chéo 3 làn (Đá)
        let lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3; i++) {
            let obs = rowObstacles[i];
            obs.activeType = 'rock';
            obs.rock.position.set(LANE_POSITIONS[lanes[i]], 1.2, -i * 8);
            obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
            obs.rock.visible = true;
        }
    } else if (rand < 0.55) {
        // Mẫu 4 (10%): Phi tiêu lơ lửng - Ép Trượt
        let lane = Math.floor(Math.random() * 3);
        let obs = rowObstacles[lane];
        obs.activeType = 'shuriken';
        if (obs.shuriken) {
            obs.shuriken.position.set(LANE_POSITIONS[lane], 2.5, 0); // Cao 2.5m
            obs.shuriken.visible = true;
        }
    } else if (rand < 0.70) {
        // Mẫu 5 (15%): Cửa tử - 2 đá 2 bên, 1 Phi tiêu lơ lửng ở giữa -> Ép Trượt lách khe
        for (let i = 0; i < 3; i++) {
            let obs = rowObstacles[i];
            if (i === 1) {
                obs.activeType = 'shuriken';
                if (obs.shuriken) {
                    obs.shuriken.position.set(LANE_POSITIONS[i], 2.5, 0);
                    obs.shuriken.visible = true;
                }
            } else {
                obs.activeType = 'rock';
                obs.rock.position.set(LANE_POSITIONS[i], 1.2, 0);
                obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
                obs.rock.visible = true;
            }
        }
    } else if (rand < 0.75) {
        // Mẫu 6 (15%): Thiên thạch rơi trúng đầu! (Tăng tỷ lệ xuất hiện lên)
        let lane = Math.floor(Math.random() * 3);
        let obs = rowObstacles[lane];
        obs.activeType = 'rock';
        obs.isFalling = true;
        obs.rock.castShadow = false; // Tắt đổ bóng thật của thiên thạch để nó không chiếu bóng đen xì lên vách núi!

        obs.startY = 150; // Rớt từ độ cao 150m (Siêu cao)
        obs.targetY = 1.2;
        obs.triggerZ = -100; // Đợi tới 100m mới bắt đầu dội bom! Tốc độ rơi sấm sét!

        obs.rock.position.set(LANE_POSITIONS[lane], obs.startY, 0);
        obs.rock.rotation.set(0, Math.random() * Math.PI, 0);
        obs.rock.visible = true;

        obs.shadow.position.set(LANE_POSITIONS[lane], 0.05, 0);
        obs.shadow.visible = true;
    } else if (rand < 0.85) {
        // Mẫu 7 (10%): Đá khổng lồ mắc kẹt ngang tầm cổ -> Ép TRƯỢT
        let obs = rowObstacles[1];
        obs.activeType = 'giantRock';
        obs.isFalling = false;

        // TÙY CHỈNH HITBOX CHO TẢNG ĐÁ TRƯỢT TẠI ĐÂY (X, Y, Z)
        let cutY = 0.5; // Bạn vừa chốt số này
        obs.hitboxCut = { x: 0.0, y: cutY, z: 5.0, offsetY: cutY / 2 };

        // Tính toán để phần ĐÁY của khối cầu nằm ĐÚNG BẰNG giới hạn clearance bạn đã config
        let bottomY = CONFIG.GIANT_ROCK_SLIDE_Y - CONFIG.GIANT_ROCK_RADIUS;
        obs.giantRock.position.set(0, bottomY + 20, 0); // 20 là bán kính trục Y của khối cầu
        obs.giantRock.visible = true;
    } else if (rand < 0.92) {
        // Mẫu 8 (7%): Đá khổng lồ chìm dưới đất -> Ép NHẢY
        let obs = rowObstacles[1];
        obs.activeType = 'giantRock';
        obs.isFalling = false;

        // TÙY CHỈNH HITBOX CHO TẢNG ĐÁ NHẢY TẠI ĐÂY (X, Y, Z)
        let cutY = 0.5; // Bạn vừa chốt số này
        obs.hitboxCut = { x: 0.0, y: cutY, z: 5.0, offsetY: -cutY / 2 };

        // Tính toán để phần ĐỈNH của khối cầu nằm ĐÚNG BẰNG giới hạn clearance bạn đã config
        let topY = CONFIG.GIANT_ROCK_JUMP_Y + CONFIG.GIANT_ROCK_RADIUS;
        obs.giantRock.position.set(0, topY - 20, 0); // 20 là bán kính trục Y của khối cầu
        obs.giantRock.visible = true;
    } else {
        // Mẫu 9 (8%): Vách núi khổng lồ nhô ra chặn 2 làn + Phi tiêu bay ở làn an toàn
        let isLeft = Math.random() > 0.5;
        let shurikenLane = isLeft ? 2 : 0;  // Bắn phi tiêu ở làn còn lại

        // Vách núi khổng lồ đè 2 làn
        let obsWall = rowObstacles[1];
        obsWall.activeType = 'mountainWall';
        obsWall.isFalling = false;

        // TÙY CHỈNH KÍCH THƯỚC VÀ HITBOX CHO VÁCH NÚI NHÔ RA
        obsWall.mountainWall.scale.set(100.0, 40.0, 100.0);

        // Bù trừ độ nở của BoundingBox do nhiễu loạn đỉnh (Noise Displacement).
        // Vách núi scale(100, 40, 100). Noise biên độ 0.02 (+/- 0.01).
        // Trục Z nở ra tối đa: 0.01 * 100 = 1m (mỗi bên). Cần gọt cutZ = 2.0m.
        // Trục Y nở ra tối đa: 0.01 * 40 = 0.4m (mỗi bên). Cần gọt cutY = 0.8m.
        let cutZ = 2.0;
        obsWall.hitboxCut = { x: 4.0, y: 0.8, z: cutZ, offsetX: 0, offsetY: 0, offsetZ: 0 };

        // ScaleX = 100, bán kính = 50. 
        // Đặt ở X = 49.5 thì mép đá sẽ nằm ở 49.5 - 50 = -0.5 (Chặn gọn gàng làn giữa, không lấn làn an toàn)
        let wallX = isLeft ? -49.5 : 49.5;
        obsWall.mountainWall.position.set(wallX, 20, 0); // Y = 20 vì tâm nằm ở giữa khối Box cao 40m
        obsWall.mountainWall.visible = true;

        // Phi tiêu: Ép người chơi trượt để né khi đang đi vào làn an toàn duy nhất
        let obsShuriken = rowObstacles[shurikenLane];
        if (obsShuriken.shuriken) {
            obsShuriken.activeType = 'shuriken';
            // Cố định bay ở độ cao 2.5m (Ép TRƯỢT) để sát thủ hơn, không bị lệt xệt dưới đất
            obsShuriken.shuriken.position.set(LANE_POSITIONS[shurikenLane], 2.5, 0);
            obsShuriken.shuriken.visible = true;
        } else {
            // Backup nếu shuriken chưa load
            obsShuriken.activeType = 'rock';
            obsShuriken.rock.position.set(LANE_POSITIONS[shurikenLane], 1.2, 0);
            obsShuriken.rock.visible = true;
        }
    }

    // --- RẢI TIỀN VÀNG DỌC THEO LÀN AN TOÀN ---
    if (rowCoins) {
        let safeLanes = [0, 1, 2];

        // Quét các chướng ngại vật để loại bỏ làn nguy hiểm
        let centerObs = rowObstacles[1];
        if (centerObs.activeType === 'giantRock') {
            safeLanes = [];
        } else if (centerObs.activeType === 'mountainWall') {
            // Vách núi che 2 làn, chừa lại 1 làn
            let wallX = centerObs.mountainWall.position.x;
            if (wallX < 0) safeLanes = [2]; // Che trái & giữa -> Phải an toàn
            else safeLanes = [0]; // Che phải & giữa -> Trái an toàn
        } else {
            // Quét từng chướng ngại vật thường
            safeLanes = [];
            for (let i = 0; i < 3; i++) {
                let obs = rowObstacles[i];
                if (obs.activeType === 'none' || obs.activeType === 'shuriken') {
                    // Nếu là làn trống hoặc phi tiêu chìm (ép nhảy) thì vẫn là đường có thể đi
                    safeLanes.push(i);
                }
            }
        }

        // Nếu có làn an toàn, chọn ngẫu nhiên 1 làn để rải 1 dải 5 đồng xu
        if (safeLanes.length > 0) {
            let selectedLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
            let laneX = LANE_POSITIONS[selectedLane];

            // Xếp 5 đồng xu trải dài theo trục Z (khoảng cách 8m mỗi đồng, tổng 32m)
            for (let c = 0; c < 5; c++) {
                let coinObj = rowCoins[c];
                coinObj.mesh.position.set(laneX, 1.0, -c * 8 + 16); // y=1.0 để lơ lửng vừa tầm ăn
                coinObj.mesh.visible = true;
                coinObj.collected = false;
            }
        }
    }
}

// Khởi tạo Vệt bóng cảnh báo (Vòng tròn đen mờ)
export const shadowGeo = new THREE.CircleGeometry(1, 16);
shadowGeo.rotateX(-Math.PI / 2); // Nằm áp sát mặt đất
export const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });

// ==========================================
// KHỞI TẠO HÀNG CHƯỚNG NGẠI VẬT
// ==========================================
for (let i = 0; i < 8; i++) {
    let rowGroup = new THREE.Group();
    let rowObstacles = [];

    // Mỗi hàng nạp sẵn 3 Slot chứa Đá, Phi tiêu, Cây và Bóng
    for (let j = 0; j < 3; j++) {
        let obsSlot = {
            rock: new THREE.Mesh(obsGeo, obsMat),
            giantRock: new THREE.Mesh(giantRockGeo, giantRockMat), // Bổ sung tảng đá khổng lồ Lục Giác
            mountainWall: new THREE.Mesh(mountainWallGeo, giantRockMat), // Sử dụng material gốc
            tree: new THREE.Mesh(fallingTreeGeo, fallingTreeMat),
            shadow: new THREE.Mesh(shadowGeo, shadowMat.clone()), // CLONE để mỗi bóng có thể tự thay đổi độ mờ độc lập!
            shuriken: null, // Sẽ load sau trong assets.js
            activeType: 'none',
            // Thuộc tính vật lý cho rơi tự do
            isFalling: false,
            targetY: 0,
            startY: 0,
            fallSpeedMult: 1.0,
            triggerZ: -200, // Điểm kích hoạt bắt đầu rơi
            rotSpeedX: 0,   // Tốc độ xoay
            rotSpeedY: 0,

            helperBox: new THREE.Box3(),
            helper: null
        };

        obsSlot.rock.castShadow = true;
        obsSlot.rock.receiveShadow = true;
        obsSlot.giantRock.castShadow = true;
        obsSlot.giantRock.receiveShadow = true;
        
        // Vách núi khổng lồ: BẬT LẠI đổ bóng (castShadow = true) theo yêu cầu test của user.
        // TẮT receiveShadow: Vì vách núi quá khổng lồ, khi camera tiến lại gần, việc tính toán 
        // bóng râm hắt LÊN nó (receive) cho hàng triệu pixel sẽ làm chết ngộp GPU (Fill-rate bottleneck).
        obsSlot.mountainWall.castShadow = true;
        obsSlot.mountainWall.receiveShadow = false;
        obsSlot.tree.castShadow = true;
        obsSlot.tree.receiveShadow = true;

        // Vệt bóng cảnh báo nằm cách mặt đất 0.05m để không bị Z-fighting
        obsSlot.shadow.position.y = 0.05;

        // ÉP CÂN ĐÁ: Cố định bề ngang hẹp (Trục X, Z), nhưng cho phép vươn cao (Trục Y)
        let scaleXZ = 0.8 + Math.random() * 0.3; // Bề ngang tuyệt đối < 2.64m
        let scaleY = 1.0 + Math.random() * 0.8;  // Nhọn lên
        obsSlot.rock.scale.set(scaleXZ, scaleY, scaleXZ);
        obsSlot.baseRockScale = new THREE.Vector3(scaleXZ, scaleY, scaleXZ); // Lưu lại để dùng cho Đá khổng lồ

        // Tạo hộp Helper màu đỏ để debug Hitbox
        obsSlot.helper = new THREE.Box3Helper(obsSlot.helperBox, 0xff0000);
        obsSlot.helper.visible = false;
        scene.add(obsSlot.helper);

        rowGroup.add(obsSlot.rock);
        rowGroup.add(obsSlot.giantRock);
        rowGroup.add(obsSlot.mountainWall);
        rowGroup.add(obsSlot.tree);
        rowGroup.add(obsSlot.shadow);
        rowObstacles.push(obsSlot);
    }

    // Khởi tạo mảng Tiền Vàng (Coins) đi kèm theo từng hàng chướng ngại vật
    let rowCoins = [];
    for (let c = 0; c < 5; c++) { 
        let coin = new THREE.Mesh(coinGeo, coinMat);
        coin.castShadow = true;
        coin.receiveShadow = true;
        coin.visible = false;
        rowGroup.add(coin);
        rowCoins.push({ mesh: coin, collected: false });
    }

    // Rải 8 hàng cách nhau 55m (Kéo giãn Pacing)
    rowGroup.position.z = -30 - (i * 55);
    spawnObstaclePattern(rowObstacles, rowCoins); // Xếp trận

    scene.add(rowGroup);
    obstacleRows.push({ group: rowGroup, obstacles: rowObstacles, coins: rowCoins });
}

// --- TẢI MÔ HÌNH PHI TIÊU (SHURIKEN) ---
gltfLoader.load('models/Dangers/true_shuriken_scale.glb', function (gltf) {
    let shurikenModel = gltf.scene;

    // Tính toán Bounding Box gốc (Local Box) MỘT LẦN DUY NHẤT cho toàn bộ Group
    shurikenModel.position.set(0, 0, 0);
    shurikenModel.rotation.set(0, 0, 0);
    shurikenModel.scale.set(1, 1, 1);
    shurikenModel.updateMatrixWorld(true);
    let localBox = new THREE.Box3().setFromObject(shurikenModel);
    shurikenModel.userData.baseBox = localBox;

    // Áp dụng tỷ lệ đồng dạng tuyệt đối với Sasuke (5, 5, 5)
    shurikenModel.scale.set(5, 5, 5);

    // Cho phép Phi tiêu đổ bóng nhưng giữ nguyên màu gốc của file GLB
    shurikenModel.traverse(function (child) {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Phân phát Phi tiêu vào toàn bộ các Slot Chướng ngại vật trên đường đua
    obstacleRows.forEach(row => {
        row.obstacles.forEach(obs => {
            let clone = shurikenModel.clone();
            clone.visible = false;
            row.group.add(clone);
            obs.shuriken = clone;
        });
    });
    console.log("Đã trang bị xong hệ thống Phi tiêu Tử thần!");
});
