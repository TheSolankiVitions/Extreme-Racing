const { useState, useEffect, useRef } = React;

// --- AUDIO MANAGER ---
const AudioSys = {
    // Files exactly as requested
    menu: new Audio('blackground-audio-non-playing.mp4'),
    game: new Audio('backgroung-audio-playing.mp4'),
    // Coin SFX (using a placeholder generic beep if file not provided, or logic for it)
    // Since user didn't give coin filename, we'll create a simple Oscillator beep for now
    // OR try to load 'coin.mp3' if they add it later.
    playCoin: function() {
        // Simple synthetic beep to ensure sound works immediately without extra file
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800; // High beep like hill climb
            gain.gain.value = 0.1;
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } catch(e) {}
    },
    
    // States
    enterMenu: function() {
        this.game.pause();
        this.game.currentTime = 0;
        this.menu.loop = true;
        this.menu.play().catch(e => console.log("Click to enable audio"));
    },
    enterGame: function() {
        this.menu.pause();
        this.menu.currentTime = 0;
        this.game.loop = true;
        this.game.play().catch(e => console.log("Game Audio Blocked"));
    },
    stopAll: function() {
        this.menu.pause();
        this.game.pause();
    }
};

const App = () => {
    const [view, setView] = useState('garage');
    const [data, setData] = useState({ coins: 0 });
    const [session, setSession] = useState({ coins: 0, fuel: 100 });
    const [report, setReport] = useState(null);
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Initial Audio Trigger
    useEffect(() => {
        // Try to play menu audio on mount
        AudioSys.enterMenu();
    }, []);

    const actions = {
        start: () => {
            setView('game');
            AudioSys.enterGame(); // Switch audio immediately
        }
    };

    // Mount Game Engine
    useEffect(() => {
        if(view === 'game') {
            setSession({ coins: 0, fuel: 100 });
            setTimeout(() => {
                if(canvasRef.current) {
                    engineRef.current = new window.GameEngine(
                        canvasRef.current,
                        { vehicle: 0, stage: 'Countryside' },
                        {
                            onFuel: (f) => setSession(s => ({...s, fuel:f})),
                            onCoin: (v) => {
                                setSession(s => ({...s, coins: s.coins + v}));
                                AudioSys.playCoin(); // Trigger SFX
                            },
                            onEnd: (res) => {
                                AudioSys.stopAll(); // Silence on crash
                                setReport(res);
                                setData(d => ({...d, coins: d.coins + session.coins}));
                                setView('report');
                            }
                        }
                    );
                }
            }, 100);
        }
    }, [view]);

    // Inputs
    const handleInput = (k, v) => engineRef.current && engineRef.current.setInput(k, v);
    useEffect(() => {
        const kd = (e) => {
            if(view!=='game') return;
            if(e.key === 'ArrowRight' || e.key === 'd') handleInput('gas', true);
            if(e.key === 'ArrowLeft' || e.key === 'a') handleInput('brake', true);
        };
        const ku = (e) => {
            if(view!=='game') return;
            if(e.key === 'ArrowRight' || e.key === 'd') handleInput('gas', false);
            if(e.key === 'ArrowLeft' || e.key === 'a') handleInput('brake', false);
        };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); }
    }, [view]);

    return (
        <div style={{width:'100%', height:'100%'}}>
            {/* Garage View */}
            {view === 'garage' && <window.Garage data={data} actions={actions} />}

            {/* Game View */}
            {view === 'game' && (
                <div style={{width:'100%', height:'100%'}}>
                    <canvas ref={canvasRef} id="game-canvas"></canvas>
                    <div className="hud-layer">
                        <div className="top-bar">
                            <div>{Math.floor(data.coins + session.coins)}</div>
                            <div>{Math.floor((engineRef.current?.distance || 0))}m</div>
                        </div>
                        <div className="fuel-wrap"><div className="fuel-fill" style={{width:`${session.fuel}%`}}></div></div>
                        <div className="fuel-text">FUEL</div>
                        <div className="controls">
                            <div className="pedal brake" onPointerDown={()=>handleInput('brake', true)} onPointerUp={()=>handleInput('brake', false)}>BRAKE</div>
                            <div className="pedal gas" onPointerDown={()=>handleInput('gas', true)} onPointerUp={()=>handleInput('gas', false)}>GAS</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Report View */}
            {view === 'report' && report && (
                <div className="modal">
                    <div className="report">
                        <h2 style={{color:'red'}}>{report.reason}</h2>
                        <img src={report.photo} className="crash-img" />
                        <h3>Earned: {session.coins}</h3>
                        <h3>Distance: {report.stats.dist}m</h3>
                        <button className="btn btn-go" onClick={()=>{setView('garage'); AudioSys.enterMenu();}}>RETURN TO GARAGE</button>
                    </div>
                </div>
            )}
        </div>
    );
};
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
