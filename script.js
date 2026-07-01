// =========================================================================
// CONFIGURACIÓN DE SUPABASE (CONECTADO A TU BASE DE DATOS)
// =========================================================================
const SUPABASE_URL = "https://eakdjtveszrdrcdhimvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVha2RqdHZlc3pyZHJjZGhpbXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5MjUyODQsImV4cCI6MjA5ODUwMTI4NH0.sN1CjH5BUi_PTonmHwfeRqD7tXNOarhuNaWH9TFxtmU";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =========================================================================
// VARIABLES DEL JUEGO
// =========================================================================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let playerAlias = "MICH";
let selectedSkin = "negro"; 
let selectedLabel = "⚫";
let selectedMode = "torre"; 
let score = 0;
let gameInterval;
let gameRunning = false;

let player;
const keys = {};

// Variables Torre
let platforms = [];
let ladders = [];
let enemies = [];
let cameraY = 0;
let scrollSpeed = 0.35; 
let currentFloor = 1; 
let totalPlatformsCreated = 0;
let castleGoal = null;

// Variables Laberinto
const tileSize = 40;
let coins = [];
let ghost = null;

const mazeMap = [
    [1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,0,1],
    [1,0,1,0,0,0,0,1,0,1],
    [1,1,1,0,1,1,0,1,0,1],
    [1,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,0,1,1,1,0,1],
    [1,0,0,1,0,0,0,1,0,1],
    [1,1,0,1,1,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,1,0,1],
    [1,0,0,0,1,0,1,0,0,1],
    [1,1,1,0,1,0,1,0,1,1],
    [1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1]
];

// =========================================================================
// EVENTOS Y ESCUCHADORES (LISTENERS)
// =========================================================================
const skinCards = document.querySelectorAll('#skin-selector-container .selector-card');
skinCards.forEach(card => {
    card.addEventListener('click', () => {
        skinCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedSkin = card.getAttribute('data-skin');
        selectedLabel = card.getAttribute('data-label');
    });
});

const modeCards = document.querySelectorAll('#mode-selector-container .selector-card');
modeCards.forEach(card => {
    card.addEventListener('click', () => {
        modeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMode = card.getAttribute('data-mode');
    });
});

// Estrellas de votación
document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', (e) => {
        const val = parseInt(e.target.getAttribute('data-value'));
        document.querySelectorAll('.star').forEach(s => {
            const sVal = parseInt(s.getAttribute('data-value'));
            if(sVal <= val) s.classList.add('active');
            else s.classList.remove('active');
        });
        document.getElementById("rating-thanks").style.display = "block";
    });
});

window.addEventListener("keydown", e => keys[e.code] = true);
window.addEventListener("keyup", e => keys[e.code] = false);

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("restart-btn").addEventListener("click", () => {
    document.getElementById("gameover-screen").style.display = "none";
    document.getElementById("start-screen").style.display = "block";
});

// =========================================================================
// FUNCIONES DE SUPABASE (RANKING GLOBAL)
// =========================================================================
async function saveScoreLocal(alias, finalScore, label, mode) {
    const { data, error } = await supabaseClient
        .from('ranking')
        .insert([{ alias: alias, score: finalScore, label: label, mode: mode }]);
        
    if (error) console.error("Error al guardar en Supabase:", error);
}

async function loadLeaderboardLocal(mode) {
    const { data: leaderboard, error } = await supabaseClient
        .from('ranking')
        .select('*')
        .eq('mode', mode)
        .order('score', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error al cargar de Supabase:", error);
        return;
    }

    document.getElementById("rank-title").innerText = `TOP 5 RANKING: ${mode === "torre" ? "LA TORRE" : "EL LABERINTO"}`;
    const tbody = document.getElementById("leaderboard-body");
    tbody.innerHTML = "";
    
    if (!leaderboard || leaderboard.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4">¡Ningún michi clasificó aún!</td></tr>`;
        return;
    }
    
    leaderboard.forEach((row, index) => {
        tbody.innerHTML += `<tr><td>${index + 1}</td><td style='font-size:14px;'>${row.label || '⚫'}</td><td>${row.alias}</td><td>${row.score}</td></tr>`;
    });
}

// =========================================================================
// MECÁNICAS E INICIALIZACIÓN DEL JUEGO
// =========================================================================
function startGame() {
    const input = document.getElementById("player-alias");
    playerAlias = input.value.trim().toUpperCase() || "MICH";
    document.getElementById("start-screen").style.display = "none";
    canvas.style.display = "block";
    score = 0;
    gameRunning = true;

    document.querySelectorAll('.star').forEach(s => s.classList.remove('active'));
    document.getElementById("rating-thanks").style.display = "none";

    if (selectedMode === "torre") {
        initTorreMode();
    } else {
        initPacmanMode();
    }
}

function initTorreMode() {
    cameraY = 0;
    scrollSpeed = 0.35;
    totalPlatformsCreated = 1;
    currentFloor = 1;
    castleGoal = null;

    player = {
        x: 180,
        y: 450,
        width: 24,
        height: 28,
        vx: 0,
        vy: 0,
        isGrounded: false,
        isClimbing: false,
        speed: 3.5,
        jumpForce: -9.2
    };

    platforms = [{ x: 0, y: 550, width: 400, height: 20, floorNum: 1 }];
    ladders = [];
    enemies = [];
    
    let lastY = 550;
    let ladderSide = "right"; 

    for (let i = 0; i < 5; i++) {
        lastY -= 85; 
        let width = 320; 
        let x = (ladderSide === "right") ? 0 : 80; 
        totalPlatformsCreated++;
        platforms.push({ x, y: lastY, width, height: 15, floorNum: totalPlatformsCreated });

        let ladderX = (ladderSide === "right") ? 340 : 35;
        ladders.push({ x: ladderX, y: lastY, width: 25, height: 90 });

        if (Math.random() > 0.4) {
            enemies.push({
                x: x + 50 + Math.random() * 120, y: lastY - 20, width: 20, height: 20,
                vx: 1.2, rangeMin: x, rangeMax: x + width - 20, type: Math.random() > 0.5 ? 'perro' : 'fantasma'
            });
        }
        ladderSide = (ladderSide === "right") ? "left" : "right";
    }

    if (gameInterval) cancelAnimationFrame(gameInterval);
    gameLoop();
}

function generateNextLevel() {
    if (totalPlatformsCreated >= 11) return;

    let highestPlat = platforms[platforms.length - 1];
    let y = highestPlat.y - 85;
    totalPlatformsCreated++;

    if (totalPlatformsCreated === 11) {
        let nextSide = (highestPlat.x === 0) ? "left" : "right";
        let pX = (nextSide === "right") ? 0 : 80;
        
        platforms.push({ x: pX, y: y, width: 320, height: 20, isMeta: true, floorNum: 11 });
        
        let ladderX = (nextSide === "right") ? 340 : 35;
        ladders.push({ x: ladderX, y: y, width: 25, height: 90 });
        castleGoal = { x: 160, y: y - 60, width: 80, height: 60 };
    } else {
        let width = 320;
        let nextSide = (highestPlat.x === 0) ? "left" : "right";
        let x = (nextSide === "right") ? 0 : 80;

        platforms.push({ x, y, width, height: 15, floorNum: totalPlatformsCreated });
        let ladderX = (nextSide === "right") ? 340 : 35;
        ladders.push({ x: ladderX, y: y, width: 25, height: 90 });

        if (Math.random() > 0.55) {
            enemies.push({
                x: x + 50 + Math.random() * 120, y: y - 20, width: 20, height: 20,
                vx: 1.2, rangeMin: x, rangeMax: x + width - 20, type: Math.random() > 0.5 ? 'perro' : 'fantasma'
            });
        }
    }
}

function initPacmanMode() {
    player = {
        x: 48,
        y: 46,
        width: 24,
        height: 24,
        speed: 2.2
    };

    ghost = {
        x: 8 * tileSize + 8,
        y: 13 * tileSize + 8,
        width: 24,
        height: 24,
        dirX: 0,
        dirY: -1, 
        speed: 1.5
    };

    coins = [];
    for (let r = 0; r < mazeMap.length; r++) {
        for (let c = 0; c < mazeMap[r].length; c++) {
            if (mazeMap[r][c] === 0 && !(r === 1 && c === 1)) {
                coins.push({ x: c * tileSize + tileSize/2, y: r * tileSize + tileSize/2, collected: false });
            }
        }
    }

    if (gameInterval) cancelAnimationFrame(gameInterval);
    gameLoop();
}

function checkCollisionWall(x, y, w, h) {
    let left = Math.floor(x / tileSize);
    let right = Math.floor((x + w) / tileSize);
    let top = Math.floor(y / tileSize);
    let bottom = Math.floor((y + h) / tileSize);

    if (left < 0 || right >= 10 || top < 0 || bottom >= 15) return true;

    for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
            if (mazeMap[r][c] === 1) return true;
        }
    }
    return false;
}

function isGridWall(col, row) {
    if (col < 0 || col >= 10 || row < 0 || row >= 15) return true;
    return mazeMap[row][col] === 1;
}

function gameLoop() {
    if (!gameRunning) return;
    if (selectedMode === "torre") {
        updateTorre();
        drawTorre();
    } else {
        updatePacman();
        drawPacman();
    }
    gameInterval = requestAnimationFrame(gameLoop);
}

function updateTorre() {
    if (castleGoal && cameraY + castleGoal.y >= 200) {
        scrollSpeed = 0; 
    } else {
        cameraY += scrollSpeed;
        scrollSpeed += 0.00003; 
    }

    let touchingLadder = false;
    ladders.forEach(lad => {
        if (player.x + player.width > lad.x && player.x < lad.x + lad.width &&
            player.y + player.height > lad.y && player.y < lad.y + lad.height) {
            touchingLadder = true;
        }
    });

    if (keys["ArrowLeft"]) player.vx = -player.speed;
    else if (keys["ArrowRight"]) player.vx = player.speed;
    else player.vx = 0;

    if (touchingLadder && keys["ArrowUp"]) {
        player.isClimbing = true;
        player.vy = -3; 
        player.isGrounded = false;
    } else if (touchingLadder && keys["ArrowDown"]) {
        player.isClimbing = true;
        player.vy = 3;
    } else if (player.isClimbing && !touchingLadder) {
        player.isClimbing = false;
        player.vy = 0;
    } else if (!touchingLadder) {
        player.isClimbing = false;
    }

    if (!player.isClimbing) {
        if (keys["ArrowUp"] && player.isGrounded) {
            player.vy = player.jumpForce;
            player.isGrounded = false;
        }
        player.vy += 0.45; 
    }

    player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    player.y += player.vy;
    player.isGrounded = false;

    platforms.forEach(plat => {
        if (player.x + player.width > plat.x && player.x < plat.x + plat.width) {
            if (player.vy >= 0 && 
                player.y + player.height <= plat.y + 12 && 
                player.y + player.height + player.vy >= plat.y) {
                player.vy = 0;
                player.y = plat.y - player.height;
                player.isGrounded = true;
                if(plat.floorNum) currentFloor = plat.floorNum;
            }
            else if (player.vy < 0 && 
                     player.y >= plat.y + plat.height - 8 && 
                     player.y + player.vy <= plat.y + plat.height) {
                player.vy = 0.5; 
                player.y = plat.y + plat.height;
            }
        }
    });

    if (castleGoal) {
        let playerCenterX = player.x + player.width / 2;
        if (playerCenterX > castleGoal.x + 10 && playerCenterX < castleGoal.x + 70 &&
            player.y + player.height > castleGoal.y + 20 && player.y < castleGoal.y + 60) {
            endGame(true, "¡TORRE COMPLETADA!");
            return;
        }
    }

    let startLength = platforms.length;
    platforms = platforms.filter(plat => plat.y + cameraY < canvas.height + 100);
    ladders = ladders.filter(lad => lad.y + cameraY < canvas.height + 100);
    if (startLength - platforms.length > 0) generateNextLevel();

    enemies.forEach((enemy, index) => {
        enemy.x += enemy.vx;
        if (enemy.x <= enemy.rangeMin || enemy.x >= enemy.rangeMax) enemy.vx *= -1;

        if (player.x < enemy.x + enemy.width && player.x + player.width > enemy.x &&
            player.y < enemy.y + enemy.height && player.y + player.height > enemy.y) {
            if (player.vy > 0 && (player.y + player.height - player.vy) <= enemy.y + 6) {
                enemies.splice(index, 1); 
                player.vy = -6.5; 
                score += 100;     
            } else {
                endGame(false, "Derrotado en la torre");
            }
        }
    });

    if (player.y + cameraY > canvas.height) endGame(false, "Caída al vacío");
}

function updatePacman() {
    let vx = 0;
    let vy = 0;

    if (keys["ArrowLeft"]) vx = -player.speed;
    else if (keys["ArrowRight"]) vx = player.speed;
    
    if (keys["ArrowUp"]) vy = -player.speed;
    else if (keys["ArrowDown"]) vy = player.speed;

    if (vx !== 0 && !checkCollisionWall(player.x + vx, player.y, player.width, player.height)) {
        player.x += vx;
    }
    if (vy !== 0 && !checkCollisionWall(player.x, player.y + vy, player.width, player.height)) {
        player.y += vy;
    }

    coins.forEach(coin => {
        if (!coin.collected) {
            let dist = Math.hypot((player.x + player.width/2) - coin.x, (player.y + player.height/2) - coin.y);
            if (dist < 15) {
                coin.collected = true;
                score += 50;
            }
        }
    });

    ghost.x += ghost.dirX * ghost.speed;
    ghost.y += ghost.dirY * ghost.speed;

    let gCol = Math.floor((ghost.x + ghost.width/2) / tileSize);
    let gRow = Math.floor((ghost.y + ghost.height/2) / tileSize);
    let gOffsetX = (ghost.x) % tileSize;
    let gOffsetY = (ghost.y) % tileSize;

    if (Math.abs(gOffsetX - 8) < ghost.speed && Math.abs(gOffsetY - 8) < ghost.speed) {
        const dirs = [{x:1, y:0}, {x:-1, y:0}, {x:0, y:1}, {x:0, y:-1}];
        let valid = dirs.filter(d => {
            if (d.x === -ghost.dirX && d.y === -ghost.dirY) return false;
            return !isGridWall(gCol + d.x, gRow + d.y);
        });

        if (valid.length > 0) {
            if (Math.random() < 0.35 || isGridWall(gCol + ghost.dirX, gRow + ghost.dirY)) {
                let move = valid[Math.floor(Math.random() * valid.length)];
                ghost.dirX = move.x;
                ghost.dirY = move.y;
            }
        } else {
            ghost.dirX *= -1;
            ghost.dirY *= -1;
        }
    }

    let distToGhost = Math.hypot((player.x + player.width/2) - (ghost.x + ghost.width/2), (player.y + player.height/2) - (ghost.y + ghost.height/2));
    if (distToGhost < 16) {
        endGame(false, "Atrapado por el espectro");
    }

    if (coins.every(c => c.collected)) {
        endGame(true, "¡LABERINTO COMPLETADO!");
    }
}

// =========================================================================
// RENDERIZADO GRÁFICO (CANVAS)
// =========================================================================
function drawGatitoBrujo(x, y) {
    const sprite = [
        [0,0,0,0,0,2,2,0,0,0,0,0],
        [0,0,0,0,2,2,2,2,0,0,0,0],
        [0,0,0,2,2,2,2,2,2,0,0,0],
        [0,0,2,2,2,3,3,2,2,2,0,0], 
        [0,2,2,2,2,2,2,2,2,2,2,0],
        [1,0,0,1,2,2,2,2,1,0,0,1], 
        [1,1,1,1,1,1,1,1,1,1,1,1], 
        [1,1,4,1,1,1,1,1,1,4,1,1], 
        [1,1,1,1,1,4,1,1,1,1,1,1], 
        [0,1,1,1,1,1,1,1,1,1,1,0], 
        [0,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,1,1,1,1,1,1,1,1,1,0],
        [0,1,1,0,1,1,0,1,1,0,1,1], 
    ];

    let catColor = "#1a1a1a"; 
    if (selectedSkin === "naranja") catColor = "#e67e22";
    if (selectedSkin === "blanco") catColor = "#ecf0f1";

    let pixelSize = 2;
    for (let r = 0; r < sprite.length; r++) {
        for (let c = 0; c < sprite[r].length; c++) {
            if (sprite[r][c] === 1) { 
                ctx.fillStyle = catColor;
                ctx.fillRect(x + (c * pixelSize), y + (r * pixelSize), pixelSize, pixelSize);
            } else if (sprite[r][c] === 2) { 
                ctx.fillStyle = "#7758A3"; 
                ctx.fillRect(x + (c * pixelSize), y + (r * pixelSize), pixelSize, pixelSize);
            } else if (sprite[r][c] === 3) { 
                ctx.fillStyle = "#F6C45C"; 
                ctx.fillRect(x + (c * pixelSize), y + (r * pixelSize), pixelSize, pixelSize);
            } else if (sprite[r][c] === 4) { 
                ctx.fillStyle = "#DB3E8C"; 
                ctx.fillRect(x + (c * pixelSize), y + (r * pixelSize), pixelSize, pixelSize);
            }
        }
    }
}

function drawTorreEnemy(enemy) {
    ctx.save();
    if (enemy.type === 'fantasma') {
        ctx.fillStyle = "#7758A3";
        ctx.fillRect(enemy.x + 4, enemy.y, 12, 16);
        ctx.fillRect(enemy.x + 2, enemy.y + 4, 16, 12);
        ctx.fillStyle = "#F6C45C";
        ctx.fillRect(enemy.x + 5, enemy.y + 5, 2, 3);
        ctx.fillRect(enemy.x + 11, enemy.y + 5, 2, 3);
    } else {
        ctx.fillStyle = "#DB3E8C";
        ctx.fillRect(enemy.x + 2, enemy.y + 4, 16, 12); 
        ctx.fillRect(enemy.x + 12, enemy.y, 6, 6); 
        ctx.fillRect(enemy.x + 2, enemy.y + 16, 3, 4);
        ctx.fillRect(enemy.x + 13, enemy.y + 16, 3, 4);
        ctx.fillStyle = "#F6C45C"; 
        ctx.fillRect(enemy.x + 15, enemy.y + 2, 2, 2);
    }
    ctx.restore();
}

function drawTorre() {
    ctx.fillStyle = "#FFAFEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(0, cameraY);

    ctx.strokeStyle = "rgba(219, 62, 140, 0.25)";
    ctx.lineWidth = 2;
    let startY = Math.floor(-cameraY / 25) * 25;
    for (let y = startY; y < startY + canvas.height + 100; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        
        let offset = (Math.floor(y / 25) % 2 === 0) ? 0 : 25;
        for (let x = offset; x < canvas.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 25);
            ctx.stroke();
        }
    }

    ladders.forEach(lad => {
        ctx.fillStyle = "#7758A3";
        ctx.fillRect(lad.x, lad.y, 4, lad.height);
        ctx.fillRect(lad.x + lad.width - 4, lad.y, 4, lad.height);
        for (let i = 4; i < lad.height; i += 12) ctx.fillRect(lad.x, lad.y + i, lad.width, 3);
    });

    platforms.forEach(plat => {
        ctx.fillStyle = plat.isMeta ? "#DB3E8C" : "#7758A3";
        ctx.fillRect(plat.x, plat.y, plat.width, plat.height);
        ctx.fillStyle = "#F6C45C"; 
        ctx.fillRect(plat.x, plat.y, plat.width, 3);
    });

    if (castleGoal) {
        ctx.fillStyle = "#7758A3";
        ctx.fillRect(castleGoal.x, castleGoal.y + 20, 80, 40);
        ctx.fillStyle = "#DB3E8C";
        ctx.fillRect(castleGoal.x + 30, castleGoal.y + 35, 20, 25); 
    }

    enemies.forEach(enemy => drawTorreEnemy(enemy));

    drawGatitoBrujo(player.x, player.y);
    ctx.restore();

    ctx.fillStyle = "#1a1525";
    ctx.font = "bold 15px 'Courier New'";
    ctx.fillText(`PUNTOS: ${score}`, 15, 30);
    ctx.fillText(`PISO: ${currentFloor}/11`, 15, 50);
    ctx.fillText(`HEROE: ${playerAlias}`, 15, 70);
}

function drawPacman() {
    ctx.fillStyle = "#66A5ED"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < mazeMap.length; r++) {
        for (let c = 0; c < mazeMap[r].length; c++) {
            if (mazeMap[r][c] === 1) {
                ctx.fillStyle = "#7758A3"; 
                ctx.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
                
                ctx.fillStyle = "#DB3E8C";
                ctx.fillRect(c * tileSize + 8, r * tileSize + 8, 6, 6);
                ctx.fillRect(c * tileSize + 24, r * tileSize + 22, 6, 6);
                
                ctx.fillStyle = "#F6C45C";
                ctx.fillRect(c * tileSize + 20, r * tileSize + 8, 8, 6);
                ctx.fillRect(c * tileSize + 6, r * tileSize + 24, 6, 6);

                ctx.strokeStyle = "#1a1525";
                ctx.lineWidth = 1;
                ctx.strokeRect(c * tileSize, r * tileSize, tileSize, tileSize);
            }
        }
    }

    ctx.fillStyle = "#F6C45C";
    coins.forEach(coin => {
        if (!coin.collected) {
            ctx.beginPath();
            ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "#1a1525";
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });

    ctx.fillStyle = "#DB3E8C"; 
    ctx.fillRect(ghost.x, ghost.y, ghost.width, ghost.height);
    ctx.fillStyle = "#fff"; 
    ctx.fillRect(ghost.x + 3, ghost.y + 4, 5, 5); 
    ctx.fillRect(ghost.x + 14, ghost.y + 4, 5, 5);

    drawGatitoBrujo(player.x, player.y);

    ctx.fillStyle = "#1a1525";
    ctx.font = "bold 15px 'Courier New'";
    ctx.fillText(`PUNTOS: ${score}`, 15, 585);
    ctx.fillText(`MAZMORRA: EL LABERINTO`, 170, 585);
}

// =========================================================================
// PANTALLA FINAL Y CIERRE DEL JUEGO
// =========================================================================
function endGame(isVictory, detailText) {
    gameRunning = false;
    canvas.style.display = "none";
    
    const title = document.getElementById("end-title");
    const status = document.getElementById("end-status");
    
    if (isVictory) {
        title.innerText = "¡VICTORIA MÁXIMA!";
        title.className = "victory-text";
        status.innerText = "¡Espectacular! Completaste el desafío con éxito.";
        score += 1000; 
    } else {
        title.innerText = "GAME OVER";
        title.className = "";
        status.innerText = `Fin del intento: ${detailText}.`;
    }

    document.getElementById("final-score").innerText = score;
    document.getElementById("gameover-screen").style.display = "block";
    
    saveScoreLocal(playerAlias, score, selectedLabel, selectedMode);
    loadLeaderboardLocal(selectedMode);
}
