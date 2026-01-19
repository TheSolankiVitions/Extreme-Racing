class GameEngine {
    constructor(canvas, config, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.config = config;
        this.cb = callbacks;

        this.gravity = config.stage === 'Moon' ? 0.2 : 0.6; // Slightly heavier gravity for realism
        this.friction = config.stage === 'Desert' ? 0.90 : 0.97;
        
        this.running = false;
        this.fuel = 100;
        this.distance = 0;
        this.coins = [];
        this.terrain = [];
        this.offset = 0;
        
        this.input = { gas: false, brake: false };
        this.startPos = 250; 
        this.limitBack = this.startPos - 150; // 15m limit (approx 150px)

        // Physics Loop
        this.fps = 60;
        this.dt = 1; // Time step
        this.subSteps = 8; // CRITICAL: Run constraints 8 times per frame for stability

        this.init();
    }

    init() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

        // 1. Generate Terrain (Flat Start)
        // Hardcode first 600px to be flat floor at 70% height
        const floorY = this.height * 0.75;
        for(let x = 0; x < this.width + 1000; x += 20) {
            let y = floorY;
            if(x > 800) {
                // Gentle hills after 800px
                y += Math.sin(x * 0.003) * 60 + Math.sin(x * 0.01) * 30;
            }
            this.terrain.push({x, y});

            // Coins
            if(x > 1000 && Math.random() < 0.08) {
                this.coins.push({ x, y: y-60, val: Math.random()>0.9 ? 500 : 50, collected: false });
            }
        }

        // 2. Vehicle Setup (Realistic Geometry)
        // Tune suspension to be "Plush" not "Bouncy"
        const isMonster = this.config.vehicle === 1;
        const scale = isMonster ? 1.4 : 1.0;
        
        const spawnY = floorY - 100; // Drop gently onto floor

        // Specs
        const wheelR = (isMonster ? 32 : 20) * scale;
        
        this.car = {
            c: { x: this.startPos, y: spawnY, ox: this.startPos, oy: spawnY }, // Chassis center
            fw: { x: this.startPos + 40, y: spawnY + 40, ox: this.startPos + 40, oy: spawnY + 40, r: wheelR }, // Front Wheel
            rw: { x: this.startPos - 40, y: spawnY + 40, ox: this.startPos - 40, oy: spawnY + 40, r: wheelR }, // Rear Wheel
            head: { x: this.startPos - 10, y: spawnY - 30, ox: this.startPos - 10, oy: spawnY - 30, r: 12 }, // Driver Head
            
            angle: 0,
            mass: isMonster ? 2.0 : 1.2,
            power: isMonster ? 0.6 : 0.5,
            
            // Suspension: Critical Tuning
            susLen: 50 * scale,
            stiff: 0.15, // Low stiffness = soft suspension
            damp: 0.85   // High damping = no bounce
        };

        this.running = true;
        this.loop();
    }

    // --- High Fidelity Procedural Graphics ---
    drawCar() {
        const c = this.car.c;
        const ang = this.car.angle;

        this.ctx.save();
        this.ctx.translate(c.x, c.y);
        this.ctx.rotate(ang);

        // 1. Chassis Body (Realistic Jeep Shape)
        this.ctx.fillStyle = this.config.vehicle===1 ? '#e74c3c' : '#2ecc71'; // Red for Monster, Green for Jeep
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        // Hood
        this.ctx.moveTo(40, 10);
        this.ctx.lineTo(45, 0);
        this.ctx.lineTo(-45, 0); // Bed
        this.ctx.lineTo(-50, 10);
        this.ctx.lineTo(-45, 20);
        this.ctx.lineTo(40, 20);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        // Roll Cage / Roof
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = '#444';
        this.ctx.beginPath();
        this.ctx.moveTo(-35, 0);
        this.ctx.lineTo(-35, -35);
        this.ctx.lineTo(10, -35);
        this.ctx.lineTo(30, 0);
        this.ctx.stroke();
        
        // Driver Body
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = '#000';
        this.ctx.beginPath();
        this.ctx.moveTo(-10, 0); // Hip
        this.ctx.lineTo(-10, -25); // Neck base
        this.ctx.lineTo(15, -15); // Arms to wheel
        this.ctx.stroke();

        this.ctx.restore();

        // 2. Driver Head (Physics Object)
        this.ctx.save();
        this.ctx.translate(this.car.head.x, this.car.head.y);
        this.ctx.rotate(ang * 0.5); // Slight head bob
        
        // Helmet
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 11, 0, Math.PI*2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Visor
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.moveTo(4, -5);
        this.ctx.quadraticCurveTo(11, 0, 4, 5);
        this.ctx.lineTo(2, 5);
        this.ctx.lineTo(2, -5);
        this.ctx.fill();
        this.ctx.restore();

        // 3. Wheels (Detailed)
        [this.car.fw, this.car.rw].forEach(w => {
            this.ctx.save();
            this.ctx.translate(w.x, w.y);
            // Rotate visual based on X position to simulate rolling
            this.ctx.rotate(w.x / w.r); 

            // Tire
            this.ctx.fillStyle = '#111';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, w.r, 0, Math.PI*2);
            this.ctx.fill();
            
            // Rim
            this.ctx.fillStyle = '#555';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, w.r * 0.6, 0, Math.PI*2);
            this.ctx.fill();
            
            // Bolts/Spokes
            this.ctx.fillStyle = '#ccc';
            this.ctx.beginPath();
            for(let i=0; i<5; i++) {
                this.ctx.rotate(Math.PI*2/5);
                this.ctx.rect(-2, -w.r*0.5, 4, w.r*0.4);
            }
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }

    drawTerrain() {
        this.ctx.beginPath();
        this.ctx.moveTo(this.terrain[0].x, this.terrain[0].y);
        for(let i=1; i<this.terrain.length; i++) {
            this.ctx.lineTo(this.terrain[i].x, this.terrain[i].y);
        }
        
        // Gradients for Realism
        let grad = this.ctx.createLinearGradient(0, 0, 0, this.height);
        if(this.config.stage === 'Desert') {
            grad.addColorStop(0.5, '#e67e22'); // Sand top
            grad.addColorStop(1, '#d35400');    // Sand deep
        } else if (this.config.stage === 'Moon') {
            grad.addColorStop(0.5, '#bdc3c7'); // Grey
            grad.addColorStop(1, '#7f8c8d');
        } else {
            grad.addColorStop(0.5, '#2ecc71'); // Grass
            grad.addColorStop(1, '#27ae60');   // Dirt
        }

        this.ctx.fillStyle = grad;
        this.ctx.lineTo(this.terrain[this.terrain.length-1].x, this.height);
        this.ctx.lineTo(this.terrain[0].x, this.height);
        this.ctx.fill();
        
        // Top Stroke
        this.ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        this.ctx.lineWidth = 5;
        this.ctx.stroke();
    }

    // --- SUB-STEPPED PHYSICS ---
    update() {
        if(this.input.gas && this.fuel > 0) this.fuel -= 0.05;
        this.cb.onFuel(this.fuel);
        if(this.fuel <= 0 && Math.abs(this.car.c.x - this.car.c.ox) < 0.01) this.endGame("OUT OF FUEL");

        // Run Constraints multiple times for stability
        for(let s=0; s<this.subSteps; s++) {
            this.verlet();
            this.constraints();
            this.collisions();
        }

        // Game Logic
        this.car.angle = Math.atan2(this.car.fw.y - this.car.rw.y, this.car.fw.x - this.car.rw.x);
        
        // Head Collision (Fatal)
        // Check if head is below terrain line
        if(this.checkHeadCrash()) this.endGame("HEAD INJURY");

        // Scroll
        this.offset = this.car.c.x - this.width * 0.3;
        this.distance = Math.floor((this.car.c.x - 250) / 50); // Scale meters

        // Gen Terrain
        let last = this.terrain[this.terrain.length-1];
        if(last.x < this.car.c.x + this.width + 200) {
            let nx = last.x + 20;
            let ny = (this.height*0.75) + Math.sin(nx*0.003)*60 + Math.sin(nx*0.01)*30;
            this.terrain.push({x: nx, y: ny});
            if(this.terrain[0].x < this.offset - 500) this.terrain.shift();
            
            // Coins
            if(Math.random() < 0.05) this.coins.push({x:nx, y:ny-60, val:50, collected:false});
        }
        
        // Coin Collect
        this.coins.forEach(c => {
            if(!c.collected && Math.hypot(c.x - this.car.c.x, c.y - this.car.c.y) < 60) {
                c.collected = true;
                this.cb.onCoin(c.val);
            }
        });
    }

    verlet() {
        // Apply Gravity & Velocity
        const applyForce = (p, m) => {
            let vx = (p.x - p.ox) * this.friction;
            let vy = (p.y - p.oy) * this.friction;
            p.ox = p.x;
            p.oy = p.y;
            p.x += vx;
            p.y += vy + (this.gravity / this.subSteps); // Scale gravity
        };
        applyForce(this.car.c);
        applyForce(this.car.fw);
        applyForce(this.car.rw);
        applyForce(this.car.head);
    }

    constraints() {
        const link = (p1, p2, len, k, damp) => {
            let dx = p1.x - p2.x;
            let dy = p1.y - p2.y;
            let d = Math.sqrt(dx*dx + dy*dy);
            let diff = (len - d) / d;
            let force = diff * k * (1-damp); 
            let ox = dx * force * 0.5;
            let oy = dy * force * 0.5;
            p1.x += ox; p1.y += oy;
            p2.x -= ox; p2.y -= oy;
        };

        // Suspension (Soft & Damped)
        link(this.car.c, this.car.fw, this.car.susLen, this.car.stiff, this.car.damp);
        link(this.car.c, this.car.rw, this.car.susLen, this.car.stiff, this.car.damp);
        
        // Rigid Chassis
        link(this.car.fw, this.car.rw, 80 * (this.config.vehicle===1?1.4:1), 1.0, 0); 
        // Rigid Head
        link(this.car.c, this.car.head, 35, 1.0, 0);
    }

    collisions() {
        const check = (c) => {
            // Find terrain segment
            // Simple optimization: terrain points are 20px apart
            // Calculate index approx
            let idx = Math.floor((c.x - this.terrain[0].x) / 20);
            if(idx < 0 || idx >= this.terrain.length-1) return;

            let t1 = this.terrain[idx];
            let t2 = this.terrain[idx+1];

            // Lerp
            let t = (c.x - t1.x) / (t2.x - t1.x);
            let gy = t1.y + t * (t2.y - t1.y);

            if(c.y + c.r > gy) {
                c.y = gy - c.r;
                
                // Traction
                let tx = t2.x - t1.x, ty = t2.y - t1.y;
                let len = Math.hypot(tx, ty);
                tx /= len;
                
                if(this.fuel > 0) {
                    let force = (this.car.power / this.subSteps);
                    if(this.input.gas) c.x += tx * force;
                    
                    // REVERSE LIMIT
                    if(this.input.brake) {
                        if(c.x > this.limitBack) c.x -= tx * force;
                        else {
                             c.x = this.limitBack + 1;
                             let vx = c.x - c.ox;
                             if(vx < 0) c.ox = c.x; // Kill backward momentum
                        }
                    }
                }
            }
        };
        check(this.car.fw);
        check(this.car.rw);
    }

    checkHeadCrash() {
        let h = this.car.head;
        let idx = Math.floor((h.x - this.terrain[0].x) / 20);
        if(idx >= 0 && idx < this.terrain.length-1) {
            let t1 = this.terrain[idx];
            let t2 = this.terrain[idx+1];
            let t = (h.x - t1.x)/(t2.x - t1.x);
            let gy = t1.y + t*(t2.y - t1.y);
            if(h.y + h.r > gy + 5) return true; // +5 tolerance
        }
        return false;
    }

    endGame(reason) {
        if(!this.running) return;
        this.running = false;
        this.draw();
        this.cb.onEnd({ reason, stats: {dist: this.distance} });
    }

    draw() {
        // Sky
        this.ctx.fillStyle = this.config.stage==='Moon' ? '#111' : (this.config.stage==='Desert'?'#fdf3e7':'#87CEEB');
        this.ctx.fillRect(0,0,this.width,this.height);
        
        this.ctx.save();
        this.ctx.translate(-this.offset, 0);

        this.drawTerrain();
        this.drawCar();

        // Coins
        this.coins.forEach(c => {
            if(!c.collected) {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.beginPath();
                this.ctx.arc(c.x, c.y, 8, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#DAA520';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
            }
        });

        this.ctx.restore();
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
