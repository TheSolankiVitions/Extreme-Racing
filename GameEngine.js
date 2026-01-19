class GameEngine {
    constructor(canvas, config, callbacks) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: false });
        this.config = config;
        this.cb = callbacks;

        // Physics Constants
        this.gravity = config.stage === 'Moon' ? 0.25 : 0.65;
        this.friction = config.stage === 'Desert' ? 0.92 : 0.96;
        
        this.running = false;
        this.fuel = 100;
        this.distance = 0;
        this.coins = [];
        this.terrain = [];
        this.offset = 0;
        this.input = { gas: false, brake: false };
        
        // Safety Features
        this.safeMode = true; // Invincibility flag
        this.startPos = 300; 

        // Physics Resolution
        this.subSteps = 8; // High stability
        
        this.init();
    }

    init() {
        this.width = this.canvas.width = window.innerWidth;
        this.height = this.canvas.height = window.innerHeight;

        // 1. Terrain Generation: SAFETY RUNWAY
        // First 800px are absolutely flat
        const floorY = this.height * 0.7;
        
        for(let x = 0; x < this.width + 1000; x += 20) {
            let y = floorY;
            if (x > 800) {
                // Procedural generation starts after 800px
                y += Math.sin(x * 0.004) * 70 + Math.sin(x * 0.01) * 30;
            }
            this.terrain.push({x, y});

            // Coins (Only generate after 1000px)
            if(x > 1200 && Math.random() < 0.08) {
                this.coins.push({ x, y: y-60, val: Math.random()>0.9?500:50, collected: false });
            }
        }

        // 2. Vehicle Setup: STABLE SPAWN
        const isMonster = this.config.vehicle === 1;
        const scale = isMonster ? 1.4 : 1.0;
        
        // Spawn 100px above floor to let it settle gently
        const spawnY = floorY - 120; 

        // Wheels
        const wheelR = (isMonster ? 32 : 22) * scale;
        
        this.car = {
            c: { x: this.startPos, y: spawnY, ox: this.startPos, oy: spawnY }, 
            fw: { x: this.startPos + 45, y: spawnY + 40, ox: this.startPos + 45, oy: spawnY + 40, r: wheelR }, 
            rw: { x: this.startPos - 45, y: spawnY + 40, ox: this.startPos - 45, oy: spawnY + 40, r: wheelR }, 
            head: { x: this.startPos -
