function Garage({ coins, onStart, ownedVehicles, ownedStages, selectedVehicle, setSelectedVehicle, selectedStage, setSelectedStage, onBuy }) {
    
    const vehicles = [
        { name: 'Jeep', img: 'jeep.png', price: 0 },
        { name: 'Bike', img: 'bike.png', price: 1000 },
        { name: 'Wood', img: 'wood.png', price: 2000 },
        { name: 'Mini Monster', img: 'mini_monster.png', price: 3000 },
        { name: 'Cartoon', img: 'cartoon.png', price: 4000 },
    ];

    const stages = [
        { name: 'Country', img: 'country.png', price: 0 },
        { name: 'Moon', img: 'moom.png', price: 1000 },
        { name: 'Desert', img: 'desert.png', price: 2000 },
        { name: 'Glaciers', img: 'glaciers.png', price: 3000 },
        { name: 'Mars', img: 'mars.png', price: 4000 },
    ];

    const [tab, setTab] = useState('vehicles'); // vehicles | stages

    return (
        <div className="garage-container">
            <div className="garage-header">
                <div className="glass-panel" style={{padding: '10px 20px'}}>
                    💰 {coins}
                </div>
                <div>
                    <button className="btn" onClick={() => setTab('vehicles')} style={{marginRight: 10, opacity: tab==='vehicles'?1:0.5}}>Vehicles</button>
                    <button className="btn" onClick={() => setTab('stages')} style={{opacity: tab==='stages'?1:0.5}}>Stages</button>
                </div>
            </div>

            <div className="garage-grid">
                {tab === 'vehicles' ? vehicles.map(v => {
                    const isOwned = ownedVehicles.includes(v.img);
                    return (
                        <div key={v.img} className={`glass-panel card ${selectedVehicle === v.img ? 'selected' : ''}`}
                             onClick={() => isOwned && setSelectedVehicle(v.img)}>
                            <img src={v.img} alt={v.name} />
                            <h3>{v.name}</h3>
                            {!isOwned ? (
                                <button className="btn" disabled={coins < v.price} onClick={(e) => { e.stopPropagation(); onBuy(v.price, v.img, 'vehicle'); }}>
                                    Buy {v.price}
                                </button>
                            ) : <span>OWNED</span>}
                        </div>
                    )
                }) : stages.map(s => {
                    const isOwned = ownedStages.includes(s.img);
                    return (
                        <div key={s.img} className={`glass-panel card ${selectedStage === s.img ? 'selected' : ''}`}
                             onClick={() => isOwned && setSelectedStage(s.img)}>
                            <img src={s.img} alt={s.name} />
                            <h3>{s.name}</h3>
                            {!isOwned ? (
                                <button className="btn" disabled={coins < s.price} onClick={(e) => { e.stopPropagation(); onBuy(s.price, s.img, 'stage'); }}>
                                    Buy {s.price}
                                </button>
                            ) : <span>OWNED</span>}
                        </div>
                    )
                })}
            </div>

            <div style={{textAlign: 'center', marginTop: '20px'}}>
                <button className="btn" style={{fontSize: '2rem', padding: '15px 50px'}} onClick={onStart}>RACE</button>
            </div>

            <div className="footer-brand">Made by The Solanki Visions</div>
        </div>
    );
}
