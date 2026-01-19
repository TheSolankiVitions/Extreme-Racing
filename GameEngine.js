class GameEngine {
    constructor(canvas, config, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false }); // Optimize
        this.config = config;
        this.cb = callbacks; // { onCoin, onEnd, onFeedback }

        // Physics Constants
        this.gravity = config.stage === 'Moon' ? 0.25 : 0.6;
        this.friction = config.stage === 'Desert' ? 0.94 : 0.99;
        
        // Loop Logic (Fixed Timestep)
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.dt = 1000 / 60; // 60 FPS physics step
        this.running = false;

        // Entities
        this.terrain = [];
        this.coins = [];
        this.particles = [];
        this.offset = 0;
        this.distance = 0;
        
        // Input State
        this.input = { gas: false, brake: false };

        // Terrain Gen
        this.terrainAmp = 150;
        this.terrainFreq = 0.004;

        // Stunt Logic
        this.airTime = 0;
        this.angleAccumulator = 0;
        this.lastAngle = 0;
        this.grounded = true;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Generate initial terrain
        for(let x = 0; x < this.width + 1000; x+=30) this.genTerrain(x);

        // Vehicle Setup (Verlet Bodies)
        const vData = [
            { w: 90, h: 30, r: 20, mass: 1.0 }, // Jeep
            { w: 110, h: 50, r: 35, mass: 1.5 }, // Monster
            { w: 100, h: 20, r: 18, mass: 0.8 }  // Race Car
        ][this.config.vehicle];

        const startX = 200;
        const startY = 200;

        // Upgrades Application
        const engineMult = 1 + (this.config.upgrades.engine * 0.15);
        const susStiff = 0.05 + (this.config.upgrades.suspension * 0.02);
        
        this.car = {
            torque: (0.4 * engineMult) / vData.mass,
            stiffness: susStiff,
            mass: vData.mass,
            angle: 0,
            chassis: { x: startX, y: startY, ox: startX, oy: startY },
            fWheel: { x: startX + 35, y: startY + 30, ox: startX + 35, oy: startY + 30, r: vData.r },
            rWheel: { x: startX - 35, y: startY + 30, ox: startX - 35, oy: startY + 30, r: vData.r }
        };

        this.running = true;
        this.loop();
    }

    resize() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
    }

    genTerrain(x) {
        // Difficulty Scaling: Increase amp/freq every 5000px
        if (x > 0 && x % 5000 < 30) {
            this.terrainAmp *= 1.05;
            this.terrainFreq *= 1.05;
            this.cb.onFeedback("DIFFICULTY UP!", x - this.offset, 200, "#f00");
        }

        // Superposition Sine Waves (Pseudo-Perlin)
        let y = Math.sin(x * this.terrainFreq) * this.terrainAmp + 
                Math.sin(x * this.terrainFreq * 2.1) * (this.terrainAmp * 0.4) +
                Math.sin(x * this.terrainFreq * 0.5) * (this.terrainAmp * 0.8);
        
        y += this.height / 1.5; // Base Level

        this.terrain.push({ x, y });

        // Coin Generation Algorithm
        if (Math.random() < 0.15) {
            const tiers = [25, 50, 75, 100, 200, 500, 1000];
            // Probability of higher coins increases with distance
            const difficulty = Math.min(6, Math.floor(x / 10000));
            const val = tiers[Math.floor(Math.random() * (difficulty + 3)) % 7];
            this.coins.push({ x, y: y - 80, val, collected: false });
        }
    }

    // --- PHYSICS CORE (Verlet) ---
    integrate(p) {
        const vx = (p.x - p.ox) * this.friction;
        const vy = (p.y - p.oy) * this.friction;
        p.ox = p.x;
        p.oy = p.y;
        p.x += vx;
        p.y += vy + this.gravity;
    }

    constrain(p1, p2, len, k) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const diff = (len - dist) / dist * k; // Spring force
        const ox = dx * diff * 0.5;
        const oy = dy * diff * 0.5;
        p1.x += ox; p1.y += oy;
        p2.x -= ox; p2.y -= oy;
    }

    checkGround(c) {
        // Simple Line Intersection with Terrain segments
        for(let i = 0; i < this.terrain.length - 1; i++) {
            let t1 = this.terrain[i];
            let t2 = this.terrain[i+1];
            if (c.x >= t1.x && c.x <= t2.x) {
                // Interpolate Height
                const t = (c.x - t1.x) / (t2.x - t1.x);
                const gy = t1.y + t * (t2.y - t1.y);
                
                if (c.y + c.r > gy) {
                    const depth = (c.y + c.r) - gy;
                    c.y -= depth;
                    
                    // Traction/Torque
                    const tx = t2.x - t1.x;
                    const ty = t2.y - t1.y;
                    const len = Math.sqrt(tx*tx + ty*ty);
                    const nx = tx/len; // Normal Tangent
                    
                    // Apply Force
                    if (this.input.gas) c.x += nx * this.car.torque;
                    if (this.input.brake) c.x -= nx * this.car.torque;
                    return true;
                }
            }
        }
        return false;
    }

    update() {
        // 1. Integration
        this.integrate(this.car.chassis);
        this.integrate(this.car.fWheel);
        this.integrate(this.car.rWheel);

        // 2. Constraints (Suspension & Chassis)
        this.constrain(this.car.chassis, this.car.fWheel, 50, this.car.stiffness);
        this.constrain(this.car.chassis, this.car.rWheel, 50, this.car.stiffness);
        this.constrain(this.car.fWheel, this.car.rWheel, 80, 1);

        // 3. Collision
        const g1 = this.checkGround(this.car.fWheel);
        const g2 = this.checkGround(this.car.rWheel);
        this.grounded = g1 || g2;

        // 4. Stunt System
        this.car.angle = Math.atan2(this.car.fWheel.y - this.car.rWheel.y, this.car.fWheel.x - this.car.rWheel.x);
        
        if (!this.grounded) {
            this.airTime += 1/60;
            if (this.airTime > 1.0 && this.airTime % 1.0 < 0.05) {
                this.cb.onCoin(50);
                this.cb.onFeedback("AIR TIME +50", this.width/2, this.height/2, "#0ff");
            }
            // Flip Check
            let dAngle = this.car.angle - this.lastAngle;
            if (dAngle > 3) dAngle -= Math.PI*2;
            if (dAngle < -3) dAngle += Math.PI*2;
            this.angleAccumulator += dAngle;

            if (this.angleAccumulator > Math.PI * 1.8) {
                this.cb.onCoin(500);
                this.cb.onFeedback("BACKFLIP +500", this.width/2, this.height/3, "#f0f");
                this.angleAccumulator = 0;
            }
            if (this.angleAccumulator < -Math.PI * 1.8) {
                this.cb.onCoin(750);
                this.cb.onFeedback("FRONTFLIP +750", this.width/2, this.height/3, "#0f0");
                this.angleAccumulator = 0;
            }
        } else {
            this.airTime = 0;
            this.angleAccumulator = 0;
            // Death Check (Roof hit ground)
            if (Math.abs(this.car.angle) > 2.0) {
                this.running = false;
                this.cb.onEnd();
            }
        }
        this.lastAngle = this.car.angle;

        // 5. Game Logic
        this.offset = this.car.chassis.x - this.width / 3;
        this.distance = Math.max(this.distance, Math.floor(this.car.chassis.x / 100));

        // Procedural Gen
        const lastT = this.terrain[this.terrain.length - 1];
        if (lastT.x < this.car.chassis.x + this.width + 500) {
            this.genTerrain(lastT.x + 30);
        }
        // Culling
        if (this.terrain.length > 0 && this.terrain[0].x < this.offset - 1000) {
            this.terrain.shift();
        }

        // Coins
        this.coins.forEach(c => {
            if(!c.collected) {
                const dx = c.x - this.car.chassis.x;
                const dy = c.y - this.car.chassis.y;
                if(dx*dx + dy*dy < 3600) {
                    c.collected = true;
                    this.cb.onCoin(c.val);
                }
            }
        });
    }

    draw() {
        // Clear
        this.ctx.fillStyle = this.config.stage === 'Moon' ? '#111' : '#1e1e24';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(-this.offset, 0);

        // Terrain
        this.ctx.beginPath();
        if (this.terrain.length > 0) this.ctx.moveTo(this.terrain[0].x, this.terrain[0].y);
        for(let t of this.terrain) this.ctx.lineTo(t.x, t.y);
        
        // Color Theme
        let stroke = '#0f9'; // Countryside
        if(this.config.stage === 'Desert') stroke = '#fa0';
        if(this.config.stage === 'Moon') stroke = '#888';
        
        this.ctx.lineWidth = 6;
        this.ctx.strokeStyle = stroke;
        this.ctx.stroke();
        
        // Fill ground
        this.ctx.lineTo(this.terrain[this.terrain.length-1].x, this.height + 500);
        this.ctx.lineTo(this.terrain[0].x, this.height + 500);
        this.ctx.fillStyle = 'rgba(0,0,0,0.8)';
        this.ctx.fill();

        // Coins
        this.coins.forEach(c => {
            if(!c.collected) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.beginPath();
                this.ctx.arc(c.x, c.y, 10, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.fillStyle = '#000';
                this.ctx.font = '10px Arial';
                this.ctx.fillText(c.val, c.x-8, c.y+4);
            }
        });

        // Car
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        
        // Wheels
        [this.car.fWheel, this.car.rWheel].forEach(w => {
            this.ctx.beginPath();
            this.ctx.arc(w.x, w.y, w.r, 0, Math.PI*2);
            this.ctx.fillStyle = '#222';
            this.ctx.fill();
            this.ctx.stroke();
            // Spokes
            this.ctx.beginPath();
            this.ctx.moveTo(w.x, w.y);
            this.ctx.lineTo(w.x + Math.cos(this.car.angle)*w.r, w.y + Math.sin(this.car.angle)*w.r);
            this.ctx.stroke();
        });

        // Chassis
        this.ctx.save();
        this.ctx.translate(this.car.chassis.x, this.car.chassis.y);
        this.ctx.rotate(this.car.angle);
        this.ctx.fillStyle = stroke;
        this.ctx.fillRect(-40, -15, 80, 30);
        // Window
        this.ctx.fillStyle = '#aaf';
        this.ctx.fillRect(-10, -15, 30, 15);
        this.ctx.restore();

        this.ctx.restore();
    }

    loop() {
        if(!this.running) return;

        const now = performance.now();
        const frameTime = now - this.lastTime;
        this.lastTime = now;
        this.accumulator += frameTime;

        // Fixed Physics Step (Zero-Lag Assurance)
        while (this.accumulator >= this.dt) {
            this.update();
            this.accumulator -= this.dt;
        }

        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    setInput(k, v) { this.input[k] = v; }
}

window.GameEngine = GameEngine;
