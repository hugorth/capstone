// Dashboard Screen Component
const DashboardScreen = ({ currentUser }) => {
    const [dashboardData, setDashboardData] = React.useState(null);
    const [loading, setLoading]             = React.useState(true);
    const [isConnected, setIsConnected]     = React.useState(false);
    const [steps, setSteps]   = React.useState(0);

    // Distance et calories toujours dérivées des pas — jamais de rollback possible
    const distance = parseFloat((steps * 0.7 / 1000).toFixed(2));
    const calories  = Math.round(steps * 0.04);

    React.useEffect(() => {
        loadDashboard();

        const onStep = (e) => {
            const serverSteps = e?.detail?.steps;
            // Math.max : si un message arrive dans le désordre, on ne recule jamais
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
            // Ne jamais réduire le compteur affiché lors d'un refresh depuis la DB
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
            <div className="p-6 flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-slate-500">Chargement du tableau de bord...</p>
                </div>
            </div>
        );
    }

    const connected = isConnected || (dashboardData.device?.connected ?? false);
    const battery   = dashboardData.summary?.battery ?? dashboardData.device?.battery ?? 0;
    const location  = dashboardData.location;

    const handleSOS = async () => {
        if (window.confirm('🚨 Activer le SOS d\'urgence?\n\nLes contacts seront notifiés immédiatement.')) {
            try {
                await SafeStepAPI.activateSOS();
                alert('✅ SOS activé! Contacts d\'urgence notifiés.');
            } catch (error) {
                alert('❌ Erreur lors de l\'activation du SOS: ' + error.message);
            }
        }
    };

    return (
        <div className="p-6 pb-24 animate-fade-in">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Bonjour, {currentUser?.name?.split(' ')[0] || 'Utilisateur'}</h1>
                    <p className="text-slate-500">Voici votre activité d'aujourd'hui</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`status-dot ${connected ? 'bg-green-400 active' : 'bg-slate-300'}`}></span>
                    <span className="text-sm font-semibold text-slate-600">
                        {connected ? 'Connecté' : 'Déconnecté'}
                    </span>
                </div>
            </div>

            {/* Map Placeholder */}
            <div className="map-placeholder mb-6 shadow-lg">
                <div className="map-pin"></div>
                <div className="absolute bottom-4 left-4 bg-white px-4 py-2 rounded-lg shadow-md">
                    <p className="text-xs text-slate-500">Position actuelle</p>
                    <p className="font-semibold text-sm">{location?.address || 'Chargement...'}</p>
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-4 mb-6 responsive-grid-3">
                <div className="metric-card text-center">
                    <Icon name="footprints" size={28} color="#0EA5E9" className="mx-auto mb-2" />
                    <p className="text-2xl font-bold">{steps.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Pas</p>
                </div>
                <div className="metric-card text-center">
                    <Icon name="route" size={28} color="#10B981" className="mx-auto mb-2" />
                    <p className="text-2xl font-bold">{distance.toFixed(1)}</p>
                    <p className="text-xs text-slate-500">km</p>
                </div>
                <div className="metric-card text-center">
                    <Icon name="flame" size={28} color="#F59E0B" className="mx-auto mb-2" />
                    <p className="text-2xl font-bold">{calories}</p>
                    <p className="text-xs text-slate-500">kcal</p>
                </div>
            </div>

            {/* Battery Status */}
            <div className="metric-card mb-6">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Icon name="battery-charging" size={20} color="#10B981" />
                        <span className="font-semibold">Batterie</span>
                    </div>
                    <span className="text-2xl font-bold">{battery}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-500"
                        style={{ width: `${battery}%` }}
                    ></div>
                </div>
            </div>

            {/* Emergency Button */}
            <button 
                className="btn btn-danger w-full pulse-animation" 
                onClick={handleSOS}
            >
                <Icon name="alert-circle" size={24} />
                <span className="relative z-10">URGENCE SOS</span>
            </button>
        </div>
    );
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DashboardScreen;
}
