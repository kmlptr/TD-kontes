from flask import Flask, request, jsonify
from flask_cors import CORS

from esp32 import ESP32Module
from pixhawk import PixhawkModule

# --- Setup Flask ---
app = Flask(__name__)
CORS(app)

# --- Inisialisasi modul ---
esp32 = ESP32Module("/dev/ttyUSB0")
pixhawk = PixhawkModule("/dev/ttyACM0")

esp32.connect()
pixhawk.connect()

# --- Global state ---
current_mode = "DRONE"  # default awal = DRONE


# ===============================
# API ENDPOINTS
# ===============================

@app.route("/set_mode", methods=["POST"])
def set_mode():
    """Pindah mode antara ROVER (ESP32) dan DRONE (Pixhawk)."""
    global current_mode
    data = request.get_json(force=True)
    mode = data.get("mode", "").upper()

    if mode in ["ROVER", "DRONE"]:
        current_mode = mode
        return jsonify({"status": "ok", "mode": current_mode})
    return jsonify({"status": "error", "error": "Mode must be ROVER or DRONE"}), 400


@app.route("/telemetry", methods=["GET"])
def telemetry():
    """Ambil data telemetry sesuai mode saat ini."""
    if current_mode == "ROVER":
        d = esp32.telemetry()
        d["type"] = "ROVER"
    else:
        d = pixhawk.telemetry()
        d["type"] = "DRONE"
    return jsonify(d)


@app.route("/arm", methods=["POST"])
def arm():
    """Arm kendaraan sesuai mode saat ini."""
    if current_mode == "ROVER":
        esp32.send_command("ARM_ON")
        return jsonify({"status": "ok", "armed": True, "type": "ROVER"})
    else:
        ok = pixhawk.arm()
        return jsonify({"status": "ok" if ok else "error", "armed": ok, "type": "DRONE"})


@app.route("/disarm", methods=["POST"])
def disarm():
    """Disarm kendaraan sesuai mode saat ini."""
    if current_mode == "ROVER":
        esp32.send_command("ARM_OFF")
        return jsonify({"status": "ok", "armed": False, "type": "ROVER"})
    else:
        ok = pixhawk.disarm()
        return jsonify({"status": "ok" if ok else "error", "armed": not ok, "type": "DRONE"})


@app.route("/flash", methods=["POST"])
def flash():
    """Toggle flash lampu di ROVER (ESP32)."""
    if current_mode == "ROVER":
        esp32.send_command("FLASH_TOGGLE")
        return jsonify({"status": "ok", "type": "ROVER"})
    return jsonify({"status": "error", "error": "Flash hanya untuk ROVER"}), 400


@app.route("/set_mode_drone", methods=["POST"])
def set_mode_drone():
    """Ubah flight mode di Pixhawk (hanya saat mode DRONE)."""
    if current_mode == "DRONE":
        data = request.get_json(force=True)
        mode = data.get("mode", "").upper()
        ok = pixhawk.set_mode(mode)
        return jsonify({"status": "ok" if ok else "error", "mode": mode, "type": "DRONE"})
    return jsonify({"status": "error", "error": "Mode change hanya untuk DRONE"}), 400


# ===============================
# ENTRY POINT
# ===============================
if __name__ == "__main__":
    print("[INFO] Server API dimulai di http://0.0.0.0:5000")
    print("[INFO] Default mode:", current_mode)
    app.run(host="0.0.0.0", port=5000, debug=True)
