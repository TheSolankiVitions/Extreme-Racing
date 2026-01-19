const { useState, useEffect, useRef } = React;

// --- Audio Manager ---
const AudioManager = {
    menu: new Audio('background-audio-non-playing.mp3'),
    game: new Audio('background-audio-playing.mp3'),
    playMenu: function() {
        this.game.pause();
        this.game.currentTime = 0;
        this.menu.loop = true;
        this.menu.play().catch(e => console.log("Audio not found - silent mode"));
    },
    playGame: function() {
        this.menu.pause();
        this.menu.currentTime = 0;
        this.game.loop = true;
        this.game.play().catch(e => console.log("Audio not found - silent mode"));
    }
};

const App = () => {
    // 1. Persistence
    const loadData = () => {
        try {
            const d = JSON.parse(localStorage.getItem('extremeRacingSolanki'));
            if(d) return d;
        } catch(e) {}
        return {
            coins: 5000,
            vehicle: 0,
            stage: 'Countryside',
            unlockedVehicles: [0],
            unlockedStages: ['Countryside'],
            upgrades: { engine: 1, suspension: 1, tires: 1, balance: 1 }
        };
    };

    const [data, setData] = useState(loadData);
    const [view, setView] = useState('garage');
    const [sessionCoins, setSessionCoins] = useState(0);
    const [feedback, setFeedback] = useState([]);
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Save on change
    useEffect(() => {
        localStorage.setItem('extremeRacingSolanki', JSON.stringify(data));
    }, [data]);

    // Audio Init
    useEffect(() => {
        if(view === 'garage') AudioManager.playMenu();
        else AudioManager.playGame();
    }, [view]);

    // --- Actions ---
    const actions = {
        buyVehicle: (id, cost) => setData(p => ({...p, coins: p.coins - cost, unlockedVehicles: [...p.unlockedVehicles, id]})),
        selectVehicle: (id) => setData(p => ({...p, vehicle: id})),
        buyStage: (id, cost) => setData(p => ({...p, coins: p.coins - cost, unlockedStages: [...p.unlockedStages, id]})),
        selectStage: (id) => setData(p => ({...p, stage: id})),
        upgrade: (key, cost) => setData(p => ({...p, coins: p.coins - cost, upgrades: {...p.upgrades, [key]: p.upgrades[key]+1}})),
        startGame: () => setView('game')
    };

    // --- Game Logic Handling ---
    const startGameLogic = () => {
        if(!canvasRef.current) return;
        setSessionCoins(0);
        setFeedback([]);
        
        engineRef.current = new window.GameEngine(
            canvasRef.current,
            { vehicle: data.vehicle, stage: data.stage, upgrades: data.upgrades },
            {
                onCoin: (val) => setSessionCoins(p => p + val),
                onEnd: () => {
                    // Slight delay to show crash
                    setTimeout(() => {
                        setData(d => ({...d, coins: d.coins + engineRef.current.coins.reduce((a,c)=>c.collected?a+c.val:a,0) })); // Safe sync
                        setView('garage');
                    }, 1500);
                },
                onFeedback: (text, x, y, col) => {
                    const id = Date.now();
                    setFeedback(p => [...p, { id, text, col }]);
                    setTimeout(() => setFeedback(p => p.filter(f => f.id !== id)), 1200);
                }
            }
        );
    };

    // Mount Game Engine when view changes
    useEffect(() => {
        if(view === 'game') {
            // Short delay to ensure Canvas DOM is ready
            setTimeout(startGameLogic, 50);
        } else {
            if(engineRef.current) engineRef.current.running = false;
        }
    }, [view]);

    // Input Bindings
    const handleInput = (k, v) => {
        if(engineRef.current) engineRef.current.setInput(k, v);
    };

    // Keyboard
    useEffect(() => {
        const kd = (e) => {
            if(view!=='game') return;
            if(e.code === 'ArrowRight' || e.code === 'KeyD') handleInput('gas', true);
            if(e.code === 'ArrowLeft' || e.code === 'KeyA') handleInput('brake', true);
        };
        const ku = (e) => {
            if(view!=='game') return;
            if(e.code === 'ArrowRight' || e.code === 'KeyD') handleInput('gas', false);
            if(e.code === 'ArrowLeft' || e.code === 'KeyA') handleInput('brake', false);
        };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); }
    }, [view]);

    if(view === 'garage') return <window.Garage data={data} actions={actions} />;

    return (
        <div style={{width:'100%', height:'100%'}}>
            <canvas ref={canvasRef} id="game-canvas"></canvas>
            
            <div className="ui-layer">
                <div className="hud-top">
                    <div className="coin-box">COINS: {data.coins + sessionCoins}</div>
                    <div className="stage-box">{data.stage.toUpperCase()}</div>
                </div>

                {/* Floating Text */}
                {feedback.map(f => (
                    <div key={f.id} className="feedback" style={{left:'50%', top:'40%', color:f.col, transform:'translate(-50%)'}}>
                        {f.text}
                    </div>
                ))}

                <div className="controls">
                    <div className="pedal brake" 
                        onPointerDown={(e)=>{e.preventDefault(); handleInput('brake', true)}} 
                        onPointerUp={(e)=>{e.preventDefault(); handleInput('brake', false)}}
                    >BRAKE</div>
                    <div className="pedal gas" 
                        onPointerDown={(e)=>{e.preventDefault(); handleInput('gas', true)}} 
                        onPointerUp={(e)=>{e.preventDefault(); handleInput('gas', false)}}
                    >GAS</div>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
