// ==================== API CLIENT ====================
const API_CONFIG = {
    BASE_URL: 'http://localhost:3001/api',
    WS_URL: 'ws://localhost:3001'
};

let wsConnection = null;
let wsCallbacks = {};

function initWebSocket() {
    if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return wsConnection;
    }

    wsConnection = new WebSocket(API_CONFIG.WS_URL);

    wsConnection.onopen = () => {
        console.log('✅ WebSocket connected');
        // Authentifie la connexion WebSocket avec le JWT
        const token = AuthManager.getAccessToken();
        if (token) {
            wsConnection.send(JSON.stringify({ type: 'auth', token }));
        }
    };

    wsConnection.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 WebSocket message:', message);
            
            if (message.type && wsCallbacks[message.type]) {
                wsCallbacks[message.type](message.data);
            }
        } catch (error) {
            console.error('WebSocket message parse error:', error);
        }
    };

    wsConnection.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
    };

    wsConnection.onclose = () => {
        console.log('WebSocket disconnected, attempting reconnect in 5s...');
        setTimeout(initWebSocket, 5000);
    };

    return wsConnection;
}

async function apiRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    
    const defaultOptions = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };

    // Add auth token if available
    const token = AuthManager.getAccessToken();
    if (token) {
        defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add body if provided
    if (options.body) {
        defaultOptions.body = options.body;
    }

    try {
        let response = await fetch(url, defaultOptions);

        // Handle token expiration
        if (response.status === 401) {
            console.log('Token expired, attempting refresh...');
            try {
                const newToken = await AuthManager.refreshAccessToken();
                defaultOptions.headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, defaultOptions);
            } catch (refreshError) {
                console.error('Token refresh failed:', refreshError);
                throw new Error('Authentication failed. Please login again.');
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Request Error:', error);
        throw error;
    }
}

const SafeStepAPI = {
    // Authentication
    async login(email, password) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || error.message || 'Login failed');
        }

        const data = await response.json();

        if (data.success && data.data?.accessToken) {
            AuthManager.setTokens(data.data.accessToken, data.data.refreshToken);
            return { success: true, user: data.data.user };
        }

        throw new Error('Invalid login response');
    },

    async register(email, password, name, additionalData = {}) {
        const response = await fetch(`${API_CONFIG.BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                name,
                ...additionalData
            })
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error || error.message || 'Registration failed');
        }

        const data = await response.json();

        if (data.success && data.data?.accessToken) {
            AuthManager.setTokens(data.data.accessToken, data.data.refreshToken);
            return { success: true, user: data.data.user };
        }

        throw new Error('Invalid registration response');
    },

    async logout() {
        try {
            await apiRequest('/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            AuthManager.clearAuth();
            if (wsConnection) {
                wsConnection.close();
            }
        }
    },

    async verifyToken() {
        try {
            const response = await apiRequest('/auth/verify');
            // Le serveur retourne { success, data: { user } }
            return {
                success: response.success,
                user: response.data?.user ?? response.user
            };
        } catch (error) {
            console.error('Token verification failed:', error);
            return { success: false };
        }
    },

    // WebSocket
    connect: initWebSocket,
    on: (eventType, callback) => {
        wsCallbacks[eventType] = callback;
    },
    
    // Data endpoints
    getDashboard: () => apiRequest('/dashboard'),
    getUser: () => apiRequest('/users/me'),
    updateUser: (data) => apiRequest('/users/me', { 
        method: 'PUT',
        body: JSON.stringify(data) 
    }),
    getDeviceStatus: () => apiRequest('/device/status'),
    postDeviceData: (data) => apiRequest('/device/data', {
        method: 'POST',
        body: JSON.stringify(data)
    }),
    getActivity: () => apiRequest('/activity'),
    getHealth: () => apiRequest('/health'),
    getFallRisk: () => apiRequest('/fallrisk'),
    getAlerts: () => apiRequest('/alerts'),
    syncSteps: (steps) => apiRequest('/activity/sync-steps', { method: 'POST', body: JSON.stringify({ steps }) }),
    recordFall: (data) => apiRequest('/falls', { method: 'POST', body: JSON.stringify(data) }),
    activateSOS: () => apiRequest('/emergency/sos', { method: 'POST' }),
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SafeStepAPI, API_CONFIG };
}
