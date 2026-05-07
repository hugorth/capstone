// Main Application Component
const App = () => {
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState(null);
    const [currentScreen, setCurrentScreen] = React.useState('dashboard');
    const [authLoading, setAuthLoading] = React.useState(true);

    React.useEffect(() => {
        checkAuthentication();
    }, []);

    const setupRealtimeListeners = () => {
        if (window.safestepSyncInterval) clearInterval(window.safestepSyncInterval);

        let pendingSteps = 0;

        SafeStepAPI.on('step_counted', (data) => {
            if (!data?.synced) {
                pendingSteps += 1;
            }
            window.dispatchEvent(new CustomEvent('safestep_step_added', { detail: { steps: data?.steps } }));
        });

        window.safestepSyncInterval = setInterval(() => {
            if (pendingSteps > 0) {
                const stepsToSync = pendingSteps;
                pendingSteps = 0;
                SafeStepAPI.syncSteps(stepsToSync).catch(() => {
                    pendingSteps += stepsToSync;
                });
            }
        }, 5000);

        SafeStepAPI.on('fall_detected', (data) => {
            console.log('🚨 FALL DETECTED:', data);
            alert(`⚠️ CHUTE DÉTECTÉE!\n\nLieu: ${data.location}\nSévérité: ${data.severity}\n\nLes contacts d'urgence ont été notifiés.`);
        });
    };

    const checkAuthentication = async () => {
        setAuthLoading(true);
        try {
            if (AuthManager.isAuthenticated()) {
                const result = await SafeStepAPI.verifyToken();
                if (result.success && result.user) {
                    setCurrentUser(result.user);
                    setIsLoggedIn(true);
                    SafeStepAPI.connect();
                    setupRealtimeListeners();
                } else {
                    AuthManager.clearAuth();
                    setIsLoggedIn(false);
                }
            } else {
                setIsLoggedIn(false);
            }
        } catch (error) {
            console.error('Authentication check failed:', error);
            AuthManager.clearAuth();
            setIsLoggedIn(false);
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogin = (user) => {
        setCurrentUser(user);
        setIsLoggedIn(true);
        SafeStepAPI.connect();
        setupRealtimeListeners();
    };

    const handleLogout = async () => {
        try {
            await SafeStepAPI.logout();
            if (window.safestepSyncInterval) clearInterval(window.safestepSyncInterval);
            setIsLoggedIn(false);
            setCurrentUser(null);
            setCurrentScreen('dashboard');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    if (authLoading) {
        return (
            <div className="app-container flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl mb-6 shadow-lg">
                        <Icon name="footprints" size={40} color="white" />
                    </div>
                    <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                        SafeStep
                    </h1>
                    <div className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-slate-600">Chargement...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    const menuItems = [
        { id: 'dashboard',    label: 'Home',     icon: 'home',           color: '#0EA5E9' },
        { id: 'fall-history', label: 'Chutes',   icon: 'alert-triangle', color: '#EF4444' },
        { id: 'settings',     label: 'Réglages', icon: 'settings',       color: '#64748B' },
    ];

    const renderScreen = () => {
        switch(currentScreen) {
            case 'dashboard':    return <DashboardScreen currentUser={currentUser} />;
            case 'fall-history': return <FallHistoryScreen />;
            case 'settings':     return <SettingsScreen currentUser={currentUser} onLogout={handleLogout} />;
            default:             return <DashboardScreen currentUser={currentUser} />;
        }
    };

    return (
        <div className="app-container">
            {/* Desktop Sidebar */}
            <div className="desktop-sidebar" style={{ display: 'none' }}>
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <Icon name="footprints" size={24} color="white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-xl">SafeStep</h1>
                            <p className="text-xs text-slate-500">Version 2.1.0</p>
                        </div>
                    </div>

                    <div className="metric-card mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
                                {currentUser?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'}
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-sm">{currentUser?.name || 'Utilisateur'}</p>
                                <p className="text-xs text-slate-500">Online</p>
                            </div>
                            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                        </div>
                    </div>

                    <nav className="space-y-1">
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setCurrentScreen(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                    currentScreen === item.id
                                        ? 'bg-blue-50 text-blue-600'
                                        : 'hover:bg-slate-50 text-slate-700'
                                }`}
                            >
                                <Icon name={item.icon} size={20} color={currentScreen === item.id ? item.color : '#64748B'} />
                                <span className="font-semibold text-sm">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="desktop-main">
                {/* Mobile Header — logo + titre seulement */}
                <div className="mobile-header fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[480px] bg-white border-b border-slate-200 px-5 py-3 flex items-center z-50">
                    <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-3">
                        <Icon name="footprints" size={18} color="white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-base leading-tight">SafeStep</h1>
                        <p className="text-xs text-slate-500 leading-tight">
                            {menuItems.find(item => item.id === currentScreen)?.label || 'Home'}
                        </p>
                    </div>
                </div>

                <div className="desktop-content pt-16 content-wrapper">
                    {renderScreen()}
                </div>

                {/* Mobile Bottom Navigation — 3 items */}
                <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-[480px] nav-bar">
                    {menuItems.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => setCurrentScreen(item.id)}
                            className={currentScreen === item.id ? 'nav-item active' : 'nav-item'}
                        >
                            <Icon name={item.icon} size={22} />
                            <span className="text-xs font-semibold">{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

console.log('🚀 Initializing React app...');

try {
    const rootElement = document.getElementById('root');
    if (!rootElement) throw new Error('Root element not found!');
    rootElement.innerHTML = '';
    const root = ReactDOM.createRoot(rootElement);
    root.render(<App />);
    console.log('✅ App rendered successfully');
    initLucideIcons();
} catch (error) {
    console.error('❌ React initialization error:', error);
    document.body.innerHTML = `
        <div style="padding: 40px; text-align: center; font-family: sans-serif;">
            <h1 style="color: #EF4444;">⚠️ Erreur de Chargement</h1>
            <p style="color: #64748B; margin: 20px 0;">${error.message}</p>
            <button onclick="location.reload()" style="padding: 12px 24px; background: #0EA5E9; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
                🔄 Recharger la Page
            </button>
        </div>
    `;
}
