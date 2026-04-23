const FallHistoryScreen = () => {
    const [falls, setFalls] = React.useState([]);
    const [showAll, setShowAll] = React.useState(false);

    React.useEffect(() => {
        SafeStepAPI.getDashboard()
            .then(r => {
                // S'assurer qu'on a un tableau et le trier du plus récent au plus ancien
                const fetchedFalls = r.data?.falls ?? [];
                const sorted = [...fetchedFalls].sort((a, b) => new Date(b.date) - new Date(a.date));
                setFalls(sorted);
            })
            .catch(() => setFalls([]));
    }, []);

    const displayedFalls = showAll ? falls : falls.slice(0, 3);
    const hasMore = falls.length > 3;

    return (
        <div className="p-6 pb-24 animate-fade-in">
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">Historique</h2>
                    <p className="text-sm font-medium text-slate-500 mt-1">Vos dernières détections de chute</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shadow-inner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                    </svg>
                </div>
            </div>

            {falls.length === 0 ? (
                <div className="metric-card text-center py-12 rounded-3xl">
                    <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <Icon name="shield-check" size={40} color="#10B981" />
                    </div>
                    <p className="text-xl font-bold text-slate-800 mb-2">Aucune chute</p>
                    <p className="text-sm text-slate-500 font-medium">Tout va bien, continuez comme ça !</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {displayedFalls.map((fall, i) => {
                        const fallDate = fall.date ? new Date(fall.date) : null;
                        const dateStr = fallDate ? fallDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : 'Date inconnue';
                        const timeStr = fallDate ? fallDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
                        const severity = fall.severity ?? 'N/A';
                        
                        return (
                            <div key={i} className="group relative bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 overflow-hidden">
                                {/* Ligne de décoration rouge sur le côté */}
                                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-gradient-to-b from-red-500 to-orange-400"></div>
                                
                                <div className="flex items-start gap-4 pl-2">
                                    <div className="w-10 h-10 shrink-0 rounded-full bg-red-50 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Icon name="alert-triangle" size={20} color="#EF4444" />
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-bold text-slate-800 text-base truncate">
                                                {fall.location ?? 'Position inconnue'}
                                            </h4>
                                            <span className="shrink-0 text-xs font-bold px-2.5 py-1 bg-red-100 text-red-700 rounded-lg whitespace-nowrap">
                                                Sévérité: {severity}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-2">
                                            <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                                                <Icon name="calendar" size={12} color="#64748B" />
                                                <span>{dateStr}</span>
                                            </div>
                                            {timeStr && (
                                                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md">
                                                    <Icon name="clock" size={12} color="#64748B" />
                                                    <span>{timeStr}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {hasMore && (
                        <button 
                            onClick={() => setShowAll(!showAll)}
                            className="w-full mt-2 py-3.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition-colors duration-200 flex items-center justify-center gap-2 border border-slate-200 border-dashed"
                        >
                            {showAll ? (
                                <>Réduire la liste <Icon name="chevron-up" size={16} /></>
                            ) : (
                                <>Voir les {falls.length - 3} autres chutes <Icon name="chevron-down" size={16} /></>
                            )}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

if (typeof module !== 'undefined' && module.exports) module.exports = FallHistoryScreen;
