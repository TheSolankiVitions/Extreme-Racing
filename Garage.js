const Garage = ({ data, actions }) => {
    const [tab, setTab] = React.useState('vehicles');

    // Asset Map (Using placeholders for visuals as requested, but logic is solid)
    const cars = [
        { id: 0, name: "Jeep", price: 0, img: "https://placehold.co/300x150/4caf50/fff?text=Jeep" },
        { id: 1, name: "Monster", price: 5000, img: "https://placehold.co/300x150/ff5722/fff?text=Monster+Truck" },
        { id: 2, name: "Racer", price: 10000, img: "https://placehold.co/300x150/ffeb3b/000?text=Race+Car" },
        { id: 3, name: "Supercar", price: 15000, img: "https://placehold.co/300x150/e91e63/fff?text=Supercar" }
    ];

    const stages = [
        { id: "Countryside", price: 0, img: "https://placehold.co/300x150/228B22/fff?text=Countryside" },
        { id: "Desert", price: 4000, img: "https://placehold.co/300x150/eecfa1/000?text=Desert" },
        { id: "Moon", price: 8000, img: "https://placehold.co/300x150/555/fff?text=Moon" },
        { id: "Forest", price: 12000, img: "https://placehold.co/300x150/006400/fff?text=Forest" }
    ];

    return (
        <div className="menu-wrap">
            <div className="brand">Made by The Solanki Visions</div>
            <h1 style={{fontSize:'40px', margin:'10px'}}>EXTREME RACING</h1>
            <div style={{color:'gold', fontSize:'20px', marginBottom:'20px'}}>COINS: {data.coins}</div>

            <div style={{marginBottom:'20px'}}>
                <button className="btn" style={{width:'auto', marginRight:'10px'}} onClick={()=>setTab('vehicles')}>VEHICLES</button>
                <button className="btn" style={{width:'auto'}} onClick={()=>setTab('stages')}>STAGES</button>
            </div>

            <div className="garage-grid">
                {tab === 'vehicles' && cars.map(c => {
                    const owned = data.unlockedCars.includes(c.id);
                    return (
                        <div key={c.id} className="card">
                            <img src={c.img} className="card-img" />
                            <div className="card-body">
                                <h3>{c.name}</h3>
                                {owned ? 
                                    <button className={data.currentCar===c.id?"btn btn-selected":"btn btn-select"} onClick={()=>actions.setCar(c.id)}>
                                        {data.currentCar===c.id?"EQUIPPED":"SELECT"}
                                    </button>
                                :
                                    <button className="btn btn-buy" disabled={data.coins<c.price} onClick={()=>actions.buyCar(c.id, c.price)}>
                                        BUY {c.price}
                                    </button>
                                }
                            </div>
                        </div>
                    )
                })}

                {tab === 'stages' && stages.map(s => {
                    const owned = data.unlockedStages.includes(s.id);
                    return (
                        <div key={s.id} className="card">
                            <img src={s.img} className="card-img" />
                            <div className="card-body">
                                <h3>{s.id}</h3>
                                {owned ? 
                                    <button className={data.currentStage===s.id?"btn btn-selected":"btn btn-select"} onClick={()=>actions.setStage(s.id)}>
                                        {data.currentStage===s.id?"SELECTED":"SELECT"}
                                    </button>
                                :
                                    <button className="btn btn-buy" disabled={data.coins<s.price} onClick={()=>actions.buyStage(s.id, s.price)}>
                                        BUY {s.price}
                                    </button>
                                }
                            </div>
                        </div>
                    )
                })}
            </div>

            <button className="btn btn-selected" style={{marginTop:'30px', padding:'20px', fontSize:'24px'}} onClick={actions.start}>START ENGINE</button>
        </div>
    );
};
window.Garage = Garage;
