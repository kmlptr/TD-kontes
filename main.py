from flask import Flask, request, jsonify
from flask_cors import CORS
import threading

from esp32 import ESP32Module
from pixhawk import PixhawkModule

app = Flask(__name__)
CORS(app)

# --- Inisialisasi modul ---
esp32 = ESP32Module("/dev/ttyUSB0", 115200)
pixhawk = PixhawkModule("/dev/ttyACM0", 115200)

esp32.connect()
pixhawk.connect()

current_mode = "DRONE"  # default ke Pixhawk

# --- API ---

@app.route("/set_mode", methods=["POST"])
def set_mode():
    global current_mode
    data = request.get_json(force=True)
    mode = data.get("mode", "").upper()
    if mode in ["ROVER", "DRONE"]:
        current_mode = mode
        return jsonify({"status": "ok", "mode": current_mode})
    return jsonify({"status": "error", "error": "Mode must be ROVER or DRONE"}), 400

@app.route("/telemetry", methods=["GET"])
def telemetry():
    if current_mode == "ROVER":
        return jsonify({"type": "ROVER", "data": esp32.telemetry()})
    else:
        return jsonify({"type": "DRONE", "data": pixhawk.telemetry()})

@app.route("/arm", methods=["POST"])
def arm():
    if current_mode == "ROVER":
        esp32.send_command("ARM_ON")
        return jsonify({"status": "ok", "armed": True})
    else:
        ok = pixhawk.arm()
        return jsonify({"status": "ok" if ok else "error", "armed": ok})

@app.route("/disarm", methods=["POST"])
def disarm():
    if current_mode == "ROVER":
        esp32.send_command("ARM_OFF")
        return jsonify({"status": "ok", "armed": False})
    else:
        ok = pixhawk.disarm()
        return jsonify({"status": "ok" if ok else "error", "armed": not ok})

@app.route("/flash", methods=["POST"])
def flash():
    if current_mode == "ROVER":
        esp32.send_command("FLASH_ON")
        return jsonify({"status": "ok"})
    return jsonify({"status": "error", "error": "Flash hanya untuk ROVER"}), 400

@app.route("/set_mode_drone", methods=["POST"])
def set_mode_drone():
    if current_mode == "DRONE":
        data = request.get_json(force=True)
        mode = data.get("mode")
        ok = pixhawk.set_mode(mode)
        return jsonify({"status": "ok" if ok else "error", "mode": mode})
    return jsonify({"status": "error", "error": "Mode change hanya untuk DRONE"}), 400

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
