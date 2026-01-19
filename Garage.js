function Garage({ coins, ownedVehicles, ownedStages, selectedVehicle, setSelectedVehicle, selectedStage, setSelectedStage, onBuy, onStart }) {
    
    // Definition of assets and costs (Points)
    const vehicles = [
        { id: 'jeep.png', name: 'Classic Jeep', cost: 0 },
        { id: 'bike.png', name: 'Motocross', cost: 1000 },
        { id: 'wood.png', name: 'Wood Racer', cost: 2000 },
        { id: 'mini_monster.png', name: 'Mini Monster', cost: 3000 },
        { id: 'cartoon.png', name: 'Cartoon Super', cost: 4000 },
    ];

    const stages = [
        { id: 'country.png', name: 'Countryside', cost: 0 },
        { id: 'moom.png', name: 'Moon Base', cost: 1000 },
        { id: 'desert.png', name: 'Sahara', cost: 2000 },
        { id: 'glaciers.png', name: 'Arctic', cost: 3000 },
        { id: 'mars.png', name: 'Red Planet', cost: 4000 },
    ];

    const [tab, setTab] = useState('vehicles');

    const renderCard = (item, type, isOwned, isSelected) => (
        <div key={item.id} 
             className={`glass-panel card ${isSelected ? 'selected' : ''}`}
             onClick={() => isOwned && (type === 'vehicle' ? setSelectedVehicle(item.id) : setSelectedStage(item.id))}>
            
            <div style={{width:'100%', textAlign:'left', color: '#aaa'}}>
                {isOwned ? 'OWNED' : `LOCKED`}
            </div>
            
            <img src={item.id} alt={item.name} />
            
            <h3>{item.name}</h3>
            
            {isOwned ? (
                <button className="btn btn-select">
                    {isSelected ? 'SELECTED' : 'SELECT'}
                </button>
            ) : (
                <button 
                    className={`btn ${coins >= item.cost ? 'btn-buy' : 'btn-locked'}`}
                    onClick={(e) => { e.stopPropagation(); onBuy(item.cost, item.id, type); }}
                    disabled={coins < item.cost}
                >
                    UNLOCK {item.cost} PTS
                </button>
            )}
        </div>
    );

    return (
        <div className="garage-container">
            <div className="garage-header">
                <div>
                    <h2 style={{margin:0}}>GARAGE</h2>
                    <span style={{fontSize: '0.8rem', color: '#888'}}>Made by The Solanki Visions</span>
                </div>
                <div className="currency-display">🪙 {coins}</div>
            </div>

            <div style={{display:'flex', gap:10, marginBottom:10}}>
                <button className="btn" style={{opacity: tab==='vehicles'?1:0.5}} onClick={()=>setTab('vehicles')}>Vehicles</button>
                <button className="btn" style={{opacity: tab==='stages'?1:0.5}} onClick={()=>setTab('stages')}>Stages</button>
            </div>

            <div className="garage-scroll">
                {tab === 'vehicles' 
                    ? vehicles.map(v => renderCard(v, 'vehicle', ownedVehicles.includes(v.id), selectedVehicle === v.id))
                    : stages.map(s => renderCard(s, 'stage', ownedStages.includes(s.id), selectedStage === s.id))
                }
            </div>

            <div style={{marginTop: 'auto', textAlign:'center', paddingTop: 20}}>
                <button className="btn btn-start" onClick={onStart}>START RACE</button>
            </div>
        </div>
    );
}
