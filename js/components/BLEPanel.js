// BLE Panel Component
// Deux modes :
//  - Web Bluetooth (si supporté) → connexion directe depuis le navigateur
//  - BLE Gateway Python (ble-gateway.py) → données reçues via WebSocket

const BLEPanel = () => {
    const [bleStatus,   setBleStatus]   = React.useState('disconnected');
    const [lastData,    setLastData]    = React.useState(null);
    const [fallAlert,   setFallAlert]   = React.useState(false);
    const [error,       setError]       = React.useState('');
    const [gatewayLive, setGatewayLive] = React.useState(false);
    const lastFallTimeRef = React.useRef(0);

    const webBTSupported = BLEManager.isSupported();

    React.useEffect(() => {
        // --- Mode Web Bluetooth ---
        BLEManager.onStatusChange = (status) => setBleStatus(status);

        BLEManager.onDataCallback = async (data) => {
            setLastData(data);
            try { await SafeStepAPI.postDeviceData(data); } catch (_) {}
        };

        BLEManager.onFallCallback = async () => {
            const now = Date.now();
            if (now - lastFallTimeRef.current > 8000) {
                lastFallTimeRef.current = now;
                setFallAlert(true);
                try { await SafeStepAPI.recordFall({ location: 'Position inconnue', severity: 'Élevée' }); } catch(e) {}
                setTimeout(() => setFallAlert(false), 8000);
            }
        };

        // --- Mode Gateway Python — écoute les updates WebSocket ---
        SafeStepAPI.on('device_update', (data) => {
            if (!data) return;
            setGatewayLive(true);
            setLastData({
                imu: data.shoe?.sensors?.accelerometer ? {
                    ax: data.shoe.sensors.accelerometer.x,
                    ay: data.shoe.sensors.accelerometer.y,
                    az: data.shoe.sensors.accelerometer.z,
                    gx: data.shoe.sensors.gyroscope?.x ?? 0,
                    gy: data.shoe.sensors.gyroscope?.y ?? 0,
                    gz: data.shoe.sensors.gyroscope?.z ?? 0,
                } : null,
                gps:       data.gps,
                vibration: data.shoe?.sensors?.vibration,
            });
            if (data.fallDetected) {
                const now = Date.now();
                if (now - lastFallTimeRef.current > 8000) {
                    lastFallTimeRef.current = now;
                    setFallAlert(true);
                    SafeStepAPI.recordFall({ location: data.gps?.valid ? `${data.gps.latitude.toFixed(4)}, ${data.gps.longitude.toFixed(4)}` : 'Position inconnue', severity: 'Élevée' }).catch(console.error);
                    setTimeout(() => setFallAlert(false), 8000);
                }
            }
        });

        return () => {
            BLEManager.onStatusChange = null;
            BLEManager.onDataCallback = null;
            BLEManager.onFallCallback = null;
        };
    }, []);

    const handleConnect    = async () => {
        setError('');
        setBleStatus('connecting');
        try { await BLEManager.connect(); }
        catch (e) { setBleStatus('disconnected'); setError(e.message || 'Connexion BLE échouée'); }
    };
    const handleDisconnect = async () => await BLEManager.disconnect();

    const imu       = lastData?.imu;
    const gps       = lastData?.gps;
    const vibration = lastData?.vibration;
    const isLive    = bleStatus === 'connected' || gatewayLive;

    const statusColor = bleStatus === 'connected'  ? '#10B981'
                      : bleStatus === 'connecting' ? '#F59E0B'
                      : gatewayLive                ? '#10B981'
                      : '#EF4444';

    const statusLabel = bleStatus === 'connected'  ? 'Connectée (BLE direct)'
                      : bleStatus === 'connecting' ? 'Connexion en cours...'
                      : gatewayLive                ? 'Connectée (gateway Python)'
                      : 'Déconnectée';

    return (
        <div className="metric-card mb-6">
            {fallAlert && (
                <div className="mb-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                    <span style={{ fontSize: '1.2rem' }}>🚨</span>
                    <span className="text-red-700 font-semibold text-sm">Chute détectée !</span>
                </div>
            )}

            <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Icon name="bluetooth" size={20} color="#0EA5E9" />
                Chaussure Connectée
            </h3>

            <div className="flex items-center gap-2 mb-4">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: statusColor }}></div>
                <span className="text-sm font-semibold" style={{ color: statusColor }}>{statusLabel}</span>
                {isLive && <span className="text-xs text-slate-400 ml-auto">Live ●</span>}
            </div>

            {isLive && imu && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg text-xs font-mono space-y-2">
                    <div>
                        <span className="font-sans font-semibold text-slate-500">Accéléromètre (g)</span>
                        <div className="flex gap-3 mt-1">
                            <span>X <b>{imu.ax?.toFixed(2)}</b></span>
                            <span>Y <b>{imu.ay?.toFixed(2)}</b></span>
                            <span>Z <b>{imu.az?.toFixed(2)}</b></span>
                        </div>
                    </div>
                    <div>
                        <span className="font-sans font-semibold text-slate-500">Gyroscope (°/s)</span>
                        <div className="flex gap-3 mt-1">
                            <span>X <b>{imu.gx?.toFixed(1)}</b></span>
                            <span>Y <b>{imu.gy?.toFixed(1)}</b></span>
                            <span>Z <b>{imu.gz?.toFixed(1)}</b></span>
                        </div>
                    </div>
                    {gps?.valid && (
                        <div>
                            <span className="font-sans font-semibold text-slate-500">GPS</span>
                            <div className="mt-1">
                                {gps.latitude?.toFixed(5)}° N, {gps.longitude?.toFixed(5)}° E — {gps.speed?.toFixed(1)} km/h
                            </div>
                        </div>
                    )}
                    {vibration && <div className="text-orange-500 font-sans font-semibold">⚡ Vibration</div>}
                </div>
            )}

            {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

            {webBTSupported && (
                bleStatus !== 'connected' ? (
                    <button onClick={handleConnect} disabled={bleStatus === 'connecting'}
                        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-50 mb-3"
                        style={{ background: '#0EA5E9' }}>
                        {bleStatus === 'connecting' ? 'Recherche...' : 'Connecter via Web Bluetooth'}
                    </button>
                ) : (
                    <button onClick={handleDisconnect}
                        className="w-full py-3 rounded-xl font-semibold text-sm border-2 border-slate-200 text-slate-600 hover:bg-slate-50 transition-all mb-3">
                        Déconnecter
                    </button>
                )
            )}

            <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500">
                <p className="font-semibold text-slate-600 mb-1">BLE Gateway Python</p>
                {gatewayLive ? (
                    <p className="text-green-600 font-semibold">✅ Gateway active</p>
                ) : (
                    <>
                        <p className="mb-1">Dans un terminal :</p>
                        <code className="block bg-slate-200 px-2 py-1 rounded mb-1">pip install bleak requests</code>
                        <code className="block bg-slate-200 px-2 py-1 rounded">python3 ble-gateway.py</code>
                    </>
                )}
            </div>
        </div>
    );
};

if (typeof module !== 'undefined' && module.exports) module.exports = BLEPanel;
