const FallHistoryScreen = () => {
    const [falls, setFalls] = React.useState([]);

    React.useEffect(() => {
        SafeStepAPI.getDashboard()
            .then(r => setFalls(r.data?.falls ?? []))
            .catch(() => setFalls([]));
    }, []);

    return (
        <div className="p-6 pb-24 animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">Historique des Chutes</h2>
            {falls.length === 0 ? (
                <div className="metric-card text-center py-10">
                    <Icon name="shield-check" size={48} color="#10B981" className="mx-auto mb-3" />
                    <p className="text-lg font-semibold text-green-600 mb-1">Aucune chute enregistrée</p>
                    <p className="text-sm text-slate-400">Continuez comme ça !</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {falls.map((fall, i) => (
                        <div key={i} className="metric-card flex items-start gap-3 border-l-4 border-red-400">
                            <Icon name="alert-triangle" size={20} color="#EF4444" />
                            <div className="w-full">
                                <div className="flex justify-between items-center w-full mb-1">
                                    <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-md">
                                        Chute n°{falls.length - i}
                                    </span>
                                </div>
                                <p className="font-semibold text-sm">{fall.location ?? 'Position inconnue'}</p>
                                <p className="text-xs text-slate-500">{fall.date ? new Date(fall.date).toLocaleString('fr-FR') : 'Date inconnue'} — Sévérité: {fall.severity ?? 'N/A'}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

if (typeof module !== 'undefined' && module.exports) module.exports = FallHistoryScreen;
