/**
 * EXTREME RACING - MASTER FILE V18
 * Made by The Solanki Visions
 * Features: Dual-Wheel Suspension, Audio Engine, Slow-Mo, Mobile Optimization
 */

/* ==========================================================================
   1. GAME CONFIGURATION & CONSTANTS
   ========================================================================== */
const CONFIG = {
    // Physics
    gravity: 0.25,
    friction: 0.97,
    airResistance: 0.99,
    suspensionStiffness: 0.1, // Lower = Bouncier
    rotationSpeed: 0.05,
    
    // Engine
    fps: 60,
    chunkSize: 1000,
    renderDistance: 1500,
    deleteDistance: 1000,
    
    // Gameplay
    fuelConsumption: 0.03, // Lowered for less frustration
    nitroConsumption: 0.4,
    ppm: 30, // Pixels per Meter scale
    stuntThreshold: 120 // Frames in air to count as jump
};

const GAME_STATE = {
    LOADING: 0,
    MENU: 1,
    GARAGE: 2,
    PLAYING: 3,
    GAMEOVER: 4
};

// Singleton Game Instance
const Game = {
    state: GAME_STATE.LOADING,
    canvas: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d', { alpha: false }),
    width: window.innerWidth,
    height: window.innerHeight,
    lastTime: 0,
    timeScale: 1.0, // For Slow Motion effects

    // Core Data
    score: 0,
    coins: 0,
    fuel: 100,
    nitro: 100,
    distance: 0,
    airTime: 0,
    flips: 0,
    
    // Controls
    keys: { gas: false, brake: false, nitro: false },
    
    // Camera
    camera: { x: 0, y: 0, shake: 0 },

    // Entities
    terrain: [],
    coinsObj: [],
    fuelObj: [],
    particles: [],
};

/* ==========================================================================
   2. ASSET MANAGEMENT & AUDIO ENGINE
   ========================================================================== */
const ASSETS = {
    images: {
        'jeep': 'jeep.png',
        'bike': 'bike.png',
        'wood': 'wood.png',
        'mini_monster': 'mini_monster.png',
        'cartoon': 'cartoon.png',
        'character': 'character.png', // CRITICAL: Your requested driver
        'fuel': 'fuel_can.png',
        'coin': 'coin.png'
    },
    loaded: {}
};

// Sound Manager (Rebuilt to fix browser autoplay issues)
const SOUNDS = {
    menuLoop: new Audio('background-audio-non-playing.mp4'),
    gameLoop: new Audio('background-audio-playing.mp4'),
};

// Configure Loops
SOUNDS.menuLoop.loop = true;
SOUNDS.gameLoop.loop = true;
SOUNDS.menuLoop.volume = 0.5;
SOUNDS.gameLoop.volume = 0.4;

function initAudio() {
    // Only call this on User Interaction (Start Button)
    SOUNDS.menuLoop.play().catch(e => console.log("Audio waiting for input"));
}

// Vehicle Data
const VEHICLES = [
    { id: 'jeep', name: 'Classic Jeep', price: 0, speed: 0.8, weight: 1.0, width: 90, img: 'jeep' },
    { id: 'bike', name: 'Dirt Bike', price: 1000, speed: 1.3, weight: 0.6, width: 70, img: 'bike' },
    { id: 'wood', name: 'Wood Wagon', price: 2000, speed: 0.7, weight: 1.2, width: 95, img: 'wood' },
    { id: 'mini_monster', name: 'Beast 4x4', price: 3000, speed: 1.0, weight: 1.5, width: 100, img: 'mini_monster' },
    { id: 'cartoon', name: 'Pro Racer', price: 4000, speed: 1.4, weight: 0.9, width: 85, img: 'cartoon' }
];

// Stages (Procedural Params)
const STAGES = [
    { id: 'country', name: 'Green Hills', price: 0, roughness: 40, color: '#4b7c38', sky: '#87CEEB' },
    { id: 'moon', name: 'Moon Base', price: 1000, roughness: 30, color: '#555', sky: '#000' },
    { id: 'desert', name: 'Sahara', price: 2000, roughness: 70, color: '#e6c229', sky: '#ffcc66' },
    { id: 'glaciers', name: 'Ice Peaks', price: 3000, roughness: 50, color: '#aaddff', sky: '#fff' },
    { id: 'mars', name: 'Mars', price: 4000, roughness: 90, color: '#b83b18', sky: '#ff9966' }
];

// Persistent Data
let PlayerData = {
    coins: 0,
    unlockedVehicles: ['jeep'],
    unlockedStages: ['country'],
    selectedVehicle: 'jeep',
    selectedStage: 'country'
};

/* ==========================================================================
   3. ASSET LOADING SEQUENCE
   ========================================================================== */
async function loadAssets() {
    // Load Save
    const save = localStorage.getItem('extreme_racing_save');
    if (save) PlayerData = JSON.parse(save);

    const promises = [];
    for (let key in ASSETS.images) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.src = ASSETS.images[key];
            img.onload = () => { ASSETS.loaded[key] = img; updateLoader(); resolve(); };
            img.onerror = () => { 
                // Create a fallback colored box if image is missing so game doesn't crash
                const c = document.createElement('canvas');
                c.width = 60; c.height = 40;
                const cx = c.getContext('2d');
                cx.fillStyle = key === 'character' ? '#FFFF00' : '#FF0000';
                cx.fillRect(0,0,60,40);
                ASSETS.loaded[key] = c;
                updateLoader(); resolve();
            };
        }));
    }
    
    await Promise.all(promises);
    
    // Initialize Logic
    document.getElementById('loading-screen').classList.add('hidden');
    switchState(GAME_STATE.MENU);
}

function updateLoader() {
    const total = Object.keys(ASSETS.images).length;
    const loaded = Object.keys(ASSETS.loaded).length;
    const pct = (loaded / total) * 100;
    document.getElementById('loader-fill').style.width = `${pct}%`;
}

/* ==========================================================================
   4. PHYSICS ENGINE (DUAL-WHEEL RAYCAST) - THE FIX
   ========================================================================== */
class CarPhysics {
    constructor(type) {
        const stats = VEHICLES.find(v => v.id === type);
        this.width = stats.width;
        this.height = this.width / 2;
        
        // Physics State
        this.x = 0; // Starts at 0
        this.y = -100;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0; // Rotation
        this.va = 0;    // Angular Velocity
        
        // Stats
        this.speedPower = stats.speed;
        this.weight = stats.weight;
        this.onGround = false;
        
        // Driver Position (Relative to center)
        this.driverX = -10;
        this.driverY = -15;
        this.driverDead = false;
    }

    update() {
        if (this.driverDead) return;

        const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
        const gravity = (stage.id === 'moon' ? 0.1 : 0.25) * Game.timeScale;

        // 1. Apply Gravity
        this.vy += gravity * this.weight;

        // 2. Input Handling
        if (Game.fuel > 0) {
            if (Game.keys.gas) {
                if (this.onGround) {
                    this.vx += (0.4 * this.speedPower) * Game.timeScale;
                    spawnParticles(this.x - 30, this.y + 15, '#888', 'dust');
                } else {
                    this.va -= 0.005 * Game.timeScale; // Air Control
                }
                Game.fuel -= CONFIG.fuelConsumption * Game.timeScale;
            }
            
            if (Game.keys.brake) {
                if (this.onGround) {
                    this.vx -= (0.3 * this.speedPower) * Game.timeScale;
                } else {
                    this.va += 0.005 * Game.timeScale;
                }
            }

            // Nitro
            if (Game.keys.nitro && Game.nitro > 0) {
                this.vx += (this.onGround ? 0.8 : 0.3) * Game.timeScale;
                Game.nitro -= CONFIG.nitroConsumption * Game.timeScale;
                spawnParticles(this.x - 40, this.y, '#00F3FF', 'flame');
                addScreenShake(2);
            }
        }

        // 3. Air Resistance / Friction
        this.vx *= CONFIG.friction;
        this.va *= 0.95; // Angular drag to stop infinite spin

        // 4. Update Position
        this.x += this.vx * Game.timeScale;
        this.y += this.vy * Game.timeScale;
        this.angle += this.va * Game.timeScale;

        // 5. TERRAIN COLLISION (DUAL RAYCAST SYSTEM)
        this.handleTerrain();

        // 6. Update Distance
        if (this.x / CONFIG.ppm > Game.distance) {
            Game.distance = Math.floor(this.x / CONFIG.ppm);
        }
    }

    handleTerrain() {
        // Calculate Wheel Positions based on rotation
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        
        // Wheel offset (half width)
        const wOff = this.width / 2.5; 
        
        // Front Wheel X
        const fx = this.x + (wOff * cos);
        // Rear Wheel X
        const rx = this.x - (wOff * cos);

        // Get Ground Height at both wheels
        const fGround = getTerrainHeight(fx);
        const rGround = getTerrainHeight(rx);
        
        // Center Ground (for height check)
        const cGround = getTerrainHeight(this.x);
        
        // Calculate where the car SHOULD be
        const desiredAngle = Math.atan2(fGround - rGround, wOff * 2);
        const carBottom = this.y + (this.height / 2);

        // Check Collision
        if (carBottom >= cGround - 5) { // Tolerance
            this.onGround = true;
            this.vy = 0;
            this.y = cGround - (this.height / 2); // Snap to ground
            
            // Suspension: Smoothly rotate towards ground angle
            // This prevents "shaking" by interpolating instead of snapping
            const diff = desiredAngle - this.angle;
            this.va += diff * CONFIG.suspensionStiffness; 
            
            // Hard Landing Juice
            if (this.vy > 10) {
                addScreenShake(this.vy);
                spawnParticles(this.x, this.y + 20, '#555', 'dust');
            }
        } else {
            this.onGround = false;
            Game.airTime++;
        }

        // --- DRIVER HEAD COLLISION CHECK ---
        // Transform local head position to world space
        const hx = this.x + (this.driverX * cos - this.driverY * sin);
        const hy = this.y + (this.driverX * sin + this.driverY * cos);
        const hGround = getTerrainHeight(hx);

        if (hy >= hGround) {
            // Head hit ground
            triggerGameOver("HEAD INJURY");
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.camera.x, this.y - Game.camera.y);
        ctx.rotate(this.angle);
        
        // 1. Draw Car Body
        const img = ASSETS.loaded[PlayerData.selectedVehicle];
        if (img) {
            ctx.drawImage(img, -this.width/2, -this.height/2, this.width, this.height);
        } else {
            // Fallback Box
            ctx.fillStyle = 'red';
            ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);
        }

        // 2. Draw Driver (Character.png)
        // Positioned explicitly relative to car center
        const driverImg = ASSETS.loaded['character'];
        if (driverImg) {
            // Physics Bobbing
            const bob = Math.sin(Date.now() / 100) * 2;
            const lean = this.vx * 0.05; // Lean back on accel
            
            ctx.save();
            ctx.translate(this.driverX, this.driverY + bob);
            ctx.rotate(lean);
            // Draw centered on head pivot
            ctx.drawImage(driverImg, -15, -15, 30, 30);
            ctx.restore();
        }

        ctx.restore();
    }
}

/* ==========================================================================
   5. TERRAIN GENERATOR (With Safe Zone)
   ========================================================================== */
function getTerrainHeight(x) {
    if (Game.terrain.length === 0) return Game.height - 150;
    
    const segment = 50; // Distance between points
    const idx = Math.floor(x / segment);
    
    // Bounds check
    if (idx < 0) return Game.terrain[0];
    if (idx >= Game.terrain.length - 1) return Game.terrain[Game.terrain.length - 1];
    
    // Linear Interpolation for smooth lines between points
    const t = (x % segment) / segment;
    const y1 = Game.terrain[idx];
    const y2 = Game.terrain[idx+1];
    
    return y1 + t * (y2 - y1);
}

function generateTerrain(startIndex, count) {
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    let prevY = Game.terrain.length > 0 ? Game.terrain[Game.terrain.length - 1] : Game.height - 150;
    
    for (let i = 0; i < count; i++) {
        const realIndex = startIndex + i;
        
        let newY = prevY;

        // **SAFE ZONE LOGIC**: First 20 segments (1000px) are FLAT
        if (realIndex < 20) {
            newY = Game.height - 150;
        } else {
            // Noise Generation
            const noise = Math.sin(realIndex * 0.1) + Math.sin(realIndex * 0.03) * 2.5;
            newY += noise * (stage.roughness / 5);
            
            // Random Jumps
            if (realIndex % 150 > 140) newY -= 15; // Ramp Up
            if (realIndex % 150 === 0) newY += 80; // Drop Off
        }

        // Floor/Ceiling Clamp
        if (newY > Game.height - 50) newY = Game.height - 50;
        if (newY < 200) newY = 200;
        
        Game.terrain.push(newY);
        prevY = newY;
        
        // Spawn Items (Only after safe zone)
        if (realIndex > 20) {
            const xPos = realIndex * 50;
            if (Math.random() < 0.3) Game.coinsObj.push({x: xPos, y: newY - 40, c: false});
            if (Math.random() < 0.02) Game.fuelObj.push({x: xPos, y: newY - 40, c: false});
        }
    }
}

/* ==========================================================================
   6. PARTICLE EFFECTS (Juice)
   ========================================================================== */
class Particle {
    constructor(x, y, color, type) {
        this.x = x; this.y = y; this.color = color;
        this.life = 1.0;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.size = Math.random() * 5 + 2;
        this.decay = 0.03;
    }
    update() {
        this.x += this.vx * Game.timeScale;
        this.y += this.vy * Game.timeScale;
        this.life -= this.decay * Game.timeScale;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - Game.camera.x, this.y - Game.camera.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function spawnParticles(x, y, color, type) {
    for(let i=0; i<5; i++) Game.particles.push(new Particle(x, y, color, type));
}

function addScreenShake(amount) {
    Game.camera.shake = amount;
}

/* ==========================================================================
   7. MAIN LOOP & LOGIC
   ========================================================================== */
let car;

function startGame() {
    // Reset State
    Game.state = GAME_STATE.PLAYING;
    Game.timeScale = 1.0;
    Game.score = 0; Game.coins = 0; Game.fuel = 100; Game.nitro = 100;
    Game.distance = 0; Game.airTime = 0;
    Game.terrain = []; Game.coinsObj = []; Game.fuelObj = []; Game.particles = [];
    
    // Play Audio (Requires user interaction first, which this function is bound to)
    SOUNDS.menuLoop.pause();
    SOUNDS.gameLoop.currentTime = 0;
    SOUNDS.gameLoop.play().catch(e => console.log("Audio block"));

    // Initial Terrain (Start Flat)
    generateTerrain(0, 100);
    
    // Spawn Car at Safe Spot
    car = new CarPhysics(PlayerData.selectedVehicle);
    car.x = 200; 
    car.y = getTerrainHeight(200) - 100; // Drop from sky

    // UI
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('garage-screen').classList.add('hidden');
    document.getElementById('report-screen').classList.add('hidden');
    document.getElementById('hud-screen').classList.remove('hidden');

    requestAnimationFrame(loop);
}

function loop(timestamp) {
    if (Game.state !== GAME_STATE.PLAYING && Game.state !== GAME_STATE.GAMEOVER) return;

    // 1. Physics Update
    car.update();

    // 2. Camera Update (Lerp + Shake)
    const targetX = car.x - Game.width / 3;
    const targetY = car.y - Game.height / 1.5;
    
    // Smooth follow
    Game.camera.x += (targetX - Game.camera.x) * 0.1;
    Game.camera.y += (targetY - Game.camera.y) * 0.1;
    
    // Add Shake
    if (Game.camera.shake > 0) {
        Game.camera.x += (Math.random() - 0.5) * Game.camera.shake;
        Game.camera.y += (Math.random() - 0.5) * Game.camera.shake;
        Game.camera.shake *= 0.9; // Decay
        if (Game.camera.shake < 0.5) Game.camera.shake = 0;
    }

    // 3. Render World
    render();

    // 4. Terrain Expansion
    const edge = Math.floor((Game.camera.x + Game.width + 500) / 50);
    if (edge > Game.terrain.length) generateTerrain(Game.terrain.length, 20);

    // 5. Logic
    checkCollectibles();
    updateHUD();

    // 6. Particles
    for (let i = Game.particles.length - 1; i >= 0; i--) {
        Game.particles[i].update();
        if (Game.particles[i].life <= 0) Game.particles.splice(i, 1);
    }

    // 7. Check Fuel Death
    if (Game.fuel <= 0 && Math.abs(car.vx) < 0.1 && Game.state === GAME_STATE.PLAYING) {
        triggerGameOver("OUT OF FUEL");
    }

    requestAnimationFrame(loop);
}

function checkCollectibles() {
    Game.coinsObj.forEach(c => {
        if (!c.c && (c.x - car.x)**2 + (c.y - car.y)**2 < 2500) {
            c.c = true;
            Game.coins++;
            spawnParticles(c.x, c.y, '#FFD700', 'sparkle');
            showPopup("+1", c.x, c.y);
        }
    });
    Game.fuelObj.forEach(f => {
        if (!f.c && (f.x - car.x)**2 + (f.y - car.y)**2 < 2500) {
            f.c = true;
            Game.fuel = 100;
            spawnParticles(f.x, f.y, 'red', 'sparkle');
            showPopup("FUEL", f.x, f.y);
        }
    });
}

function showPopup(text, x, y) {
    const el = document.createElement('div');
    el.className = 'score-popup';
    el.innerText = text;
    document.getElementById('popup-container').appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function render() {
    const ctx = Game.ctx;
    ctx.clearRect(0, 0, Game.width, Game.height);
    
    // Draw Sky
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    ctx.fillStyle = stage.sky;
    ctx.fillRect(0, 0, Game.width, Game.height);

    // Draw Terrain
    ctx.fillStyle = stage.color;
    ctx.beginPath();
    const start = Math.floor(Game.camera.x / 50);
    const end = start + Math.ceil(Game.width / 50) + 2;
    
    if (Game.terrain[start] !== undefined) {
        ctx.moveTo(start*50 - Game.camera.x, Game.terrain[start] - Game.camera.y);
        for(let i=start; i<=end; i++) {
            if (Game.terrain[i] !== undefined)
                ctx.lineTo(i*50 - Game.camera.x, Game.terrain[i] - Game.camera.y);
        }
        ctx.lineTo(end*50 - Game.camera.x, Game.height);
        ctx.lineTo(start*50 - Game.camera.x, Game.height);
        ctx.fill();
    }

    // Draw Items
    Game.coinsObj.forEach(c => {
        if (!c.c) ctx.drawImage(ASSETS.loaded['coin'], c.x - 15 - Game.camera.x, c.y - 15 - Game.camera.y, 30, 30);
    });
    Game.fuelObj.forEach(f => {
        if (!f.c) ctx.drawImage(ASSETS.loaded['fuel'], f.x - 15 - Game.camera.x, f.y - 20 - Game.camera.y, 30, 40);
    });

    // Draw Particles
    Game.particles.forEach(p => p.draw(ctx));

    // Draw Car
    car.draw(ctx);
}

function updateHUD() {
    document.getElementById('dist-display').innerText = Game.distance;
    document.getElementById('session-coins').innerText = Game.coins;
    document.getElementById('fuel-bar').style.width = `${Math.max(0, Game.fuel)}%`;
    document.getElementById('nitro-bar').style.width = `${Math.max(0, Game.nitro)}%`;
}

function triggerGameOver(reason) {
    if (Game.state === GAME_STATE.GAMEOVER) return; // Prevent double trigger
    
    Game.state = GAME_STATE.GAMEOVER;
    car.driverDead = true;
    Game.timeScale = 0.2; // Slow Motion Death
    
    // Save Data
    PlayerData.coins += Game.coins;
    localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
    
    // Stop Music
    SOUNDS.gameLoop.pause();
    
    // Snapshot logic
    const snapCanvas = document.getElementById('snapshot-canvas');
    const sCtx = snapCanvas.getContext('2d');
    sCtx.fillStyle = '#111'; sCtx.fillRect(0,0,300,150);
    sCtx.fillStyle = 'white'; sCtx.fillText("CRASH RECORDED", 50, 75);

    // Update Report UI
    document.getElementById('fail-reason').innerText = reason;
    document.getElementById('rep-distance').innerText = `${Game.distance}m`;
    document.getElementById('rep-coins').innerText = Game.coins;
    document.getElementById('rep-total').innerText = PlayerData.coins;

    // Show Report after delay
    setTimeout(() => {
        Game.timeScale = 1.0; // Reset for next run
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.remove('hidden');
    }, 1500);
}

/* ==========================================================================
   8. MENU & GARAGE LOGIC
   ========================================================================== */
function switchState(s) {
    ['menu-screen', 'garage-screen', 'report-screen'].forEach(id => 
        document.getElementById(id).classList.add('hidden'));
    
    if(s === GAME_STATE.MENU) {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-total-coins').innerText = PlayerData.coins;
        // Audio
        initAudio(); 
    }
    else if(s === GAME_STATE.GARAGE) {
        document.getElementById('garage-screen').classList.remove('hidden');
        populateGarage();
    }
}

function populateGarage() {
    document.getElementById('garage-coins').innerText = PlayerData.coins;
    const vList = document.getElementById('vehicle-list');
    vList.innerHTML = '';
    
    VEHICLES.forEach(v => {
        const d = document.createElement('div');
        const owned = PlayerData.unlockedVehicles.includes(v.id);
        const sel = PlayerData.selectedVehicle === v.id;
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.innerHTML = `<div class="card-title">${v.name}</div>
                       <div class="price-badge">${owned ? 'OWNED' : v.price + ' 🪙'}</div>
                       <img src="${ASSETS.images[v.img].src}">`;
        d.onclick = () => {
            if(owned) {
                PlayerData.selectedVehicle = v.id;
            } else if (PlayerData.coins >= v.price) {
                PlayerData.coins -= v.price;
                PlayerData.unlockedVehicles.push(v.id);
                PlayerData.selectedVehicle = v.id;
            }
            populateGarage();
            localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
        };
        vList.appendChild(d);
    });
    
    // Repeat for Stages...
    const sList = document.getElementById('stage-list');
    sList.innerHTML = '';
    STAGES.forEach(s => {
        const d = document.createElement('div');
        const owned = PlayerData.unlockedStages.includes(s.id);
        const sel = PlayerData.selectedStage === s.id;
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.style.background = s.color;
        d.innerHTML = `<div class="card-title" style="color:white; text-shadow:1px 1px 0 #000">${s.name}</div>
                       <div class="price-badge">${owned ? 'OWNED' : s.price + ' 🪙'}</div>`;
        d.onclick = () => {
            if(owned) PlayerData.selectedStage = s.id;
            else if(PlayerData.coins >= s.price) {
                PlayerData.coins -= s.price;
                PlayerData.unlockedStages.push(s.id);
                PlayerData.selectedStage = s.id;
            }
            populateGarage();
            localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
        };
        sList.appendChild(d);
    });
}

// Input Binding
window.addEventListener('keydown', e => {
    if(e.code==='ArrowRight'||e.code==='KeyD') Game.keys.gas = true;
    if(e.code==='ArrowLeft'||e.code==='KeyA') Game.keys.brake = true;
    if(e.code==='ShiftLeft') Game.keys.nitro = true;
});
window.addEventListener('keyup', e => {
    if(e.code==='ArrowRight'||e.code==='KeyD') Game.keys.gas = false;
    if(e.code==='ArrowLeft'||e.code==='KeyA') Game.keys.brake = false;
    if(e.code==='ShiftLeft') Game.keys.nitro = false;
});

// Touch
const bGas = document.getElementById('btn-gas');
const bBrake = document.getElementById('btn-brake');
const bNitro = document.getElementById('btn-nitro');

bGas.addEventListener('touchstart', e=>{e.preventDefault(); Game.keys.gas=true;});
bGas.addEventListener('touchend', e=>{e.preventDefault(); Game.keys.gas=false;});
bBrake.addEventListener('touchstart', e=>{e.preventDefault(); Game.keys.brake=true;});
bBrake.addEventListener('touchend', e=>{e.preventDefault(); Game.keys.brake=false;});
bNitro.addEventListener('touchstart', e=>{e.preventDefault(); Game.keys.nitro=true;});
bNitro.addEventListener('touchend', e=>{e.preventDefault(); Game.keys.nitro=false;});

// UI Buttons
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
}
