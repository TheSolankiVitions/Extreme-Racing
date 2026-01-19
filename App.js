const { useState, useEffect, useRef } = React;

// Audio Factory
const AudioSys = {
    menu: new Audio('blackground-audio-non-playing.mp4'), // Will fail gracefully if file missing
    game: new Audio('background-audio-playing.mp4'),
    playMenu: function() { this.game.pause(); this.menu.loop=true; this.menu.play().catch(()=>{}); },
    playGame: function() { this.menu.pause(); this.game.loop=true; this.game.play().catch(()=>{}); },
    stop: function() { this.game.pause(); this.menu.pause(); }
};

const App = () => {
    // 1. Loader State
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState('garage'); // garage, game, result
    
    // 2. Data Persistence
    const loadData = () => {
        try { return JSON.parse(localStorage.getItem('solanki_extreme_v3')) || defaultData; } 
        catch { return defaultData; }
    };
    const defaultData = { coins: 2000, lifetime: 0, unlockedCars: [0], unlockedStages: ['Countryside'], currentCar: 0, currentStage: 'Countryside' };
    
    const [data, setData] = useState(loadData);
    const [session, setSession] = useState({ coins: 0, fuel: 100, feedbacks: [] });
    const [report, setReport] = useState(null);
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Save Logic
    useEffect(() => localStorage.setItem('solanki_extreme_v3', JSON.stringify(data)), [data]);

    // Preloader Simulation
    useEffect(() => {
        setTimeout(() => setLoading(false), 1500); // Fake asset load
        AudioSys.playMenu();
    }, []);

    // Game Actions
    const actions = {
        buyCar: (id, p) => setData(d => ({...d, coins: d.coins-p, unlockedCars: [...d.unlockedCars, id]})),
        setCar: (id) => setData(d => ({...d, currentCar: id})),
        buyStage: (id, p) => setData(d => ({...d, coins: d.coins-p, unlockedStages: [...d.unlockedStages, id]})),
        setStage: (id) => setData(d => ({...d, currentStage: id})),
        start: () => { setView('game'); AudioSys.playGame(); }
    };

    // Engine Mounting
    useEffect(() => {
        if(view === 'game') {
            setSession({ coins: 0, fuel: 100, feedbacks: [] });
            setTimeout(() => {
                if(canvasRef.current) {
                    engineRef.current = new window.GameEngine(
                        canvasRef.current,
                        { vehicle: data.currentCar, stage: data.currentStage },
                        {
                            onFuel: (f) => setSession(s => ({...s, fuel: f})),
                            onCoin: (v) => setSession(s => ({...s, coins: s.coins + v})),
                            onFeedback: (t, x, y) => {
                                const id = Date.now();
                                setSession(s => ({...s, feedbacks: [...s.feedbacks, {id, t, x, y}]}));
                                setTimeout(() => setSession(s => ({...s, feedbacks: s.feedbacks.filter(f=>f.id!==id)})), 1000);
                            },
                            onEnd: (result) => {
                                AudioSys.stop();
                                setReport({...result, coins: engineRef.current.coins.filter(c=>c.collected).reduce((a,b)=>a+b.val,0)});
                                setData(d => ({...d, coins: d.coins + session.coins, lifetime: d.lifetime + session.coins})); // Sync
                                setView('result');
                            }
                        }
                    );
                }
            }, 50);
        }
    }, [view]);

    // Input
    const handleInput = (k, v) => engineRef.current && engineRef.current.setInput(k, v);
    useEffect(() => {
        const kDown = (e) => { if(view==='game') { if(e.key==='ArrowRight') handleInput('gas', true); if(e.key==='ArrowLeft') handleInput('brake', true); }};
        const kUp = (e) => { if(view==='game') { if(e.key==='ArrowRight') handleInput('gas', false); if(e.key==='ArrowLeft') handleInput('brake', false); }};
        window.addEventListener('keydown', kDown); window.addEventListener('keyup', kUp);
        return () => { window.removeEventListener('keydown', kDown); window.removeEventListener('keyup', kUp); };
    }, [view]);

    if(loading) return <div className="loader-screen"><h1>THE SOLANKI VISIONS</h1><div className="loader-bar"><div className="loader-fill" style={{width:'100%'}}></div></div></div>;

    if(view === 'garage') return <window.Garage data={data} actions={actions} />;

    return (
        <div style={{width:'100%', height:'100%'}}>
            <canvas ref={canvasRef} id="game-canvas"></canvas>
            
            {view === 'game' && (
                <div className="hud-layer">
                    <div className="top-bar">
                        <div>{data.currentStage}</div>
                        <div style={{color:'gold'}}>+{session.coins}</div>
                    </div>
                    <div className="fuel-container"><div className="fuel-bar" style={{width: `${session.fuel}%`}}></div></div>
                    <div className="fuel-label">FUEL</div>
                    
                    {session.feedbacks.map(f => (
                        <div key={f.id} className="feedback-text" style={{left: f.x, top: f.y}}>{f.t}</div>
                    ))}

                    <div className="controls">
                        <div className="pedal brake" onPointerDown={()=>handleInput('brake',true)} onPointerUp={()=>handleInput('brake',false)}>BRAKE</div>
                        <div className="pedal gas" onPointerDown={()=>handleInput('gas',true)} onPointerUp={()=>handleInput('gas',false)}>GAS</div>
                    </div>
                </div>
            )}

            {view === 'result' && report && (
                <div className="report-modal">
                    <div className="report-card">
                        <h2 style={{color:'red'}}>{report.reason}</h2>
                        <img src={report.photo} className="crash-photo" />
                        <div className="stat-row"><span>Coins Earned:</span> <span style={{color:'gold'}}>{session.coins}</span></div>
                        <div className="stat-row"><span>Distance:</span> <span>{report.stats.dist}m</span></div>
                        <div className="stat-row"><span>Air Time:</span> <span>{report.stats.air.toFixed(1)}s</span></div>
                        <button className="btn btn-selected" onClick={()=>{setView('garage'); AudioSys.playMenu();}}>RETURN TO GARAGE</button>
                    </div>
                </div>
            )}
        </div>
    );
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
