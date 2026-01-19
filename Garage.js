const Garage = ({ data, actions }) => {
    return (
        <div className="menu">
            <h1 style={{fontSize:'40px', color:'var(--gold)'}}>EXTREME RACING</h1>
            <div>MADE BY THE SOLANKI VISIONS</div>
            <div style={{margin:'20px', fontSize:'24px', color:'white'}}>COINS: {data.coins}</div>
            
            <div className="menu-grid">
                {/* Simplified Vehicle Selection for stability */}
                <div className="card">
                    <img src="https://placehold.co/300x150/red/white?text=JEEP" />
                    <h3>JEEP (FREE)</h3>
                    <button className="btn" style={{background:'#0f0'}}>SELECTED</button>
                </div>
            </div>

            <button className="btn btn-go" onClick={actions.start}>START ENGINE</button>
        </div>
    );
};
window.Garage = Garage;
