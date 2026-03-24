// Main Application Component
const App = () => {
    const [isLoggedIn, setIsLoggedIn] = React.useState(false);
    const [currentUser, setCurrentUser] = React.useState(null);
    const [currentScreen, setCurrentScreen] = React.useState('dashboard');
    const [menuOpen, setMenuOpen] = React.useState(false);
    const [authLoading, setAuthLoading] = React.useState(true);

    // Check authentication on mount
    React.useEffect(() => {
        checkAuthentication();
    }, []);

    const setupRealtimeListeners = () => {
        if (window.safestepSyncInterval) clearInterval(window.safestepSyncInterval);

        let pendingSteps = 0;

        SafeStepAPI.on('step_counted', (data) => {
            // Si synced=true, le backend a déjà incrémenté en DB (Web BLE) → pas besoin de re-syncer
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
                    console.log('✅ User authenticated:', result.user);
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
            console.log('✅ User logged out');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    // Show loading screen while checking auth
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
                        <span className="text-slate-600">Loading...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return <LoginScreen onLogin={handleLogin} />;
    }

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: 'home', color: '#0EA5E9' },
        { id: 'fall-history', label: 'Fall History', icon: 'alert-triangle', color: '#EF4444' },
        { id: 'settings', label: 'Settings', icon: 'settings', color: '#64748B' },
    ];

    const renderScreen = () => {
        switch(currentScreen) {
            case 'dashboard': return <DashboardScreen currentUser={currentUser} />;
            case 'fall-history': return <FallHistoryScreen />;
            case 'settings': return <SettingsScreen currentUser={currentUser} onLogout={handleLogout} />;
            default: return <DashboardScreen currentUser={currentUser} />;
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
                                <Icon 
                                    name={item.icon} 
                                    size={20} 
                                    color={currentScreen === item.id ? item.color : '#64748B'} 
                                />
                                <span className="font-semibold text-sm">{item.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="desktop-main">
                {/* Mobile Header */}
                <div className="mobile-header fixed top-0 left-1/2 transform -translate-x-1/2 w-full max-w-[480px] bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                            <Icon name="footprints" size={20} color="white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg">SafeStep</h1>
                            <p className="text-xs text-slate-500">
                                {menuItems.find(item => item.id === currentScreen)?.label || 'Dashboard'}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setMenuOpen(!menuOpen)}
                        className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-all"
                    >
                        <Icon name={menuOpen ? 'x' : 'menu'} size={20} color="#0F172A" />
                    </button>
                </div>

                {/* Mobile Slide-out Menu */}
                {menuOpen && (
                    <div 
                        className="fixed inset-0 bg-black bg-opacity-50 z-40 animate-fade-in"
                        onClick={() => setMenuOpen(false)}
                    >
                        <div 
                            className="fixed right-0 top-0 h-full w-80 bg-white shadow-2xl overflow-y-auto animate-slide-up"
                            onClick={(e) => e.stopPropagation()}
                            style={{ maxWidth: 'calc(100vw - 2rem)' }}
                        >
                            <div className="p-6">
                                <h2 className="text-xl font-bold mb-6">Menu</h2>
                                <div className="space-y-2">
                                    {menuItems.map((item) => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setCurrentScreen(item.id);
                                                setMenuOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                                                currentScreen === item.id 
                                                    ? 'bg-blue-50 text-blue-600' 
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <Icon name={item.icon} size={20} color={item.color} />
                                            <span className="font-semibold text-sm">{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="desktop-content pt-20 content-wrapper">
                    {renderScreen()}
                </div>
                
                {/* Mobile Bottom Navigation */}
                <div className="fixed bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-[480px] nav-bar">
                    <div onClick={() => setCurrentScreen('dashboard')} className={currentScreen === 'dashboard' ? 'nav-item active' : 'nav-item'}>
                        <Icon name="home" size={22} />
                        <span className="text-xs font-semibold">Home</span>
                    </div>
                    <div onClick={() => setCurrentScreen('fall-history')} className={currentScreen === 'fall-history' ? 'nav-item active' : 'nav-item'}>
                        <Icon name="alert-triangle" size={22} />
                        <span className="text-xs font-semibold">Chutes</span>
                    </div>
                    <div onClick={() => setCurrentScreen('settings')} className={currentScreen === 'settings' ? 'nav-item active' : 'nav-item'}>
                        <Icon name="settings" size={22} />
                        <span className="text-xs font-semibold">Config</span>
                    </div>
                    <div onClick={() => setMenuOpen(true)} className="nav-item">
                        <Icon name="grid" size={22} />
                        <span className="text-xs font-semibold">Menu</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Render with React 18 API
console.log('🚀 Initializing React app...');

try {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        throw new Error('Root element not found!');
    }
    
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
