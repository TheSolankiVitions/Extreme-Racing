/**
 * EXTREME RACING - GAME ENGINE V16
 * Made by The Solanki Visions
 * Features: Zero-Lag, Custom Physics, Particle System, Camera Shake
 */

/* =========================================
   1. CONFIGURATION & STATE
   ========================================= */
const CONFIG = {
    gravity: 0.25,
    friction: 0.98,
    fps: 60,
    physicsStep: 1000 / 60,
    chunkSize: 1000,
    renderDistance: 2000,
    deleteDistance: 1000,
    fuelConsumption: 0.05,
    stuntThreshold: 250,
    ppm: 30
};

const GAME_STATE = {
    LOADING: 0,
    MENU: 1,
    GARAGE: 2,
    PLAYING: 3,
    GAMEOVER: 4
};

const Game = {
    state: GAME_STATE.LOADING,
    canvas: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d', { alpha: false }),
    width: window.innerWidth,
    height: window.innerHeight,
    lastTime: 0,
    
    // Audio
    audioMenu: document.getElementById('audio-bg-menu'),
    audioGame: document.getElementById('audio-bg-game'),

    // Gameplay Data
    score: 0,
    coins: 0,
    fuel: 100,
    distance: 0,
    airTime: 0,
    
    // Inputs
    keys: { gas: false, brake: false },
    
    // Camera System (With Shake)
    camera: { 
        x: 0, 
        y: 0,
        shakeX: 0,
        shakeY: 0,
        shakeDecay: 0.9
    },

    // Dynamic Objects
    terrain: [],
    coinsObj: [],
    fuelObj: [],
    particles: [], // The "Juice"
};

/* =========================================
   2. DATA & ASSETS
   ========================================= */
const ASSETS = {
    images: {
        'jeep': 'jeep.png',
        'bike': 'bike.png',
        'wood': 'wood.png',
        'mini_monster': 'mini_monster.png',
        'cartoon': 'cartoon.png',
        'character': 'character.png', // Replaced the dot
        'fuel': 'fuel_can.png',
        'coin': 'coin.png'
    },
    loaded: {}
};

// Vehicle Definitions
const VEHICLES = [
    { id: 'jeep', name: 'Classic Jeep', price: 0, speed: 0.8, weight: 1.0, img: 'jeep' },
    { id: 'bike', name: 'Dirt Bike', price: 1000, speed: 1.3, weight: 0.6, img: 'bike' },
    { id: 'wood', name: 'Wood Wagon', price: 2000, speed: 0.7, weight: 1.2, img: 'wood' },
    { id: 'mini_monster', name: 'Mini Monster', price: 3000, speed: 1.0, weight: 1.5, img: 'mini_monster' },
    { id: 'cartoon', name: 'Toon Racer', price: 4000, speed: 1.4, weight: 0.9, img: 'cartoon' }
];

// Stage Definitions
const STAGES = [
    { id: 'country', name: 'Country Side', price: 0, roughness: 50, gravityMult: 1.0, color: '#4b7c38', sky: '#87CEEB' },
    { id: 'moon', name: 'The Moon', price: 1000, roughness: 30, gravityMult: 0.4, color: '#888888', sky: '#000000' },
    { id: 'desert', name: 'Sahara', price: 2000, roughness: 80, gravityMult: 1.0, color: '#e6c229', sky: '#ffcc66' },
    { id: 'glaciers', name: 'Glaciers', price: 3000, roughness: 60, gravityMult: 1.1, color: '#aaddff', sky: '#ffffff' },
    { id: 'mars', name: 'Mars Base', price: 4000, roughness: 100, gravityMult: 0.9, color: '#b83b18', sky: '#ff9966' }
];

let PlayerData = {
    coins: 0,
    unlockedVehicles: ['jeep'],
    unlockedStages: ['country'],
    selectedVehicle: 'jeep',
    selectedStage: 'country'
};

/* =========================================
   3. ASSET LOADER (Async)
   ========================================= */
async function loadAssets() {
    const save = localStorage.getItem('extreme_racing_save');
    if (save) PlayerData = JSON.parse(save);

    const promises = [];
    
    for (let key in ASSETS.images) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.src = ASSETS.images[key];
            img.onload = () => {
                ASSETS.loaded[key] = img;
                updateLoader();
                resolve();
            };
            img.onerror = () => {
                // Generate a visual placeholder if image missing
                const canvas = document.createElement('canvas');
                canvas.width = 50; canvas.height = 50;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = key === 'character' ? '#ffcc00' : 'red';
                ctx.fillRect(0,0,50,50);
                ASSETS.loaded[key] = canvas;
                updateLoader();
                resolve();
            };
        }));
    }

    await Promise.all(promises);
    document.getElementById('loading-screen').classList.add('hidden');
    switchState(GAME_STATE.MENU);
}

let loadedCount = 0;
function updateLoader() {
    loadedCount++;
    const total = Object.keys(ASSETS.images).length;
    const pct = (loadedCount / total) * 100;
    document.getElementById('loader-fill').style.width = `${pct}%`;
}

/* =========================================
   4. PARTICLE SYSTEM (The Juice)
   ========================================= */
class Particle {
    constructor(x, y, color, type) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 5 + 2;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.01;
        this.color = color;
        this.type = type; // 'dust' or 'sparkle'
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        if (this.type === 'dust') {
            this.size *= 0.95; // Shrink
            this.vy -= 0.1; // Float up
        }
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - Game.camera.x, this.y - Game.camera.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function spawnDust(x, y) {
    for(let i=0; i<3; i++) {
        Game.particles.push(new Particle(x, y, '#dddddd', 'dust'));
    }
}

function spawnSparkles(x, y) {
    for(let i=0; i<10; i++) {
        Game.particles.push(new Particle(x, y, '#ffff00', 'sparkle'));
    }
}

/* =========================================
   5. PHYSICS ENGINE (Custom)
   ========================================= */
class CarPhysics {
    constructor(type) {
        const stats = VEHICLES.find(v => v.id === type);
        this.x = 200;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.vr = 0;
        
        this.speed = stats.speed;
        this.weight = stats.weight;
        this.width = 80;
        this.height = 40;
        this.onGround = false;
        
        // Driver Head (Relative to car center)
        this.headX = 0; 
        this.headY = -25; 
        this.headRadius = 15;
        this.driverDead = false;
    }

    update(dt) {
        if (this.driverDead) return;

        const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
        this.vy += CONFIG.gravity * stage.gravityMult * this.weight;

        // Input Forces & Head Physics
        let tiltForce = 0;

        if (Game.fuel > 0) {
            if (Game.keys.gas) {
                if (this.onGround) {
                    this.vx += 0.25 * this.speed;
                    spawnDust(this.x - 30, this.y + 20); // Dust from rear wheel
                    tiltForce = -0.3; // Head tilts back
                } else {
                    this.vr -= 0.05; // Air control
                }
                Game.fuel -= CONFIG.fuelConsumption;
            }
            if (Game.keys.brake) {
                if (this.onGround) {
                    this.vx -= 0.25 * this.speed;
                    tiltForce = 0.3; // Head tilts forward
                } else {
                    this.vr += 0.05; // Air control
                }
            }
        }

        // Apply Friction
        this.vx *= CONFIG.friction;
        this.vr *= 0.95;

        // Update Position
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.vr;

        // Collision Check
        this.checkTerrainCollision();
        
        // Stats
        if (this.x / CONFIG.ppm > Game.distance) {
            Game.distance = Math.floor(this.x / CONFIG.ppm);
        }
    }

    checkTerrainCollision() {
        const groundY = getTerrainHeight(this.x);
        const nextGroundY = getTerrainHeight(this.x + 40);
        const slope = Math.atan2(nextGroundY - groundY, 40);
        const carBottom = this.y + 20;

        if (carBottom >= groundY) {
            // Landing Impact
            if (!this.onGround && this.vy > 5) {
                addScreenShake(this.vy * 2); // Screen shake on hard landing
                spawnDust(this.x, this.y + 20); // Big dust puff
            }

            this.onGround = true;
            this.y = groundY - 20;
            this.vy = 0;
            
            // Suspension Smoothing
            const angleDiff = slope - this.rotation;
            this.vr += angleDiff * 0.15; // Snappier rotation alignment
            this.vx *= 0.98;
        } else {
            this.onGround = false;
            Game.airTime++;
        }

        // DRIVER HEAD COLLISION
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        const gx = this.x + (this.headX * cos - this.headY * sin);
        const gy = this.y + (this.headX * sin + this.headY * cos);
        
        const headGround = getTerrainHeight(gx);
        
        if (gy + this.headRadius >= headGround) {
            addScreenShake(20); // Massive shake on death
            triggerGameOver("HEAD INJURY");
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.camera.x, this.y - Game.camera.y);
        ctx.rotate(this.rotation);
        
        // Draw Car Sprite
        const img = ASSETS.loaded[PlayerData.selectedVehicle];
        ctx.drawImage(img, -this.width/2, -this.height/2, this.width, this.height);
        
        // Draw Driver Sprite (character.png)
        // Dynamic head tilting based on acceleration
        const tilt = (this.vx * 0.05); 
        
        ctx.save();
        ctx.translate(this.headX, this.headY);
        ctx.rotate(tilt); // Physics reaction
        const driverImg = ASSETS.loaded['character'];
        // Draw character slightly larger than collision circle
        ctx.drawImage(driverImg, -20, -20, 40, 40); 
        ctx.restore();

        ctx.restore();
    }
}

/* =========================================
   6. CAMERA & EFFECTS
   ========================================= */
function addScreenShake(amount) {
    Game.camera.shakeX = (Math.random() - 0.5) * amount;
    Game.camera.shakeY = (Math.random() - 0.5) * amount;
}

function updateCamera() {
    // Linear Interpolation (Lerp) for smooth following
    const targetX = car.x - Game.width / 3;
    const targetY = car.y - Game.height / 1.5;
    
    // Smoothness factor (0.1 = slow, 0.9 = fast)
    Game.camera.x += (targetX - Game.camera.x) * 0.1;
    Game.camera.y += (targetY - Game.camera.y) * 0.1;

    // Apply Shake
    Game.camera.x += Game.camera.shakeX;
    Game.camera.y += Game.camera.shakeY;
    
    // Decay Shake
    Game.camera.shakeX *= Game.camera.shakeDecay;
    Game.camera.shakeY *= Game.camera.shakeDecay;
}

/* =========================================
   7. TERRAIN SYSTEM
   ========================================= */
function getTerrainHeight(x) {
    if (Game.terrain.length === 0) return Game.height - 100;
    const segmentWidth = 50;
    const index = Math.floor(x / segmentWidth);
    if (index < 0) return Game.terrain[0];
    if (index >= Game.terrain.length - 1) return Game.terrain[Game.terrain.length - 1];
    
    const t = (x % segmentWidth) / segmentWidth;
    const y1 = Game.terrain[index];
    const y2 = Game.terrain[index + 1];
    return y1 + t * (y2 - y1);
}

function generateTerrainChunk(startIndex, count) {
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    let prevY = Game.terrain.length > 0 ? Game.terrain[Game.terrain.length - 1] : Game.height - 150;
    
    for (let i = 0; i < count; i++) {
        const noise = Math.sin((startIndex + i) * 0.1) + Math.sin((startIndex + i) * 0.03) * 2;
        const delta = noise * stage.roughness;
        let newY = prevY + delta;
        if (newY > Game.height - 50) newY = Game.height - 50;
        if (newY < 200) newY = 200;
        
        Game.terrain.push(newY);
        prevY = newY;
        
        // Spawn Objects
        const realX = (Game.terrain.length - 1) * 50;
        spawnCollectibles(realX, newY);
    }
}

function spawnCollectibles(x, y) {
    let chance = x < 15000 ? 0.4 : 0.1;
    if (Math.random() < chance) Game.coinsObj.push({ x: x, y: y - 40, collected: false });
    if (Math.random() < 0.02) Game.fuelObj.push({ x: x, y: y - 40, collected: false });
}

/* =========================================
   8. GAME LOOP
   ========================================= */
let car;

function startGame() {
    Game.state = GAME_STATE.PLAYING;
    Game.score = 0;
    Game.coins = 0;
    Game.fuel = 100;
    Game.distance = 0;
    Game.airTime = 0;
    Game.terrain = [];
    Game.coinsObj = [];
    Game.fuelObj = [];
    Game.particles = [];
    
    try {
        Game.audioMenu.pause();
        Game.audioGame.currentTime = 0;
        Game.audioGame.play();
    } catch(e) {}

    generateTerrainChunk(0, 50);
    car = new CarPhysics(PlayerData.selectedVehicle);
    
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('garage-screen').classList.add('hidden');
    document.getElementById('report-screen').classList.add('hidden');
    document.getElementById('hud-screen').classList.remove('hidden');
    
    requestAnimationFrame(loop);
}

function loop(timestamp) {
    if (Game.state !== GAME_STATE.PLAYING) return;

    const dt = timestamp - Game.lastTime;
    Game.lastTime = timestamp;

    car.update(dt);
    updateCamera();

    // Terrain gen
    const rightEdgeIndex = Math.floor((Game.camera.x + Game.width + 500) / 50);
    if (rightEdgeIndex > Game.terrain.length) {
        generateTerrainChunk(Game.terrain.length, 20);
    }

    checkCollectibles();
    
    // Update Particles
    for (let i = Game.particles.length - 1; i >= 0; i--) {
        let p = Game.particles[i];
        p.update();
        if (p.life <= 0) Game.particles.splice(i, 1);
    }

    render();
    updateHUD();

    if (Game.fuel <= 0 && Math.abs(car.vx) < 0.1) {
        triggerGameOver("OUT OF FUEL");
    }

    requestAnimationFrame(loop);
}

function checkCollectibles() {
    Game.coinsObj.forEach(c => {
        if (!c.collected) {
            const dx = c.x - car.x;
            const dy = c.y - car.y;
            if (dx*dx + dy*dy < 2500) {
                c.collected = true;
                Game.coins++;
                spawnSparkles(c.x, c.y); // Visual reward
            }
        }
    });
    
    Game.fuelObj.forEach(f => {
        if (!f.collected) {
            const dx = f.x - car.x;
            const dy = f.y - car.y;
            if (dx*dx + dy*dy < 2500) {
                f.collected = true;
                Game.fuel = 100;
                spawnSparkles(f.x, f.y);
            }
        }
    });
}

function render() {
    const ctx = Game.ctx;
    ctx.clearRect(0, 0, Game.width, Game.height);
    
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    ctx.fillStyle = stage.sky;
    ctx.fillRect(0, 0, Game.width, Game.height);

    // Draw Terrain
    ctx.fillStyle = stage.color;
    ctx.beginPath();
    const startIdx = Math.floor(Game.camera.x / 50);
    const endIdx = startIdx + Math.ceil(Game.width / 50) + 2;
    
    if (Game.terrain[startIdx] !== undefined) {
        ctx.moveTo(startIdx * 50 - Game.camera.x, Game.terrain[startIdx] - Game.camera.y);
        for (let i = startIdx; i <= endIdx; i++) {
            if (Game.terrain[i] !== undefined) {
                ctx.lineTo(i * 50 - Game.camera.x, Game.terrain[i] - Game.camera.y);
            }
        }
        ctx.lineTo(endIdx * 50 - Game.camera.x, Game.height);
        ctx.lineTo(startIdx * 50 - Game.camera.x, Game.height);
        ctx.fill();
    }

    // Draw Items
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    Game.coinsObj.forEach(c => {
        if (!c.collected && c.x > Game.camera.x && c.x < Game.camera.x + Game.width) {
            ctx.drawImage(ASSETS.loaded['coin'], c.x - 15 - Game.camera.x, c.y - 15 - Game.camera.y, 30, 30);
        }
    });
    
    Game.fuelObj.forEach(f => {
        if (!f.collected && f.x > Game.camera.x && f.x < Game.camera.x + Game.width) {
            ctx.drawImage(ASSETS.loaded['fuel'], f.x - 15 - Game.camera.x, f.y - 20 - Game.camera.y, 30, 40);
        }
    });

    // Draw Particles
    Game.particles.forEach(p => p.draw(ctx));

    car.draw(ctx);
}

function updateHUD() {
    document.getElementById('dist-display').innerText = `${Game.distance}m`;
    document.getElementById('session-coins').innerText = Game.coins;
    document.getElementById('fuel-fill').style.width = `${Math.max(0, Game.fuel)}%`;
}

function triggerGameOver(reason) {
    Game.state = GAME_STATE.GAMEOVER;
    car.driverDead = true;
    Game.audioGame.pause();
    
    PlayerData.coins += Game.coins;
    localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
    
    document.getElementById('fail-reason').innerText = reason;
    document.getElementById('rep-distance').innerText = `${Game.distance}m`;
    document.getElementById('rep-coins').innerText = Game.coins;
    document.getElementById('rep-air').innerText = `${(Game.airTime / 60).toFixed(1)}s`;
    
    const snapCanvas = document.getElementById('snapshot-canvas');
    const sCtx = snapCanvas.getContext('2d');
    sCtx.fillStyle = "#333";
    sCtx.fillRect(0,0,snapCanvas.width, snapCanvas.height);
    sCtx.fillStyle = "white";
    sCtx.fillText("CRASHED", 100, 70);

    setTimeout(() => {
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.remove('hidden');
    }, 1000);
}

// State Switcher and Buttons
function switchState(newState) {
    document.querySelectorAll('.hidden').forEach(el => {}); // Helper
    
    if (newState === GAME_STATE.MENU) {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('garage-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.add('hidden');
        document.getElementById('menu-total-coins').innerText = PlayerData.coins;
        Game.audioGame.pause();
        Game.audioMenu.play().catch(e=>{});
    }
    else if (newState === GAME_STATE.GARAGE) {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('garage-screen').classList.remove('hidden');
        populateGarage();
    }
}

// Populate Garage (Same logic as before, ensuring visuals update)
function populateGarage() {
    document.getElementById('garage-coins').innerText = PlayerData.coins;
    
    const vList = document.getElementById('vehicle-list');
    vList.innerHTML = '';
    VEHICLES.forEach(v => {
        const div = document.createElement('div');
        const unlocked = PlayerData.unlockedVehicles.includes(v.id);
        const selected = PlayerData.selectedVehicle === v.id;
        div.className = `card ${unlocked ? 'unlocked' : ''} ${selected ? 'selected' : ''}`;
        div.innerHTML = `
            <div class="card-info">
                <h4>${v.name}</h4>
                ${unlocked ? '<span class="owned-tag">OWNED</span>' : `<span class="price-tag">${v.price} 🪙</span>`}
            </div>
            <img src="${ASSETS.images[v.img] ? ASSETS.images[v.img].src : ''}">
        `;
        div.onclick = () => {
            if (unlocked) {
                PlayerData.selectedVehicle = v.id;
                populateGarage();
                localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
            } else if (PlayerData.coins >= v.price) {
                PlayerData.coins -= v.price;
                PlayerData.unlockedVehicles.push(v.id);
                PlayerData.selectedVehicle = v.id;
                populateGarage();
                localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
            }
        };
        vList.appendChild(div);
    });

    const sList = document.getElementById('stage-list');
    sList.innerHTML = '';
    STAGES.forEach(s => {
        const div = document.createElement('div');
        const unlocked = PlayerData.unlockedStages.includes(s.id);
        const selected = PlayerData.selectedStage === s.id;
        div.className = `card ${unlocked ? 'unlocked' : ''} ${selected ? 'selected' : ''}`;
        div.style.background = s.color;
        div.innerHTML = `
            <div class="card-info">
                <h4 style="color:black; text-shadow:none;">${s.name}</h4>
                ${unlocked ? '<span class="owned-tag" style="color:black">OWNED</span>' : `<span class="price-tag">${s.price} 🪙</span>`}
            </div>
        `;
        div.onclick = () => {
            if (unlocked) {
                PlayerData.selectedStage = s.id;
                populateGarage();
                localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
            } else if (PlayerData.coins >= s.price) {
                PlayerData.coins -= s.price;
                PlayerData.unlockedStages.push(s.id);
                PlayerData.selectedStage = s.id;
                populateGarage();
                localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
            }
        };
        sList.appendChild(div);
    });
}

// Listeners
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') Game.keys.gas = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Game.keys.brake = true;
});
window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') Game.keys.gas = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Game.keys.brake = false;
});

const btnGas = document.getElementById('btn-gas');
const btnBrake = document.getElementById('btn-brake');
btnGas.addEventListener('touchstart', (e) => { e.preventDefault(); Game.keys.gas = true; });
btnGas.addEventListener('touchend', (e) => { e.preventDefault(); Game.keys.gas = false; });
btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); Game.keys.brake = true; });
btnBrake.addEventListener('touchend', (e) => { e.preventDefault(); Game.keys.brake = false; });

document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-garage').onclick = () => switchState(GAME_STATE.GARAGE);
document.getElementById('btn-back-menu').onclick = () => switchState(GAME_STATE.MENU);
document.getElementById('btn-menu-return').onclick = () => switchState(GAME_STATE.MENU);
document.getElementById('btn-restart').onclick = startGame;

window.onload = () => {
    window.addEventListener('resize', () => {
        Game.width = window.innerWidth;
        Game.height = window.innerHeight;
        Game.canvas.width = Game.width;
        Game.canvas.height = Game.height;
    });
    window.dispatchEvent(new Event('resize'));
    loadAssets();
};
