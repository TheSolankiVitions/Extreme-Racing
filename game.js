/**
 * EXTREME RACING - ENGINE V20
 * Made by The Solanki Visions
 * Features: Zero-DOM Lag, Fixed Physics, Canvas Rendering, Real Driver
 */

/* ==========================================================================
   1. CONFIGURATION
   ========================================================================== */
const CONFIG = {
    g: 0.5, // Stronger gravity to prevent float
    fric: 0.96, // Ground friction
    airRes: 0.99, // Air resistance
    speed: 0.5, // Acceleration power
    chunk: 1000,
    ppm: 30, // Pixels per meter
    maxTilt: 1.0 // Prevent flipping too easily
};

const STATE = { LOAD: 0, MENU: 1, GARAGE: 2, PLAY: 3, OVER: 4 };

const Game = {
    s: STATE.LOAD,
    cvs: document.getElementById('game-canvas'),
    ctx: document.getElementById('game-canvas').getContext('2d', { alpha: false }),
    w: window.innerWidth,
    h: window.innerHeight,
    
    // Audio
    music: document.getElementById('music-game'),
    menuMusic: document.getElementById('music-menu'),

    // Data
    score: 0, coins: 0, fuel: 100, nitro: 100, dist: 0, air: 0,
    keys: { gas: false, brake: false, nitro: false },
    cam: { x: 0, y: 0, shake: 0 },
    
    // Arrays
    terr: [], coinsObj: [], fuelObj: [], parts: [], popups: [],
    
    lastTime: 0,
    dt: 1.0
};

/* ==========================================================================
   2. ASSET LOADER (CRITICAL: Character Handling)
   ========================================================================== */
const ASSETS = {
    src: {
        'jeep': 'jeep.png',
        'bike': 'bike.png',
        'wood': 'wood.png',
        'mini_monster': 'mini_monster.png',
        'cartoon': 'cartoon.png',
        'character': 'character.png', // Ensure this is PNG with transparency
        'coin': 'coin.png',
        'fuel': 'fuel_can.png'
    },
    img: {}
};

let User = { coins: 0, veh: ['jeep'], stg: ['country'], cVeh: 'jeep', cStg: 'country' };

const CARS = [
    { id: 'jeep', name: 'Jeep', price: 0, spd: 1.0, wt: 1.0, w: 90 },
    { id: 'bike', name: 'Moto', price: 1000, spd: 1.4, wt: 0.7, w: 70 },
    { id: 'wood', name: 'Wagon', price: 2000, spd: 0.8, wt: 1.2, w: 95 },
    { id: 'mini_monster', name: 'Monster', price: 3000, spd: 1.1, wt: 1.4, w: 100 },
    { id: 'cartoon', name: 'F1', price: 4000, spd: 1.5, wt: 0.8, w: 90 }
];

const STAGES = [
    { id: 'country', name: 'Hills', price: 0, r: 40, c: '#4b7c38', s: '#87CEEB' },
    { id: 'moon', name: 'Moon', price: 1000, r: 30, c: '#555', s: '#000' },
    { id: 'desert', name: 'Sand', price: 2000, r: 60, c: '#e6c229', s: '#ffcc66' },
    { id: 'mars', name: 'Mars', price: 4000, r: 80, c: '#b83b18', s: '#ff9966' }
];

async function init() {
    const save = localStorage.getItem('er_v20');
    if(save) User = JSON.parse(save);

    const p = [];
    for(let k in ASSETS.src) {
        p.push(new Promise(r => {
            const i = new Image();
            i.src = ASSETS.src[k];
            i.onload = () => { ASSETS.img[k] = i; loadUpdate(); r(); };
            i.onerror = () => {
                // Fallback: Yellow box for driver if image fails
                const c = document.createElement('canvas'); c.width=40; c.height=40;
                const x = c.getContext('2d'); x.fillStyle = k==='character'?'#FFD700':'#F00'; x.fillRect(0,0,40,40);
                ASSETS.img[k] = c; loadUpdate(); r();
            };
        }));
    }
    await Promise.all(p);
    document.getElementById('loading-screen').classList.add('hidden');
    goState(STATE.MENU);
}

function loadUpdate() {
    const t = Object.keys(ASSETS.src).length;
    const l = Object.keys(ASSETS.img).length;
    document.getElementById('load-bar').style.width = (l/t)*100 + "%";
}

/* ==========================================================================
   3. PHYSICS (FIXED: NO FLOAT)
   ========================================================================== */
class PhysicsCar {
    constructor(type) {
        const d = CARS.find(c => c.id === type);
        this.w = d.w; this.h = d.w/2;
        this.x = 300; this.y = -200;
        this.vx = 0; this.vy = 0;
        this.ang = 0; this.va = 0;
        this.pwr = d.spd; this.mass = d.wt;
        this.ground = false;
        this.dead = false;
        
        // Driver position
        this.head = {x: -10, y: -25};
    }

    update() {
        if(this.dead) return;
        const stg = STAGES.find(s => s.id === User.cStg);
        const grav = (stg.id === 'moon' ? 0.2 : CONFIG.g);

        // 1. Gravity (Always apply strong gravity)
        this.vy += grav * this.mass;

        // 2. Input (Instant Response)
        if (Game.fuel > 0) {
            if (Game.keys.gas) {
                if (this.ground) {
                    this.vx += CONFIG.speed * this.pwr;
                    this.ang -= 0.01; // Slight wheelie
                    addPart(this.x-30, this.y+20, '#aaa', 1);
                } else {
                    this.va -= 0.01; // Air spin
                }
                Game.fuel -= 0.05;
            }
            if (Game.keys.brake) {
                if (this.ground) this.vx -= CONFIG.speed * 0.8;
                else this.va += 0.01;
            }
            if (Game.keys.nitro && Game.nitro > 0) {
                this.vx += (this.ground ? 1.0 : 0.4);
                Game.nitro -= 0.5;
                addPart(this.x-40, this.y, '#00F3FF', 2);
                shake(2);
            }
        }

        this.vx *= CONFIG.fric;
        this.va *= 0.95;

        this.x += this.vx;
        this.y += this.vy;
        this.ang += this.va;

        this.collide();

        // Distance
        const m = Math.floor(this.x / CONFIG.ppm);
        if(m > Game.dist) Game.dist = m;
    }

    collide() {
        // Dual Point Suspension (Front/Back)
        const wOff = this.w * 0.35;
        const cos = Math.cos(this.ang);
        const fx = this.x + (wOff * cos);
        const rx = this.x - (wOff * cos);
        
        const fy = getGround(fx);
        const ry = getGround(rx);
        const cy = getGround(this.x);

        const wantAng = Math.atan2(fy - ry, wOff*2);
        const bot = this.y + (this.h/2);

        if (bot >= cy - 5) {
            this.ground = true;
            this.y = cy - (this.h/2);
            this.vy = 0;
            // Smooth rotation match
            this.va += (wantAng - this.ang) * 0.15;
            
            // Crash Logic
            if(this.vy > 18) { shake(5); addPart(this.x, this.y+20, '#555', 5); }
        } else {
            this.ground = false;
            Game.air++;
        }

        // Head Check
        const sin = Math.sin(this.ang);
        const hx = this.x + (this.head.x * cos - this.head.y * sin);
        const hy = this.y + (this.head.x * sin + this.head.y * cos);
        
        if (hy >= getGround(hx)) end("HEAD HIT");
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.cam.x, this.y - Game.cam.y);
        ctx.rotate(this.ang);
        
        // Car Body
        const cImg = ASSETS.img[User.cVeh];
        if(cImg) ctx.drawImage(cImg, -this.w/2, -this.h/2, this.w, this.h);
        else { ctx.fillStyle='red'; ctx.fillRect(-40,-20,80,40); }

        // Driver (Character.jpg/png) - NO BOX
        const dImg = ASSETS.img['character'];
        if(dImg) {
            const lean = this.vx * 0.05;
            ctx.save();
            ctx.translate(this.head.x, this.head.y);
            ctx.rotate(lean);
            // Draw driver centered
            ctx.drawImage(dImg, -15, -15, 30, 30);
            ctx.restore();
        }
        ctx.restore();
    }
}

/* ==========================================================================
   4. TERRAIN & SYSTEM
   ========================================================================== */
function getGround(x) {
    if(Game.terr.length===0) return Game.h-150;
    const i = Math.floor(x/50);
    if(i<0) return Game.terr[0];
    if(i>=Game.terr.length-1) return Game.terr[Game.terr.length-1];
    const t = (x%50)/50;
    return Game.terr[i] + t * (Game.terr[i+1]-Game.terr[i]);
}

function genGround(s, len) {
    const stg = STAGES.find(l => l.id === User.cStg);
    let py = Game.terr.length > 0 ? Game.terr[Game.terr.length-1] : Game.h-200;
    
    for(let i=0; i<len; i++) {
        const idx = s+i;
        let ny = py;
        
        // Safe Start
        if(idx < 20) ny = Game.h-200;
        else {
            const n = Math.sin(idx*0.1)*3 + Math.sin(idx*0.05)*5;
            ny += (Math.random()-0.5)*(stg.r/2) + n;
            if(ny > Game.h-50) ny=Game.h-50;
            if(ny < 200) ny=200;
        }
        Game.terr.push(ny);
        py = ny;

        if(idx>20) {
            if(Math.random()<0.3) Game.coinsObj.push({x:idx*50,y:ny-50,a:true});
            if(Math.random()<0.03) Game.fuelObj.push({x:idx*50,y:ny-50,a:true});
        }
    }
}

/* ==========================================================================
   5. RENDER LOOP (CANVAS ONLY - NO DOM LAG)
   ========================================================================== */
let car;

function start() {
    Game.s = STATE.PLAY;
    Game.score=0; Game.coins=0; Game.fuel=100; Game.nitro=100; Game.dist=0;
    Game.terr=[]; Game.coinsObj=[]; Game.fuelObj=[]; Game.parts=[]; Game.popups=[];
    
    Game.menuMusic.pause();
    Game.music.currentTime=0;
    Game.music.play();

    genGround(0, 50);
    car = new PhysicsCar(User.cVeh);
    
    ['menu-screen','garage-screen','report-screen'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    document.getElementById('hud-screen').classList.remove('hidden');
    requestAnimationFrame(loop);
}

function loop() {
    if(Game.s !== STATE.PLAY && Game.s !== STATE.OVER) return;

    car.update();

    // Camera
    const tx = car.x - Game.w/3;
    const ty = car.y - Game.h/1.6;
    Game.cam.x += (tx - Game.cam.x)*0.1;
    Game.cam.y += (ty - Game.cam.y)*0.1;
    
    if(Game.cam.shake > 0) {
        Game.cam.x += (Math.random()-0.5)*Game.cam.shake;
        Game.cam.y += (Math.random()-0.5)*Game.cam.shake;
        Game.cam.shake *= 0.9;
    }

    // Terrain Gen
    const edge = Math.floor((Game.cam.x + Game.w + 500)/50);
    if(edge > Game.terr.length) genGround(Game.terr.length, 20);

    // Items
    Game.coinsObj.forEach(c => {
        if(c.a && Math.hypot(c.x-car.x, c.y-car.y) < 50) {
            c.a=false; Game.coins++; addPart(c.x,c.y,'gold',5);
            addPopup("+1", c.x, c.y);
        }
    });
    Game.fuelObj.forEach(f => {
        if(f.a && Math.hypot(f.x-car.x, f.y-car.y) < 50) {
            f.a=false; Game.fuel=100; addPart(f.x,f.y,'red',5);
            addPopup("FUEL", f.x, f.y);
        }
    });

    draw();
    updateHUD();

    if(Game.fuel<=0 && Math.abs(car.vx)<0.1 && Game.s===STATE.PLAY) end("EMPTY TANK");

    requestAnimationFrame(loop);
}

function draw() {
    const ctx = Game.ctx;
    ctx.clearRect(0,0,Game.w, Game.h);
    
    // Sky
    const s = STAGES.find(l=>l.id===User.cStg);
    ctx.fillStyle = s.s; ctx.fillRect(0,0,Game.w, Game.h);

    // Terrain
    ctx.fillStyle = s.c;
    ctx.beginPath();
    const st = Math.floor(Game.cam.x/50);
    const ed = st + Math.ceil(Game.w/50) + 2;
    if(Game.terr[st]!==undefined) {
        ctx.moveTo(st*50-Game.cam.x, Game.terr[st]-Game.cam.y);
        for(let i=st; i<=ed; i++) {
            if(Game.terr[i]!==undefined) ctx.lineTo(i*50-Game.cam.x, Game.terr[i]-Game.cam.y);
        }
        ctx.lineTo(ed*50-Game.cam.x, Game.h);
        ctx.lineTo(st*50-Game.cam.x, Game.h);
        ctx.fill();
    }

    // Objects
    Game.coinsObj.forEach(c => { if(c.a) ctx.drawImage(ASSETS.img['coin'], c.x-15-Game.cam.x, c.y-15-Game.cam.y, 30, 30); });
    Game.fuelObj.forEach(f => { if(f.a) ctx.drawImage(ASSETS.img['fuel'], f.x-15-Game.cam.x, f.y-20-Game.cam.y, 30, 40); });

    // Particles & Popups (Canvas Only to stop lag)
    Game.parts.forEach((p,i) => {
        p.up(); p.draw(ctx);
        if(p.l<=0) Game.parts.splice(i,1);
    });
    
    Game.popups.forEach((p,i) => {
        p.y -= 2; p.l -= 0.02;
        ctx.globalAlpha = p.l;
        ctx.fillStyle = "#FFD700"; ctx.font = "bold 24px Arial";
        ctx.fillText(p.txt, p.x - Game.cam.x, p.y - Game.cam.y);
        ctx.globalAlpha = 1;
        if(p.l<=0) Game.popups.splice(i,1);
    });

    car.draw(ctx);
}

// Particle Class
class Part {
    constructor(x,y,c,s) { this.x=x; this.y=y; this.c=c; this.s=s; this.vx=(Math.random()-0.5)*5; this.vy=(Math.random()-0.5)*5; this.l=1.0; }
    up() { this.x+=this.vx; this.y+=this.vy; this.l-=0.05; }
    draw(c) { c.globalAlpha=this.l; c.fillStyle=this.c; c.beginPath(); c.arc(this.x-Game.cam.x, this.y-Game.cam.y, this.s, 0, Math.PI*2); c.fill(); c.globalAlpha=1; }
}
function addPart(x,y,c,s) { for(let i=0;i<3;i++) Game.parts.push(new Part(x,y,c,s)); }
function addPopup(t,x,y) { Game.popups.push({txt:t, x:x, y:y, l:1.0}); }
function shake(a) { Game.cam.shake = a; }

// UI Helpers
function updateHUD() {
    document.getElementById('dist-val').innerText = Game.dist + " m";
    document.getElementById('sess-coins').innerText = Game.coins;
    document.getElementById('fuel-bar').style.width = Math.max(0, Game.fuel)+"%";
    document.getElementById('nitro-bar').style.width = Math.max(0, Game.nitro)+"%";
}

function end(msg) {
    Game.s = STATE.OVER; car.dead = true; Game.music.pause();
    User.coins += Game.coins; localStorage.setItem('er_v20', JSON.stringify(User));
    
    document.getElementById('fail-msg').innerText = msg;
    document.getElementById('end-dist').innerText = Game.dist + "m";
    document.getElementById('end-coins').innerText = Game.coins;
    
    setTimeout(() => {
        document.getElementById('hud-screen').classList.add('hidden');
        document.getElementById('report-screen').classList.remove('hidden');
    }, 1000);
}

function goState(s) {
    ['menu-screen','garage-screen','report-screen'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    if(s===STATE.MENU) {
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-coins').innerText = User.coins;
        Game.music.pause(); Game.menuMusic.play().catch(()=>{});
    }
    if(s===STATE.GARAGE) {
        document.getElementById('garage-screen').classList.remove('hidden');
        renderGarage();
    }
}

function renderGarage() {
    document.getElementById('garage-coins-val').innerText = User.coins;
    const vl = document.getElementById('vehicle-list'); vl.innerHTML='';
    const sl = document.getElementById('stage-list'); sl.innerHTML='';
    
    CARS.forEach(c => {
        const owned = User.veh.includes(c.id);
        const sel = User.cVeh === c.id;
        const d = document.createElement('div');
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.innerHTML = `<div class="card-name">${c.name}</div><img src="${ASSETS.img[c.id].src}"><div class="card-price">${owned?'OWNED':c.price+' 🪙'}</div>`;
        d.onclick = () => {
            if(owned) User.cVeh = c.id;
            else if(User.coins >= c.price) { User.coins -= c.price; User.veh.push(c.id); User.cVeh = c.id; }
            renderGarage(); localStorage.setItem('er_v20', JSON.stringify(User));
        };
        vl.appendChild(d);
    });

    STAGES.forEach(s => {
        const owned = User.stg.includes(s.id);
        const sel = User.cStg === s.id;
        const d = document.createElement('div');
        d.className = `card ${owned?'unlocked':''} ${sel?'selected':''}`;
        d.style.background = s.c;
        d.innerHTML = `<div class="card-name" style="margin-top:40px; color:black;">${s.name}</div><div class="card-price">${owned?'OWNED':s.price+' 🪙'}</div>`;
        d.onclick = () => {
            if(owned) User.cStg = s.id;
            else if(User.coins >= s.price) { User.coins -= s.price; User.stg.push(s.id); User.cStg = s.id; }
            renderGarage(); localStorage.setItem('er_v20', JSON.stringify(User));
        };
        sl.appendChild(d);
    });
}

// Controls
window.addEventListener('keydown', e=>{
    if(e.code==='ArrowRight'||e.code==='KeyD') Game.keys.gas=true;
    if(e.code==='ArrowLeft'||e.code==='KeyA') Game.keys.brake=true;
    if(e.code==='ShiftLeft') Game.keys.nitro=true;
});
window.addEventListener('keyup', e=>{
    if(e.code==='ArrowRight'||e.code==='KeyD') Game.keys.gas=false;
    if(e.code==='ArrowLeft'||e.code==='KeyA') Game.keys.brake=false;
    if(e.code==='ShiftLeft') Game.keys.nitro=false;
});

const bG=document.getElementById('btn-gas'), bB=document.getElementById('btn-brake'), bN=document.getElementById('btn-nitro');
bG.addEventListener('touchstart',e=>{e.preventDefault(); Game.keys.gas=true;});
bG.addEventListener('touchend',e=>{e.preventDefault(); Game.keys.gas=false;});
bB.addEventListener('touchstart',e=>{e.preventDefault(); Game.keys.brake=true;});
bB.addEventListener('touchend',e=>{e.preventDefault(); Game.keys.brake=false;});
bN.addEventListener('touchstart',e=>{e.preventDefault(); Game.keys.nitro=true;});
bN.addEventListener('touchend',e=>{e.preventDefault(); Game.keys.nitro=false;});

document.getElementById('btn-start').onclick = start;
document.getElementById('btn-garage').onclick = () => goState(STATE.GARAGE);
document.getElementById('btn-back').onclick = () => goState(STATE.MENU);
document.getElementById('btn-home').onclick = () => goState(STATE.MENU);
document.getElementById('btn-retry').onclick = start;

window.onload = init;
