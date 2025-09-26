// ================= GAME STATE AND SETTINGS =================
// User Settings (with defaults)
let WINNING_SCORE = 5;
let BALL_SPEED = 6;
let ENABLE_SOUND = true;
let ENABLE_POWERUPS = true;

// Game State
const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d');
const paddleWidth = 14;
const basePaddleHeight = 90;
const playerX = 20, aiX = canvas.width - paddleWidth - 20;
let paddleHeightState = {player: basePaddleHeight, ai: basePaddleHeight};
let playerY = (canvas.height - basePaddleHeight) / 2;
let aiY = (canvas.height - basePaddleHeight) / 2;
const ballSize = 16;
let ballX, ballY, ballSpeedX, ballSpeedY, ballTrail;
let rallyCount = 0;
let playerScore = 0, aiScore = 0;
let paused = false, gameOver = false, twoPlayer = false;
let theme = "dark";

// Powerups
let powerups = [];
const powerupTypes = [
    {type: "big-paddle", color: "#37e", label: "BIG"},
    {type: "fast-ball", color: "#e33", label: "FAST"},
    {type: "small-paddle", color: "#e3e", label: "SMALL"},
    {type: "ghost-ball", color: "#0cc", label: "GHOST"},
    {type: "reverse", color: "#f90", label: "REV"}
];
let activePowerup = null;
let powerupTimeout = null;
let ghostBall = false, reverseControls = false;

// UI Elements
let scoreboard = document.getElementById('scoreboard-container');
let message = document.getElementById('message');
let restartBtn = document.getElementById('restart-btn');
const modeBtn = document.getElementById('mode-btn');
const themeBtn = document.getElementById('theme-btn');
const settingsBtn = document.getElementById('settings-btn');
const soundPaddle = document.getElementById('sound-paddle');
const soundWall = document.getElementById('sound-wall');
const soundScore = document.getElementById('sound-score');

// Modal
const modal = document.getElementById('settings-modal');
const closeModal = document.getElementById('close-modal');
const winScoreInput = document.getElementById('win-score-input');
const ballSpeedInput = document.getElementById('ball-speed-input');
const ballSpeedLabel = document.getElementById('ball-speed-label');
const soundToggle = document.getElementById('sound-toggle');
const powerupToggle = document.getElementById('powerup-toggle');
const applySettingsBtn = document.getElementById('apply-settings-btn');

// ================= LOCAL STORAGE =================
function saveGameData() {
    const data = {
        playerScore,
        aiScore,
        playerY,
        aiY,
        twoPlayer,
        theme,
        WINNING_SCORE,
        BALL_SPEED,
        ENABLE_SOUND,
        ENABLE_POWERUPS
    };
    localStorage.setItem('pongGameData', JSON.stringify(data));
}
function loadGameData() {
    const data = localStorage.getItem('pongGameData');
    if (data) {
        try {
            const d = JSON.parse(data);
            playerScore = typeof d.playerScore === "number" ? d.playerScore : 0;
            aiScore = typeof d.aiScore === "number" ? d.aiScore : 0;
            playerY = typeof d.playerY === "number" ? d.playerY : (canvas.height - basePaddleHeight) / 2;
            aiY = typeof d.aiY === "number" ? d.aiY : (canvas.height - basePaddleHeight) / 2;
            twoPlayer = !!d.twoPlayer;
            theme = d.theme || "dark";
            WINNING_SCORE = typeof d.WINNING_SCORE === "number" ? d.WINNING_SCORE : 5;
            BALL_SPEED = typeof d.BALL_SPEED === "number" ? d.BALL_SPEED : 6;
            ENABLE_SOUND = d.ENABLE_SOUND !== undefined ? d.ENABLE_SOUND : true;
            ENABLE_POWERUPS = d.ENABLE_POWERUPS !== undefined ? d.ENABLE_POWERUPS : true;
            modeBtn.textContent = twoPlayer ? "Switch to AI Mode" : "Switch to 2 Player Mode";
            document.body.classList.toggle('light', theme === "light");
            themeBtn.textContent = theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme";
            updateScoreboard();
        } catch (e) {}
    }
}

// ================== GAME DRAW ==================
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Net
    ctx.strokeStyle = theme === "dark" ? '#fff' : '#444';
    ctx.setLineDash([10, 15]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    // Powerups
    if (ENABLE_POWERUPS) {
        for (const p of powerups) {
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 3.5;
            ctx.arc(p.x + p.size/2, p.y + p.size/2, p.size/2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = "bold 16px Arial";
            ctx.fillStyle = p.color;
            ctx.textAlign = "center";
            ctx.fillText(p.label, p.x + p.size/2, p.y + p.size/2 + 6);
            ctx.restore();
        }
    }
    // Ball trail
    const TRAIL_LENGTH = 18;
    for (let i = Math.max(0, ballTrail.length-TRAIL_LENGTH); i < ballTrail.length; ++i) {
        let a = (i - (ballTrail.length-TRAIL_LENGTH)) / TRAIL_LENGTH;
        ctx.globalAlpha = 0.12 + 0.18 * a;
        ctx.beginPath();
        ctx.arc(ballTrail[i].x + ballSize/2, ballTrail[i].y + ballSize/2, ballSize/2, 0, Math.PI * 2);
        ctx.fillStyle = ghostBall ? "#aaffee" : "#ffe066";
        ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Ball
    ctx.beginPath();
    ctx.arc(ballX + ballSize/2, ballY + ballSize/2, ballSize/2, 0, Math.PI * 2);
    ctx.fillStyle = ghostBall ? "#aaffee" : "#ffe066";
    ctx.shadowColor = ghostBall ? "#0cc" : "#ffe066";
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Paddles
    ctx.save();
    ctx.fillStyle = activePowerup?.player === 'player' && activePowerup?.type === "big-paddle" ? "#6df" :
                    activePowerup?.player === 'player' && activePowerup?.type === "small-paddle" ? "#c6f" : (theme === "dark" ? "#fff" : "#222");
    ctx.fillRect(playerX, playerY, paddleWidth, paddleHeightState.player);
    ctx.fillStyle = activePowerup?.player === 'ai' && activePowerup?.type === "big-paddle" ? "#6df" :
                    activePowerup?.player === 'ai' && activePowerup?.type === "small-paddle" ? "#c6f" : (theme === "dark" ? "#fff" : "#222");
    ctx.fillRect(aiX, aiY, paddleWidth, paddleHeightState.ai);
    ctx.restore();

    // Reverse Arrow
    if (reverseControls) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#f90";
        ctx.font = "bold 32px Arial";
        ctx.fillText("⇄", canvas.width/2-18, 38);
        ctx.restore();
    }
}

// =============== BALL / POWERUP LOGIC ===============
function resetBall() {
    ballX = canvas.width / 2 - ballSize / 2;
    ballY = canvas.height / 2 - ballSize / 2;
    let speed = BALL_SPEED + 1.2 * Math.min(6, rallyCount/3);
    let angle = (Math.random()-0.5)*0.6;
    ballSpeedX = speed * (Math.random() > 0.5 ? 1 : -1);
    ballSpeedY = 4 * Math.sin(angle);
    ballTrail = [];
    rallyCount = 0;
    ghostBall = false;
    reverseControls = false;
    if (!gameOver && ENABLE_POWERUPS && Math.random() < 0.18) spawnPowerup();
}
function spawnPowerup() {
    let p = powerupTypes[Math.floor(Math.random()*powerupTypes.length)];
    let px = canvas.width/4 + Math.random() * canvas.width/2 - 20;
    let py = 40 + Math.random() * (canvas.height-80);
    powerups.push({...p, x: px, y: py, size: 38, active: false});
}
function activatePowerup(powerup, player) {
    activePowerup = { ...powerup, player };
    if (powerupTimeout) clearTimeout(powerupTimeout);
    let duration = 5000;
    switch(powerup.type) {
        case "big-paddle":
            if (player === "player") paddleHeightState.player = 140;
            else paddleHeightState.ai = 140;
            break;
        case "small-paddle":
            if (player === "player") paddleHeightState.player = 50;
            else paddleHeightState.ai = 50;
            break;
        case "fast-ball":
            ballSpeedX *= 1.6;
            ballSpeedY *= 1.6;
            break;
        case "ghost-ball":
            ghostBall = true;
            break;
        case "reverse":
            reverseControls = true;
            break;
    }
    powerupTimeout = setTimeout(() => {
        if (powerup.type === "big-paddle" || powerup.type === "small-paddle") {
            paddleHeightState.player = basePaddleHeight;
            paddleHeightState.ai = basePaddleHeight;
        }
        if (powerup.type === "fast-ball") {
            ballSpeedX /= 1.6;
            ballSpeedY /= 1.6;
        }
        if (powerup.type === "ghost-ball") ghostBall = false;
        if (powerup.type === "reverse") reverseControls = false;
        activePowerup = null;
    }, duration);
}

// ================= GAME UPDATE =================
function clamp(val, min, max) {
    return Math.max(min, Math.min(val, max));
}
function update() {
    if (paused || gameOver) return;
    // Ball movement
    ballX += ballSpeedX;
    ballY += ballSpeedY;
    ballTrail.push({x: ballX, y: ballY});
    if (ballTrail.length > 21) ballTrail.shift();

    // Wall collision
    if (ballY < 0) {
        ballY = 0;
        ballSpeedY *= -1;
        playSound(soundWall);
    }
    if (ballY + ballSize > canvas.height) {
        ballY = canvas.height - ballSize;
        ballSpeedY *= -1;
        playSound(soundWall);
    }

    // Powerup collision
    if (ENABLE_POWERUPS) {
        for (let i=0; i<powerups.length; ++i) {
            let p = powerups[i];
            let bx = ballX + ballSize/2, by = ballY + ballSize/2;
            let px = p.x + p.size/2, py = p.y + p.size/2;
            let dist = Math.hypot(bx-px, by-py);
            if (dist < ballSize/2 + p.size/2) {
                activatePowerup(p, ballSpeedX < 0 ? "player" : "ai");
                powerups.splice(i,1);
                break;
            }
        }
    }

    // Paddle collision
    if (!ghostBall && ballX <= playerX + paddleWidth &&
        ballY + ballSize > playerY &&
        ballY < playerY + paddleHeightState.player
    ) {
        ballX = playerX + paddleWidth;
        ballSpeedX *= -1.1;
        let collidePoint = (ballY + ballSize/2) - (playerY + paddleHeightState.player/2);
        ballSpeedY = collidePoint * 0.22 + (Math.random()-0.5)*2;
        rallyCount++;
        playSound(soundPaddle);
        paddleHitAnim("player");
    }
    if (!ghostBall && ballX + ballSize >= aiX &&
        ballY + ballSize > aiY &&
        ballY < aiY + paddleHeightState.ai
    ) {
        ballX = aiX - ballSize;
        ballSpeedX *= -1.1;
        let collidePoint = (ballY + ballSize/2) - (aiY + paddleHeightState.ai/2);
        ballSpeedY = collidePoint * 0.22 + (Math.random()-0.5)*2;
        rallyCount++;
        playSound(soundPaddle);
        paddleHitAnim("ai");
    }

    // Score
    if (ballX < 0) {
        aiScore++;
        updateScoreboard();
        playSound(soundScore);
        animateScore("ai");
        resetBall();
        powerups = [];
    }
    if (ballX + ballSize > canvas.width) {
        playerScore++;
        updateScoreboard();
        playSound(soundScore);
        animateScore("player");
        resetBall();
        powerups = [];
    }

    // AI movement
    if (!twoPlayer) {
        let aiCenter = aiY + paddleHeightState.ai/2;
        let ballCenter = ballY + ballSize/2;
        if (aiCenter < ballCenter - 18) aiY += Math.min(8, ballCenter - aiCenter);
        else if (aiCenter > ballCenter + 18) aiY -= Math.min(8, aiCenter - ballCenter);
        aiY = clamp(aiY, 0, canvas.height - paddleHeightState.ai);
    }

    // Game over?
    if (playerScore >= WINNING_SCORE || aiScore >= WINNING_SCORE) {
        gameOver = true;
        message.textContent = playerScore > aiScore ? (twoPlayer ? "Player 1 Wins! 🎉" : "You Win! 🎉") : (twoPlayer ? "Player 2 Wins! 🎉" : "AI Wins! 😬");
        restartBtn.style.display = "inline-block";
        ballSpeedX = 0; ballSpeedY = 0;
    }
}

// ============ SCOREBOARD ANIMATION ===============
function updateScoreboard() {
    document.getElementById('player-score').textContent = playerScore;
    document.getElementById('ai-score').textContent = aiScore;
    saveGameData();
}
function animateScore(who) {
    scoreboard.style.transform = who === "player" ? "scale(1.18,1.25) rotate(-2deg)" : "scale(1.18,1.25) rotate(2deg)";
    setTimeout(() => { scoreboard.style.transform = ""; }, 350);
}

// ============== SOUND ===================
function playSound(audio) {
    if (!ENABLE_SOUND) return;
    audio.currentTime = 0;
    audio.play();
}

// ================= CONTROLS =================
canvas.addEventListener('mousemove', function (e) {
    if (paused || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const mouseX = e.clientX - rect.left;
    if (twoPlayer) {
        if (mouseX < canvas.width/2) playerY = clamp(mouseY - paddleHeightState.player / 2, 0, canvas.height - paddleHeightState.player);
        else aiY = clamp(mouseY - paddleHeightState.ai / 2, 0, canvas.height - paddleHeightState.ai);
    } else {
        playerY = clamp(mouseY - paddleHeightState.player / 2, 0, canvas.height - paddleHeightState.player);
    }
});
canvas.addEventListener('touchmove', function (e) {
    if (paused || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    for (let i=0; i<e.touches.length; ++i) {
        const touchY = e.touches[i].clientY - rect.top;
        const touchX = e.touches[i].clientX - rect.left;
        if (twoPlayer) {
            if (touchX < canvas.width/2) playerY = clamp(touchY - paddleHeightState.player / 2, 0, canvas.height - paddleHeightState.player);
            else aiY = clamp(touchY - paddleHeightState.ai / 2, 0, canvas.height - paddleHeightState.ai);
        } else {
            playerY = clamp(touchY - paddleHeightState.player / 2, 0, canvas.height - paddleHeightState.player);
        }
    }
    e.preventDefault();
}, {passive: false});

// Keyboard (W/S/Up/Down or reversed for reverse control)
let keys = {};
window.addEventListener('keydown', function(e) {
    keys[e.key.toLowerCase()] = true;
    if (e.key === " " || e.key === "p") {
        paused = !paused;
        message.textContent = paused ? "Paused" : "";
    }
    if (e.key === "r" && gameOver) restartGame();
});
window.addEventListener('keyup', function(e) {
    keys[e.key.toLowerCase()] = false;
});
function paddleKeyboardMove() {
    // Player 1
    if (reverseControls) {
        if (keys["w"] || keys["arrowup"]) playerY = clamp(playerY + 12, 0, canvas.height - paddleHeightState.player);
        if (keys["s"] || keys["arrowdown"]) playerY = clamp(playerY - 12, 0, canvas.height - paddleHeightState.player);
    } else {
        if (keys["w"]) playerY = clamp(playerY - 12, 0, canvas.height - paddleHeightState.player);
        if (keys["s"]) playerY = clamp(playerY + 12, 0, canvas.height - paddleHeightState.player);
    }
    if (twoPlayer) {
        if (reverseControls) {
            if (keys["arrowup"]) aiY = clamp(aiY + 12, 0, canvas.height - paddleHeightState.ai);
            if (keys["arrowdown"]) aiY = clamp(aiY - 12, 0, canvas.height - paddleHeightState.ai);
        } else {
            if (keys["arrowup"]) aiY = clamp(aiY - 12, 0, canvas.height - paddleHeightState.ai);
            if (keys["arrowdown"]) aiY = clamp(aiY + 12, 0, canvas.height - paddleHeightState.ai);
        }
    }
}

// Pause on click
canvas.addEventListener('click', function() {
    if (gameOver) return;
    paused = !paused;
    message.textContent = paused ? "Paused" : "";
});

// Paddle hit wiggle
function paddleHitAnim(side) {
    let orig = side === "player" ? playerY : aiY;
    let amt = 10;
    let t = 0;
    function animate() {
        if (t < 6) {
            let offset = (t % 2 === 0 ? amt : -amt) * (1-t/10);
            if (side === "player") playerY = clamp(orig + offset, 0, canvas.height - paddleHeightState.player);
            else aiY = clamp(orig + offset, 0, canvas.height - paddleHeightState.ai);
            t++;
            setTimeout(animate, 12);
        } else {
            if (side === "player") playerY = clamp(orig, 0, canvas.height - paddleHeightState.player);
            else aiY = clamp(orig, 0, canvas.height - paddleHeightState.ai);
        }
    }
    animate();
}

// ========== BUTTONS AND SETTINGS ===========
restartBtn.addEventListener('click', restartGame);
function restartGame() {
    playerScore = aiScore = 0;
    updateScoreboard();
    playerY = (canvas.height - basePaddleHeight) / 2;
    aiY = (canvas.height - basePaddleHeight) / 2;
    message.textContent = "";
    restartBtn.style.display = "none";
    gameOver = false;
    rallyCount = 0;
    powerups = [];
    activePowerup = null;
    paddleHeightState = {player: basePaddleHeight, ai: basePaddleHeight};
    ghostBall = false;
    reverseControls = false;
    resetBall();
    saveGameData();
}
modeBtn.addEventListener('click', function() {
    twoPlayer = !twoPlayer;
    modeBtn.textContent = twoPlayer ? "Switch to AI Mode" : "Switch to 2 Player Mode";
    message.textContent = twoPlayer ? "2 Player Mode: P1=W/S, P2=↑/↓, or Mouse/Touch" : "AI Mode: Left paddle only. W/S or Mouse/Touch";
    restartGame();
    saveGameData();
});
themeBtn.addEventListener('click', function() {
    if (theme === "dark") {
        theme = "light";
        document.body.classList.add('light');
        themeBtn.textContent = "Switch to Dark Theme";
    } else {
        theme = "dark";
        document.body.classList.remove('light');
        themeBtn.textContent = "Switch to Light Theme";
    }
    saveGameData();
});

// ============ SETTINGS MODAL ============
settingsBtn.addEventListener('click', function() {
    winScoreInput.value = WINNING_SCORE;
    ballSpeedInput.value = BALL_SPEED;
    ballSpeedLabel.textContent = BALL_SPEED;
    soundToggle.checked = ENABLE_SOUND;
    powerupToggle.checked = ENABLE_POWERUPS;
    modal.style.display = "block";
});
closeModal.onclick = function() { modal.style.display = "none"; }
window.onclick = function(event) { if (event.target == modal) modal.style.display = "none"; }
ballSpeedInput.oninput = function() { ballSpeedLabel.textContent = ballSpeedInput.value; }
applySettingsBtn.onclick = function() {
    WINNING_SCORE = parseInt(winScoreInput.value) || 5;
    BALL_SPEED = parseInt(ballSpeedInput.value) || 6;
    ENABLE_SOUND = soundToggle.checked;
    ENABLE_POWERUPS = powerupToggle.checked;
    modal.style.display = "none";
    restartGame();
    saveGameData();
};

// ============ GAME LOOP =============
function gameLoop() {
    paddleKeyboardMove();
    update();
    draw();
    requestAnimationFrame(gameLoop);
}
function init() {
    loadGameData();
    resetBall();
    updateScoreboard();
    message.textContent = "First to " + WINNING_SCORE + " wins. Move paddle with mouse, touch, or W/S/↑/↓. Click or press Space/P to pause.";
}
init();
gameLoop();