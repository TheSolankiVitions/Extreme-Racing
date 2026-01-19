function GameEngine({ vehicleAsset, stageAsset, onGameOver }) {
    const canvasRef = React.useRef(null);
    const engineRef = React.useRef(null);
    
    // Gameplay State
    const [fuel, setFuel] = React.useState(100);
    const [distance, setDistance] = React.useState(0);
    const [coins, setCoins] = React.useState(0);

    React.useEffect(() => {
        const { Engine, Render, Runner, Composite, Bodies, Body, Constraint, Events, Vector } = Matter;

        // 1. Setup Engine & Zero-Lag Runner
        const engine = Engine.create();
        const world = engine.world;
        const runner = Runner.create({ isFixed: true, delta: 1000 / 60 }); // Locked 60FPS physics
        
        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');

        // 2. Load Images for Custom Renderer
        const imgChassis = new Image(); imgChassis.src = vehicleAsset;
        const imgWheel = new Image(); imgWheel.src = 'wheel.png';
        const imgHead = new Image(); imgHead.src = 'driver_head.png';
        const imgStage = new Image(); imgStage.src = stageAsset; // For Parallax & Terrain Texture
        const imgCoin = new Image(); imgCoin.src = 'coin.png';
        const imgFuel = new Image(); imgFuel.src = 'fuel_can.png';

        // 3. Construct Vehicle (Damped Harmonic Oscillator)
        const group = Body.nextGroup(true);
        
        const chassis = Bodies.rectangle(200, 300, 120, 50, { 
            collisionFilter: { group }, density: 0.002, friction: 0.5, label: 'chassis'
        });

        const wheelA = Bodies.circle(150, 350, 25, { 
            collisionFilter: { group }, friction: 0.9, density: 0.01, label: 'wheel' 
        });
        const wheelB = Bodies.circle(250, 350, 25, { 
            collisionFilter: { group }, friction: 0.9, density: 0.01, label: 'wheel' 
        });

        // Suspension Constraints (k = stiffness, c = damping/frictionAir implicitly in Matter)
        const axelA = Constraint.create({
            bodyA: chassis, bodyB: wheelA, pointA: { x: -45, y: 25 }, stiffness: 0.08, damping: 0.1, length: 45
        });
        const axelB = Constraint.create({
            bodyA: chassis, bodyB: wheelB, pointA: { x: 45, y: 25 }, stiffness: 0.08, damping: 0.1, length: 45
        });

        // Driver Head (Game Over Sensor)
        const head = Bodies.circle(200, 250, 15, { collisionFilter: { group }, label: 'head' });
        const neck = Constraint.create({ bodyA: chassis, bodyB: head, pointA: {x:0, y:-30}, stiffness: 0.2, length: 5 });

        Composite.add(world, [chassis, wheelA, wheelB, axelA, axelB, head, neck]);

        // 4. Procedural Terrain Generation
        const terrainParts = [];
        let xOff = 0;

        function addTerrainChunk(startX) {
            const count = 10;
            const width = 120;
            
            for (let i = 0; i < count; i++) {
                // Noise-like generation
                const y = 600 + Math.sin(xOff * 0.02) * 150 + Math.sin(xOff * 0.05) * 50;
                
                const ground = Bodies.rectangle(startX + (i * width), y + 300, width, 600, {
                    isStatic: true, label: 'ground', friction: 1.0
                });
                
                terrainParts.push(ground);
                Composite.add(world, ground);
                
                // Rewards (Coin High Start Rate check)
                const isEarlyGame = startX < 5000; // First 500m (approx 5000px)
                const spawnRate = isEarlyGame ? 0.8 : 0.3;

                if (Math.random() < spawnRate) {
                    const itemType = Math.random() > 0.9 ? 'fuel' : 'coin';
                    const item = Bodies.circle(startX + (i*width), y - 50, 20, { 
                        isStatic: true, isSensor: true, label: itemType 
                    });
                    Composite.add(world, item);
                }

                xOff += width;
            }
        }
        addTerrainChunk(0);
        addTerrainChunk(1200);

        // 5. Input Handling
        const keys = { ArrowRight: false, ArrowLeft: false };
        window.addEventListener('keydown', e => keys[e.code] = true);
        window.addEventListener('keyup', e => keys[e.code] = false);

        // 6. Game Loop Variables
        let isRunning = true;
        let lastFuelDecay = 0;
        let backflips = 0;
        let frontflips = 0;
        let airFrames = 0;
        let totalRot = 0;
        let prevAngle = 0;

        // 7. Render & Logic Loop
        function loop(time) {
            if (!isRunning) return;
            
            Runner.tick(runner, engine, 1000/60);

            // -- Logic --
            
            // Movement & Fuel
            if (fuel > 0) {
                if (keys.ArrowRight) {
                    Body.setAngularVelocity(wheelA, 0.4);
                    Body.setAngularVelocity(wheelB, 0.4);
                    setFuel(f => Math.max(0, f - 0.05));
                }
                if (keys.ArrowLeft) {
                    Body.setAngularVelocity(wheelA, -0.3);
                    Body.setAngularVelocity(wheelB, -0.3);
                    Body.setAngularVelocity(chassis, -0.05); // Air Control
                    setFuel(f => Math.max(0, f - 0.05));
                }
            } else {
                // Coast to stop (fuel empty)
                if (Math.abs(chassis.velocity.x) < 0.1) endGame('fuel');
            }

            // Stunt Logic
            const angle = chassis.angle;
            const deltaAngle = angle - prevAngle;
            if (Math.abs(chassis.velocity.y) > 1) { // In Air
                airFrames++;
                totalRot += deltaAngle;
                // Check flips (approx 6.28 rads)
                if (totalRot < -6) { backflips++; totalRot = 0; setCoins(c => c+500); }
                if (totalRot > 6) { frontflips++; totalRot = 0; setCoins(c => c+750); }
                
                // Air time reward every second (60 frames)
                if (airFrames % 60 === 0) setCoins(c => c+50);
            } else {
                airFrames = 0;
                totalRot = 0;
            }
            prevAngle = angle;

            // Infinite Terrain & Memory Management
            const playerX = chassis.position.x;
            if (playerX > terrainParts[terrainParts.length - 5].position.x - 2000) {
                addTerrainChunk(terrainParts[terrainParts.length - 1].position.x + 120);
            }
            // Cleanup
            if (terrainParts[0].position.x < playerX - 1500) {
                const old = terrainParts.shift();
                Composite.remove(world, old);
            }

            // Collisions (Coins/Fuel/Head)
            const bodies = Composite.allBodies(world);
            bodies.forEach(b => {
                if (b.label === 'coin' || b.label === 'fuel') {
                    if (Matter.Collision.collides(chassis, b)) {
                        if (b.label === 'coin') setCoins(c => c + 10);
                        if (b.label === 'fuel') setFuel(100);
                        Composite.remove(world, b);
                    }
                }
            });

            // Game Over Check: Head hits ground
            const groundBodies = bodies.filter(b => b.label === 'ground');
            const headCrash = Matter.Query.collides(head, groundBodies);
            if (headCrash.length > 0) endGame('crash');


            // -- Rendering (No Primitives) --
            
            // Camera follow
            const camX = -playerX + window.innerWidth / 3;
            const camY = -chassis.position.y + window.innerHeight / 2;

            // Clear & Draw Parallax Background
            ctx.setTransform(1,0,0,1,0,0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Parallax effect: slower movement than camera
            const bgX = (camX * 0.5) % canvas.width;
            ctx.drawImage(imgStage, bgX, 0, canvas.width, canvas.height);
            ctx.drawImage(imgStage, bgX + canvas.width, 0, canvas.width, canvas.height);

            // Apply Camera
            ctx.translate(camX, camY);

            // Draw Terrain (Textured Fill)
            ctx.fillStyle = ctx.createPattern(imgStage, 'repeat'); // Use stage texture for ground
            ctx.beginPath();
            terrainParts.forEach(t => {
                const v = t.vertices;
                ctx.moveTo(v[0].x, v[0].y);
                for(let k=1; k<v.length; k++) ctx.lineTo(v[k].x, v[k].y);
                ctx.lineTo(v[0].x, v[0].y);
            });
            ctx.fill();
            // Draw a top border for visibility
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.stroke();

            // Draw Sprites
            const drawSprite = (body, img, w, h) => {
                ctx.save();
                ctx.translate(body.position.x, body.position.y);
                ctx.rotate(body.angle);
                ctx.drawImage(img, -w/2, -h/2, w, h);
                ctx.restore();
            };

            // Draw Items
            bodies.forEach(b => {
                if (b.label === 'coin') drawSprite(b, imgCoin, 40, 40);
                if (b.label === 'fuel') drawSprite(b, imgFuel, 40, 40);
            });

            // Draw Car
            drawSprite(chassis, imgChassis, 120, 60);
            drawSprite(wheelA, imgWheel, 50, 50);
            drawSprite(wheelB, imgWheel, 50, 50);
            drawSprite(head, imgHead, 30, 30);

            // Stats Update
            setDistance(Math.floor(playerX / 100));

            requestAnimationFrame(loop);
        }

        function endGame(reason) {
            isRunning = false;
            const snapshot = canvas.toDataURL();
            onGameOver({
                snapshot,
                coins: coins + Math.floor(distance),
                distance,
                airTime: airFrames / 60,
                flips: backflips + frontflips
            });
        }

        requestAnimationFrame(loop);

        return () => {
            isRunning = false;
            Runner.stop(runner);
            Engine.clear(engine);
        };
    }, []);

    return (
        <>
            <canvas ref={canvasRef} />
            <div className="hud">
                <div className="hud-top">
                    <div>📏 {distance} m</div>
                    <div>🪙 {coins}</div>
                </div>
                <div className="fuel-bar-container">
                    <div className="fuel-fill" style={{width: `${fuel}%`}}></div>
                </div>
            </div>
        </>
    );
}
