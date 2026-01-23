/**
 * EXTREME RACING - ENGINE V19
 * Made by The Solanki Visions
 * Features: Dual-Point Physics, Instant Response, Zero-Float, Asset Check
 */

/* ==========================================================================
   1. CONSTANTS & CONFIG
   ========================================================================== */
const CONFIG = {
    gravity: 0.6, // BOOSTED: Makes car heavy so it doesn't float
    friction: 0.96,
    speedPower: 0.5, // BOOSTED: More torque
    chunkSize: 1000,
    renderDist: 2000,
    ppm: 30, // Pixels per meter
    maxTilt: 1.2 // Radian limit to prevent crazy spinning
};

const STATE = { LOAD: 0, MENU: 1, GARAGE: 2, PLAY: 3, OVER: 4 };

// Main Game Instance
const Game = {
    s: STATE.LOAD, // Current State
    cvs: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d', { alpha: false }),
    w: window.innerWidth,
    h: window.innerHeight,
    
    // Audio
    music: document.getElementById('audio-bg-game'),
    menuMusic: document.getElementById('audio-bg-menu'),

    // Variables
    score: 0, coins: 0, fuel: 100, nitro: 100, dist: 0,
    keys: { gas: false, brake: false, nitro: false },
    camera: { x: 0, y: 0, shake: 0 },
    
    // Objects
    terrain: [], coinsObj: [], fuelObj: [], particles: [],
    
    // Time
    lastTime: 0,
    timeScale: 1.0
};

/* ==========================================================================
   2. ASSET LOADER (WITH ERROR HANDLERS)
   ========================================================================== */
const ASSETS = {
    // Note: Ensure these files exist in your folder!
    src: {
        'jeep': 'jeep.png',
        'bike': 'bike.png',
        'wood': 'wood.png',
        'mini_monster': 'mini_monster.png',
        'cartoon': 'cartoon.png',
        'character': 'character.png', 
        'coin': 'coin.png',
        'fuel': 'fuel_can.png'
    },
    img: {}
};

// Player Data
let User = { coins: 0, vehicles: ['jeep'], stages: ['country'], curVeh: 'jeep', curStg: 'country' };

// Vehicle Stats
const CARS = [
    { id: 'jeep', name: 'Jeep', price: 0, speed: 1.0, weight: 1.0, w: 90 },
    { id: 'bike', name: 'Moto', price: 1000, speed: 1.4, weight: 0.7, w: 70 },
    { id: 'wood', name: 'Wagon', price: 2000, speed: 0.8, weight: 1.2, w: 95 },
    { id: 'mini_monster', name: 'Monster', price: 3000, speed: 1.1, weight: 1.4, w: 100 },
    { id: 'cartoon', name: 'F1 Toon', price: 4000, speed: 1.5, weight: 0.8, w: 85 }
];

// Stages
const LEVELS = [
    { id: 'country', name: 'Hills', price: 0, rough: 40, col: '#4b7c38', sky: '#87CEEB' },
    { id: 'moon', name: 'Moon', price: 1000, rough: 30, col: '#555', sky: '#000' },
    { id: 'desert', name: 'Sand', price: 2000, rough: 60, col: '#e6c229', sky: '#ffcc66' },
    { id: 'mars', name: 'Mars', price: 4000, rough: 80, col: '#b83b18', sky: '#ff9966' }
];

async function initSystem() {
    const saved = localStorage.getItem('er_save');
    if (saved) User = JSON.parse(saved);

    const loadP = [];
    for (let k in ASSETS.src) {
        loadP.push(new Promise(r => {
            const i = new Image();
            i.src = ASSETS.src[k];
            i.onload = () => { ASSETS.img[k] = i; updateLoadBar(); r(); };
            i.onerror = () => { 
                // Fallback: Create a colored rect so game doesn't break
                const c = document.createElement('canvas'); c.width=50; c.height=50;
                const x = c.getContext('2d'); x.fillStyle = 'red'; x.fillRect(0,0,50,50);
                ASSETS.img[k] = c; updateLoadBar(); r(); 
            };
        }));
    }
    await Promise.all(loadP);
    document.getElementById('loading-screen').classList.add('hidden');
    changeState(STATE.MENU);
}

function updateLoadBar() {
    const t = Object.keys(ASSETS.src).length;
    const l = Object.keys(ASSETS.img).length;
    document.getElementById('loader-fill').style.width = (l/t)*100 + "%";
}

/* ==========================================================================
   3. PHYSICS ENGINE (THE FIX)
   ========================================================================== */
class PhysicsCar {
    constructor(type) {
        const data = CARS.find(c => c.id === type);
        this.w = data.w;
        this.h = this.w / 2;
        
        // Physics
        this.x = 200; 
        this.y = -500; // Start high to drop
        this.vx = 0; this.vy = 0;
        this.ang = 0; this.va = 0;
        
        // Stats
        this.power = data.speed;
        this.mass = data.weight;
        this.grounded = false;
        
        // Driver
        this.dead = false;
        this.headOffset = {x: 0, y: -20};
    }

    tick() {
        if (this.dead) return;

        // 1. Gravity
        const stage = LEVELS.find(l => l.id === User.curStg);
        const g = (stage.id === 'moon' ? 0.2 : CONFIG.gravity) * Game.timeScale;
        this.vy += g * this.mass;

        // 2. Input
        if (Game.fuel > 0) {
            if (Game.keys.gas) {
                if (this.grounded) {
                    this.vx += (CONFIG.speedPower * this.power) * Game.timeScale;
                    // Visual feedback
                    this.ang -= 0.02 * Game.timeScale; // Wheelie effect
                    createPart(this.x - 30, this.y + 20, '#aaa', 1); // Dust
                } else {
                    this.va -= 0.005 * Game.timeScale; // Air rotation
                }
                Game.fuel -= 0.05 * Game.timeScale;
            }
            if (Game.keys.brake) {
                if (this.grounded) this.vx -= (CONFIG.speedPower * 0.8) * Game.timeScale;
                else this.va += 0.005 * Game.timeScale;
            }
            if (Game.keys.nitro && Game.nitro > 0) {
                this.vx += (this.grounded ? 1.0 : 0.4) * Game.timeScale;
                Game.nitro -= 0.5 * Game.timeScale;
                createPart(this.x - 40, this.y, '#00f3ff', 2); // Flame
                shakeCam(2);
            }
        }

        // 3. Friction
        this.vx *= CONFIG.friction;
        this.va *= 0.95;

        // 4. Move
        this.x += this.vx * Game.timeScale;
        this.y += this.vy * Game.timeScale;
        this.ang += this.va * Game.timeScale;

        // 5. TERRAIN RESOLUTION (The anti-float logic)
        this.resolveTerrain();

        // 6. Stats
        if(this.x/CONFIG.ppm > Game.dist) Game.dist = Math.floor(this.x/CONFIG.ppm);
    }

    resolveTerrain() {
        // Dual Raycast Points (Front & Back Wheels)
        const wheelOff = this.w * 0.35;
        const cos = Math.cos(this.ang);
        const sin = Math.sin(this.ang);

        // Calculate world positions of wheels
        const fx = this.x + (wheelOff * cos); // Front X
        const rx = this.x - (wheelOff * cos); // Rear X
        
        // Get Ground Height at those X positions
        const fy = getGroundY(fx);
        const ry = getGroundY(rx);
        const cy = getGroundY(this.x); // Center ground

        // Ideal angle based on terrain slope
        const slopeAngle = Math.atan2(fy - ry, wheelOff * 2);
        
        // Car bottom Y position
        const carBot = this.y + (this.h * 0.5);

        // Check if hitting ground
        if (carBot >= cy - 5) {
            // We are on/in ground
            this.grounded = true;
            this.y = cy - (this.h * 0.5); // SNAP to ground surface
            this.vy = 0; // Stop falling
            
            // Smoothly align rotation to slope (Suspension feel)
            // Instead of snapping angle, we push angular velocity towards it
            const diff = slopeAngle - this.ang;
            this.va += diff * 0.1; 
            
            // Hard landing impact
            if (this.vy > 15) {
                shakeCam(5);
                createPart(this.x, this.y+20, '#555', 5);
            }
        } else {
            this.grounded = false;
        }

        // HEAD COLLISION CHECK
        const hx = this.x + (this.headOffset.x * cos - this.headOffset.y * sin);
        const hy = this.y + (this.headOffset.x * sin + this.headOffset.y * cos);
        if (hy >= getGroundY(hx)) {
            gameOver("HEAD SMASH");
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.camera.x, this.y - Game.camera.y);
        ctx.rotate(this.ang);
        
        // Draw Car
        if (ASSETS.img[User.curVeh]) {
            ctx.drawImage(ASSETS.img[User.curVeh], -this.w/2, -this.h/2, this.w, this.h);
        } else {
            ctx.fillStyle = 'red'; ctx.fillRect(-this.w/2, -this.h/2, this.w, this.h);
        }

        // Draw Character (Responsive Driver)
        if (ASSETS.img['character']) {
            // Head bob based on velocity
            const lean = this.vx * 0.05; 
            ctx.save();
            ctx.translate(this.headOffset.x, this.headOffset.y);
            ctx.rotate(lean);
            ctx.drawImage(ASSETS.img['character'], -15, -15, 30, 30);
            ctx.restore();
        }
        ctx.restore();
    }
}

/* ==========================================================================
   4. TERRAIN SYSTEM (SAFE SPAWN)
   ========================================================================== */
function getGroundY(x) {
    if (Game.terrain.length === 0) return Game.h - 150;
    const seg = 50; 
    const idx = Math.floor(x / seg);
    
    // Safety bounds
    if (idx < 0) return Game.terrain[0];
    if (idx >= Game.terrain.length - 1) return Game.terrain[Game.terrain.length-1];
    
    // Interpolate
    const t = (x % seg) / seg;
    const y1 = Game.terrain[idx];
    const y2 = Game.terrain[idx+1];
    return y1 + t * (y2 - y1);
}

function genTerrain(start, len) {
    const stage = LEVELS.find(l => l.id === User.curStg);
    let py = Game.terrain.length > 0 ? Game.terrain[Game.terrain.length-1] : Game.h - 200;
    
    for (let i = 0; i < len; i++) {
        const absIdx = start + i;
        let ny = py;

        // SAFE ZONE: First 30 segments (1500px) are FLAT
        if (absIdx < 30) {
            ny = Game.h - 200;
        } else {
            // Noise
            const noise = Math.sin(absIdx * 0.1) * 2 + Math.cos(absIdx * 0.05) * 5;
            ny += (Math.random() - 0.5) * (stage.rough / 3) + noise;
            
            // Constraints
            if (ny > Game.h - 50) ny = Game.h - 50;
            if (ny < 200) ny = 200;
        }
        
        Game.terrain.push(ny);
        py = ny;

        // Items (After safe zone)
        if (absIdx > 30) {
            const x = absIdx * 50;
            if (Math.random() < 0.2) Game.coinsObj.push({x: x, y: ny - 50, act: true});
            if (Math.random() < 0.03) Game.fuelObj.push({x: x, y: ny - 50, act: true});
        }
    }
}

/* ==========================================================================
   5. PARTICLE SYSTEM
   ========================================================================== */
class Particle {
    constructor(x, y, col, size) {
        this.x = x; this.y = y; this.col = col; this.size = size;
        this.life = 1.0;
        this.vx = (Math.random()-0.5)*5;
        this.vy = (Math.random()-0.5)*5;
    }
    up() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.05;
        this.size *= 0.95;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.col;
        ctx.beginPath(); ctx.arc(this.x - Game.camera.x, this.y - Game.camera.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}
function createPart(x, y, c, s) { for(let i=0; i<3; i++) Game.particles.push(new Particle(x, y, c, s)); }

/* ==========================================================================
   6. GAME LOOP
   ========================================================================== */
let player;

function startGame() {
    Game.s = STATE.PLAY;
    Game.score = 0; Game.coins = 0; Game.fuel = 100; Game.nitro = 100;
    Game.terrain = []; Game.coinsObj = []; Game.fuelObj = []; Game.particles = [];
    Game.timeScale = 1.0;
    Game.dist = 0;

    // AUDIO FIX: Played on button click
    Game.menuMusic.pause();
    Game.music.currentTime = 0;
    Game.music.play();

    // Gen Safe Terrain
    genTerrain(0, 50);
    
    // Spawn Player
    player = new PhysicsCar(User.curVeh);
    player.x = 300; 
    // Set Y explicitly to ensure it doesn't fall through
    player.y = getGroundY(300) - 100; 

    // UI
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('garage-screen').classList.add('hidden');
    document.getElementById('report-screen').classList.add('hidden');
    document.getElementById('hud-screen').classList.remove('hidden');

    requestAnimationFrame(loop);
}

function shakeCam(amt) { Game.camera.shake = amt; }

function loop(ts) {
    if (Game.s !== STATE.PLAY && Game.s !== STATE.OVER) return;

    // 1. Physics
    player.tick();

    // 2. Camera (Lerp)
    const tx = player.x - Game.w / 3;
    const ty = player.y - Game.h / 1.6;
    Game.camera.x += (tx - Game.camera.x) * 0.1;
    Game.camera.y += (ty - Game.camera.y) * 0.1;
    
    // Shake Apply
    if (Game.camera.shake > 0) {
        Game.camera.x += (Math.random()-0.5) * Game.camera.shake;
        Game.camera.y += (Math.random()-0.5) * Game.camera.shake;
        Game.camera.shake *= 0.9;
        if(Game.camera.shake < 0.5) Game.camera.shake = 0;
    }

    // 3. Terrain Gen
    const edge = Math.floor((Game.camera.x + Game.w + 500) / 50);
    if (edge > Game.terrain.length) genTerrain(Game.terrain.length, 20);

    // 4. Collectibles
    Game.coinsObj.forEach(c => {
        if (c.act && Math.hypot(c.x-player.x, c.y-player.y) < 50) {
            c.act = false; Game.coins++; createPart(c.x, c.y, 'gold', 5);
            popup("+1", c.x, c.y);
        }
    });
    Game.fuelObj.forEach(f => {
        if (f.act && Math.hypot(f.x-player.x, f.y-player.y) < 50) {
            f.act = false; Game.fuel = 100; createPart(f.x, f.y, 'red', 5);
            popup("FUEL", f.x, f.y);
        }
    });

    // 5. Render
    const ctx = Game.ctx;
    ctx.clearRect(0,0,Game.w, Game.h);
    
    // Sky
    const stg = LEVELS.find(l => l.id === User.curStg);
    ctx.fillStyle = stg.sky; ctx.fillRect(0,0,Game.w, Game.h);

    // Terrain Draw
    ctx.fillStyle = stg.col;
    ctx.beginPath();
    const sx = Math.floor(Game.camera.x/50);
    const ex = sx + Math.ceil(Game.w/50) + 2;
    if (Game.terrain[sx] !== undefined) {
        ctx.moveTo(sx*50 - Game.camera.x, Game.terrain[sx] - Game.camera.y);
        for(let i=sx; i<=ex; i++) {
            if(Game.terrain[i] !== undefined) 
                ctx.lineTo(i*50 - Game.camera.x, Game.terrain[i] - Game.camera.y);
        }
        ctx.lineTo(ex*50 - Game.camera.x, Game.h);
        ctx.lineTo(sx*50 - Game.camera.x, Game.h);
        ctx.fill();
    }

    // Items
    Game.coinsObj.forEach(c => { if(c.act) ctx.drawImage(ASSETS.img['coin'], c.x-15-Game.camera.x, c.y-15-Game.camera.y, 30, 30); });
    Game.fuelObj.forEach(f => { if(f.act) ctx.drawImage(ASSETS.img['fuel'], f.x-15-Game.camera.x, f.y-20-Game.camera.y, 30, 40); });

    // Particles
    for(let i=Game.particles.length-1; i>=0; i--) {
        let p = Game.particles[i]; p.up(); p.draw(ctx);
        if(p.life <= 0) Game.particles.splice(i,1);
    }

    player.render(ctx);
    
    // UI Update
    document.getElementById('dist-display').innerText = Game.dist;
    document.getElementById('session-coins').innerText = Game.coins;
    document.getElementById('fuel-bar').style.width = Math.max(0, Game.fuel)+"%";
    document.getElementById('nitro-bar').style.width = Math.max(0, Game.nitro)+"%";

    if (Game.fuel <= 0 && Math.abs(player.vx) < 0.1 && Game.s === STATE.PLAY) gameOver("EMPTY TANK");

    requestAnimationFrame(loop);
}

function popup(txt, x, y) {
    const d = document.createElement('div');
    d.className = 'popup-msg'; d.innerText = txt;
    document.getElementById('popup-area').appendChild(d);
    setTimeout(()=>d.remove(), 1000);
}

function gameOver(msg) {
    Game.s = STATE.OVER;
    player.dead = true;
    Game.timeScale = 0.2; // Slow mo effect
    Game.music.pause();
    
    User.coins += Game.coins;
    localStorage.setItem('er_save', JSON.stringify(User));
    
    document.getElementById('fail-reason').innerText = msg;
    document.getElementById('rep-distance').innerText = Game.dist + "m";
    document.getElementById('rep-coins').innerText = Game.coins;
    
    // Snapshot
    const sc = document.getElementById('snapshot-canvas');
    const sx = sc.getContext('2d');
    sx.fillStyle='#222'; sx.fillRect(0,0,300,150);
    sx.font="20px Arial"; sx.fillStyle="white"; sx.fillText("WRECKED", 100, 80);

    setTimeout(() => {
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.remove('hidden');
        Game.timeScale = 1.0;
    }, 1500);
}

/* ==========================================================================
   7. UI & INPUT LOGIC
   ========================================================================== */
function changeState(s) {
    document.querySelectorAll('.hidden').forEach(e => {}); // no-op
    ['menu-screen','garage-screen','report-screen'].forEach(id => document.getElementById(id).classList.add('hidden'));
    
    if (s === STATE.MENU) {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-total-coins').innerText = User.coins;
        Game.music.pause(); Game.menuMusic.play().catch(()=>{});
    }
    if (s === STATE.GARAGE) {
        document.getElementById('garage-screen').classList.remove('hidden');
        renderGarage();
    }
}

function renderGarage() {
    const vl = document.getElementById('vehicle-list'); vl.innerHTML = '';
    const sl = document.getElementById('stage-list'); sl.innerHTML = '';
    document.getElementById('garage-coins').innerText = User.coins;

    CARS.forEach(c => {
        const owned = User.vehicles.includes(c.id);
        const sel = User.curVeh === c.id;
        const d = document.createElement('div');
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.innerHTML = `<img src="${ASSETS.img[c.img].src}"><div class="card-name">${c.name}</div><div class="card-price">${owned?'OWNED':c.price}</div>`;
        d.onclick = () => {
            if(owned) User.curVeh = c.id;
            else if(User.coins >= c.price) { User.coins -= c.price; User.vehicles.push(c.id); User.curVeh = c.id; }
            renderGarage(); localStorage.setItem('er_save', JSON.stringify(User));
        };
        vl.appendChild(d);
    });

    LEVELS.forEach(l => {
        const owned = User.stages.includes(l.id);
        const sel = User.curStg === l.id;
        const d = document.createElement('div');
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.style.borderBottom = `5px solid ${l.col}`;
        d.innerHTML = `<div class="card-name" style="margin-top:40px;">${l.name}</div><div class="card-price">${owned?'OWNED':l.price}</div>`;
        d.onclick = () => {
            if(owned) User.curStg = l.id;
            else if(User.coins >= l.price) { User.coins -= l.price; User.stages.push(l.id); User.curStg = l.id; }
            renderGarage(); localStorage.setItem('er_save', JSON.stringify(User));
        };
        sl.appendChild(d);
    });
}

// Binds
window.addEventListener('keydown', e => {
    if(e.code==='ArrowRight'||e.code==='KeyD') Game.keys.gas=true;
    if(e.code==='ArrowLeft'||e.code==='KeyA') Game.keys.brake=true;
    if(e.code==='ShiftLeft') Game.keys.nitro=true;
});
window.addEventListener('keyup', e => {
    if(e.code==='ArrowRight'||e.code==='KeyD') Game.keys.gas=false;
    if(e.code==='ArrowLeft'||e.code==='KeyA') Game.keys.brake=false;
    if(e.code==='ShiftLeft') Game.keys.nitro=false;
});

const bindTouch = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', e => { e.preventDefault(); Game.keys[key] = true; });
    el.addEventListener('touchend', e => { e.preventDefault(); Game.keys[key] = false; });
};
bindTouch('btn-gas', 'gas');
bindTouch('btn-brake', 'brake');
bindTouch('btn-nitro', 'nitro');

document.getElementById('btn-start').onclick = startGame;
document.getElementById('btn-garage').onclick = () => changeState(STATE.GARAGE);
document.getElementById('btn-back-menu').onclick = () => changeState(STATE.MENU);
document.getElementById('btn-menu-return').onclick = () => changeState(STATE.MENU);
document.getElementById('btn-restart').onclick = startGame;

window.onload = initSystem;
