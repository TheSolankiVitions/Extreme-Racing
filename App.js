const { useState, useEffect, useRef } = React;

function App() {
    const [view, setView] = useState('garage'); // garage, game, report
    const [coins, setCoins] = useState(500); // Starting bonus
    const [ownedVehicles, setOwnedVehicles] = useState(['jeep.png']);
    const [ownedStages, setOwnedStages] = useState(['country.png']);
    
    // Selection State
    const [selectedVehicle, setSelectedVehicle] = useState('jeep.png');
    const [selectedStage, setSelectedStage] = useState('country.png');
    
    // Last Run Stats
    const [runStats, setRunStats] = useState(null);

    // Audio Refs
    const audioMenu = useRef(new Audio('background-audio-non-playing.mp4'));
    const audioGame = useRef(new Audio('background-audio-playing.mp4'));

    useEffect(() => {
        audioMenu.current.loop = true;
        audioGame.current.loop = true;

        if (view === 'garage' || view === 'report') {
            audioGame.current.pause();
            audioGame.current.currentTime = 0;
            audioMenu.current.play().catch(e => console.log("Audio autoplay blocked"));
        } else if (view === 'game') {
            audioMenu.current.pause();
            audioGame.current.play();
        }
    }, [view]);

    const handleStartGame = () => setView('game');
    
    const handleGameOver = (stats) => {
        setRunStats(stats);
        setCoins(prev => prev + stats.coins);
        setView('report');
    };

    const handleBuy = (cost, item, type) => {
        if (coins >= cost) {
            setCoins(c => c - cost);
            if (type === 'vehicle') setOwnedVehicles([...ownedVehicles, item]);
            if (type === 'stage') setOwnedStages([...ownedStages, item]);
        }
    };

    return (
        <React.Fragment>
            {view === 'garage' && (
                <Garage 
                    coins={coins} 
                    onStart={handleStartGame}
                    ownedVehicles={ownedVehicles}
                    ownedStages={ownedStages}
                    selectedVehicle={selectedVehicle}
                    setSelectedVehicle={setSelectedVehicle}
                    selectedStage={selectedStage}
                    setSelectedStage={setSelectedStage}
                    onBuy={handleBuy}
                />
            )}
            
            {view === 'game' && (
                <GameEngine 
                    vehicle={selectedVehicle} 
                    stage={selectedStage} 
                    onGameOver={handleGameOver}
                />
            )}

            {view === 'report' && runStats && (
                <div className="glass-panel report-modal">
                    <h2>MISSION REPORT</h2>
                    <img src={runStats.snapshot} style={{width: '100%', borderRadius: '8px', border: '2px solid white'}} />
                    <div style={{textAlign:'left', margin: '20px 0'}}>
                        <p>🪙 Coins Earned: {runStats.coins}</p>
                        <p>📏 Distance: {Math.floor(runStats.distance)} m</p>
                        <p>🤸 Backflips: {runStats.backflips}</p>
                        <p>🤸 Frontflips: {runStats.frontflips}</p>
                    </div>
                    <button className="btn" onClick={() => setView('garage')}>Return to Garage</button>
                    <div className="footer-brand">Made by The Solanki Visions</div>
                </div>
            )}
        </React.Fragment>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
