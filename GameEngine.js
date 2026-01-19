class GameEngine {
    constructor(canvas, config, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.config = config;
        this.cb = callbacks; // onFuel, onCoin, onEnd, onFeedback

        // Physics Config
        this.gravity = config.stage === 'Moon' ? 0.25 : 0.55;
        this.friction = config.stage === 'Desert' ? 0.94 : 0.985;
        this.fps = 60;
        this.dt = 1000 / 60;
        
        // Game State
        this.running = false;
        this.fuel = 100;
        this.fuelMax = 100;
        this.distance = 0;
        this.coins = [];
        this.fuelTanks = [];
        this.terrain = [];
        this.offset = 0;
        this.shake = 0;
        
        // Stunt logic
        this.airTime = 0;
        this.rotAccum = 0;
        this.lastAngle = 0;
        this.grounded = true;

        this.input = { gas: false, brake: false };

        this.init();
    }

    init() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        
        // Generate Terrain
        this.terrainAmp = 80;
        this.terrainFreq = 0.005;
        for(let x=0; x<this.width + 1000; x+=20) this.genTerrain(x);

        // Vehicle Setup (Procedural Sprite Logic)
        const vType = this.config.vehicle; // 0=Jeep, 1=Monster, 2=Race, 3=Super
        const specs = [
            { w: 90, h: 35, wheel: 18, mass: 1.0, power: 0.5 }, // Jeep
            { w: 110, h: 50, wheel: 30, mass: 1.6, power: 0.7 }, // Monster
            { w: 100, h: 25, wheel: 16, mass: 0.9, power: 0.9 }, // Race
            { w: 100, h: 25, wheel: 17, mass: 0.9, power: 1.1 }  // Super
        ][vType];

        const startX = 200;
        const startY = this.height / 2;

        this.car = {
            chassis: { x: startX, y: startY, ox: startX, oy: startY },
            fWheel: { x: startX+35, y: startY+30, ox: startX+35, oy: startY+30, r: specs.wheel },
            rWheel: { x: startX-35, y: startY+30, ox: startX-35, oy: startY+30, r: specs.wheel },
            head: { x: startX, y: startY-20, ox: startX, oy: startY-20 }, // Driver Head
            angle: 0,
            mass: specs.mass,
            power: specs.power,
            specs: specs
        };

        this.running = true;
        this.lastTime = performance.now();
        this.loop();
    }

    genTerrain(x) {
        // Scaling Difficulty
        if(x > 0 && x % 2500 === 0) {
            this.terrainAmp *= 1.05;
            this.terrainFreq *= 1.05;
        }
        
        // Smoother start
        let amp = x < 5000 ? this.terrainAmp * 0.5 : this.terrainAmp;

        let y = Math.sin(x * this.terrainFreq) * amp + 
                Math.sin(x * this.terrainFreq * 2.5) * (amp/2);
        y += this.height / 1.5;
        this.terrain.push({x, y});

        // Spawning
        if (Math.random() < 0.1) {
            // High rate early logic
            let spawnRate = x < 5000 ? 0.8 : 0.3;
            if(Math.random() < spawnRate) {
                // Coins
                this.coins.push({ x, y: y-60, val: Math.random()>0.9 ? 500 : 50, collected:false });
            } else if (Math.random() < 0.05) {
                // Fuel
                this.fuelTanks.push({ x, y: y-60, collected: false });
            }
        }
    }

    // Verlet Physics
    updatePoint(p) {
        let vx = (p.x - p.ox) * this.friction;
        let vy = (p.y - p.oy) * this.friction;
        p.ox = p.x;
        p.oy = p.y;
        p.x += vx;
        p.y += vy + this.gravity;
    }

    constrain(p1, p2, dist, k) {
        let dx = p1.x - p2.x, dy = p1.y - p2.y;
        let d = Math.sqrt(dx*dx + dy*dy);
        let diff = (dist - d) / d * k;
        let ox = dx * diff * 0.5;
        let oy = dy * diff * 0.5;
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
                    // Traction
                    let tx = t2.x - t1.x, ty = t2.y - t1.y;
                    let len = Math.hypot(tx, ty);
                    tx/=len; ty/=len;
                    
                    if(this.fuel > 0) {
                        if(this.input.gas) c.x += tx * this.car.power;
                        if(this.input.brake) c.x -= tx * this.car.power;
                    }
                    return true;
                }
            }
        }
        return false;
    }

    triggerCrash(reason) {
        if(!this.running) return;
        this.running = false;
        this.shake = 20;
        this.draw(); // Draw final frame
        const photo = this.canvas.toDataURL();
        this.cb.onEnd({ reason, photo, stats: { dist: this.distance, air: this.airTime, flips: 0 }});
    }

    update() {
        if(!this.running) return;

        // Fuel Logic
        if(this.input.gas && this.fuel > 0) this.fuel -= 0.08;
        this.fuel = Math.max(0, this.fuel);
        this.cb.onFuel(this.fuel);
        if(this.fuel <= 0 && Math.abs(this.car.chassis.x - this.car.chassis.ox) < 0.1) {
            this.triggerCrash("OUT OF FUEL");
        }

        // Physics Steps
        this.updatePoint(this.car.chassis);
        this.updatePoint(this.car.fWheel);
        this.updatePoint(this.car.rWheel);
        this.updatePoint(this.car.head);

        // Constraints
        this.constrain(this.car.chassis, this.car.fWheel, 45, 0.2); // Suspension
        this.constrain(this.car.chassis, this.car.rWheel, 45, 0.2);
        this.constrain(this.car.fWheel, this.car.rWheel, 80, 1); // Axle
        this.constrain(this.car.chassis, this.car.head, 15, 1); // Neck

        this.car.angle = Math.atan2(this.car.fWheel.y - this.car.rWheel.y, this.car.fWheel.x - this.car.rWheel.x);

        // Collision
        let g1 = this.resolveTerrain(this.car.fWheel);
        let g2 = this.resolveTerrain(this.car.rWheel);
        this.grounded = g1 || g2;

        // Head Collision (Fatal)
        for(let i=0; i<this.terrain.length-1; i++) {
            let t1 = this.terrain[i], t2 = this.terrain[i+1];
            if(this.car.head.x >= t1.x && this.car.head.x <= t2.x) {
                let t = (this.car.head.x - t1.x)/(t2.x - t1.x);
                let gy = t1.y + t*(t2.y - t1.y);
                if(this.car.head.y > gy) this.triggerCrash("HEAD INJURY");
            }
        }

        // Stunts
        if(!this.grounded) {
            this.airTime += 1/60;
            let dAngle = this.car.angle - this.lastAngle;
            if(dAngle > 3) dAngle -= Math.PI*2;
            if(dAngle < -3) dAngle += Math.PI*2;
            this.rotAccum += dAngle;
            
            if(this.rotAccum > Math.PI*1.8) {
                this.cb.onCoin(500);
                this.cb.onFeedback("BACKFLIP +500", this.width/2, this.height/3);
                this.rotAccum = 0;
            }
            if(this.rotAccum < -Math.PI*1.8) {
                this.cb.onCoin(750);
                this.cb.onFeedback("FRONTFLIP +750", this.width/2, this.height/3);
                this.rotAccum = 0;
            }
        } else {
            this.rotAccum = 0;
        }
        this.lastAngle = this.car.angle;

        // World Move
        this.offset = this.car.chassis.x - this.width/3;
        this.distance = Math.floor(this.car.chassis.x / 100);

        // Procedural Generation & Cleanup
        const lastT = this.terrain[this.terrain.length-1];
        if(lastT.x < this.car.chassis.x + this.width + 500) this.genTerrain(lastT.x + 20);
        if(this.terrain[0].x < this.offset - 1000) this.terrain.shift();

        // Collectibles
        this.coins.forEach(c => {
            if(!c.collected && Math.hypot(c.x - this.car.chassis.x, c.y - this.car.chassis.y) < 50) {
                c.collected = true;
                this.cb.onCoin(c.val);
            }
        });
        this.fuelTanks.forEach(f => {
            if(!f.collected && Math.hypot(f.x - this.car.chassis.x, f.y - this.car.chassis.y) < 50) {
                f.collected = true;
                this.fuel = Math.min(this.fuelMax, this.fuel + 25);
                this.cb.onFeedback("FUEL UP", f.x - this.offset, f.y);
            }
        });
    }

    draw() {
        // Shake Effect
        let sx = 0, sy = 0;
        if(this.shake > 0) {
            sx = (Math.random()-0.5)*this.shake;
            sy = (Math.random()-0.5)*this.shake;
            this.shake *= 0.9;
            if(this.shake < 0.5) this.shake = 0;
        }

        this.ctx.fillStyle = this.config.stage === 'Moon' ? '#111' : '#87CEEB'; // Sky
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(-this.offset + sx, sy);

        // Draw Terrain
        this.ctx.beginPath();
        if(this.terrain.length) this.ctx.moveTo(this.terrain[0].x, this.terrain[0].y);
        for(let t of this.terrain) this.ctx.lineTo(t.x, t.y);
        
        // Texture Logic
        this.ctx.fillStyle = this.config.stage === 'Moon' ? '#555' : (this.config.stage==='Desert'?'#eecfa1':'#228B22');
        this.ctx.lineWidth = 10;
        this.ctx.strokeStyle = this.config.stage === 'Moon' ? '#888' : '#006400';
        this.ctx.stroke();
        this.ctx.lineTo(this.terrain[this.terrain.length-1].x, this.height+500);
        this.ctx.lineTo(this.terrain[0].x, this.height+500);
        this.ctx.fill();

        // Items
        this.coins.forEach(c => {
            if(!c.collected) {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.beginPath();
                this.ctx.arc(c.x, c.y, 8, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.stroke();
            }
        });
        this.fuelTanks.forEach(f => {
            if(!f.collected) {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.fillRect(f.x-10, f.y-15, 20, 30);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '10px Arial';
                this.ctx.fillText("F", f.x-3, f.y+5);
            }
        });

        // Draw Car (Procedural Sprite - No Boxes)
        this.ctx.save();
        this.ctx.translate(this.car.chassis.x, this.car.chassis.y);
        this.ctx.rotate(this.car.angle);
        
        // Car Body (Stylized)
        this.ctx.fillStyle = ['#4caf50', '#ff5722', '#ffeb3b', '#e91e63'][this.config.vehicle];
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 2;
        
        // Custom Car Shapes
        this.ctx.beginPath();
        if(this.config.vehicle === 0) { // Jeep
            this.ctx.rect(-40, -15, 80, 20);
            this.ctx.rect(-35, -35, 50, 20); // Cabin
        } else if (this.config.vehicle === 1) { // Monster
            this.ctx.moveTo(-50, -10);
            this.ctx.lineTo(50, -10);
            this.ctx.lineTo(50, -40);
            this.ctx.lineTo(-30, -40);
            this.ctx.lineTo(-50, -20);
        } else { // Race
            this.ctx.moveTo(-50, 0);
            this.ctx.bezierCurveTo(-30, -30, 30, -30, 50, 0);
        }
        this.ctx.fill();
        this.ctx.stroke();

        // Driver (Head)
        this.ctx.translate(0, -25);
        this.ctx.fillStyle = '#fdb';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 8, 0, Math.PI*2);
        this.ctx.fill();
        // Helmet
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 8, Math.PI, Math.PI*2);
        this.ctx.fill();

        this.ctx.restore(); // End Car Body

        // Wheels (Independent)
        [this.car.fWheel, this.car.rWheel].forEach(w => {
            this.ctx.save();
            this.ctx.translate(w.x, w.y);
            this.ctx.rotate(w.x * 0.05); // Roll visual
            this.ctx.beginPath();
            this.ctx.arc(0,0, w.r, 0, Math.PI*2);
            this.ctx.fillStyle = '#111';
            this.ctx.fill();
            this.ctx.strokeStyle = '#555';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();
            // Rims
            this.ctx.strokeStyle = '#ccc';
            this.ctx.beginPath();
            this.ctx.moveTo(0, -w.r+5); this.ctx.lineTo(0, w.r-5);
            this.ctx.moveTo(-w.r+5, 0); this.ctx.lineTo(w.r-5, 0);
            this.ctx.stroke();
            this.ctx.restore();
        });

        this.ctx.restore(); // End World
    }

    loop() {
        if(!this.running) return;
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    setInput(k, v) { this.input[k] = v; }
}
window.GameEngine = GameEngine;
