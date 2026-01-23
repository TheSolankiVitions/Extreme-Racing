/**
 * NEON RACER - GOD ENGINE V21
 * Features: Zero DOM Lag, Custom Physics, Particle Juice, Audio Manager
 */

/* =========================================
   1. CONFIGURATION
   ========================================= */
const CFG = {
    g: 0.55,       // Gravity (High to stop floating)
    fric: 0.96,    // Ground friction
    accel: 0.5,    // Acceleration power
    chunk: 1000,   // Terrain chunk size
    ppm: 30,       // Pixels per meter
    renderDist: 1500
};

const ST = { LOAD:0, MENU:1, GARAGE:2, PLAY:3, OVER:4 };

const Game = {
    s: ST.LOAD,
    cvs: document.getElementById('game'),
    ctx: document.getElementById('game').getContext('2d', { alpha: false }),
    w: window.innerWidth,
    h: window.innerHeight,
    
    // Audio
    m_menu: new Audio('music_menu.mp3'),
    m_race: new Audio('music_race.mp3'),
    s_coin: new Audio('sfx_coin.mp3'),
    s_motor: new Audio('sfx_motor.mp3'),

    // State
    score:0, coins:0, fuel:100, nitro:100, dist:0, air:0,
    keys: { gas:false, brake:false, nitro:false },
    cam: { x:0, y:0, shake:0 },
    
    // Entities
    terr: [], coinsObj: [], fuelObj: [], parts: [], popups: [],
    lastTime: 0
};

// Configure Audio
Game.m_menu.loop = true; Game.m_menu.volume = 0.5;
Game.m_race.loop = true; Game.m_race.volume = 0.4;
Game.s_motor.loop = true; Game.s_motor.volume = 0.0; // Dynamic volume

/* =========================================
   2. ASSETS & DATA
   ========================================= */
const ASSETS = {
    src: {
        'vehicle': 'vehicle.png',
        'wheel': 'wheel.png',
        'character': 'character.png',
        'coin': 'coin.png',
        'fuel': 'fuel.png',
        // Optional backgrounds could go here
    },
    img: {}
};

let User = { coins:0, veh:['v1'], stg:['s1'], cVeh:'v1', cStg:'s1' };

const CARS = [
    { id:'v1', name:'NEON JEEP', price:0, spd:1.0, wt:1.0, w:90 },
    { id:'v2', name:'CYBER MOTO', price:1000, spd:1.4, wt:0.7, w:70 },
    { id:'v3', name:'TITAN', price:2000, spd:0.8, wt:1.3, w:100 },
    { id:'v4', name:'SPEEDSTER', price:4000, spd:1.6, wt:0.9, w:95 }
];

const STAGES = [
    { id:'s1', name:'NEON HILLS', price:0, r:40, sky:'#050505', g:'#00F3FF' },
    { id:'s2', name:'MARS COLONY', price:2000, r:60, sky:'#220505', g:'#FF3333' },
    { id:'s3', name:'MOON BASE', price:4000, r:30, sky:'#000', g:'#888' }
];

async function init() {
    // Load Save
    const save = localStorage.getItem('nr_save');
    if(save) User = JSON.parse(save);

    // Load Images
    const p = [];
    for(let k in ASSETS.src) {
        p.push(new Promise(r => {
            const i = new Image();
            i.src = ASSETS.src[k];
            i.onload = () => { ASSETS.img[k] = i; loadBar(); r(); };
            i.onerror = () => { 
                // Fallback Generator
                const c = document.createElement('canvas'); c.width=40; c.height=40;
                const x = c.getContext('2d'); x.fillStyle = 'red'; x.fillRect(0,0,40,40);
                ASSETS.img[k] = c; loadBar(); r();
            };
        }));
    }
    await Promise.all(p);
    
    // Init Audio Context (Unlock on first click later)
    
    document.getElementById('loader').classList.add('hidden');
    setState(ST.MENU);
    loop();
}

function loadBar() {
    const t = Object.keys(ASSETS.src).length;
    const l = Object.keys(ASSETS.img).length;
    document.getElementById('load-bar').style.width = (l/t)*100+"%";
}

/* =========================================
   3. PHYSICS ENGINE
   ========================================= */
class Car {
    constructor(type) {
        const d = CARS.find(c=>c.id===type);
        this.w = d.w; this.h = d.w/2;
        this.x = 200; this.y = -200;
        this.vx = 0; this.vy = 0;
        this.ang = 0; this.va = 0;
        this.spd = d.spd; this.mass = d.wt;
        this.ground = false;
        this.dead = false;
        this.wheelAng = 0;
    }

    update() {
        if(this.dead) return;
        
        // 1. Gravity & Forces
        const stg = STAGES.find(s=>s.id===User.cStg);
        const grav = stg.id==='s3' ? 0.2 : CFG.g;
        this.vy += grav * this.mass;

        // 2. Input
        let hasPower = false;
        if(Game.fuel > 0) {
            if(Game.keys.gas) {
                if(this.ground) {
                    this.vx += CFG.accel * this.spd;
                    this.ang -= 0.02; // Torque lift
                    hasPower = true;
                    spawnDust(this.x-30, this.y+20);
                } else {
                    this.va -= 0.02; // Air control
                }
                Game.fuel -= 0.04;
            }
            if(Game.keys.brake) {
                if(this.ground) this.vx -= CFG.accel * 0.8;
                else this.va += 0.02;
            }
            if(Game.keys.nitro && Game.nitro > 0) {
                this.vx += (this.ground ? 1.0 : 0.4);
                Game.nitro -= 0.5;
                spawnFlame(this.x-40, this.y);
                Game.cam.shake = 3;
            }
        }

        // Engine Sound
        Game.s_motor.volume = hasPower ? 0.5 : 0.1;

        // 3. Friction
        this.vx *= CFG.fric;
        this.va *= 0.95;
        this.wheelAng += this.vx * 0.1;

        // 4. Integration
        this.x += this.vx;
        this.y += this.vy;
        this.ang += this.va;

        // 5. Collision
        this.collide();

        // 6. Stats
        const m = Math.floor(this.x/CFG.ppm);
        if(m > Game.dist) Game.dist = m;
    }

    collide() {
        // Dual Raycast for Stability
        const wOff = this.w * 0.35;
        const cos = Math.cos(this.ang);
        const fx = this.x + (wOff * cos); // Front Wheel X
        const rx = this.x - (wOff * cos); // Rear Wheel X
        
        const fy = getY(fx);
        const ry = getY(rx);
        const cy = getY(this.x);

        const targetAng = Math.atan2(fy - ry, wOff*2);
        const bot = this.y + (this.h/2);

        if (bot >= cy - 5) {
            this.ground = true;
            this.y = cy - (this.h/2);
            this.vy = 0;
            // Suspension Damping
            this.va += (targetAng - this.ang) * 0.2;
            
            // Hard Landing
            if(this.vy > 15) { Game.cam.shake=5; spawnDust(this.x, this.y+20); }
        } else {
            this.ground = false;
            Game.air++;
        }

        // Driver Head Check
        const sin = Math.sin(this.ang);
        const hx = this.x + (-10*cos - -25*sin);
        const hy = this.y + (-10*sin + -25*cos);
        if(hy >= getY(hx)) gameOver("CRITICAL FAILURE");
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x - Game.cam.x, this.y - Game.cam.y);
        ctx.rotate(this.ang);

        // Body
        const cImg = ASSETS.img[User.cVeh] || ASSETS.img['vehicle'];
        if(cImg) ctx.drawImage(cImg, -this.w/2, -this.h/2, this.w, this.h);
        else { ctx.fillStyle='#fff'; ctx.fillRect(-this.w/2,-this.h/2,this.w,this.h); }

        // Driver (Character)
        const dImg = ASSETS.img['character'];
        if(dImg) {
            const lean = this.vx * 0.05;
            ctx.save();
            ctx.translate(-10, -15);
            ctx.rotate(lean);
            ctx.drawImage(dImg, -15, -25, 30, 30);
            ctx.restore();
        }

        // Wheels
        const wImg = ASSETS.img['wheel'];
        if(wImg) {
            // Front
            ctx.save();
            ctx.translate(this.w/3, this.h/2 - 5);
            ctx.rotate(this.wheelAng);
            ctx.drawImage(wImg, -12, -12, 24, 24);
            ctx.restore();
            // Rear
            ctx.save();
            ctx.translate(-this.w/3, this.h/2 - 5);
            ctx.rotate(this.wheelAng);
            ctx.drawImage(wImg, -12, -12, 24, 24);
            ctx.restore();
        }

        ctx.restore();
    }
}

/* =========================================
   4. TERRAIN & OBJECTS
   ========================================= */
function getY(x) {
    if(Game.terr.length===0) return Game.h-150;
    const i = Math.floor(x/50);
    if(i<0) return Game.terr[0];
    if(i>=Game.terr.length-1) return Game.terr[Game.terr.length-1];
    const t = (x%50)/50;
    return Game.terr[i] + t*(Game.terr[i+1]-Game.terr[i]);
}

function genTerr(s, len) {
    const stg = STAGES.find(l=>l.id===User.cStg);
    let py = Game.terr.length>0 ? Game.terr[Game.terr.length-1] : Game.h-200;
    
    for(let i=0; i<len; i++) {
        const idx = s+i;
        let ny = py;
        
        // Safe Zone start
        if(idx < 20) ny = Game.h-200;
        else {
            const n = Math.sin(idx*0.1)*5 + Math.sin(idx*0.03)*15;
            ny += (Math.random()-0.5)*stg.r + n;
            if(ny > Game.h-50) ny = Game.h-50;
            if(ny < 100) ny = 100;
        }
        Game.terr.push(ny);
        py = ny;

        if(idx > 20) {
            if(Math.random()<0.3) Game.coinsObj.push({x:idx*50, y:ny-50, a:true});
            if(Math.random()<0.03) Game.fuelObj.push({x:idx*50, y:ny-50, a:true});
        }
    }
}

/* =========================================
   5. GAME LOOP
   ========================================= */
let player;

function start() {
    Game.s = ST.PLAY;
    Game.score=0; Game.coins=0; Game.fuel=100; Game.nitro=100; Game.dist=0;
    Game.terr=[]; Game.coinsObj=[]; Game.fuelObj=[]; Game.parts=[]; Game.popups=[];
    
    Game.m_menu.pause();
    Game.m_race.currentTime=0; Game.m_race.play().catch(()=>{});
    Game.s_motor.play().catch(()=>{});

    genTerr(0, 50);
    player = new Car(User.cVeh);
    // Explicit spawn to prevent void fall
    player.x = 200; player.y = getY(200) - 50; 

    setState(ST.PLAY);
}

function loop() {
    requestAnimationFrame(loop);
    if(Game.s !== ST.PLAY) return;

    player.update();

    // Camera
    const tx = player.x - Game.w/3;
    const ty = player.y - Game.h/1.6;
    Game.cam.x += (tx - Game.cam.x)*0.1;
    Game.cam.y += (ty - Game.cam.y)*0.1;
    
    if(Game.cam.shake > 0) {
        Game.cam.x += (Math.random()-0.5)*Game.cam.shake;
        Game.cam.y += (Math.random()-0.5)*Game.cam.shake;
        Game.cam.shake *= 0.9;
    }

    // Gen
    const edge = Math.floor((Game.cam.x + Game.w + 500)/50);
    if(edge > Game.terr.length) genTerr(Game.terr.length, 20);

    // Items
    Game.coinsObj.forEach(c => {
        if(c.a && Math.hypot(c.x-player.x, c.y-player.y) < 60) {
            c.a=false; Game.coins++; 
            Game.s_coin.currentTime=0; Game.s_coin.play().catch(()=>{});
            addPopup("+1", c.x, c.y); spawnSparkle(c.x, c.y, '#FFD700');
        }
    });
    Game.fuelObj.forEach(f => {
        if(f.a && Math.hypot(f.x-player.x, f.y-player.y) < 60) {
            f.a=false; Game.fuel=100; 
            Game.s_coin.currentTime=0; Game.s_coin.play().catch(()=>{});
            addPopup("FUEL", f.x, f.y); spawnSparkle(f.x, f.y, '#FF3333');
        }
    });

    render();
    updateUI();

    if(Game.fuel<=0 && Math.abs(player.vx)<0.1) gameOver("EMPTY TANK");
}

/* =========================================
   6. RENDERER (PURE CANVAS)
   ========================================= */
function render() {
    const ctx = Game.ctx;
    ctx.clearRect(0,0,Game.w, Game.h);
    
    const stg = STAGES.find(s=>s.id===User.cStg);
    
    // Background (Gradient Sky)
    const grad = ctx.createLinearGradient(0,0,0,Game.h);
    grad.addColorStop(0, stg.sky);
    grad.addColorStop(1, '#000');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,Game.w, Game.h);

    // Terrain (Neon Line Style)
    ctx.strokeStyle = stg.g;
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10; ctx.shadowColor = stg.g;
    ctx.beginPath();
    const sx = Math.floor(Game.cam.x/50);
    const ex = sx + Math.ceil(Game.w/50)+2;
    if(Game.terr[sx]!==undefined) {
        ctx.moveTo(sx*50-Game.cam.x, Game.terr[sx]-Game.cam.y);
        for(let i=sx; i<=ex; i++) {
            if(Game.terr[i]!==undefined) ctx.lineTo(i*50-Game.cam.x, Game.terr[i]-Game.cam.y);
        }
    }
    ctx.stroke();
    
    // Fill below lines to hide messy background
    ctx.lineTo((ex-1)*50-Game.cam.x, Game.h);
    ctx.lineTo(sx*50-Game.cam.x, Game.h);
    ctx.fillStyle = '#050505';
    ctx.shadowBlur=0;
    ctx.fill();

    // Items
    Game.coinsObj.forEach(c=>{ if(c.a) ctx.drawImage(ASSETS.img['coin'], c.x-15-Game.cam.x, c.y-15-Game.cam.y, 30, 30); });
    Game.fuelObj.forEach(f=>{ if(f.a) ctx.drawImage(ASSETS.img['fuel'], f.x-15-Game.cam.x, f.y-25-Game.cam.y, 30, 45); });

    // Particles
    for(let i=Game.parts.length-1; i>=0; i--) {
        let p = Game.parts[i];
        p.life -= 0.05; p.x+=p.vx; p.y+=p.vy;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x-Game.cam.x, p.y-Game.cam.y, p.s, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        if(p.life<=0) Game.parts.splice(i,1);
    }

    // Popups
    for(let i=Game.popups.length-1; i>=0; i--) {
        let p = Game.popups[i];
        p.y -= 2; p.l -= 0.02;
        ctx.globalAlpha = p.l;
        ctx.fillStyle = "#FFF"; ctx.font = "bold 20px Arial";
        ctx.fillText(p.t, p.x-Game.cam.x, p.y-Game.cam.y);
        ctx.globalAlpha = 1;
        if(p.l<=0) Game.popups.splice(i,1);
    }

    player.draw(ctx);
}

function spawnDust(x,y) { for(let i=0;i<2;i++) Game.parts.push({x:x,y:y,vx:(Math.random()-0.5)*3,vy:(Math.random()-0.5)*3,life:1,c:'#555',s:Math.random()*5}); }
function spawnFlame(x,y) { for(let i=0;i<3;i++) Game.parts.push({x:x,y:y,vx:-5-Math.random()*5,vy:(Math.random()-0.5)*2,life:0.5,c:'#00F3FF',s:5}); }
function spawnSparkle(x,y,c) { for(let i=0;i<8;i++) Game.parts.push({x:x,y:y,vx:(Math.random()-0.5)*8,vy:(Math.random()-0.5)*8,life:1,c:c,s:3}); }
function addPopup(t,x,y) { Game.popups.push({t:t,x:x,y:y,l:1}); }

/* =========================================
   7. UI & STATE
   ========================================= */
function updateUI() {
    document.getElementById('dist-val').innerText = Game.dist + " M";
    document.getElementById('sess-coins').innerText = Game.coins;
    document.getElementById('fuel-bar').style.width = Math.max(0, Game.fuel)+"%";
    document.getElementById('nitro-bar').style.width = Math.max(0, Game.nitro)+"%";
}

function gameOver(msg) {
    Game.s = ST.OVER; player.dead = true;
    Game.m_race.pause(); Game.s_motor.pause();
    
    User.coins += Game.coins;
    localStorage.setItem('nr_save', JSON.stringify(User));
    
    document.getElementById('fail-msg').innerText = msg;
    document.getElementById('end-dist').innerText = Game.dist+"m";
    document.getElementById('end-coins').innerText = Game.coins;
    
    // Snap
    const sc = document.getElementById('snap-canvas');
    const sx = sc.getContext('2d');
    sx.drawImage(Game.cvs, 0, 0, sc.width, sc.height);

    setTimeout(() => {
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('report').classList.remove('hidden');
    }, 1000);
}

function setState(s) {
    ['menu','garage','hud','report'].forEach(id=>document.getElementById(id).classList.add('hidden'));
    if(s===ST.MENU) {
        document.getElementById('menu').classList.remove('hidden');
        document.getElementById('menu-coins').innerText = User.coins;
        Game.m_race.pause(); Game.m_menu.play().catch(()=>{});
    }
    if(s===ST.GARAGE) {
        document.getElementById('garage').classList.remove('hidden');
        renderGarage();
    }
    if(s===ST.PLAY) {
        document.getElementById('hud').classList.remove('hidden');
    }
}

function renderGarage() {
    document.getElementById('garage-coins-val').innerText = User.coins;
    const cl = document.getElementById('car-list'); cl.innerHTML='';
    const sl = document.getElementById('stage-list'); sl.innerHTML='';
    
    CARS.forEach(c => {
        const o = User.veh.includes(c.id);
        const d = document.createElement('div');
        d.className = `card ${o?'unlocked':''} ${User.cVeh===c.id?'selected':''}`;
        d.innerHTML = `<img src="${ASSETS.img[c.img]?ASSETS.img[c.img].src:''}"><div class="card-price">${o?'OWNED':c.price}</div>`;
        d.onclick = () => {
            if(o) User.cVeh=c.id; 
            else if(User.coins>=c.price) { User.coins-=c.price; User.veh.push(c.id); User.cVeh=c.id; }
            renderGarage(); localStorage.setItem('nr_save', JSON.stringify(User));
        };
        cl.appendChild(d);
    });
    // Similar loop for STAGES...
    STAGES.forEach(s => {
        const o = User.stg.includes(s.id);
        const d = document.createElement('div');
        d.className = `card ${o?'unlocked':''} ${User.cStg===s.id?'selected':''}`;
        d.style.borderBottom = `4px solid ${s.g}`;
        d.innerHTML = `<h3 style="color:${s.g}">${s.name}</h3><div class="card-price">${o?'OWNED':s.price}</div>`;
        d.onclick = () => {
            if(o) User.cStg=s.id;
            else if(User.coins>=s.price) { User.coins-=s.price; User.stg.push(s.id); User.cStg=s.id; }
            renderGarage(); localStorage.setItem('nr_save', JSON.stringify(User));
        };
        sl.appendChild(d);
    });
}

// Binds
window.onkeydown = e => {
    if(e.key==='ArrowRight'||e.key==='d') Game.keys.gas=true;
    if(e.key==='ArrowLeft'||e.key==='a') Game.keys.brake=true;
    if(e.key==='Shift') Game.keys.nitro=true;
};
window.onkeyup = e => {
    if(e.key==='ArrowRight'||e.key==='d') Game.keys.gas=false;
    if(e.key==='ArrowLeft'||e.key==='a') Game.keys.brake=false;
    if(e.key==='Shift') Game.keys.nitro=false;
};

const bindT = (id, k) => {
    const el = document.getElementById(id);
    el.ontouchstart = e => { e.preventDefault(); Game.keys[k]=true; };
    el.ontouchend = e => { e.preventDefault(); Game.keys[k]=false; };
};
bindT('touch-gas', 'gas');
bindT('touch-brake', 'brake');
bindT('touch-nitro', 'nitro');

document.getElementById('btn-start').onclick = start;
document.getElementById('btn-garage').onclick = () => setState(ST.GARAGE);
document.getElementById('btn-back').onclick = () => setState(ST.MENU);
document.getElementById('btn-home').onclick = () => setState(ST.MENU);
document.getElementById('btn-retry').onclick = start;

window.onload = () => {
    window.dispatchEvent(new Event('resize'));
    init();
};
