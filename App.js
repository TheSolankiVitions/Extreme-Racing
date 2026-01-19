const { useState, useEffect, useRef } = React;

function App() {
    const [view, setView] = useState('garage'); // garage, game, report
    const [coins, setCoins] = useState(0);
    
    // Unlocks (Store IDs of owned items)
    const [ownedVehicles, setOwnedVehicles] = useState(['jeep.png']);
    const [ownedStages, setOwnedStages] = useState(['country.png']);
    
    // Current Selection
    const [vehicle, setVehicle] = useState('jeep.png');
    const [stage, setStage] = useState('country.png');
    
    // Post-Game Data
    const [lastRun, setLastRun] = useState(null);

    // Audio Engine
    const menuAudio = useRef(new Audio('background-audio-non-playing.mp4'));
    const gameAudio = useRef(new Audio('background-audio-playing.mp4'));

    useEffect(() => {
        // Audio Logic
        menuAudio.current.loop = true;
        gameAudio.current.loop = true;

        if (view === 'garage' || view === 'report') {
            gameAudio.current.pause();
            gameAudio.current.currentTime = 0;
            menuAudio.current.play().catch(e => console.log("Interaction needed for audio"));
        } else if (view === 'game') {
            menuAudio.current.pause();
            menuAudio.current.currentTime = 0;
            gameAudio.current.play();
        }
    }, [view]);

    const handleBuy = (cost, id, type) => {
        if (coins >= cost) {
            setCoins(c => c - cost);
            if (type === 'vehicle') setOwnedVehicles([...ownedVehicles, id]);
            if (type === 'stage') setOwnedStages([...ownedStages, id]);
        }
    };

    const handleGameOver = (stats) => {
        setLastRun(stats);
        setCoins(c => c + stats.coins);
        // Force audio stop
        gameAudio.current.pause();
        setView('report');
    };

    return (
        <React.Fragment>
            {view === 'garage' && (
                <Garage 
                    coins={coins}
                    ownedVehicles={ownedVehicles}
                    ownedStages={ownedStages}
                    selectedVehicle={vehicle}
                    setSelectedVehicle={setVehicle}
                    selectedStage={stage}
                    setSelectedStage={setStage}
                    onBuy={handleBuy}
                    onStart={() => setView('game')}
                />
            )}
            
            {view === 'game' && (
                <GameEngine 
                    vehicleAsset={vehicle} 
                    stageAsset={stage} 
                    onGameOver={handleGameOver}
                />
            )}

            {view === 'report' && lastRun && (
                <div className="glass-panel report-modal">
                    <h2>RUN COMPLETE</h2>
                    <img src={lastRun.snapshot} className="snapshot" />
                    <div className="stat-row"><span>Coins</span> <span>+{lastRun.coins}</span></div>
                    <div className="stat-row"><span>Distance</span> <span>{Math.floor(lastRun.distance)}m</span></div>
                    <div className="stat-row"><span>Air Time</span> <span>{lastRun.airTime.toFixed(1)}s</span></div>
                    <div className="stat-row"><span>Flips</span> <span>{lastRun.flips}</span></div>
                    <br/>
                    <button className="btn btn-select" onClick={() => setView('garage')}>Back to Garage</button>
                    <div style={{marginTop: 20, fontSize: '0.7rem', color: '#888'}}>Made by The Solanki Visions</div>
                </div>
            )}
        </React.Fragment>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
