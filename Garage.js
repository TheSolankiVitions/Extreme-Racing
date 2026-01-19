const Garage = ({ data, actions }) => {
    const [tab, setTab] = React.useState('vehicles');
    
    // Config Data
    const DB = {
        vehicles: [
            { id: 0, name: "Jeep", cost: 0, desc: "Balanced Starter." },
            { id: 1, name: "Monster", cost: 25000, desc: "Crushes Obstacles." },
            { id: 2, name: "F1 Racer", cost: 40000, desc: "High Speed, Low Drag." }
        ],
        stages: [
            { id: "Countryside", cost: 0, desc: "Green Hills." },
            { id: "Desert", cost: 15000, desc: "Slippery Sand." },
            { id: "Moon", cost: 30000, desc: "Low Gravity." }
        ],
        upgrades: ['Engine', 'Suspension', 'Tires', 'Balance']
    };

    return (
        <div className="menu-wrap">
            <h1 className="brand-header">EXTREME RACING</h1>
            <div className="brand-sub">MADE BY THE SOLANKI VISIONS</div>

            <div className="tab-bar">
                {['vehicles', 'stages', 'upgrades'].map(t => (
                    <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={()=>setTab(t)}>
                        {t.toUpperCase()}
                    </button>
                ))}
            </div>

            <div className="grid">
                {/* Vehicles */}
                {tab === 'vehicles' && DB.vehicles.map(v => {
                    const owned = data.unlockedVehicles.includes(v.id);
                    const isSelected = data.vehicle === v.id;
                    return (
                        <div key={v.id} className="card">
                            <h3>{v.name}</h3>
                            <p>{v.desc}</p>
                            {owned ? (
                                <button className="action-btn" disabled={isSelected} onClick={()=>actions.selectVehicle(v.id)}>
                                    {isSelected ? 'EQUIPPED' : 'SELECT'}
                                </button>
                            ) : (
                                <button className="action-btn" disabled={data.coins < v.cost} onClick={()=>actions.buyVehicle(v.id, v.cost)}>
                                    BUY ${v.cost}
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Stages */}
                {tab === 'stages' && DB.stages.map(s => {
                    const owned = data.unlockedStages.includes(s.id);
                    const isSelected = data.stage === s.id;
                    return (
                        <div key={s.id} className="card">
                            <h3>{s.id}</h3>
                            <p>{s.desc}</p>
                            {owned ? (
                                <button className="action-btn" disabled={isSelected} onClick={()=>actions.selectStage(s.id)}>
                                    {isSelected ? 'SELECTED' : 'SELECT'}
                                </button>
                            ) : (
                                <button className="action-btn" disabled={data.coins < s.cost} onClick={()=>actions.buyStage(s.id, s.cost)}>
                                    BUY ${s.cost}
                                </button>
                            )}
                        </div>
                    );
                })}

                {/* Upgrades */}
                {tab === 'upgrades' && DB.upgrades.map(u => {
                    const key = u.toLowerCase();
                    const lvl = data.upgrades[key];
                    const cost = (lvl + 1) * 2000;
                    return (
                        <div key={u} className="card">
                            <div style={{display:'flex', justifyContent:'space-between'}}>
                                <h3>{u}</h3>
                                <span>Lvl {lvl}/10</span>
                            </div>
                            <div style={{height:'10px', background:'#333', borderRadius:'5px', overflow:'hidden'}}>
                                <div style={{width:`${lvl*10}%`, height:'100%', background:'var(--neon-green)'}}></div>
                            </div>
                            <button className="action-btn" disabled={lvl>=10 || data.coins < cost} onClick={()=>actions.upgrade(key, cost)}>
                                UPGRADE (${cost})
                            </button>
                        </div>
                    );
                })}
            </div>

            <button className="start-btn" onClick={actions.startGame}>START ENGINE</button>
            <div className="footer-credit">© 2024 THE SOLANKI VISIONS</div>
        </div>
    );
};

window.Garage = Garage;
