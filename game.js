/**
 * EXTREME RACING - GAME ENGINE
 * Made by The Solanki Visions
 * Version 1.0 (Zero-Lag Edition)
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
    renderDistance: 2000, // Load terrain ahead
    deleteDistance: 1000, // Delete terrain behind
    fuelConsumption: 0.05, // Per frame
    stuntThreshold: 250, // Frames in air for airtime
    ppm: 30 // Pixels per meter (visual scale)
};

const GAME_STATE = {
    LOADING: 0,
    MENU: 1,
    GARAGE: 2,
    PLAYING: 3,
    GAMEOVER: 4
};

// Singleton Game Object
const Game = {
    state: GAME_STATE.LOADING,
    canvas: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d', { alpha: false }), // Optimize for speed
    width: window.innerWidth,
    height: window.innerHeight,
    lastTime: 0,
    accumulator: 0,
    
    // Audio Elements
    audioMenu: document.getElementById('audio-bg-menu'),
    audioGame: document.getElementById('audio-bg-game'),

    // Gameplay Data
    score: 0,
    coins: 0,
    fuel: 100,
    distance: 0,
    airTime: 0,
    flips: { front: 0, back: 0 },
    
    // Inputs
    keys: { gas: false, brake: false },
    
    // Camera
    camera: { x: 0, y: 0 },

    // Dynamic Objects
    terrain: [],
    coinsObj: [],
    fuelObj: [],
    particles: [],
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
        'driver': 'driver_head.png', // Fallback or draw procedural
        'fuel': 'fuel_can.png',      // Fallback
        'coin': 'coin.png'           // Fallback
    },
    loaded: {}
};

// Vehicle Definitions
const VEHICLES = [
    { id: 'jeep', name: 'Classic Jeep', price: 0, speed: 0.8, weight: 1.0, img: 'jeep' },
    { id: 'bike', name: 'Dirt Bike', price: 1000, speed: 1.2, weight: 0.6, img: 'bike' },
    { id: 'wood', name: 'Wood Wagon', price: 2000, speed: 0.7, weight: 1.2, img: 'wood' },
    { id: 'mini_monster', name: 'Mini Monster', price: 3000, speed: 1.0, weight: 1.5, img: 'mini_monster' },
    { id: 'cartoon', name: 'Toon Racer', price: 4000, speed: 1.3, weight: 0.9, img: 'cartoon' }
];

// Stage Definitions (Procedural Params)
const STAGES = [
    { id: 'country', name: 'Country Side', price: 0, roughness: 50, gravityMult: 1.0, color: '#4b7c38', sky: '#87CEEB' },
    { id: 'moon', name: 'The Moon', price: 1000, roughness: 30, gravityMult: 0.4, color: '#888888', sky: '#000000' },
    { id: 'desert', name: 'Sahara', price: 2000, roughness: 80, gravityMult: 1.0, color: '#e6c229', sky: '#ffcc66' },
    { id: 'glaciers', name: 'Glaciers', price: 3000, roughness: 60, gravityMult: 1.1, color: '#aaddff', sky: '#ffffff' },
    { id: 'mars', name: 'Mars Base', price: 4000, roughness: 100, gravityMult: 0.9, color: '#b83b18', sky: '#ff9966' }
];

// Player Save Data
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
    // Load Save Data
    const save = localStorage.getItem('extreme_racing_save');
    if (save) PlayerData = JSON.parse(save);

    const promises = [];
    
    // Load Images
    for (let key in ASSETS.images) {
        promises.push(new Promise((resolve) => {
            const img = new Image();
            img.src = ASSETS.images[key];
            // Since we don't have the actual files, we generate placeholders if error
            img.onload = () => {
                ASSETS.loaded[key] = img;
                updateLoader();
                resolve();
            };
            img.onerror = () => {
                // Generate a colored rectangle as placeholder
                const canvas = document.createElement('canvas');
                canvas.width = 100; canvas.height = 50;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = key === 'coin' ? 'gold' : 'red';
                ctx.fillRect(0,0,100,50);
                ASSETS.loaded[key] = canvas; // Use canvas as image source
                updateLoader();
                resolve();
            };
        }));
    }

    await Promise.all(promises);
    
    // Complete Loading
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
   4. PHYSICS ENGINE (Custom Raycast)
   ========================================= */
class CarPhysics {
    constructor(type) {
        const stats = VEHICLES.find(v => v.id === type);
        this.x = 200;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        this.rotation = 0;
        this.vr = 0; // Rotational velocity
        
        // Stats
        this.speed = stats.speed;
        this.weight = stats.weight;
        
        // Suspension logic
        this.width = 80;
        this.height = 40;
        this.onGround = false;
        
        // Driver Head (Relative to car center)
        this.headX = 0; 
        this.headY = -30; 
        this.headRadius = 10;
        this.driverDead = false;
    }

    update(dt) {
        if (this.driverDead) return;

        // Apply Gravity
        const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
        this.vy += CONFIG.gravity * stage.gravityMult * this.weight;

        // Apply Input Forces
        if (Game.fuel > 0) {
            if (Game.keys.gas) {
                // Accelerate
                if (this.onGround) this.vx += 0.2 * this.speed;
                // Rotate in air (Backflip logic)
                else this.vr -= 0.05;
                
                Game.fuel -= CONFIG.fuelConsumption;
            }
            if (Game.keys.brake) {
                // Decelerate / Reverse
                if (this.onGround) this.vx -= 0.2 * this.speed;
                // Rotate in air (Frontflip logic)
                else this.vr += 0.05;
            }
        }

        // Apply Friction/Air Resistance
        this.vx *= CONFIG.friction;
        this.vr *= 0.95; // Angular drag

        // Update Position
        this.x += this.vx;
        this.y += this.vy;
        this.rotation += this.vr;

        // Terrain Collision (Raycast Style)
        this.checkTerrainCollision();
        
        // Update Stats
        if (this.x / CONFIG.ppm > Game.distance) {
            Game.distance = Math.floor(this.x / CONFIG.ppm);
        }
    }

    checkTerrainCollision() {
        // Find terrain height at Car X
        const groundY = getTerrainHeight(this.x);
        const nextGroundY = getTerrainHeight(this.x + 40); // Forward check for slope
        
        // Calculate slope angle
        const slope = Math.atan2(nextGroundY - groundY, 40);

        // Wheel collision (simplified as box bottom)
        const carBottom = this.y + 20; // Approx half height

        if (carBottom >= groundY) {
            this.onGround = true;
            this.y = groundY - 20; // Snap to ground
            this.vy = 0;
            
            // Match rotation to slope smoothly (Suspension visual)
            const angleDiff = slope - this.rotation;
            this.vr += angleDiff * 0.1; // Spring force for rotation
            
            // Friction
            this.vx *= 0.98;
        } else {
            this.onGround = false;
            Game.airTime++;
        }

        // DRIVER HEAD COLLISION (GAME OVER TRIGGER)
        // Calculate global position of head
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        
        // Transform local head pos to global
        const gx = this.x + (this.headX * cos - this.headY * sin);
        const gy = this.y + (this.headX * sin + this.headY * cos);
        
        const headGround = getTerrainHeight(gx);
        
        if (gy + this.headRadius >= headGround) {
            triggerGameOver("HEAD INJURY");
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.camera.x, this.y - Game.camera.y);
        ctx.rotate(this.rotation);
        
        // Draw Car Sprite
        const img = ASSETS.loaded[PlayerData.selectedVehicle];
        // Draw centered
        ctx.drawImage(img, -this.width/2, -this.height/2, this.width, this.height);
        
        // Draw Driver (Cartoon Man)
        ctx.fillStyle = "#ffcc00"; // Helmet color
        ctx.beginPath();
        // Physics reactive head bob
        const bob = Math.sin(Date.now() / 100) * 2; 
        ctx.arc(this.headX, this.headY + bob, this.headRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }
}

// Procedural Terrain Generator
function getTerrainHeight(x) {
    if (Game.terrain.length === 0) return Game.height - 100;
    
    // Find segment
    const segmentWidth = 50;
    const index = Math.floor(x / segmentWidth);
    
    if (index < 0) return Game.terrain[0];
    if (index >= Game.terrain.length - 1) return Game.terrain[Game.terrain.length - 1];
    
    const t = (x % segmentWidth) / segmentWidth;
    const y1 = Game.terrain[index];
    const y2 = Game.terrain[index + 1];
    
    // Linear interpolation
    return y1 + t * (y2 - y1);
}

function generateTerrainChunk(startIndex, count) {
    const stage = STAGES.find(s => s.id === PlayerData.selectedStage);
    let prevY = Game.terrain.length > 0 ? Game.terrain[Game.terrain.length - 1] : Game.height - 150;
    
    for (let i = 0; i < count; i++) {
        // Noise generation
        const noise = Math.sin((startIndex + i) * 0.1) + Math.sin((startIndex + i) * 0.03) * 2;
        const delta = noise * stage.roughness;
        let newY = prevY + delta;
        
        // Clamp logic to keep within screen reasonable bounds relative to base
        if (newY > Game.height - 50) newY = Game.height - 50;
        if (newY < 200) newY = 200;
        
        Game.terrain.push(newY);
        prevY = newY;
        
        // Spawn Objects (Coins/Fuel)
        const realX = (Game.terrain.length - 1) * 50;
        spawnCollectibles(realX, newY);
    }
}

function spawnCollectibles(x, y) {
    // High spawn rate early (First 500m = 15000px)
    let chance = x < 15000 ? 0.4 : 0.1;
    
    if (Math.random() < chance) {
        Game.coinsObj.push({ x: x, y: y - 40, collected: false });
    }
    
    // Fuel every ~300 meters
    if (Math.random() < 0.02) {
        Game.fuelObj.push({ x: x, y: y - 40, collected: false });
    }
}

/* =========================================
   5. GAME LOOP & LOGIC
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
    
    // Audio
    try {
        Game.audioMenu.pause();
        Game.audioGame.currentTime = 0;
        Game.audioGame.play();
    } catch(e) { console.log("Audio requires interaction"); }

    // Init Logic
    generateTerrainChunk(0, 50); // Start platform
    car = new CarPhysics(PlayerData.selectedVehicle);
    
    // UI
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('garage-screen').classList.add('hidden');
    document.getElementById('report-screen').classList.add('hidden');
    document.getElementById('hud-screen').classList.remove('hidden');
    
    requestAnimationFrame(loop);
}

function loop(timestamp) {
    if (Game.state !== GAME_STATE.PLAYING) return;

    // Delta Time
    const dt = timestamp - Game.lastTime;
    Game.lastTime = timestamp;

    // 1. Update Physics
    car.update(dt);
    
    // 2. Camera Follow
    Game.camera.x = car.x - Game.width / 3; // Keep car on left side
    // Smooth Y camera
    // Game.camera.y += (car.y - Game.height/2 - Game.camera.y) * 0.1;
    Game.camera.y = car.y - Game.height / 1.5; 

    // 3. Terrain Management
    const rightEdgeIndex = Math.floor((Game.camera.x + Game.width + 500) / 50);
    if (rightEdgeIndex > Game.terrain.length) {
        generateTerrainChunk(Game.terrain.length, 20);
    }
    
    // Memory Management (Delete old)
    if (Game.terrain.length > 500) {
        // We actually can't easily shift terrain array because indexes rely on X position.
        // Instead, we just let it grow for simplicity in JS, or use a sparse object.
        // For this demo, array growth up to a few thousand is fine for memory.
    }

    // 4. Collectibles
    checkCollectibles();

    // 5. Render
    render();
    
    // 6. HUD Update
    updateHUD();

    // 7. Check Fuel Death
    if (Game.fuel <= 0 && Math.abs(car.vx) < 0.1) {
        triggerGameOver("OUT OF FUEL");
    }

    requestAnimationFrame(loop);
}

function checkCollectibles() {
    // Coins
    Game.coinsObj.forEach(c => {
        if (!c.collected) {
            const dx = c.x - car.x;
            const dy = c.y - car.y;
            if (dx*dx + dy*dy < 2500) { // Distance squared < 50^2
                c.collected = true;
                Game.coins++;
                // Add sound effect here if available
            }
        }
    });
    
    // Fuel
    Game.fuelObj.forEach(f => {
        if (!f.collected) {
            const dx = f.x - car.x;
            const dy = f.y - car.y;
            if (dx*dx + dy*dy < 2500) {
                f.collected = true;
                Game.fuel = 100; // Refill
            }
        }
    });
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

    // Draw Collectibles
    ctx.font = "20px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    Game.coinsObj.forEach(c => {
        if (!c.collected && c.x > Game.camera.x && c.x < Game.camera.x + Game.width) {
            ctx.fillText("🪙", c.x - Game.camera.x, c.y - Game.camera.y);
        }
    });
    
    Game.fuelObj.forEach(f => {
        if (!f.collected && f.x > Game.camera.x && f.x < Game.camera.x + Game.width) {
            ctx.fillStyle = "red";
            ctx.fillRect(f.x - 10 - Game.camera.x, f.y - 15 - Game.camera.y, 20, 30);
            ctx.fillStyle = "white";
            ctx.fillText("F", f.x - Game.camera.x, f.y - Game.camera.y);
        }
    });

    // Draw Car
    car.draw(ctx);
}

function updateHUD() {
    document.getElementById('dist-display').innerText = `${Game.distance}m`;
    document.getElementById('session-coins').innerText = Game.coins;
    document.getElementById('fuel-fill').style.width = `${Math.max(0, Game.fuel)}%`;
}

/* =========================================
   6. STATE MANAGEMENT & UI LOGIC
   ========================================= */
function switchState(newState) {
    document.querySelectorAll('.hidden').forEach(el => {
        // Keep hidden classes unless specific ID
    });
    
    // Simple Router
    if (newState === GAME_STATE.MENU) {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-total-coins').innerText = PlayerData.coins;
        // Audio
        Game.audioGame.pause();
        Game.audioMenu.play().catch(e=>{});
    }
    else if (newState === GAME_STATE.GARAGE) {
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('garage-screen').classList.remove('hidden');
        populateGarage();
    }
}

function triggerGameOver(reason) {
    Game.state = GAME_STATE.GAMEOVER;
    car.driverDead = true;
    
    Game.audioGame.pause();
    
    // Save Data
    PlayerData.coins += Game.coins;
    localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
    
    // Update Report UI
    document.getElementById('fail-reason').innerText = reason;
    document.getElementById('rep-distance').innerText = `${Game.distance}m`;
    document.getElementById('rep-coins').innerText = Game.coins;
    document.getElementById('rep-air').innerText = `${(Game.airTime / 60).toFixed(1)}s`;
    
    // Snapshot (Simple color fill for performance, ideally toDataURL)
    const snapCanvas = document.getElementById('snapshot-canvas');
    const sCtx = snapCanvas.getContext('2d');
    sCtx.fillStyle = "#333";
    sCtx.fillRect(0,0,snapCanvas.width, snapCanvas.height);
    sCtx.fillStyle = "white";
    sCtx.fillText("CRASHED", 100, 70);

    setTimeout(() => {
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.remove('hidden');
    }, 1000); // 1 sec delay to see crash
}

// Garage Logic
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
            } else {
                if (PlayerData.coins >= v.price) {
                    PlayerData.coins -= v.price;
                    PlayerData.unlockedVehicles.push(v.id);
                    PlayerData.selectedVehicle = v.id;
                    populateGarage();
                    localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
                } else {
                    alert("Not enough coins!");
                }
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
        div.style.background = s.color; // Visual hint
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
            } else {
                if (PlayerData.coins >= s.price) {
                    PlayerData.coins -= s.price;
                    PlayerData.unlockedStages.push(s.id);
                    PlayerData.selectedStage = s.id;
                    populateGarage();
                    localStorage.setItem('extreme_racing_save', JSON.stringify(PlayerData));
                }
            }
        };
        sList.appendChild(div);
    });
}

/* =========================================
   7. INPUT LISTENERS
   ========================================= */
window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') Game.keys.gas = true;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Game.keys.brake = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowRight' || e.code === 'KeyD') Game.keys.gas = false;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') Game.keys.brake = false;
});

// Touch Inputs
const btnGas = document.getElementById('btn-gas');
const btnBrake = document.getElementById('btn-brake');

btnGas.addEventListener('touchstart', (e) => { e.preventDefault(); Game.keys.gas = true; });
btnGas.addEventListener('touchend', (e) => { e.preventDefault(); Game.keys.gas = false; });

btnBrake.addEventListener('touchstart', (e) => { e.preventDefault(); Game.keys.brake = true; });
btnBrake.addEventListener('touchend', (e) => { e.preventDefault(); Game.keys.brake = false; });

// UI Buttons
document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-garage').onclick = () => switchState(GAME_STATE.GARAGE);
document.getElementById('btn-back-menu').onclick = () => switchState(GAME_STATE.MENU);
document.getElementById('btn-menu-return').onclick = () => switchState(GAME_STATE.MENU);
document.getElementById('btn-restart').onclick = startGame;

/* =========================================
   8. BOOTSTRAP
   ========================================= */
window.onload = () => {
    // Resize Handling
    window.addEventListener('resize', () => {
        Game.width = window.innerWidth;
        Game.height = window.innerHeight;
        Game.canvas.width = Game.width;
        Game.canvas.height = Game.height;
    });
    
    // Trigger Resize
    window.dispatchEvent(new Event('resize'));
    
    // Start Load
    loadAssets();
};
