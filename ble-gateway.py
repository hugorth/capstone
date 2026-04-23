#!/usr/bin/env python3
"""
SafeStep BLE Gateway
====================
Lit les données de la chaussure ESP32 via BLE natif (bleak)
et les envoie au backend Express via HTTP.

Utilisation:
    pip install bleak requests
    python3 ble-gateway.py

Requis: Bluetooth activé sur le PC, ESP32 allumé et en advertising.
"""

import asyncio
import struct
import time
import threading
import requests
import logging
from bleak import BleakClient, BleakScanner

# ==================== CONFIG ====================
DEVICE_NAME    = "SafeStep_Shoe"
BACKEND_URL    = "http://localhost:3001/api/device/gateway"
STEP_URL       = "http://localhost:3001/api/device/gateway/step"
GATEWAY_KEY    = "safestep-gateway-local"
DEBOUNCE_MS    = 100   # ms entre deux envois HTTP
RECONNECT_WAIT = 5     # secondes avant reconnexion

STEP_COOLDOWN  = 0.5  # secondes entre deux pas (max 2 pas/sec)

# UUIDs — doivent correspondre à safestep_esp32.ino
SERVICE_UUID        = "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
CHAR_IMU_UUID       = "beb5483e-36e1-4688-b7f5-ea07361b26a8"
CHAR_VIBRATION_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a9"
CHAR_GPS_UUID       = "beb5483e-36e1-4688-b7f5-ea07361b26aa"
CHAR_FALL_UUID      = "beb5483e-36e1-4688-b7f5-ea07361b26ab"

# ==================== LOGGING ====================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
log = logging.getLogger("safestep-gateway")

# ==================== ÉTAT ====================
pending_data   = {}
send_timer     = None
send_lock      = threading.Lock()
last_step_time = 0.0


def notify_step():
    """Notifie immédiatement le backend qu'un pas a été détecté."""
    global last_step_time
    now = time.monotonic()
    if now - last_step_time < STEP_COOLDOWN:
        return
    last_step_time = now
    def _send():
        try:
            requests.post(
                STEP_URL,
                headers={"X-Gateway-Key": GATEWAY_KEY},
                timeout=2
            )
        except Exception:
            pass
    threading.Thread(target=_send, daemon=True).start()


def send_to_backend(data: dict):
    """Envoie les données au backend Express en HTTP POST."""
    try:
        payload = {
            "imu":         data.get("imu"),
            "vibration":   data.get("vibration", False),
            "gps":         data.get("gps"),
            "fallDetected": data.get("fallDetected", False),
        }
        r = requests.post(
            BACKEND_URL,
            json=payload,
            headers={"X-Gateway-Key": GATEWAY_KEY},
            timeout=2
        )
        if r.status_code != 200:
            log.warning(f"Backend a répondu {r.status_code}: {r.text}")
    except requests.exceptions.ConnectionError:
        log.warning("Backend inaccessible — est-il démarré ?")
    except Exception as e:
        log.error(f"Erreur envoi HTTP: {e}")


def accumulate(partial: dict):
    """Accumule les données partielles et déclenche l'envoi (throttle garanti tous les DEBOUNCE_MS)."""
    global pending_data, send_timer

    with send_lock:
        pending_data.update(partial)

        if send_timer is None:
            def fire():
                global send_timer
                with send_lock:
                    snapshot = dict(pending_data)
                    if "fallDetected" in pending_data:
                        pending_data["fallDetected"] = False
                    if "vibration" in pending_data:
                        pending_data["vibration"] = False
                    send_timer = None
                send_to_backend(snapshot)

            send_timer = threading.Timer(DEBOUNCE_MS / 1000.0, fire)
            send_timer.daemon = True
            send_timer.start()


# ==================== CALLBACKS BLE ====================
def on_imu(sender, data: bytearray):
    if len(data) < 24:
        return
    ax, ay, az, gx, gy, gz = struct.unpack_from("<6f", data)
    accumulate({
        "imu": {
            "ax": round(ax, 4), "ay": round(ay, 4), "az": round(az, 4),
            "gx": round(gx, 2), "gy": round(gy, 2), "gz": round(gz, 2),
        }
    })
    log.debug(f"IMU ax={ax:.2f} ay={ay:.2f} az={az:.2f}")


def on_vibration(sender, data: bytearray):
    vib = bool(data[0])
    accumulate({"vibration": vib})
    if vib:
        log.info("⚡ Vibration détectée")
        notify_step()


def on_gps(sender, data: bytearray):
    if len(data) < 12:
        return
    lat, lon, speed = struct.unpack_from("<3f", data)
    accumulate({
        "gps": {
            "latitude":  round(lat,   6),
            "longitude": round(lon,   6),
            "speed":     round(speed, 2),
            "valid":     True,
        }
    })
    log.info(f"📍 GPS lat={lat:.5f} lon={lon:.5f} vitesse={speed:.1f} km/h")


def on_fall(sender, data: bytearray):
    if data[0] == 1:
        log.warning("🚨 CHUTE DÉTECTÉE !")
        accumulate({"fallDetected": True})


# ==================== CONNEXION BLE ====================
async def connect_and_run():
    """Scanne, se connecte et écoute la chaussure en boucle."""
    while True:
        log.info(f"🔍 Scan BLE — recherche '{DEVICE_NAME}'...")

        device = None
        try:
            device = await asyncio.wait_for(
                BleakScanner.find_device_by_name(DEVICE_NAME, timeout=10.0),
                timeout=12.0
            )
        except asyncio.TimeoutError:
            log.warning("Le scan a expiré (timeout de sécurité).")
        except Exception as e:
            log.error(f"Erreur scan: {e}")

        if device is None:
            log.warning(f"'{DEVICE_NAME}' non trouvé. Nouvelle tentative dans {RECONNECT_WAIT}s...")
            await asyncio.sleep(RECONNECT_WAIT)
            continue

        log.info(f"✅ Trouvé: {device.name} ({device.address})")

        def handle_disconnect(client):
            log.warning("🔴 Disconnected callback called!")

        try:
            async with BleakClient(device.address, disconnected_callback=handle_disconnect) as client:
                log.info("🔗 Connecté via BLE")

                await client.start_notify(CHAR_IMU_UUID,       on_imu)
                await client.start_notify(CHAR_VIBRATION_UUID, on_vibration)
                await client.start_notify(CHAR_GPS_UUID,       on_gps)
                await client.start_notify(CHAR_FALL_UUID,      on_fall)

                log.info("📡 Réception des données (Ctrl+C pour arrêter)...")

                # Maintient la connexion jusqu'à déconnexion
                while client.is_connected:
                    await asyncio.sleep(1)

                log.warning("🔌 Déconnecté — reconnexion dans {}s...".format(RECONNECT_WAIT))

        except Exception as e:
            log.error(f"Erreur BLE: {e}")

        await asyncio.sleep(RECONNECT_WAIT)


# ==================== MAIN ====================
if __name__ == "__main__":
    print("╔══════════════════════════════════════════════╗")
    print("║   🦿 SafeStep BLE Gateway                   ║")
    print("║                                              ║")
    print("║   Backend : http://localhost:3001            ║")
    print("║   Device  : SafeStep_Shoe (ESP32)            ║")
    print("║   Ctrl+C pour arrêter                        ║")
    print("╚══════════════════════════════════════════════╝")
    print()

    try:
        asyncio.run(connect_and_run())
    except KeyboardInterrupt:
        print("\n👋 Gateway arrêtée.")
