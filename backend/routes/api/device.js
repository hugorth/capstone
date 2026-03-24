const express = require('express');
const router = express.Router();
const deviceService = require('../../services/deviceService');
const User = require('../../models/User');

// Données simulées (utilisées si aucune vraie chaussure n'est connectée)
function generateSimulatedStatus() {
  const v = (base, range) => base + (Math.random() - 0.5) * range;
  return {
    connected: false,
    battery: Math.round(v(78, 10)),
    lastSync: new Date(),
    firmware: '2.4.1',
    model: 'SafeStep Pro v2',
    source: 'simulated',
    shoe: {
      sensors: {
        accelerometer: { x: +v(0.02, 0.1).toFixed(2), y: +v(0.98, 0.1).toFixed(2), z: +v(0.15, 0.1).toFixed(2) },
        gyroscope:     { x: +v(0.5, 0.5).toFixed(2),  y: +v(-0.3, 0.3).toFixed(2), z: +v(0.1, 0.2).toFixed(2)  },
        vibration: false
      }
    },
    gps: { latitude: 48.8566, longitude: 2.3522, speed: 0, valid: false },
    fallDetected: false
  };
}

/**
 * GET /api/device/status
 * Retourne les données réelles si la chaussure est connectée, sinon simulées.
 */
router.get('/status', (req, res) => {
  try {
    const real = deviceService.getData();
    res.json({ success: true, data: real || generateSimulatedStatus() });
  } catch (error) {
    console.error('Get device status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get device status' });
  }
});

/**
 * POST /api/device/data
 * Reçoit les données capteurs depuis le navigateur (BLE → frontend → ici).
 * Corps attendu :
 * {
 *   imu:         { ax, ay, az, gx, gy, gz },
 *   vibration:   boolean,
 *   gps:         { latitude, longitude, speed, valid },
 *   fallDetected: boolean
 * }
 */
router.post('/data', async (req, res) => {
  try {
    const { imu, vibration, gps, fallDetected } = req.body;

    if (!imu || typeof imu.ax === 'undefined') {
      return res.status(400).json({ success: false, error: 'Données IMU manquantes' });
    }

    const userId = req.user._id.toString();

    // Vibration = pas détecté → incrémenter en DB et notifier le frontend
    if (vibration) {
      req.user.dailySteps = (req.user.dailySteps || 0) + 1;
      await req.user.save({ validateModifiedOnly: true });

      const wsBroadcast = deviceService.getBroadcast();
      if (wsBroadcast) {
        wsBroadcast(userId, { __type: 'step_counted', synced: true, steps: req.user.dailySteps });
      }
    }

    deviceService.setData({
      connected: true,
      model: 'SafeStep Proto v1',
      shoe: {
        sensors: {
          accelerometer: { x: imu.ax, y: imu.ay, z: imu.az },
          gyroscope:     { x: imu.gx, y: imu.gy, z: imu.gz },
          vibration:     !!vibration
        }
      },
      gps: gps || { latitude: 0, longitude: 0, speed: 0, valid: false },
      fallDetected: !!fallDetected
    }, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Post device data error:', error);
    res.status(500).json({ success: false, error: 'Failed to save device data' });
  }
});

/**
 * POST /api/device/gateway   (pas de JWT — utilisé par ble-gateway.py)
 * Protégé par la clé API locale X-Gateway-Key.
 */
async function gatewayHandler(req, res) {
  try {
    const expectedKey = process.env.GATEWAY_API_KEY || 'safestep-gateway-local';
    if (req.headers['x-gateway-key'] !== expectedKey) {
      return res.status(401).json({ success: false, error: 'Clé gateway invalide' });
    }

    const { imu, vibration, gps, fallDetected } = req.body;
    if (!imu || typeof imu.ax === 'undefined') {
      return res.status(400).json({ success: false, error: 'Données IMU manquantes' });
    }

    // Si vibration, créditer +1 pas à TOUS les utilisateurs connectés via WebSocket
    if (vibration) {
      const wsBroadcast = deviceService.getBroadcast();
      if (wsBroadcast) {
        wsBroadcast(null, { __type: 'step_counted' });
      }
    }

    deviceService.setData({
      connected: true,
      model: 'SafeStep Proto v1',
      shoe: {
        sensors: {
          accelerometer: { x: imu.ax, y: imu.ay, z: imu.az },
          gyroscope:     { x: imu.gx, y: imu.gy, z: imu.gz },
          vibration:     !!vibration
        }
      },
      gps: gps || { latitude: 0, longitude: 0, speed: 0, valid: false },
      fallDetected: !!fallDetected
    }, null); // null = broadcast à tous les clients WebSocket

    res.json({ success: true });
  } catch (error) {
    console.error('Gateway data error:', error);
    res.status(500).json({ success: false, error: 'Failed to save gateway data' });
  }
}

module.exports = router;
module.exports.gatewayHandler = gatewayHandler;

module.exports.gatewayStepHandler = async function(req, res) {
  try {
    const expectedKey = process.env.GATEWAY_API_KEY || 'safestep-gateway-local';
    if (req.headers['x-gateway-key'] !== expectedKey) {
      return res.status(401).json({ success: false });
    }

    const wsBroadcast = deviceService.getBroadcast();
    const connectedUserIds = deviceService.getConnectedUserIds();

    // Incrémenter en DB pour chaque utilisateur connecté via WebSocket
    for (const userId of connectedUserIds) {
      try {
        const user = await User.findById(userId);
        if (!user) continue;
        user.dailySteps = (user.dailySteps || 0) + 1;
        await user.save({ validateModifiedOnly: true });
        if (wsBroadcast) {
          wsBroadcast(userId, { __type: 'step_counted', synced: true, steps: user.dailySteps });
        }
      } catch (userErr) {
        console.error('Step increment error for user', userId, userErr);
      }
    }

    res.json({ success: true });
  } catch (e) {
    console.error('gatewayStepHandler error:', e);
    res.status(500).json({ success: false });
  }
};
