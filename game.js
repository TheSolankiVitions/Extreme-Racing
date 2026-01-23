/**
 * EXTREME RACING - ADRENALINE EDITION (V17)
 * Made by The Solanki Visions
 * Features: Nitro Boost, Parallax, Speed Lines, Juice
 */

/* =========================================
   1. CONFIGURATION & ENGINE SETTINGS
   ========================================= */
const CONFIG = {
    gravity: 0.22, // Slightly floatier for air time
    friction: 0.98,
    fps: 60,
    chunkSize: 1000,
    fuelConsumption: 0.04,
    nitroConsumption: 0.5,
    ppm: 30, // Pixels per meter
    maxSpeed: 30, // Visual cap for speed lines
};

const GAME_STATE = {
    LOADING: 0,
    MENU: 1,
    GARAGE: 2,
    PLAYING: 3,
    GAMEOVER: 4
};

// Main Game Object
const Game = {
    state: GAME_STATE.LOADING,
    canvas: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d', { alpha: false }),
    width: window.innerWidth,
    height: window.innerHeight,
    lastTime: 0,
    
    // Audio Refs
    audioMenu: document.getElementById('audio-bg-menu'),
    audioGame: document.getElementById('audio-bg-game'),

    // Gameplay Stats
    coins: 0,
    fuel: 100,
    nitro: 100,
    distance: 0,
    airTime: 0,
    stuntScore: 0,
    
    // Controls
    keys: { gas: false, brake: false, nitro: false },
    
    // Camera
    camera: { x: 0, y: 0, shake: 0 },

    // Objects
    terrain: [],
    coinsObj: [],
    fuelObj: [],
    particles: [],
};

/* =========================================
   2. DATA & ASSET MANAGEMENT
   ========================================= */
const ASSETS = {
    images: {
        'jeep': 'jeep.png',
        'bike': 'bike.png',
        'wood': 'wood.png',
        'mini_monster': 'mini_monster.png',
        'cartoon': 'cartoon.png',
        'character': 'character.png', 
        'fuel': 'fuel_can.png',
        'coin': 'coin.png'
    },
    loaded: {}
};

const VEHICLES = [
    { id: 'jeep', name: 'Classic Jeep', price: 0, speed: 0.8, weight: 1.0, img: 'jeep' },
    { id: 'bike', name: 'Dirt Bike', price: 1000, speed: 1.4, weight: 0.6, img: 'bike' },
    { id: 'wood', name: 'Wood Wagon', price: 2000, speed: 0.7, weight: 1.2, img: 'wood' },
    { id: 'mini_monster', name: 'Beast 4x4', price: 3000, speed: 1.1, weight: 1.5, img: 'mini_monster' },
    { id: 'cartoon', name: 'Pro Racer', price: 4000, speed: 1.5, weight: 0.9, img: 'cartoon' }
];

const STAGES = [
    { id: 'country', name: 'Green Hills', price: 0, roughness: 60, color: '#4b7c38', sky: '#87CEEB' },
    { id: 'moon', name: 'Moon Base', price: 1000, roughness: 40, color: '#555555', sky: '#000000' },
    { id: 'desert', name: 'Sand Dunes', price: 2000, roughness: 90, color: '#e6c229', sky: '#ffcc66' },
    { id: 'glaciers', name: 'Ice Peaks', price: 3000, roughness: 70, color: '#aaddff', sky: '#ffffff' },
    { id: 'mars', name: 'Mars', price: 4000, roughness: 120, color: '#b83b18', sky: '#ff9966' }
];

let PlayerData = {
    coins: 0,
    unlockedVehicles: ['jeep'],
    unlockedStages: ['country'],
    selectedVehicle: 'jeep',
    selectedStage: 'country'
};

/* =========================================
   3. INITIALIZATION
   ========================================= */
async function loadAssets() {
    const save = localStorage.getItem('extreme_racing_save');
    if (save) PlayerData = JSON.parse(save);

    const promises = [];
    for (let key in ASSETS.images) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.src = ASSETS.images[key];
            img.onload = () => { ASSETS.loaded[key] = img; updateLoader(); resolve(); };
            img.onerror = () => { 
                // Fallback Generator
                const c = document.createElement('canvas');
                c.width = 50; c.height = 50;
                const cx = c.getContext('2d');
                cx.fillStyle = key === 'character' ? '#ffcc00' : 'red';
                cx.fillRect(0,0,50,50);
                ASSETS.loaded[key] = c;
                updateLoader(); resolve();
            };
        }));
    }
    await Promise.all(promises);
    document.getElementById('loading-screen').classList.add('hidden');
    switchState(GAME_STATE.MENU);
}

function updateLoader() {
    const total = Object.keys(ASSETS.images).length;
    const loaded = Object.keys(ASSETS.loaded).length; // Rough count logic
    const pct = (loaded / total) * 100; // Simplified for demo
    document.getElementById('loader-fill').style.width = '100%';
}

/* =========================================
   4. PHYSICS ENGINE (V17 - Fun Tuned)
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
        this.width = 90;
        this.height = 45;
        this.onGround = false;
        
        // Visual offsets for suspension juice
        this.chassisY = 0;
        
        // Driver
        this.headX = 0; 
        this.headY = -30; 
        this.headRadius = 14;
        this.driverDead = false;
    }

    update(dt) {
        if (this.driverDead) return;

        const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
        // Gravity (Less on moon)
        const gMult = stage.id === 'moon' ? 0.4 : (stage.id === 'mars' ? 0.8 : 1.0);
        this.vy += CONFIG.gravity * gMult * this.weight;

        // --- INPUT HANDLING ---
        if (Game.fuel > 0) {
            // Gas
            if (Game.keys.gas) {
                if (this.onGround) {
                    this.vx += 0.3 * this.speed; // Snappier accel
                    this.chassisY = 2; // Squat down visually
                    spawnParticles(this.x - 35, this.y + 20, '#aaa', 'dust');
                } else {
                    this.vr -= 0.06; // Air rotation
                }
                Game.fuel -= CONFIG.fuelConsumption;
            }
            
            // Brake/Reverse
            if (Game.keys.brake) {
                if (this.onGround) {
                    this.vx -= 0.3 * this.speed;
                    this.chassisY = -1; // Nose dive visually
                } else {
                    this.vr += 0.06;
                }
            }

            // NITRO (New!)
            if (Game.keys.nitro && Game.nitro > 0) {
                if (this.onGround) this.vx += 0.5; // Huge ground boost
                else this.vx += 0.2; // Air thrust
                
                Game.nitro -= CONFIG.nitroConsumption;
                spawnParticles(this.x - 45, this.y, '#00f3ff', 'flame'); // Blue flame
                addScreenShake(1); // Rumble
            }
        }

        // Friction & Drag
        this.vx *= CONFIG.friction;
        this.vr *= 0.92; // Strong angular drag for control
        this.chassisY *= 0.8; // Return to neutral suspension

        // Move
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.vr;

        this.checkCollisions();
        
        // Update Game Data
        if (this.x / CONFIG.ppm > Game.distance) {
            Game.distance = Math.floor(this.x / CONFIG.ppm);
        }
        
        // Nitro Regen (Slowly)
        if (!Game.keys.nitro && Game.nitro < 100) Game.nitro += 0.1;
    }

    checkCollisions() {
        const groundY = getTerrainHeight(this.x);
        const nextGroundY = getTerrainHeight(this.x + 45);
        const slope = Math.atan2(nextGroundY - groundY, 45);
        const carBottom = this.y + 25;

        // Ground Hit
        if (carBottom >= groundY) {
            // Impact Juice
            if (!this.onGround && this.vy > 6) {
                addScreenShake(this.vy * 1.5);
                spawnParticles(this.x, this.y + 25, '#888', 'dust');
                // Suspension visual bounce
                this.chassisY = 5; 
            }

            this.onGround = true;
            this.y = groundY - 25;
            this.vy = 0;
            
            // Align Rotation to Slope (Smoothly)
            const angleDiff = slope - this.rotation;
            this.vr += angleDiff * 0.2; 
            
            // Friction
            this.vx *= 0.98;
        } else {
            this.onGround = false;
            Game.airTime++;
        }

        // Head Collision (Game Over)
        const rad = this.rotation;
        const hx = this.x + (this.headX * Math.cos(rad) - this.headY * Math.sin(rad));
        const hy = this.y + (this.headX * Math.sin(rad) + this.headY * Math.cos(rad));
        
        if (hy + 15 >= getTerrainHeight(hx)) {
            addScreenShake(20);
            triggerGameOver("HEAD TRAUMA");
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.camera.x, this.y - Game.camera.y + this.chassisY);
        ctx.rotate(this.rotation);
        
        // Draw Car
        const img = ASSETS.loaded[PlayerData.selectedVehicle];
        ctx.drawImage(img, -this.width/2, -this.height/2, this.width, this.height);
        
        // Draw Driver (With physics lean)
        const lean = this.vx * 0.05;
        ctx.save();
        ctx.translate(this.headX, this.headY);
        ctx.rotate(lean);
        const dImg = ASSETS.loaded['character'];
        ctx.drawImage(dImg, -20, -20, 40, 40);
        ctx.restore();

        ctx.restore();
    }
}

/* =========================================
   5. PARTICLE SYSTEM (JUICE)
   ========================================= */
class Particle {
    constructor(x, y, color, type) {
        this.x = x; this.y = y;
        this.color = color;
        this.type = type;
        this.life = 1.0;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        
        if (type === 'flame') {
            this.vx = -5 - Math.random() * 5; // Shoot back
            this.size = 10;
            this.decay = 0.1;
        } else {
            this.size = Math.random() * 5 + 2;
            this.decay = 0.02;
        }
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
        this.size *= 0.9;
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

function spawnParticles(x, y, color, type) {
    const count = type === 'flame' ? 2 : 5;
    for(let i=0; i<count; i++) {
        Game.particles.push(new Particle(x, y, color, type));
    }
}

/* =========================================
   6. TERRAIN & OBJECTS
   ========================================= */
function getTerrainHeight(x) {
    if (Game.terrain.length === 0) return Game.height - 100;
    const seg = 50; // Segment width
    const idx = Math.floor(x / seg);
    if (idx < 0) return Game.terrain[0];
    if (idx >= Game.terrain.length - 1) return Game.terrain[Game.terrain.length-1];
    
    const t = (x % seg) / seg;
    return Game.terrain[idx] + t * (Game.terrain[idx+1] - Game.terrain[idx]);
}

function generateChunk(startIdx, count) {
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    let prevY = Game.terrain.length > 0 ? Game.terrain[Game.terrain.length-1] : Game.height - 150;
    
    for(let i=0; i<count; i++) {
        // Advanced Generation: Mix of Perlin-ish noise + Ramps
        const step = startIdx + i;
        
        // Random Ramp Logic (Every 100 steps)
        if (step % 100 > 90) {
            prevY -= 15; // Build steep ramp up
        } else if (step % 100 === 0) {
            prevY += 100; // Drop after ramp
        } else {
            // Normal Noise
            const noise = Math.sin(step * 0.1) * 2 + Math.cos(step * 0.05) * 5;
            prevY += (Math.random() - 0.5) * (stage.roughness / 5) + noise;
        }

        // Clamp
        if (prevY > Game.height - 50) prevY = Game.height - 50;
        if (prevY < 200) prevY = 200;
        
        Game.terrain.push(prevY);
        
        // Spawn Items
        if (Math.random() < 0.3) Game.coinsObj.push({x: step*50, y: prevY - 50, c: false});
        if (Math.random() < 0.02) Game.fuelObj.push({x: step*50, y: prevY - 50, c: false});
    }
}

/* =========================================
   7. CORE LOOP & CAMERA
   ========================================= */
let car;

function startGame() {
    Game.state = GAME_STATE.PLAYING;
    Game.score = 0; Game.coins = 0;
    Game.fuel = 100; Game.nitro = 100;
    Game.distance = 0; Game.airTime = 0;
    Game.terrain = []; Game.coinsObj = []; Game.fuelObj = [];
    Game.particles = [];
    
    // Reset Audio
    try {
        Game.audioMenu.pause();
        Game.audioGame.currentTime = 0;
        Game.audioGame.play();
    } catch(e) {}

    generateChunk(0, 50);
    car = new CarPhysics(PlayerData.selectedVehicle);
    
    // UI Hiding
    ['menu-screen', 'garage-screen', 'report-screen'].forEach(id => 
        document.getElementById(id).classList.add('hidden'));
    document.getElementById('hud-screen').classList.remove('hidden');
    
    requestAnimationFrame(loop);
}

function addScreenShake(amount) {
    Game.camera.shake = amount;
}

function loop() {
    if (Game.state !== GAME_STATE.PLAYING) return;

    // 1. Physics
    car.update();
    
    // 2. Camera (Smooth Follow + Shake)
    const targetX = car.x - Game.width / 3;
    const targetY = car.y - Game.height / 1.5;
    
    Game.camera.x += (targetX - Game.camera.x) * 0.1;
    Game.camera.y += (targetY - Game.camera.y) * 0.1;
    
    // Shake Effect
    if (Game.camera.shake > 0) {
        Game.camera.x += (Math.random() - 0.5) * Game.camera.shake;
        Game.camera.y += (Math.random() - 0.5) * Game.camera.shake;
        Game.camera.shake *= 0.9;
        if (Game.camera.shake < 0.5) Game.camera.shake = 0;
    }

    // 3. Speed Lines (Canvas Overlay)
    drawSpeedLines(car.vx);

    // 4. Parallax Backgrounds
    const p1 = document.getElementById('bg-layer-1');
    const p2 = document.getElementById('bg-layer-2');
    p1.style.backgroundPositionX = `${-Game.camera.x * 0.1}px`;
    p2.style.backgroundPositionX = `${-Game.camera.x * 0.3}px`;

    // 5. Terrain Gen & Cleanup
    const edge = Math.floor((Game.camera.x + Game.width + 500) / 50);
    if (edge > Game.terrain.length) generateChunk(Game.terrain.length, 20);

    // 6. Logic
    checkCollectibles();
    
    // 7. Particles
    for(let i=Game.particles.length-1; i>=0; i--) {
        Game.particles[i].update();
        if(Game.particles[i].life <= 0) Game.particles.splice(i,1);
    }

    render();
    updateHUD();

    if (Game.fuel <= 0 && Math.abs(car.vx) < 0.1) triggerGameOver("OUT OF FUEL");

    requestAnimationFrame(loop);
}

// Speed Lines Effect
const slCanvas = document.getElementById('speed-lines');
const slCtx = slCanvas.getContext('2d');
slCanvas.width = window.innerWidth; slCanvas.height = window.innerHeight;

function drawSpeedLines(speed) {
    slCtx.clearRect(0,0,slCanvas.width, slCanvas.height);
    if (speed > 15) { // Threshold for effect
        slCtx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        slCtx.lineWidth = 2;
        slCtx.beginPath();
        for(let i=0; i<10; i++) {
            const y = Math.random() * slCanvas.height;
            const len = Math.random() * 100 + 50;
            slCtx.moveTo(slCanvas.width, y);
            slCtx.lineTo(slCanvas.width - len, y);
        }
        slCtx.stroke();
    }
}

/* =========================================
   8. RENDERING
   ========================================= */
function render() {
    const ctx = Game.ctx;
    ctx.clearRect(0,0,Game.width, Game.height);
    
    // Sky
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    ctx.fillStyle = stage.sky;
    ctx.fillRect(0,0,Game.width, Game.height);

    // Terrain
    ctx.fillStyle = stage.color;
    ctx.beginPath();
    const start = Math.floor(Game.camera.x / 50);
    const end = start + Math.ceil(Game.width/50) + 2;
    
    if (Game.terrain[start] !== undefined) {
        ctx.moveTo(start*50 - Game.camera.x, Game.terrain[start] - Game.camera.y);
        for(let i=start; i<=end; i++) {
            if(Game.terrain[i] !== undefined)
                ctx.lineTo(i*50 - Game.camera.x, Game.terrain[i] - Game.camera.y);
        }
        ctx.lineTo(end*50 - Game.camera.x, Game.height);
        ctx.lineTo(start*50 - Game.camera.x, Game.height);
        ctx.fill();
    }

    // Items
    Game.coinsObj.forEach(c => {
        if(!c.c) ctx.drawImage(ASSETS.loaded['coin'], c.x - 15 - Game.camera.x, c.y - 15 - Game.camera.y, 30, 30);
    });
    
    Game.fuelObj.forEach(f => {
        if(!f.c) ctx.drawImage(ASSETS.loaded['fuel'], f.x - 15 - Game.camera.x, f.y - 20 - Game.camera.y, 30, 40);
    });

    // Particles
    Game.particles.forEach(p => p.draw(ctx));

    // Car
    car.draw(ctx);
}

function checkCollectibles() {
    Game.coinsObj.forEach(c => {
        if (!c.c && (c.x - car.x)**2 + (c.y - car.y)**2 < 2500) {
            c.c = true; Game.coins++; spawnParticles(c.x, c.y, 'gold', 'sparkle');
            showPopupText("+1", c.x, c.y);
        }
    });
    Game.fuelObj.forEach(f => {
        if (!f.c && (f.x - car.x)**2 + (f.y - car.y)**2 < 2500) {
            f.c = true; Game.fuel = 100; spawnParticles(f.x, f.y, 'red', 'sparkle');
            showPopupText("FUEL", f.x, f.y);
        }
    });
}

function showPopupText(text, x, y) {
    // Simple DOM based popup for performance
    const div = document.createElement('div');
    div.innerText = text;
    div.className = 'popup-text';
    document.getElementById('hud-screen').appendChild(div);
    setTimeout(() => div.remove(), 1000);
}

function updateHUD() {
    document.getElementById('dist-display').innerText = Game.distance;
    document.getElementById('session-coins').innerText = Game.coins;
    document.getElementById('fuel-fill').style.width = `${Math.max(0, Game.fuel)}%`;
    document.getElementById('nitro-fill').style.width = `${Math.max(0, Game.nitro)}%`;
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
    
    setTimeout(() => {
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.remove('hidden');
    }, 1000);
}

// Button Logic
function populateGarage() {
    // Re-use logic from previous versions, kept simple here for brevity
    // But ensure the "Select" logic works
    document.getElementById('garage-coins').innerText = PlayerData.coins;
    const vList = document.getElementById('vehicle-list');
    vList.innerHTML = '';
    VEHICLES.forEach(v => {
        const d = document.createElement('div');
        const owned = PlayerData.unlockedVehicles.includes(v.id);
        const sel = PlayerData.selectedVehicle === v.id;
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.innerHTML = `<div><h4>${v.name}</h4>${owned?'OWNED':v.price+' 🪙'}</div><img src="${ASSETS.images[v.img].src}">`;
        d.onclick = () => {
            if(owned) { PlayerData.selectedVehicle = v.id; } 
            else if(PlayerData.coins >= v.price) {
                PlayerData.coins -= v.price; PlayerData.unlockedVehicles.push(v.id); PlayerData.selectedVehicle = v.id;
            }
            populateGarage();
            localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
        };
        vList.appendChild(d);
    });
    // Similar logic for Stages...
    const sList = document.getElementById('stage-list');
    sList.innerHTML = '';
    STAGES.forEach(s => {
        const d = document.createElement('div');
        const owned = PlayerData.unlockedStages.includes(s.id);
        const sel = PlayerData.selectedStage === s.id;
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.style.background = s.color;
        d.innerHTML = `<div><h4>${s.name}</h4>${owned?'OWNED':s.price+' 🪙'}</div>`;
        d.onclick = () => {
            if(owned) { PlayerData.selectedStage = s.id; }
            else if(PlayerData.coins >= s.price) {
                PlayerData.coins -= s.price; PlayerData.unlockedStages.push(s.id); PlayerData.selectedStage = s.id;
            }
            populateGarage();
            localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
        };
        sList.appendChild(d);
    });
}

function switchState(s) {
    ['menu-screen', 'garage-screen', 'report-screen'].forEach(id => document.getElementById(id).classList.add('hidden'));
    if(s === GAME_STATE.MENU) {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-total-coins').innerText = PlayerData.coins;
        Game.audioGame.pause(); Game.audioMenu.play().catch(()=>{});
    }
    if(s === GAME_STATE.GARAGE) {
        document.getElementById('garage-screen').classList.remove('hidden');
        populateGarage();
    }
}

// Listeners
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

bGas.addEventListener('touchstart', e=>{ e.preventDefault(); Game.keys.gas=true; });
bGas.addEventListener('touchend', e=>{ e.preventDefault(); Game.keys.gas=false; });
bBrake.addEventListener('touchstart', e=>{ e.preventDefault(); Game.keys.brake=true; });
bBrake.addEventListener('touchend', e=>{ e.preventDefault(); Game.keys.brake=false; });
bNitro.addEventListener('touchstart', e=>{ e.preventDefault(); Game.keys.nitro=true; });
bNitro.addEventListener('touchend', e=>{ e.preventDefault(); Game.keys.nitro=false; });

document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-garage').onclick = () => switchState(GAME_STATE.GARAGE);
document.getElementById('btn-back-menu').onclick = () => switchState(GAME_STATE.MENU);
document.getElementById('btn-menu-return').onclick = () => switchState(GAME_STATE.MENU);
document.getElementById('btn-restart').onclick = startGame;

window.onload = () => {
    window.dispatchEvent(new Event('resize'));
    loadAssets();
}
