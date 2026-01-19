const { useState, useEffect, useRef } = React;

const App = () => {
    // 1. Initial State Load from LocalStorage
    const loadState = () => {
        const saved = localStorage.getItem('extremeRacingData');
        if (saved) return JSON.parse(saved);
        return {
            coins: 1000, // Starting bonus
            unlockedVehicles: [0],
            unlockedStages: ['Countryside'],
            currentVehicle: 0,
            currentStage: 'Countryside',
            upgrades: { engine: 1, suspension: 1, tires: 1, balance: 1 }
        };
    };

    const [data, setData] = useState(loadState);
    const [view, setView] = useState('garage'); // garage | game
    const [sessionCoins, setSessionCoins] = useState(0);
    const [feedbacks, setFeedbacks] = useState([]); // For floating text
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // 2. Persistence Effect
    useEffect(() => {
        localStorage.setItem('extremeRacingData', JSON.stringify(data));
    }, [data]);

    // 3. Logic Handlers
    const handlePurchase = (type, id, cost) => {
        if (data.coins >= cost) {
            const newData = { ...data, coins: data.coins - cost };
            if (type === 'vehicle') newData.unlockedVehicles.push(id);
            if (type === 'stage') newData.unlockedStages.push(id);
            setData(newData);
        }
    };

    const handleSelect = (type, id) => {
        if (type === 'vehicle') setData({ ...data, currentVehicle: id });
        if (type === 'stage') setData({ ...data, currentStage: id });
    };

    const handleUpgrade = (stat, cost) => {
        if (data.coins >= cost) {
            setData({
                ...data,
                coins: data.coins - cost,
                upgrades: { ...data.upgrades, [stat]: data.upgrades[stat] + 1 }
            });
        }
    };

    // 4. Game Loop Interface
    const startGame = () => {
        setView('game');
        setSessionCoins(0);
        setFeedbacks([]);
        // Wait for DOM paint
        setTimeout(() => {
            if (canvasRef.current) {
                engineRef.current = new window.GameEngine(
                    canvasRef.current,
                    { 
                        vehicle: { id: data.currentVehicle },
                        stage: data.currentStage,
                        upgrades: data.upgrades 
                    },
                    (amt) => setSessionCoins(prev => prev + amt), // onCoin
                    endGame, // onEnd
                    showFeedback // onFeedback
                );
            }
        }, 100);
    };

    const endGame = () => {
        // Merge coins
        setData(prev => ({ ...prev, coins: prev.coins + engineRef.current.gameCoinBuffer || sessionCoins })); // React state async workaround logic in real app
        // Actually, simplest is to use sessionCoins directly here but inside engine callback closure it might differ.
        // We will force update data from the final state.
        setData(prev => ({ ...prev, coins: prev.coins + sessionCoins }));
        setView('garage');
        engineRef.current = null;
    };

    const showFeedback = (text, x, y, color = '#fff') => {
        const id = Date.now();
        // Determine screen position relative to camera logic is hard in React overlay
        // Simplification: Fixed center feedback or pass styling.
        // In this implementation, we just float it.
        setFeedbacks(prev => [...prev, { id, text, color }]);
        setTimeout(() => {
            setFeedbacks(prev => prev.filter(f => f.id !== id));
        }, 1000);
    };

    // Input handlers mapping to Engine
    const handleInput = (type, active) => {
        if (engineRef.current) engineRef.current.setInput(type, active);
    };

    // Keyboard bindings
    useEffect(() => {
        const down = (e) => {
            if (view !== 'game') return;
            if (e.key === 'ArrowRight' || e.key === 'd') handleInput('gas', true);
            if (e.key === 'ArrowLeft' || e.key === 'a') handleInput('brake', true);
        };
        const up = (e) => {
            if (view !== 'game') return;
            if (e.key === 'ArrowRight' || e.key === 'd') handleInput('gas', false);
            if (e.key === 'ArrowLeft' || e.key === 'a') handleInput('brake', false);
        };
        window.addEventListener('keydown', down);
        window.addEventListener('keyup', up);
        return () => {
            window.removeEventListener('keydown', down);
            window.removeEventListener('keyup', up);
        };
    }, [view]);

    if (view === 'garage') {
        return <Garage data={data} onPurchase={handlePurchase} onSelect={handleSelect} onStart={startGame} onUpgrade={handleUpgrade} />;
    }

    return (
        <div style={{width:'100%', height:'100%'}}>
            <canvas id="game-canvas" ref={canvasRef}></canvas>
            
            {/* HUD */}
            <div className="ui-layer">
                <div className="hud-top">
                    <div className="coin-display">COINS: {data.coins + sessionCoins}</div>
                    <div className="distance-display">{data.currentStage.toUpperCase()}</div>
                </div>

                {/* Feedback Text Layer */}
                {feedbacks.map(f => (
                    <div key={f.id} className="feedback-text" style={{
                        left: '50%', top: '30%', color: f.color, transform: 'translateX(-50%)'
                    }}>
                        {f.text}
                    </div>
                ))}

                <div className="controls interactive">
                    <div className="pedal brake" 
                        onMouseDown={()=>handleInput('brake', true)} 
                        onMouseUp={()=>handleInput('brake', false)}
                        onTouchStart={(e)=>{e.preventDefault(); handleInput('brake', true)}}
                        onTouchEnd={(e)=>{e.preventDefault(); handleInput('brake', false)}}
                    >BRAKE</div>
                    
                    <div className="pedal gas" 
                        onMouseDown={()=>handleInput('gas', true)} 
                        onMouseUp={()=>handleInput('gas', false)}
                        onTouchStart={(e)=>{e.preventDefault(); handleInput('gas', true)}}
                        onTouchEnd={(e)=>{e.preventDefault(); handleInput('gas', false)}}
                    >GAS</div>
                </div>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
