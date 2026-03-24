require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Database
const connectDB = require('./config/database');
const { initializeDefaultUsers } = require('./utils/initUsers');

// Device service (données réelles chaussure BLE)
const deviceService = require('./services/deviceService');

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');

// Middleware
const { protect } = require('./middleware/authMiddleware');

// Initialize Express
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== SECURITY MIDDLEWARE ====================

// Helmet - Security headers
app.use(helmet({
  contentSecurityPolicy: false // Désactivé pour le développement
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting sur toutes les routes /api SAUF la gateway BLE (flux continu ~10Hz)
app.use('/api', (req, res, next) => {
  if (req.path === '/device/gateway') return next();
  return limiter(req, res, next);
});

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== FRONTEND STATIQUE ====================
// Sert les fichiers du frontend depuis la racine du projet
const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index-modular.html'));
});

// ==================== ROUTES ====================

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Gateway BLE (public — protégée par clé API, pas de JWT)
app.post('/api/device/gateway', require('./routes/api/device').gatewayHandler);
app.post('/api/device/gateway/step', require('./routes/api/device').gatewayStepHandler);

// User routes (protected)
app.use('/api/users', userRoutes);

// Protected API routes (require authentication)
app.use('/api/user', protect, require('./routes/api/user'));
app.use('/api/device', protect, require('./routes/api/device'));
app.use('/api/activity', protect, require('./routes/api/activity'));
app.use('/api/health', protect, require('./routes/api/health'));
app.use('/api/fallrisk', protect, require('./routes/api/fallrisk'));
app.use('/api/alerts', protect, require('./routes/api/alerts'));
app.use('/api/falls', protect, require('./routes/api/falls'));
app.use('/api/medications', protect, require('./routes/api/medications'));
app.use('/api/exercises', protect, require('./routes/api/exercises'));
app.use('/api/weather', protect, require('./routes/api/weather'));
app.use('/api/social', protect, require('./routes/api/social'));
app.use('/api/achievements', protect, require('./routes/api/achievements'));
app.use('/api/settings', protect, require('./routes/api/settings'));
app.use('/api/dashboard', protect, require('./routes/api/dashboard'));
app.use('/api/emergency', protect, require('./routes/api/emergency'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== WEBSOCKET ====================

// WebSocket connections map (userId -> ws)
const wsConnections = new Map();

// Expose les userId connectés au deviceService (utilisé par gatewayStepHandler)
deviceService.setGetConnectedUserIds(() => [...wsConnections.keys()]);

// Connecte le deviceService au broadcast WebSocket
// Quand la vraie chaussure envoie des données, elles sont pushées à l'utilisateur concerné
deviceService.setBroadcast((userId, data) => {
  const type = data.__type || 'device_update';
  const { __type, ...rest } = data;
  const payload = __type ? rest : data;
  const msg = JSON.stringify({ type, data: payload });
  if (userId) {
    const ws = wsConnections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(msg);
  } else {
    wsConnections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    });
  }
});

wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');
  
  let userId = null;
  let isAuthenticated = false;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      // Handle authentication
      if (data.type === 'auth') {
        const AuthService = require('./services/authService');
        try {
          const decoded = AuthService.verifyToken(data.token);
          userId = decoded.userId;
          isAuthenticated = true;
          
          // Store connection
          wsConnections.set(userId, ws);
          
          ws.send(JSON.stringify({
            type: 'auth',
            success: true,
            message: 'WebSocket authenticated'
          }));
          
          console.log(`✅ WebSocket authenticated for user: ${userId}`);
          
          // Start sending real-time updates
          startRealTimeUpdates(ws, userId);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'auth',
            success: false,
            error: 'Authentication failed'
          }));
        }
      }

      // Handle other message types
      if (isAuthenticated) {
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      wsConnections.delete(userId);
      console.log(`🔌 WebSocket disconnected for user: ${userId}`);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Real-time data simulation
function startRealTimeUpdates(ws, userId) {
  const interval = setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) {
      clearInterval(interval);
      return;
    }

    // Simulate real-time data updates
    const update = generateRealtimeData();
    
    ws.send(JSON.stringify({
      type: 'update',
      data: update,
      timestamp: new Date()
    }));
  }, parseInt(process.env.SIMULATION_INTERVAL) || 2000);

  // Clean up on disconnect
  ws.on('close', () => clearInterval(interval));
}

// Generate simulated real-time data
function generateRealtimeData() {
  const variance = (base, range) => base + (Math.random() - 0.5) * range;
  
  return {
    heartRate: Math.round(variance(72, 10)),
    steps: Math.round(variance(3847, 50)),
    cadence: Math.round(variance(112, 8)),
    stability: Math.round(variance(82, 5)),
    battery: Math.round(variance(78, 2)),
    gaitSpeed: +(variance(1.2, 0.2)).toFixed(2)
  };
}

// ==================== START SERVER ====================

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize default users
    await initializeDefaultUsers();

    // Start server
    server.listen(PORT, () => {
      console.log('\n╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   🦿 SafeStep Backend Server with Authentication         ║');
      console.log('║                                                           ║');
      console.log(`║   🌐 Server running on: http://localhost:${PORT}          ║`);
      console.log(`║   🔌 WebSocket available on: ws://localhost:${PORT}       ║`);
      console.log('║                                                           ║');
      console.log('║   📡 Simulating ESP32 & Smart Shoe Data                  ║');
      console.log('║   🔐 JWT Authentication Enabled                          ║');
      console.log('║   ✅ Ready to connect with frontend                      ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝');
      console.log('  ');
      
      console.log('🔐 Authentication Endpoints:');
      console.log('   POST /api/auth/register - Create new account');
      console.log('   POST /api/auth/login - Login');
      console.log('   POST /api/auth/logout - Logout');
      console.log('   GET  /api/auth/verify - Verify token');
      console.log('   POST /api/auth/change-password - Change password');
      console.log('');
      console.log('📋 Available API Endpoints (Protected):');
      console.log('   GET  /api/user');
      console.log('   GET  /api/device/status');
      console.log('   GET  /api/activity');
      console.log('   GET  /api/activity/weekly');
      console.log('   GET  /api/activity/heatmap');
      console.log('   GET  /api/health');
      console.log('   GET  /api/health/heartrate/history');
      console.log('   GET  /api/fallrisk');
      console.log('   GET  /api/alerts');
      console.log('   GET  /api/falls');
      console.log('   GET  /api/medications');
      console.log('   GET  /api/exercises');
      console.log('   GET  /api/weather');
      console.log('   GET  /api/social');
      console.log('   GET  /api/achievements');
      console.log('   GET  /api/settings');
      console.log('   GET  /api/dashboard (all data)');
      console.log('   POST /api/emergency/sos');
      console.log('');
      console.log('🔄 Real-time updates via WebSocket every 2 seconds');
      console.log('');
      console.log('👤 Demo Credentials:');
      console.log('   Email: marie.joubert@email.com');
      console.log('   Email: demo@safestep.com');
      console.log('   Password: Password123!');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

module.exports = app;
