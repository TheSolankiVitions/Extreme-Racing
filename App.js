const { useState, useEffect, useRef } = React;

// --- AUDIO SYSTEM (SAFE) ---
const AudioSys = {
    bgm: null,
    
    playGameMusic: function() {
        if(this.bgm) this.bgm.pause();
        // Uses the file you requested. If missing, it simply logs a warning instead of crashing.
        this.bgm = new Audio('backgroung-audio-playing.mp4'); 
        this.bgm.loop = true;
        this.bgm.volume = 0.6;
        this.bgm.play().catch(e => console.warn("Audio file missing or blocked:", e));
    },

    stopMusic: function() {
        if(this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    },

    playMenuMusic: function() {
        if(this.bgm) this.bgm.pause();
        this.bgm = new Audio('blackground-audio-non-playing.mp4');
        this.bgm.loop = true;
        this.bgm.volume = 0.5;
        this.bgm.play().catch(e => console.warn("Audio file missing or blocked:", e));
    }
};

const App = () => {
    const [view, setView] = useState('garage');
    const [data, setData] = useState({ coins: 500, unlockedCars: [0], currentCar: 0 });
    const [session, setSession] = useState({ coins: 0, fuel: 100 });
    const [report, setReport] = useState(null);
    const canvasRef = useRef(null);
    const engineRef = useRef(null);

    // Initial Menu Music (Must be triggered by user usually, but we try on load)
    useEffect(() => {
        const clickToStart = () => {
             AudioSys.playMenuMusic();
             window.removeEventListener('click', clickToStart);
        };
        window.addEventListener('click', clickToStart);
    }, []);

    const actions = {
        buyCar: (id, p) => setData(d => ({...d, coins: d.coins-p, unlockedCars: [...d.unlockedCars, id]})),
        setCar: (id) => setData(d => ({...d, currentCar: id})),
        start: () => {
            setView('game');
            AudioSys.playGameMusic();
        }
    };

    // Mount Game
    useEffect(() => {
        if(view === 'game') {
            setSession({ coins: 0, fuel: 100 });
            setTimeout(() => {
                if(canvasRef.current) {
                    engineRef.current = new window.GameEngine(
                        canvasRef.current,
                        { vehicle: data.currentCar, stage: 'Countryside' },
                        {
                            onFuel: (f) => setSession(s => ({...s, fuel: f})),
                            onCoin: (v) => setSession(s => ({...s, coins: s.coins + v})),
                            onEnd: (res) => {
                                AudioSys.stopMusic();
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

    // Input Handling
    const handleInput = (k, v) => engineRef.current && engineRef.current.setInput(k, v);
    useEffect(() => {
        const kd = (e) => {
            if(view!=='game') return;
            if(e.key==='ArrowRight' || e.key==='d') handleInput('gas', true);
            if(e.key==='ArrowLeft' || e.key==='a') handleInput('brake', true);
        };
        const ku = (e) => {
            if(view!=='game') return;
            if(e.key==='ArrowRight' || e.key==='d') handleInput('gas', false);
            if(e.key==='ArrowLeft' || e.key==='a') handleInput('brake', false);
        };
        window.addEventListener('keydown', kd);
        window.addEventListener('keyup', ku);
        return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); }
    }, [view]);

    return (
        <div style={{width:'100%', height:'100%'}}>
            {view === 'garage' && <window.Garage data={data} actions={actions} />}

            {view === 'game' && (
                <div style={{width:'100%', height:'100%'}}>
                    <canvas ref={canvasRef} id="game-canvas"></canvas>
                    <div className="hud">
                        <div className="top-bar">
                            <div className="coin-count">COINS: {data.coins + session.coins}</div>
                            <div>{engineRef.current ? engineRef.current.distance : 0}m</div>
                        </div>
                        
                        <div className="fuel-box">
                            <div className="fuel-bar" style={{width:`${session.fuel}%`}}></div>
                        </div>
                        <div className="fuel-txt">FUEL</div>

                        <div className="controls">
                            <div className="pedal brake" 
                                onMouseDown={()=>handleInput('brake', true)} onMouseUp={()=>handleInput('brake', false)}
                                onTouchStart={(e)=>{e.preventDefault(); handleInput('brake', true)}} onTouchEnd={(e)=>{e.preventDefault(); handleInput('brake', false)}}
                            >
                                <span>🛑</span>BRAKE
                            </div>
                            <div className="pedal gas"
                                onMouseDown={()=>handleInput('gas', true)} onMouseUp={()=>handleInput('gas', false)}
                                onTouchStart={(e)=>{e.preventDefault(); handleInput('gas', true)}} onTouchEnd={(e)=>{e.preventDefault(); handleInput('gas', false)}}
                            >
                                <span>🚀</span>GAS
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {view === 'report' && report && (
                <div style={{
                    position:'absolute', top:0, left:0, width:'100%', height:'100%',
                    background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center'
                }}>
                    <div style={{
                        background:'#222', padding:'30px', borderRadius:'15px', border:'2px solid gold',
                        textAlign:'center', color:'white', width:'90%', maxWidth:'400px'
                    }}>
                        <h1 style={{color:'red', fontSize:'40px', margin:'0'}}>{report.reason}</h1>
                        <h3 style={{color:'#aaa'}}>RUN DISTANCE: {report.stats.dist}m</h3>
                        <h2 style={{color:'gold', fontSize:'30px'}}>EARNED: +{session.coins}</h2>
                        <button className="start-btn" style={{fontSize:'20px', padding:'15px'}} onClick={()=>{ setView('garage'); AudioSys.playMenuMusic(); }}>
                            RETURN TO GARAGE
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
