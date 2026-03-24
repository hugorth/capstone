/**
 * deviceService.js
 * Stocke les dernières données reçues de la vraie chaussure en mémoire.
 * Fournit également un hook pour broadcaster via WebSocket.
 */

let latestSensorData = null;
let broadcastFn = null;
let getConnectedUserIdsFn = null;

module.exports = {
  /**
   * Enregistre les nouvelles données capteurs reçues du navigateur (via BLE → frontend → API)
   * et les diffuse via WebSocket si un client est connecté.
   */
  setData(data, userId) {
    latestSensorData = {
      ...data,
      source: 'real',
      timestamp: new Date()
    };
    if (broadcastFn) {
      // userId null = gateway Python → broadcast à tous les clients connectés
      broadcastFn(userId, latestSensorData);
    }
  },

  /** Retourne la dernière donnée réelle, ou null si aucune n'a été reçue */
  getData() {
    return latestSensorData;
  },

  /** Enregistre la fonction de broadcast WebSocket (appelée depuis server.js) */
  setBroadcast(fn) {
    broadcastFn = fn;
  },

  /** Retourne la fonction de broadcast WebSocket */
  getBroadcast() {
    return broadcastFn;
  },

  /** Enregistre une fonction qui retourne les userId des clients WS connectés */
  setGetConnectedUserIds(fn) {
    getConnectedUserIdsFn = fn;
  },

  /** Retourne les userId des clients WS actuellement connectés */
  getConnectedUserIds() {
    return getConnectedUserIdsFn ? getConnectedUserIdsFn() : [];
  }
};
