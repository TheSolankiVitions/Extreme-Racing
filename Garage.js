function GameEngine({ vehicle, stage, onGameOver }) {
    const canvasRef = React.useRef(null);
    const engineRef = React.useRef(null);
    const [fuel, setFuel] = React.useState(100);
    const [distance, setDistance] = React.useState(0);
    const [sessionCoins, setSessionCoins] = React.useState(0);
    
    // Gameplay flags
    const isGameOver = React.useRef(false);
    
    React.useEffect(() => {
        const Engine = Matter.Engine,
              Render = Matter.Render,
              Runner = Matter.Runner,
              Composite = Matter.Composite,
              Bodies = Matter.Bodies,
              Body = Matter.Body,
              Events = Matter.Events,
              Vector = Matter.Vector,
              Constraint = Matter.Constraint;

        // 1. Setup Matter JS
        const engine = Engine.create();
        engineRef.current = engine;
        const world = engine.world;
        
        // Zero-lag mandate
        const runner = Runner.create({ isFixed: true });

        const canvas = canvasRef.current;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const ctx = canvas.getContext('2d');

        // 2. Build Vehicle (Simplified Generic Setup tailored to PNGs)
        // Group collision filter to prevent car parts colliding with each other
        const carGroup = Body.nextGroup(true);
        
        const chassis = Bodies.rectangle(200, 300, 140, 60, { 
            collisionFilter: { group: carGroup },
            density: 0.004,
            friction: 0.5,
            label: 'chassis'
        });

        // Wheels
        const wheelA = Bodies.circle(150, 350, 30, { 
            collisionFilter: { group: carGroup },
            friction: 0.9,
            restitution: 0.2, // Bounciness
            label: 'wheel'
        });
        
        const wheelB = Bodies.circle(250, 350, 30, { 
            collisionFilter: { group: carGroup },
            friction: 0.9,
            restitution: 0.2,
            label: 'wheel'
        });

        // Suspension (Damped Harmonic Oscillator)
        const axelA = Constraint.create({
            bodyA: chassis,
            bodyB: wheelA,
            pointA: { x: -50, y: 30 },
            stiffness: 0.1, // k
            damping: 0.05,  // c
            length: 40
        });

        const axelB = Constraint.create({
            bodyA: chassis,
            bodyB: wheelB,
            pointA: { x: 50, y: 30 },
            stiffness: 0.1,
            damping: 0.05,
            length: 40
        });

        // Driver Head (Game Over trigger)
        const head = Bodies.circle(200, 250, 15, {
            collisionFilter: { group: carGroup },
            isSensor: true, // Detects collision but doesn't physically bounce
            label: 'head'
        });
        const neck = Constraint.create({
            bodyA: chassis,
            bodyB: head,
            stiffness: 1,
            length: 0,
            pointA: {x: 0, y: -40}
        });

        Composite.add(world, [chassis, wheelA, wheelB, axelA, axelB, head, neck]);

        // 3. Terrain Generation (Infinite Hills)
        let terrainBodies = [];
        let xOffset = 0;
        
        function generateGround(startX, count) {
            for (let i = 0; i < count; i++) {
                // Procedural generation logic
                const width = 100;
                const height = 50 + Math.random() * 100; 
                const y = 600 - (Math.sin(xOffset * 0.01) * 100); 
                
                const ground = Bodies.rectangle(startX + (i * width), y + 200, width, 500, { 
                    isStatic: true,
                    friction: 0.9,
                    label: 'ground'
                });
                terrainBodies.push(ground);
                Composite.add(world, ground);
                xOffset += width;
            }
        }
        generateGround(0, 20); // Initial ground

        // 4. Input Handling
        const keys = {};
        window.addEventListener('keydown', e => keys[e.code] = true);
        window.addEventListener('keyup', e => keys[e.code] = false);

        // 5. Game Loop
        let backflips = 0;
        let frontflips = 0;
        let lastAngle = 0;
        let airTime = 0;

        // Load Images
        const imgChassis = new Image(); imgChassis.src = vehicle;
        const imgWheel = new Image(); imgWheel.src = 'wheel.png'; // Using generic wheel for now
        const imgStage = new Image(); imgStage.src = stage;
        const imgHead = new Image(); imgHead.src = 'driver_head.png';

        function renderLoop() {
            if (isGameOver.current) return;

            Runner.tick(runner, engine, 1000 / 60);
            
            // Logic
            if (keys['ArrowRight']) {
                Body.setAngularVelocity(wheelA, 0.3);
                Body.setAngularVelocity(wheelB, 0.3);
                setFuel(f => Math.max(0, f - 0.1));
            }
            if (keys['ArrowLeft']) {
                Body.setAngularVelocity(wheelA, -0.2);
                Body.setAngularVelocity(wheelB, -0.2);
                Body.setAngularVelocity(chassis, -0.05); // Mid-air tilt control
            }

            // Camera Follow
            const camX = -chassis.position.x + window.innerWidth / 3;
            const camY = -chassis.position.y + window.innerHeight / 2;

            // Clear Screen
            ctx.fillStyle = '#87CEEB'; // Sky fallback
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw Stage Background (Parallax simplified)
            ctx.drawImage(imgStage, 0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(camX, camY);

            // Draw Terrain
            ctx.fillStyle = '#4a2e0e';
            terrainBodies.forEach(body => {
                ctx.beginPath();
                const vertices = body.vertices;
                ctx.moveTo(vertices[0].x, vertices[0].y);
                for (let j = 1; j < vertices.length; j += 1) {
                    ctx.lineTo(vertices[j].x, vertices[j].y);
                }
                ctx.lineTo(vertices[0].x, vertices[0].y);
                ctx.fill();
                // Texture overlay logic would go here
            });

            // Draw Car Parts (Rotated Images)
            const drawBody = (body, img, w, h) => {
                ctx.save();
                ctx.translate(body.position.x, body.position.y);
                ctx.rotate(body.angle);
                ctx.drawImage(img, -w/2, -h/2, w, h);
                ctx.restore();
            };

            drawBody(chassis, imgChassis, 140, 70);
            drawBody(wheelA, imgWheel, 60, 60);
            drawBody(wheelB, imgWheel, 60, 60);
            drawBody(head, imgHead, 30, 30);

            ctx.restore();

            // Stats Update
            setDistance(Math.floor(chassis.position.x / 100));

            // Infinite Terrain Logic
            if (chassis.position.x > terrainBodies[terrainBodies.length - 5].position.x) {
                generateGround(terrainBodies[terrainBodies.length-1].position.x + 100, 10);
                // Cleanup old logic
                const old = terrainBodies.shift();
                Composite.remove(world, old);
            }

            // Game Over Check (Head collision)
            const collisions = Matter.Query.collides(head, terrainBodies);
            if (collisions.length > 0 || fuel <= 0) {
                isGameOver.current = true;
                const snapshot = canvas.toDataURL(); // Capture screenshot
                onGameOver({
                    snapshot,
                    coins: sessionCoins + Math.floor(chassis.position.x / 10),
                    distance: chassis.position.x / 100,
                    backflips,
                    frontflips
                });
            }

            requestAnimationFrame(renderLoop);
        }

        requestAnimationFrame(renderLoop);

        return () => {
            Runner.stop(runner);
            Engine.clear(engine);
        }
    }, []);

    return (
        <div style={{width: '100%', height: '100%'}}>
            <canvas ref={canvasRef} />
            <div className="hud glass-panel">
                <div>⛽ {Math.floor(fuel)}%</div>
                <div>📏 {distance}m</div>
                <div>🪙 {sessionCoins}</div>
            </div>
        </div>
    );
}
