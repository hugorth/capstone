// ==================== BLE MANAGER ====================
// Gère la connexion BLE avec la chaussure SafeStep (ESP32 Wrover-E)
// UUIDs doivent correspondre exactement à ceux du firmware safestep_esp32.ino

const BLE_CONFIG = {
    SERVICE_UUID:        '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
    CHAR_IMU_UUID:       'beb5483e-36e1-4688-b7f5-ea07361b26a8',
    CHAR_VIBRATION_UUID: 'beb5483e-36e1-4688-b7f5-ea07361b26a9',
    CHAR_GPS_UUID:       'beb5483e-36e1-4688-b7f5-ea07361b26aa',
    CHAR_FALL_UUID:      'beb5483e-36e1-4688-b7f5-ea07361b26ab',
};

const BLEManager = {
    device:           null,
    server:           null,
    onDataCallback:   null,  // (data) => void  — appelé à chaque paquet capteur
    onFallCallback:   null,  // ()    => void  — appelé lors d'une chute
    onStatusChange:   null,  // (status: 'connected'|'disconnected') => void

    isSupported() {
        return 'bluetooth' in navigator;
    },

    isConnected() {
        return !!(this.device && this.device.gatt.connected);
    },

    async connect() {
        if (!this.isSupported()) {
            throw new Error(
                'Web Bluetooth non supporté sur ce navigateur. ' +
                'Utilisez Chrome ou Edge (desktop).'
            );
        }

        // Demande à l'utilisateur de choisir la chaussure
        this.device = await navigator.bluetooth.requestDevice({
            filters: [{ name: 'SafeStep_Shoe' }],
            optionalServices: [BLE_CONFIG.SERVICE_UUID]
        });

        this.device.addEventListener('gattserverdisconnected', () => {
            console.log('🔌 BLE déconnecté');
            if (this.onStatusChange) this.onStatusChange('disconnected');
        });

        this.server = await this.device.gatt.connect();
        console.log('✅ BLE connecté à', this.device.name);
        if (this.onStatusChange) this.onStatusChange('connected');

        const service = await this.server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);
        await this._subscribeAll(service);
    },

    async _subscribeAll(service) {
        // --- IMU : 6 floats little-endian (ax, ay, az, gx, gy, gz) = 24 bytes ---
        const imuChar = await service.getCharacteristic(BLE_CONFIG.CHAR_IMU_UUID);
        await imuChar.startNotifications();
        imuChar.addEventListener('characteristicvaluechanged', (e) => {
            const v = e.target.value;
            this._accumulate({
                imu: {
                    ax: v.getFloat32(0,  true),
                    ay: v.getFloat32(4,  true),
                    az: v.getFloat32(8,  true),
                    gx: v.getFloat32(12, true),
                    gy: v.getFloat32(16, true),
                    gz: v.getFloat32(20, true),
                }
            });
        });

        // --- Vibration : 1 byte (0 = calme, 1 = vibration) ---
        const vibChar = await service.getCharacteristic(BLE_CONFIG.CHAR_VIBRATION_UUID);
        await vibChar.startNotifications();
        vibChar.addEventListener('characteristicvaluechanged', (e) => {
            this._accumulate({ vibration: e.target.value.getUint8(0) === 1 });
        });

        // --- GPS : 3 floats little-endian (latitude, longitude, vitesse km/h) = 12 bytes ---
        const gpsChar = await service.getCharacteristic(BLE_CONFIG.CHAR_GPS_UUID);
        await gpsChar.startNotifications();
        gpsChar.addEventListener('characteristicvaluechanged', (e) => {
            const v = e.target.value;
            this._accumulate({
                gps: {
                    latitude:  v.getFloat32(0, true),
                    longitude: v.getFloat32(4, true),
                    speed:     v.getFloat32(8, true),
                    valid: true
                }
            });
        });

        // --- Chute : 1 byte (0 = normal, 1 = chute détectée) ---
        const fallChar = await service.getCharacteristic(BLE_CONFIG.CHAR_FALL_UUID);
        await fallChar.startNotifications();
        fallChar.addEventListener('characteristicvaluechanged', (e) => {
            if (e.target.value.getUint8(0) === 1) {
                console.warn('🚨 CHUTE DÉTECTÉE via BLE !');
                if (this.onFallCallback) this.onFallCallback();
                this._accumulate({ fallDetected: true });
            }
        });

        console.log('✅ Abonnement BLE OK (IMU, vibration, GPS, chute)');
    },

    // Accumule les données partielles de plusieurs caractéristiques
    // et déclenche le callback toutes les 50 ms pour éviter trop de POSTs
    _pending: {},
    _timer:   null,
    _accumulate(partial) {
        this._pending = { ...this._pending, ...partial };
        clearTimeout(this._timer);
        this._timer = setTimeout(() => {
            if (this.onDataCallback) this.onDataCallback({ ...this._pending });
            this._pending = {};
        }, 50);
    },

    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            await this.device.gatt.disconnect();
        }
        this.device = null;
        this.server = null;
        if (this.onStatusChange) this.onStatusChange('disconnected');
    }
};
