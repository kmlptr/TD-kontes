from dronekit import connect, VehicleMode
import threading, time

class PixhawkModule:
    def __init__(self, connection="/dev/ttyACM0", baud=115200):
        self.connection = connection
        self.baud = baud
        self.vehicle = None
        self.connected = False
        self.latest_data = {"armed": False, "mode": "UNKNOWN", "safety": True}
        self.lock = threading.Lock()

        threading.Thread(target=self.auto_reconnect, daemon=True).start()

    def connect(self):
        try:
            print(f"[Pixhawk] Mencoba koneksi ke {self.connection}")
            self.vehicle = connect(self.connection, baud=self.baud, wait_ready=False)
            self.connected = True
            print("[Pixhawk] Terhubung")
            threading.Thread(target=self.update_loop, daemon=True).start()
        except Exception as e:
            self.connected = False
            print(f"[Pixhawk] Gagal konek: {e}")

    def auto_reconnect(self):
        while True:
            if not self.connected:
                print("[Pixhawk] Mencoba reconnect...")
                self.connect()
            time.sleep(5)

    def update_loop(self):
        while self.connected:
            try:
                with self.lock:
                    self.latest_data["armed"] = self.vehicle.armed if self.vehicle else False
                    self.latest_data["mode"] = self.vehicle.mode.name if self.vehicle else "UNKNOWN"
            except Exception as e:
                print(f"[Pixhawk] ERROR telemetry: {e}")
                self.connected = False
            time.sleep(1)

    def telemetry(self):
        with self.lock:
            return {"connected": self.connected, **self.latest_data}
