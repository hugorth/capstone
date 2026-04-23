// Login Screen Component
const LoginScreen = ({ onLogin }) => {
    const [isLogin, setIsLogin] = React.useState(true);
    const [formData, setFormData] = React.useState({
        email: '',
        password: '',
        name: ''
    });
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState('');
    const [showPassword, setShowPassword] = React.useState(false);
    const [showHint, setShowHint] = React.useState(false);

    const handleInputChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
        setError('');
    };

    const validateForm = () => {
        if (!formData.email || !formData.password) {
            setError('Veuillez remplir tous les champs obligatoires.');
            return false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Format d\'email invalide.');
            return false;
        }

        if (formData.password.length < 8) {
            setError('Le mot de passe doit contenir au moins 8 caractères.');
            return false;
        }

        if (!isLogin && !formData.name) {
            setError('Le nom est requis pour l\'inscription.');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!validateForm()) return;

        setLoading(true);
        setError('');

        try {
            let result;
            if (isLogin) {
                result = await SafeStepAPI.login(formData.email, formData.password);
            } else {
                result = await SafeStepAPI.register(
                    formData.email, 
                    formData.password, 
                    formData.name
                );
            }

            if (result.success && result.user) {
                onLogin(result.user);
            } else {
                setError('Authentication failed. Please try again.');
            }
        } catch (error) {
            setError(error.message || 'Authentication failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const fillDemoCredentials = () => {
        setFormData({
            email: 'marie.joubert@email.com',
            password: 'Password123!',
            name: ''
        });
        setIsLogin(true);
        setError('');
    };

    return (
        <div className="app-container flex items-center justify-center p-6">
            <div className="w-full max-w-md animate-slide-up">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl mb-6 shadow-lg">
                        <Icon name="footprints" size={40} color="white" />
                    </div>
                    <h1 className="text-4xl font-bold mb-2 text-white">SafeStep</h1>
                    <p className="text-blue-100">Chaussures connectées intelligentes</p>
                </div>

                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    <div className="flex gap-2 mb-6">
                        <button
                            onClick={() => setIsLogin(true)}
                            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                                isLogin 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                            Connexion
                        </button>
                        <button
                            onClick={() => setIsLogin(false)}
                            className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                                !isLogin 
                                    ? 'bg-blue-500 text-white' 
                                    : 'bg-slate-100 text-slate-600'
                            }`}
                        >
                            Inscription
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Nom complet
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    placeholder="Jean Dupont"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Email
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="votre@email.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                Mot de passe
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <Icon name={showPassword ? "eye-off" : "eye"} size={20} />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-start gap-2">
                                <Icon name="alert-circle" size={18} className="mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Chargement...
                                </>
                            ) : (
                                <>
                                    <Icon name="log-in" size={20} />
                                    <span className="relative z-10">{isLogin ? 'Se connecter' : 'S\'inscrire'}</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <button
                            onClick={() => setShowHint(!showHint)}
                            className="text-sm text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1.5 mx-auto"
                        >
                            <Icon name={showHint ? 'chevron-down' : 'chevron-right'} size={14} />
                            Compte de démonstration
                        </button>
                        
                        {showHint && (
                            <div className="mt-3 p-4 bg-blue-50 rounded-lg text-left animate-slide-up">
                                <p className="text-sm text-slate-600 mb-2">
                                    <strong>Email:</strong> marie.joubert@email.com<br />
                                    <strong>Mot de passe:</strong> Password123!
                                </p>
                                <button
                                    onClick={fillDemoCredentials}
                                    className="w-full mt-2 py-2 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-all"
                                >
                                    Remplir automatiquement
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="text-center mt-6 text-white text-sm">
                    <p>© 2026 SafeStep Technologies • Version 2.1.0</p>
                </div>
            </div>
        </div>
    );
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoginScreen;
}
