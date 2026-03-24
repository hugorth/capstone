// Settings Screen Component
const SettingsScreen = ({ currentUser, onLogout }) => {
    const [notifications, setNotifications] = React.useState(true);
    const [vibration, setVibration] = React.useState(true);
    const [autoSOS, setAutoSOS] = React.useState(true);
    const [voiceCommands, setVoiceCommands] = React.useState(false);
    const [isLoggingOut, setIsLoggingOut] = React.useState(false);

    const handleLogoutClick = async () => {
        if (window.confirm('Êtes-vous sûr de vouloir vous déconnecter?')) {
            setIsLoggingOut(true);
            try {
                await onLogout();
            } catch (error) {
                console.error('Logout error:', error);
                alert('Échec de la déconnexion. Veuillez réessayer.');
                setIsLoggingOut(false);
            }
        }
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    const userInitials = getInitials(currentUser?.name);
    const isVerified = currentUser?.emailVerified || false;
    const emergencyContacts = currentUser?.emergencyContacts || [];

    return (
        <div className="p-6 pb-24 animate-fade-in">
            <h2 className="text-2xl font-bold mb-6">Paramètres</h2>

            {/* Profile */}
            <div className="metric-card mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">
                        {userInitials}
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold">{currentUser?.name || 'Utilisateur'}</h3>
                        <p className="text-sm text-slate-500">{currentUser?.email || 'email@example.com'}</p>
                        <div className="flex items-center gap-2 mt-1">
                            {isVerified ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                                    <Icon name="check-circle" size={12} />
                                    Vérifié
                                </span>
                            ) : (
                                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full flex items-center gap-1">
                                    <Icon name="alert-circle" size={12} />
                                    Non vérifié
                                </span>
                            )}
                            {currentUser?.role && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                    {currentUser.role}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Emergency Contacts */}
            <div className="metric-card mb-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Icon name="users" size={20} color="#0EA5E9" />
                    Contacts d'Urgence
                </h3>
                {emergencyContacts.length > 0 ? (
                    <div className="space-y-3">
                        {emergencyContacts.map((contact, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                        <Icon name="user" size={18} color="#0EA5E9" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-sm">{contact.name}</p>
                                        <p className="text-xs text-slate-500">{contact.phone}</p>
                                    </div>
                                </div>
                                <Icon name="phone" size={18} color="#10B981" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500 text-center py-4">Aucun contact d'urgence ajouté</p>
                )}
                <button className="w-full mt-3 py-2.5 border-2 border-dashed border-slate-200 rounded-lg text-sm font-semibold text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all">
                    + Ajouter un Contact
                </button>
            </div>

            {/* Settings */}
            <div className="metric-card mb-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Icon name="settings" size={20} color="#0EA5E9" />
                    Préférences
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="bell" size={20} color="#64748B" />
                            <span className="font-medium">Notifications</span>
                        </div>
                        <div 
                            className={`toggle-switch ${notifications ? 'active' : ''}`}
                            onClick={() => setNotifications(!notifications)}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="vibrate" size={20} color="#64748B" />
                            <span className="font-medium">Vibrations</span>
                        </div>
                        <div 
                            className={`toggle-switch ${vibration ? 'active' : ''}`}
                            onClick={() => setVibration(!vibration)}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="shield-alert" size={20} color="#64748B" />
                            <span className="font-medium">SOS Automatique</span>
                        </div>
                        <div 
                            className={`toggle-switch ${autoSOS ? 'active' : ''}`}
                            onClick={() => setAutoSOS(!autoSOS)}
                        ></div>
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Icon name="mic" size={20} color="#64748B" />
                            <span className="font-medium">Commandes Vocales</span>
                        </div>
                        <div 
                            className={`toggle-switch ${voiceCommands ? 'active' : ''}`}
                            onClick={() => setVoiceCommands(!voiceCommands)}
                        ></div>
                    </div>
                </div>
            </div>

            {/* BLE Shoe Connection */}
            <BLEPanel />

            {/* Logout */}
            <button 
                onClick={handleLogoutClick}
                disabled={isLoggingOut}
                className={`w-full py-3.5 border-2 border-red-200 text-red-500 rounded-xl font-semibold hover:bg-red-50 transition-all flex items-center justify-center gap-2 ${isLoggingOut ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isLoggingOut ? (
                    <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Déconnexion...
                    </>
                ) : (
                    <>
                        <Icon name="log-out" size={20} />
                        Se Déconnecter
                    </>
                )}
            </button>
        </div>
    );
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsScreen;
}
