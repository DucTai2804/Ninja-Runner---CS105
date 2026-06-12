// ==========================================
// TRẠNG THÁI TRÒ CHƠI (GLOBAL STATE)
// ==========================================

export const state = {
    // Game Core
    isPaused: false,
    isGameOver: false,
    gameScore: 0,
    gameCoins: 0,
    baseSpeed: 0.3,
    currentSpeed: 0.3,
    
    // Config Modes
    hideTrees: false,
    jumpTimer: 0,
    jumpDuration: 1.0,
    slideTimer: 0,
    slideDuration: 1.0,
    fireballSpawnDelay: 0,
    chidoriTimer: 0,
    susanooTimer: 0,
    susanooTransformTimer: 0,
    cameraTransitionTime: 0,
    timeMode: 'auto', // auto, day, night
    practicePattern: 0,
    
    // Character States
    isJumping: false,
    isSliding: false,
    jumpTimer: 0,
    slideTimer: 0,
    jumpDuration: 1.0,
    
    // Skills States
    isCastingSkill1: false,
    fireballSpawnDelay: 0,
    isCastingChidori: false,
    chidoriTimer: 0,
    chidoriFadeTimer: 0,
    isSusanooActive: false,
    isSusanooCutinActive: false,
    susanooCutinTimer: 0,
    susanooTimer: 0,
    susanooTransformTimer: 0,
    isSusanooSlashing: false,
    susanooSlashTimeRemaining: 0,
    
    // Camera
    cameraTransitionTime: 0
};
