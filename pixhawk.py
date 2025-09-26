from dronekit import connect, VehicleMode
from pymavlink import mavutil
import time

class PixhawkModule:
    def __init__(self, port="/dev/ttyACM0", baud=115200):
        self.port = port
        self.baud = baud
        self.vehicle = None
        self.connected = False

    def connect(self):
        try:
            print(f"[Pixhawk] Mencoba koneksi ke {self.port}...")
            self.vehicle = connect(self.port, baud=self.baud, wait_ready=True, timeout=5)
            self.connected = True
            print("[Pixhawk] Terhubung")
        except Exception as e:
            self.connected = False
            print(f"[Pixhawk] Gagal koneksi: {e}")

    def telemetry(self):
        if not self.connected or not self.vehicle:
            return {"connected": False}

        try:
            v = self.vehicle
            return {
                "connected": True,
                "armed": v.armed,
                "mode": v.mode.name,
                "altitude": round(v.location.global_relative_frame.alt, 2),
                "speed": round(v.groundspeed, 2),
                "heading": v.heading,
                "latitude": round(v.location.global_frame.lat, 6),
                "longitude": round(v.location.global_frame.lon, 6),
                "satellites": v.gps_0.satellites_visible,
            }
        except Exception as e:
            return {"connected": False, "error": str(e)}

    def arm(self):
        try:
            self.vehicle.armed = True
            self.vehicle.flush()
            return True
        except:
            return False

    def disarm(self):
        try:
            self.vehicle.armed = False
            self.vehicle.flush()
            return True
        except:
            return False

    def set_mode(self, mode_name):
        try:
            self.vehicle.mode = VehicleMode(mode_name)
            self.vehicle.flush()
            return True
        except:
            return False
