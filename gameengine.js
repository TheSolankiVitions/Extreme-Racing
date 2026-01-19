class GameEngine {
    constructor(canvas, config, onCoin, onEnd, onFeedback) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.config = config; // { vehicle, stage, upgrades }
        this.onCoin = onCoin;
        this.onEnd = onEnd;
        this.onFeedback = onFeedback;

        // Physics Constants
        this.gravity = config.stage === 'Moon' ? 0.2 : 0.5;
        this.friction = config.stage === 'Desert' ? 0.92 : 0.98;
        this.fps = 60;
        
        // Game State
        this.running = false;
        this.distance = 0;
        this.coins = [];
        this.particles = [];
        this.terrain = [];
        this.offset = 0;
        this.gameSpeed = 0;
        
        // Input
        this.input = { gas: false, brake: false };
        
        // Difficulty
        this.terrainAmp = 100;
        this.terrainFreq = 0.005;
        
        // Stunts
        this.airTime = 0;
        this.rotationAccumulator = 0;
        this.lastAngle = 0;
        this.inAir = false;

        this.init();
    }

    init() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;
        
        // Generate Start Terrain
        for(let i = 0; i < this.width + 500; i+=20) {
            this.generateTerrainPoint(i);
        }

        // Initialize Car (Verlet Body)
        // Vehicle Configs
        const vSpecs = [
            { w: 80, h: 40, wheel: 18, mass: 1.0 }, // Jeep
            { w: 100, h: 50, wheel: 28, mass: 1.5 }, // Monster
            { w: 90, h: 25, wheel: 16, mass: 0.8 }   // Race Car
        ][this.config.vehicle.id];

        // Upgrades affect torque and spring stiffness
        const powerMult = 1 + (this.config.upgrades.engine * 0.1);
        const susMult = 1 + (this.config.upgrades.suspension * 0.1);

        this.car = {
            x: 200, y: 0,
            angle: 0,
            speed: 0,
            chassis: { x: 200, y: 200, oldx: 200, oldy: 200, w: vSpecs.w, h: vSpecs.h },
            fWheel: { x: 200 + 30, y: 200 + 30, oldx: 230, oldy: 230, r: vSpecs.wheel },
            rWheel: { x: 200 - 30, y: 200 + 30, oldx: 170, oldy: 230, r: vSpecs.wheel },
            torque: 0.5 * powerMult,
            stiffness: 0.2 * susMult,
            grounded: false
        };
        
        // Start Loop
        this.running = true;
        this.loop();
    }

    generateTerrainPoint(x) {
        // Difficulty Scaling every 2500 pixels (approx 250m)
        if (x > 0 && x % 2500 === 0) {
            this.terrainAmp *= 1.05;
            this.terrainFreq *= 1.05;
            this.onFeedback("DIFFICULTY UP!", x, 300, "#ff0000");
        }

        // Perlin-ish Noise (Simplified superposition)
        let y = Math.sin(x * this.terrainFreq) * this.terrainAmp + 
                Math.sin(x * this.terrainFreq * 2.5) * (this.terrainAmp/2);
        
        y += this.height / 1.5; // Base height

        this.terrain.push({x, y});

        // Coin Gen
        if (Math.random() < 0.1) {
            const values = [25, 50, 75, 100, 200, 500, 1000];
            // Weight logic based on distance
            let tier = Math.min(6, Math.floor(this.distance / 5000));
            let val = values[Math.floor(Math.random() * (tier + 2)) % values.length];
            this.coins.push({x, y: y - 100, val, collected: false});
        }
    }

    // Verlet Integration
    updatePoint(p) {
        const vx = (p.x - p.oldx) * this.friction;
        const vy = (p.y - p.oldy) * this.friction;
        p.oldx = p.x;
        p.oldy = p.y;
        p.x += vx;
        p.y += vy;
        p.y += this.gravity;
    }

    constrainLength(p1, p2, len, stiffness) {
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        const diff = (len - dist) / dist * stiffness;
        const offsetx = dx * diff * 0.5;
        const offsety = dy * diff * 0.5;
        p1.x += offsetx; p1.y += offsety;
        p2.x -= offsetx; p2.y -= offsety;
    }

    resolveTerrain(circle) {
        // Find segment below
        for (let i = 0; i < this.terrain.length - 1; i++) {
            let t1 = this.terrain[i];
            let t2 = this.terrain[i+1];
            if (circle.x >= t1.x && circle.x <= t2.x) {
                // Line interpolation
                let t = (circle.x - t1.x) / (t2.x - t1.x);
                let groundY = t1.y + t * (t2.y - t1.y);
                
                // Collision
                if (circle.y + circle.r > groundY) {
                    let overlap = (circle.y + circle.r) - groundY;
                    circle.y -= overlap;
                    
                    // Simple friction/traction
                    let tx = t2.x - t1.x;
                    let ty = t2.y - t1.y;
                    let len = Math.sqrt(tx*tx + ty*ty);
                    tx /= len; ty /= len;
                    
                    if (this.input.gas) circle.x += tx * this.car.torque;
                    if (this.input.brake) circle.x -= tx * this.car.torque;
                    
                    return true;
                }
            }
        }
        return false;
    }

    update() {
        if(!this.running) return;

        // Physics Step
        this.updatePoint(this.car.chassis);
        this.updatePoint(this.car.fWheel);
        this.updatePoint(this.car.rWheel);

        // Suspension (Chassis to Wheels)
        this.constrainLength(this.car.chassis, this.car.fWheel, 50, this.car.stiffness);
        this.constrainLength(this.car.chassis, this.car.rWheel, 50, this.car.stiffness);
        // Rigid Chassis
        this.constrainLength(this.car.fWheel, this.car.rWheel, 80, 1.0);

        // Angle Calculation
        this.car.angle = Math.atan2(this.car.fWheel.y - this.car.rWheel.y, this.car.fWheel.x - this.car.rWheel.x);

        // Terrain Collision
        let g1 = this.resolveTerrain(this.car.fWheel);
        let g2 = this.resolveTerrain(this.car.rWheel);
        this.car.grounded = g1 || g2;

        // Stunt Logic: Air Time
        if (!this.car.grounded) {
            this.airTime += 1/60;
            if (this.airTime > 1.0 && Math.floor(this.airTime) > Math.floor(this.airTime - 1/60)) {
                this.onCoin(50); // 50 coins per second
                this.onFeedback("+50 AIR TIME", this.car.chassis.x, this.car.chassis.y);
            }
            
            // Flip Detection
            let delta = this.car.angle - this.lastAngle;
            // Normalize wrap-around
            if (delta > Math.PI) delta -= Math.PI * 2;
            if (delta < -Math.PI) delta += Math.PI * 2;
            
            this.rotationAccumulator += delta;

            if (this.rotationAccumulator > Math.PI * 1.8) {
                this.onCoin(500);
                this.onFeedback("BACKFLIP +500", this.car.chassis.x, this.car.chassis.y, "#ff00ff");
                this.rotationAccumulator = 0;
            }
            if (this.rotationAccumulator < -Math.PI * 1.8) {
                this.onCoin(750);
                this.onFeedback("FRONTFLIP +750", this.car.chassis.x, this.car.chassis.y, "#00ff00");
                this.rotationAccumulator = 0;
            }
        } else {
            this.airTime = 0;
            this.rotationAccumulator = 0;
        }
        this.lastAngle = this.car.angle;

        // Camera Follow
        this.offset = this.car.chassis.x - this.width / 3;
        this.distance = Math.max(this.distance, Math.floor(this.car.chassis.x));

        // Generate Terrain Ahead
        let lastT = this.terrain[this.terrain.length-1];
        if (lastT.x < this.car.chassis.x + this.width + 500) {
            this.generateTerrainPoint(lastT.x + 20);
        }

        // Culling (Memory Mgmt)
        if (this.terrain[0].x < this.offset - 1000) this.terrain.shift();

        // Coin Collection
        this.coins.forEach(c => {
            if (!c.collected && Math.hypot(c.x - this.car.chassis.x, c.y - this.car.chassis.y) < 60) {
                c.collected = true;
                this.onCoin(c.val);
            }
        });

        // Game Over Check (Flip over or stuck)
        // Simple head collision check
        if (Math.abs(this.car.angle) > Math.PI / 1.5 && this.car.grounded) {
            this.running = false;
            setTimeout(this.onEnd, 1000);
        }
    }

    draw() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.save();
        this.ctx.translate(-this.offset, 0);

        // Draw Terrain
        this.ctx.beginPath();
        this.ctx.moveTo(this.terrain[0].x, this.terrain[0].y);
        for(let t of this.terrain) this.ctx.lineTo(t.x, t.y);
        this.ctx.lineWidth = 5;
        this.ctx.strokeStyle = this.config.stage === 'Countryside' ? '#00ff9d' : (this.config.stage === 'Desert' ? '#ffaa00' : '#888');
        this.ctx.stroke();
        
        // Draw Fill
        this.ctx.lineTo(this.terrain[this.terrain.length-1].x, this.height);
        this.ctx.lineTo(this.terrain[0].x, this.height);
        this.ctx.fillStyle = 'rgba(0,0,0,0.5)';
        this.ctx.fill();

        // Draw Car
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        
        // Wheels
        this.ctx.beginPath();
        this.ctx.arc(this.car.fWheel.x, this.car.fWheel.y, this.car.fWheel.r, 0, Math.PI*2);
        this.ctx.arc(this.car.rWheel.x, this.car.rWheel.y, this.car.rWheel.r, 0, Math.PI*2);
        this.ctx.stroke();

        // Chassis
        this.ctx.save();
        this.ctx.translate(this.car.chassis.x, this.car.chassis.y);
        this.ctx.rotate(this.car.angle);
        this.ctx.fillStyle = '#ff0055';
        this.ctx.fillRect(-this.car.chassis.w/2, -this.car.chassis.h/2, this.car.chassis.w, this.car.chassis.h);
        this.ctx.restore();

        // Coins
        this.ctx.textAlign = 'center';
        this.coins.forEach(c => {
            if (!c.collected) {
                this.ctx.fillStyle = '#ffd700';
                this.ctx.beginPath();
                this.ctx.arc(c.x, c.y, 10, 0, Math.PI*2);
                this.ctx.fill();
                this.ctx.font = '12px Arial';
                this.ctx.fillStyle = '#000';
                this.ctx.fillText(c.val, c.x, c.y+4);
            }
        });

        this.ctx.restore();
    }

    loop() {
        if (!this.running) return;
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    setInput(type, active) {
        this.input[type] = active;
    }
}

// Global accessor
window.GameEngine = GameEngine;
