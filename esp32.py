import serial
import time

class ESP32Module:
    def __init__(self, port="/dev/ttyUSB0", baud=115200):
        self.port = port
        self.baud = baud
        self.ser = None
        self.connected = False

    def connect(self):
        try:
            self.ser = serial.Serial(self.port, self.baud, timeout=1)
            self.connected = True
            print(f"[ESP32] Terhubung di {self.port}")
        except Exception as e:
            self.connected = False
            print(f"[ESP32] Gagal koneksi: {e}")

    def send_command(self, cmd):
        if not self.connected:
            return False
        try:
            self.ser.write((cmd + "\n").encode())
            return True
        except:
            return False

    def telemetry(self):
        if not self.connected:
            return {"connected": False}
        try:
            self.ser.write(b"STATUS\n")
            line = self.ser.readline().decode().strip()
            return {"connected": True, "raw": line}
        except Exception as e:
            return {"connected": False, "error": str(e)}
