class GameEngine {
    constructor(canvas, config, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.config = config;
        this.cb = callbacks;

        // --- Physics Constants ---
        this.gravity = config.stage === 'Moon' ? 0.25 : 0.6;
        this.friction = config.stage === 'Desert' ? 0.92 : 0.98;
        
        // --- State ---
        this.running = false;
        this.fuel = 100;
        this.distance = 0;
        this.coins = [];
        this.terrain = [];
        this.offset = 0;
        this.shake = 0;
        
        // --- Input & Limits ---
        this.input = { gas: false, brake: false };
        this.startX = 200; // Starting X position
        this.limitX = this.startX - 150; // -15m Limit (150px)

        // --- Stunt Vars ---
        this.airTime = 0;
        this.rotAccum = 0;
        this.lastAngle = 0;
        this.grounded = true;

        this.init();
    }

    init() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        
        // 1. Generate FLAT Start Terrain to prevent immediate death
        // First 500px is perfectly flat
        for(let x=0; x<this.width+1000; x+=20) {
            let y = this.height / 1.5; // Base height
            if(x > 600) {
                // Procedural hills start after 600px
                y += Math.sin(x * 0.005) * 80 + Math.sin(x * 0.01) * 40;
            }
            this.terrain.push({x, y});
            
            // Spawn Coins (after safe zone)
            if(x > 800 && Math.random() < 0.1) {
                this.coins.push({ x, y: y-60, val: Math.random()>0.9 ? 500:50, collected:false });
            }
        }

        // 2. Vehicle Tuning (Stiffer & More Damped)
        const vType = this.config.vehicle;
        const specs = [
            { w: 90, h: 35, wheel: 18, mass: 1.0, power: 0.5 }, // Jeep
            { w: 110, h: 50, wheel: 30, mass: 1.6, power: 0.7 }, // Monster
            { w: 100, h: 25, wheel: 16, mass: 0.9, power: 0.9 }, // Race
            { w: 100, h: 25, wheel: 17, mass: 0.9, power: 1.1 }  // Super
        ][vType];

        // Spawn slightly higher to let it settle
        const startY = (this.height / 1.5) - 100;

        this.car = {
            // Chassis
            c: { x: this.startX, y: startY, ox: this.startX, oy: startY },
            // Front Wheel
            fw: { x: this.startX+35, y: startY+30, ox: this.startX+35, oy: startY+30, r: specs.wheel },
            // Rear Wheel
            rw: { x: this.startX-35, y: startY+30, ox: this.startX-35, oy: startY+30, r: specs.wheel },
            // Driver Head (Offset higher to prevent instant death)
            head: { x: this.startX, y: startY-25, ox: this.startX, oy: startY-25 },
            
            angle: 0,
            power: specs.power,
            
            // SUSPENSION TUNING
            // Higher stiffness = less sag. Higher damping = less bounce.
            suspensionLen: 45,
            stiffness: 0.3,  // Slightly stiffer
            damping: 0.6     // High damping to stop "springing"
        };

        this.running = true;
        this.loop();
    }

    // --- Physics Core (Verlet) ---
    updatePoint(p) {
        let vx = (p.x - p.ox) * this.friction;
        let vy = (p.y - p.oy) * this.friction;
        p.ox = p.x;
        p.oy = p.y;
        p.x += vx;
        p.y += vy + this.gravity;
    }

    constrain(p1, p2, len, k, damping = 0) {
        let dx = p1.x - p2.x;
        let dy = p1.y - p2.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        // Spring Force
        let diff = (len - dist) / dist;
        
        // Damping (Resistance to change in distance)
        // Not perfect in pure Verlet but we simulate by reducing correction magnitude
        let force = diff * k * (1 - damping);

        let ox = dx * force * 0.5;
        let oy = dy * force * 0.5;
        
        p1.x += ox; p1.y += oy;
        p2.x -= ox; p2.y -= oy;
    }

    resolveTerrain(c) {
        for(let i=0; i<this.terrain.length-1; i++) {
            let t1 = this.terrain[i], t2 = this.terrain[i+1];
            if(c.x >= t1.x && c.x <= t2.x) {
                let t = (c.x - t1.x)/(t2.x - t1.x);
                let gy = t1.y + t*(t2.y - t1.y);
                
                if(c.y + c.r > gy) {
                    c.y = gy - c.r;
                    
                    // Traction & Movement
                    let tx = t2.x - t1.x, ty = t2.y - t1.y;
                    let len = Math.hypot(tx, ty);
                    tx/=len; // Normalized Tangent X

                    if(this.fuel > 0) {
                        // GAS: Move forward
                        if(this.input.gas) c.x += tx * this.car.power;
                        
                        // BRAKE / REVERSE
                        // CHECK: Cannot go back past 15m (150px) from start
                        if(this.input.brake) {
                             if (c.x > this.limitX) {
                                c.x -= tx * this.car.power;
                             } else {
                                // Hard stop at limit
                                c.x = this.limitX + 1; 
                                c.ox = c.x; // Kill momentum
                             }
                        }
                    }
                    return true;
                }
            }
        }
        return false;
    }

    update() {
        if(!this.running) return;

        // Fuel Consumption
        if(this.input.gas && this.fuel > 0) this.fuel -= 0.05;
        this.cb.onFuel(this.fuel);
        if(this.fuel <= 0 && Math.abs(this.car.c.x - this.car.c.ox) < 0.1) {
            this.crash("OUT OF FUEL");
        }

        // 1. Update Points
        this.updatePoint(this.car.c);
        this.updatePoint(this.car.fw);
        this.updatePoint(this.car.rw);
        this.updatePoint(this.car.head);

        // 2. Apply Constraints (Rigid Body + Suspension)
        // Suspension: Chassis <-> Wheels (Use Damping!)
        this.constrain(this.car.c, this.car.fw, this.car.suspensionLen, this.car.stiffness, this.car.damping);
        this.constrain(this.car.c, this.car.rw, this.car.suspensionLen, this.car.stiffness, this.car.damping);
        // Axle: Wheel <-> Wheel (Rigid)
        this.constrain(this.car.fw, this.car.rw, 80, 1.0);
        // Head: Chassis <-> Head (Rigid)
        this.constrain(this.car.c, this.car.head, 20, 1.0);

        // 3. Collision
        let g1 = this.resolveTerrain(this.car.fw);
        let g2 = this.resolveTerrain(this.car.rw);
        this.grounded = g1 || g2;

        // 4. Head Collision Check (Game Over)
        // We add a safety tolerance (y + 5) so gently touching grass is okay
        for(let i=0; i<this.terrain.length-1; i++) {
            let t1 = this.terrain[i], t2 = this.terrain[i+1];
            if(this.car.head.x >= t1.x && this.car.head.x <= t2.x) {
                let t = (this.car.head.x - t1.x)/(t2.x - t1.x);
                let gy = t1.y + t*(t2.y - t1.y);
                
                if(this.car.head.y > gy + 5) { // Tolerance added
                    this.crash("HEAD INJURY");
                }
            }
        }

        // 5. Camera & World
        this.car.angle = Math.atan2(this.car.fw.y - this.car.rw.y, this.car.fw.x - this.car.rw.x);
        this.offset = this.car.c.x - this.width/3;
        this.distance = Math.floor((this.car.c.x - 200) / 100);

        // Procedural Gen
        const lastT = this.terrain[this.terrain.length-1];
        if(lastT.x < this.car.c.x + this.width + 500) {
            // Simple noise
            let nx = lastT.x + 20;
            let ny = (this.height/1.5) + Math.sin(nx*0.005)*80 + Math.sin(nx*0.01)*40;
            this.terrain.push({x: nx, y: ny});
            // Cleanup
            if(this.terrain[0].x < this.offset - 1000) this.terrain.shift();
            // Coins
            if(Math.random()<0.05) this.coins.push({x:nx, y:ny-60, val:50, collected:false});
        }

        // Coin Logic
        this.coins.forEach(c => {
            if(!c.collected && Math.hypot(c.x - this.car.c.x, c.y - this.car.c.y) < 50) {
                c.collected = true;
                this.cb.onCoin(c.val); // Plays sound via callback
            }
        });
    }

    crash(reason) {
        if(!this.running) return;
        this.running = false;
        this.shake = 20;
        this.draw();
        this.cb.onEnd({ reason, photo: this.canvas.toDataURL(), stats: { dist: this.distance } });
    }

    draw() {
        // Shake
        let sx = 0, sy = 0;
        if(this.shake>0) { sx=(Math.random()-0.5)*this.shake; sy=(Math.random()-0.5)*this.shake; this.shake*=0.9; }
        
        this.ctx.fillStyle = '#1e1e24';
        this.ctx.fillRect(0,0,this.width,this.height);
        this.ctx.save();
        this.ctx.translate(-this.offset + sx, sy);

        // Terrain
        this.ctx.beginPath();
        if(this.terrain.length) this.ctx.moveTo(this.terrain[0].x, this.terrain[0].y);
        for(let t of this.terrain) this.ctx.lineTo(t.x, t.y);
        this.ctx.strokeStyle = '#0f0';
        this.ctx.lineWidth = 5;
        this.ctx.stroke();
        this.ctx.lineTo(this.terrain[this.terrain.length-1].x, this.height+500);
        this.ctx.lineTo(this.terrain[0].x, this.height+500);
        this.ctx.fillStyle = '#050';
        this.ctx.fill();

        // Car Body
        this.ctx.save();
        this.ctx.translate(this.car.c.x, this.car.c.y);
        this.ctx.rotate(this.car.angle);
        this.ctx.fillStyle = 'red';
        this.ctx.fillRect(-40, -15, 80, 20); // Chassis
        // Head
        this.ctx.fillStyle = '#fcc';
        this.ctx.beginPath();
        this.ctx.arc(0, -25, 10, 0, Math.PI*2); // Head relative to chassis
        this.ctx.fill();
        this.ctx.restore();

        // Wheels
        [this.car.fw, this.car.rw].forEach(w => {
            this.ctx.beginPath();
            this.ctx.arc(w.x, w.y, w.r, 0, Math.PI*2);
            this.ctx.fillStyle = '#222';
            this.ctx.fill();
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        });

        // Coins
        this.coins.forEach(c => {
            if(!c.collected) {
                this.ctx.fillStyle = 'gold';
                this.ctx.beginPath();
                this.ctx.arc(c.x, c.y, 10, 0, Math.PI*2);
                this.ctx.fill();
            }
        });

        this.ctx.restore();
    }

    loop() {
        if(this.running) {
            this.update();
            this.draw();
            requestAnimationFrame(()=>this.loop());
        }
    }

    setInput(k, v) { this.input[k] = v; }
}
window.GameEngine = GameEngine;
