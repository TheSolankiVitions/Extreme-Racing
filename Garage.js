const Garage = ({ data, actions }) => {
    // Configs
    const cars = [
        { id: 0, name: "Hill Jeep", price: 0, color: '#2ecc71', type: 'Balanced' },
        { id: 1, name: "Monster", price: 5000, color: '#e74c3c', type: 'Power' }
    ];
    
    return (
        <div className="menu">
            <h1 className="title">EXTREME RACING</h1>
            <div className="subtitle">MADE BY THE SOLANKI VISIONS</div>
            
            <div style={{fontSize:'24px', color:'gold', marginBottom:'10px'}}>
                COINS: {data.coins}
            </div>

            <div className="grid">
                {cars.map(c => {
                    const owned = data.unlockedCars.includes(c.id);
                    const selected = data.currentCar === c.id;
                    return (
                        <div key={c.id} className="card" style={{borderColor: selected?'gold':'#555'}}>
                            <div className="card-preview" style={{background: '#333'}}>
                                {/* CSS Representation of Car */}
                                <div style={{
                                    width:'80px', height:'30px', background: c.color,
                                    borderRadius:'5px', position:'relative',
                                    border: '2px solid #111'
                                }}>
                                    <div style={{
                                        position:'absolute', top:'10px', left:'-10px',
                                        width:'20px', height:'20px', background:'#222', borderRadius:'50%'
                                    }}></div>
                                    <div style={{
                                        position:'absolute', top:'10px', left:'70px',
                                        width:'20px', height:'20px', background:'#222', borderRadius:'50%'
                                    }}></div>
                                    <div style={{
                                        position:'absolute', top:'-15px', left:'20px',
                                        width:'30px', height:'15px', background:'#444', borderRadius:'5px 5px 0 0'
                                    }}></div>
                                </div>
                            </div>
                            <h2 style={{color:'white', margin:'0'}}>{c.name}</h2>
                            <p style={{color:'#aaa'}}>{c.type}</p>
                            
                            {owned ? 
                                <button className={`btn ${selected?'btn-active':'btn-sel'}`} onClick={()=>actions.setCar(c.id)}>
                                    {selected ? 'READY' : 'SELECT'}
                                </button>
                                :
                                <button className="btn btn-buy" disabled={data.coins<c.price} onClick={()=>actions.buyCar(c.id, c.price)}>
                                    BUY ${c.price}
                                </button>
                            }
                        </div>
                    )
                })}
            </div>

            <button className="start-btn" onClick={actions.start}>START ENGINE</button>
        </div>
    );
};
window.Garage = Garage;
