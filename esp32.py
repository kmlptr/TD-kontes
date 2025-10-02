import serial
import time

class ESP32Module:
    def __init__(self, port="/dev/ttyUSB0", baud=9600):
        self.port = port
        self.baud = baud
        self.ser = None
        self.connected = False
        self.last_data = {
            "throttle": 0,
            "yaw": 0,
            "pitch": 0,
            "roll": 0,
            "aux1": 0,
            "aux2": 0,
            "aux3": 0,
            "aux4": 0
        }

    def connect(self):
        """Koneksi ke ESP32"""
        try:
            self.ser = serial.Serial(self.port, self.baud, timeout=1)
            self.connected = True
            print(f"[ESP32] Terhubung di {self.port}")
        except Exception as e:
            self.connected = False
            print(f"[ESP32] Gagal koneksi: {e}")

    def read_telemetry(self):
        """Baca data serial dari ESP32"""
        if not self.connected:
            return {"connected": False}

        try:
            line = self.ser.readline().decode(errors="ignore").strip()
            if not line:
                return {"connected": True, "data": self.last_data}

            # Parsing sesuai Serial.print di ESP32
            # Format contoh: "500    500    500    0    0    1000"
            parts = line.split()
            if len(parts) >= 6:
                self.last_data["throttle"] = int(parts[0])
                self.last_data["yaw"]      = int(parts[1])
                self.last_data["roll"]     = int(parts[2])
                self.last_data["aux2"]     = int(parts[3])
                self.last_data["aux1"]     = int(parts[4])
                self.last_data["aux3"]     = int(parts[5])
                # aux4 bisa ditambahkan kalau ikut dikirim
            return {"connected": True, "data": self.last_data}

        except Exception as e:
            return {"connected": False, "error": str(e)}

    def close(self):
        if self.ser and self.ser.is_open:
            self.ser.close()
            self.connected = False
            print("[ESP32] Koneksi ditutup")


# --- Contoh penggunaan ---
if __name__ == "__main__":
    esp = ESP32Module("/dev/ttyUSB0", 9600)
    esp.connect()

    while True:
        data = esp.read_telemetry()
        if data["connected"]:
            print(data["data"])  # tampilkan dictionary telemetry
        else:
            print("[ERROR]", data.get("error", "Tidak ada data"))
        time.sleep(0.1)
