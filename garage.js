const Garage = ({ data, onPurchase, onSelect, onStart, onUpgrade }) => {
    const [tab, setTab] = React.useState('vehicles'); // vehicles, stages, upgrades

    const vehicles = [
        { id: 0, name: "Jeep", cost: 0, desc: "Balanced handling." },
        { id: 1, name: "Monster Truck", cost: 25000, desc: "Huge wheels, overrides obstacles." },
        { id: 2, name: "Race Car", cost: 40000, desc: "High speed, low drag, fragile." }
    ];

    const stages = [
        { name: "Countryside", cost: 0, desc: "Standard Gravity." },
        { name: "Desert", cost: 15000, desc: "Low friction sand." },
        { name: "Moon", cost: 30000, desc: "Low Gravity fun." }
    ];

    const stats = ['Engine', 'Suspension', 'Tires', 'Balance'];

    return (
        <div className="menu-container">
            <h1 className="brand-title">EXTREME RACING</h1>
            <div className="brand-sub">MADE BY THE SOLANKI VISIONS</div>
            
            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <button className="btn" onClick={()=>setTab('vehicles')}>Vehicles</button>
                <button className="btn" onClick={()=>setTab('stages')}>Stages</button>
                <button className="btn" onClick={()=>setTab('upgrades')}>Tune Up</button>
            </div>

            <div className="garage-grid">
                {/* Vehicle Tab */}
                {tab === 'vehicles' && vehicles.map(v => {
                    const owned = data.unlockedVehicles.includes(v.id);
                    return (
                        <div key={v.id} className="card">
                            <h3>{v.name}</h3>
                            <p>{v.desc}</p>
                            {owned ? (
                                <button className="btn" 
                                    disabled={data.currentVehicle === v.id}
                                    onClick={() => onSelect('vehicle', v.id)}>
                                    {data.currentVehicle === v.id ? 'SELECTED' : 'SELECT'}
                                </button>
                            ) : (
                                <button className="btn" 
                                    disabled={data.coins < v.cost}
                                    onClick={() => onPurchase('vehicle', v.id, v.cost)}>
                                    BUY ${v.cost}
                                </button>
                            )}
                        </div>
                    )
                })}

                {/* Stage Tab */}
                {tab === 'stages' && stages.map(s => {
                    const owned = data.unlockedStages.includes(s.name);
                    return (
                        <div key={s.name} className="card">
                            <h3>{s.name}</h3>
                            <p>{s.desc}</p>
                            {owned ? (
                                <button className="btn"
                                    disabled={data.currentStage === s.name}
                                    onClick={() => onSelect('stage', s.name)}>
                                    {data.currentStage === s.name ? 'SELECTED' : 'SELECT'}
                                </button>
                            ) : (
                                <button className="btn"
                                    disabled={data.coins < s.cost}
                                    onClick={() => onPurchase('stage', s.name, s.cost)}>
                                    BUY ${s.cost}
                                </button>
                            )}
                        </div>
                    )
                })}

                {/* Upgrade Tab */}
                {tab === 'upgrades' && stats.map(stat => {
                    const key = stat.toLowerCase();
                    const level = data.upgrades[key];
                    const cost = (level + 1) * 2000;
                    return (
                        <div key={stat} className="card">
                            <h3>{stat} - Lvl {level}</h3>
                            <div className="progress-bar">
                                <div className="progress-fill" style={{width: `${level*10}%`}}></div>
                            </div>
                            <button className="btn" 
                                disabled={level >= 10 || data.coins < cost}
                                onClick={() => onUpgrade(key, cost)}>
                                UPGRADE ${cost}
                            </button>
                        </div>
                    )
                })}
            </div>

            <button className="btn btn-play" onClick={onStart}>START ENGINE</button>
            <div style={{marginTop:'auto', padding:'20px', color:'#555'}}>© The Solanki Visions</div>
        </div>
    );
};
