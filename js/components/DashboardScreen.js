// Dashboard Screen Component
const DashboardScreen = ({ currentUser }) => {
    const [dashboardData, setDashboardData] = React.useState(null);
    const [loading, setLoading]             = React.useState(true);
    const [isConnected, setIsConnected]     = React.useState(false);
    const [steps, setSteps]                 = React.useState(0);

    const distance = parseFloat((steps * 0.7 / 1000).toFixed(2));
    const calories  = Math.round(steps * 0.04);

    React.useEffect(() => {
        loadDashboard();

        const onStep = (e) => {
            const serverSteps = e?.detail?.steps;
            setSteps(prev => serverSteps !== undefined ? Math.max(serverSteps, prev) : prev + 1);
        };
        window.addEventListener('safestep_step_added', onStep);

        SafeStepAPI.on('device_update', (data) => {
            if (data.connected) setIsConnected(true);
        });

        const interval = setInterval(loadDashboard, 30000);
        return () => {
            clearInterval(interval);
            window.removeEventListener('safestep_step_added', onStep);
        };
    }, []);

    const loadDashboard = async () => {
        try {
            const response = await SafeStepAPI.getDashboard();
            const d = response.data;
            setDashboardData(d);
            setSteps(prev => Math.max(prev, d.summary?.steps || 0));
            setLoading(false);
        } catch (error) {
            console.error('Error loading dashboard:', error);
            setDashboardData({
                device: { connected: false, battery: 78 },
                location: { address: '123 Rue de Paris' },
            });
            setLoading(false);
        }
    };

    if (loading || !dashboardData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-14 w-14 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-slate-500 text-sm">Chargement...</p>
                </div>
            </div>
        );
    }

    const connected = isConnected || (dashboardData.device?.connected ?? false);
    const battery   = dashboardData.summary?.battery ?? dashboardData.device?.battery ?? 0;
    const location  = dashboardData.location;
    const firstName = currentUser?.name?.split(' ')[0] || 'Utilisateur';

    const handleSOS = async () => {
        if (window.confirm('🚨 Activer le SOS d\'urgence?\n\nLes contacts seront notifiés immédiatement.')) {
            try {
                await SafeStepAPI.activateSOS();
                alert('✅ SOS activé! Contacts d\'urgence notifiés.');
            } catch (error) {
                alert('❌ Erreur: ' + error.message);
            }
        }
    };

    const batteryColor = battery > 60 ? '#10B981' : battery > 25 ? '#F59E0B' : '#EF4444';

    return (
        <div className="animate-fade-in pb-28">

            {/* ── Greeting ── */}
            <div className="px-5 pt-5 pb-4 flex items-center justify-between">
                <div>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Bonjour</p>
                    <h1 className="text-2xl font-bold leading-tight">{firstName}</h1>
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                    connected
                        ? 'border-green-500 text-green-400 bg-green-500/10'
                        : 'border-slate-600 text-slate-400 bg-slate-500/10'
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-slate-500'}`}></span>
                    {connected ? 'Connecté' : 'Déconnecté'}
                </div>
            </div>

            {/* ── Stats 2×2 ── */}
            <div className="px-5 grid grid-cols-2 gap-3 mb-4">
                {/* Pas */}
                <div className="metric-card flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Icon name="footprints" size={18} color="#38BDF8" />
                        <span className="text-xs text-slate-500 font-medium">Pas</span>
                    </div>
                    <p className="text-3xl font-bold mt-1 leading-none">{steps.toLocaleString('fr-FR')}</p>
                    <div className="h-1 rounded-full bg-slate-700 mt-2 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-blue-500"
                             style={{ width: `${Math.min(steps / 100, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-slate-500">objectif 10 000</p>
                </div>

                {/* Distance */}
                <div className="metric-card flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Icon name="route" size={18} color="#10B981" />
                        <span className="text-xs text-slate-500 font-medium">Distance</span>
                    </div>
                    <p className="text-3xl font-bold mt-1 leading-none">{distance.toFixed(1)}</p>
                    <p className="text-xs text-slate-500 mt-auto pt-2">kilomètres</p>
                </div>

                {/* Calories */}
                <div className="metric-card flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Icon name="flame" size={18} color="#F59E0B" />
                        <span className="text-xs text-slate-500 font-medium">Calories</span>
                    </div>
                    <p className="text-3xl font-bold mt-1 leading-none">{calories}</p>
                    <p className="text-xs text-slate-500 mt-auto pt-2">kcal brûlées</p>
                </div>

                {/* Batterie */}
                <div className="metric-card flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                        <Icon name="battery-charging" size={18} color={batteryColor} />
                        <span className="text-xs text-slate-500 font-medium">Batterie</span>
                    </div>
                    <p className="text-3xl font-bold mt-1 leading-none" style={{ color: batteryColor }}>{battery}%</p>
                    <div className="h-1 rounded-full bg-slate-700 mt-2 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                             style={{ width: `${battery}%`, background: batteryColor }}></div>
                    </div>
                    <p className="text-xs text-slate-500">chaussure</p>
                </div>
            </div>

            {/* ── Map ── */}
            <div className="px-5 mb-4">
                <div className="map-placeholder shadow-lg" style={{ height: '160px' }}>
                    <div className="map-pin"></div>
                    <div className="absolute bottom-3 left-3 right-3">
                        <div className="glass-effect rounded-xl px-3 py-2 flex items-center gap-2">
                            <Icon name="map-pin" size={14} color="#EF4444" />
                            <div className="min-w-0">
                                <p className="text-xs text-slate-500 leading-none mb-0.5">Position actuelle</p>
                                <p className="font-semibold text-sm truncate">{location?.address || 'Localisation...'}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SOS ── */}
            <div className="px-5">
                <button className="btn btn-danger w-full pulse-animation" onClick={handleSOS}>
                    <Icon name="alert-circle" size={22} />
                    <span className="relative z-10">URGENCE SOS</span>
                </button>
            </div>
        </div>
    );
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardScreen;
}
