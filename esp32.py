import serial, threading, time

class ESP32Module:
    def __init__(self, port="/dev/ttyUSB0", baud=115200):
        self.port = port
        self.baud = baud
        self.serial = None
        self.connected = False
        self.latest_data = {"armed": False, "safety": True, "flash": False}
        self.lock = threading.Lock()

        # jalankan auto-reconnect thread
        threading.Thread(target=self.auto_reconnect, daemon=True).start()

    def connect(self):
        try:
            self.serial = serial.Serial(self.port, self.baud, timeout=1)
            self.connected = True
            print(f"[ESP32] Terhubung ke {self.port}")
            threading.Thread(target=self.read_loop, daemon=True).start()
        except Exception as e:
            self.connected = False
            print(f"[ESP32] Gagal konek: {e}")

    def auto_reconnect(self):
        while True:
            if not self.connected:
                print("[ESP32] Mencoba reconnect...")
                self.connect()
            time.sleep(5)  # coba tiap 5 detik

    def read_loop(self):
        while self.connected:
            try:
                if self.serial and self.serial.in_waiting:
                    line = self.serial.readline().decode(errors="ignore").strip()
                    if line:
                        print(f"[ESP32] {line}")
            except Exception as e:
                print(f"[ESP32] ERROR serial: {e}")
                self.connected = False
            time.sleep(0.1)

    def send_command(self, cmd):
        if not self.connected:
            print("[ESP32] Belum terkoneksi, CMD diabaikan")
            return
        try:
            self.serial.write((cmd + "\n").encode())
            print(f"[ESP32] CMD: {cmd}")
        except Exception as e:
            print(f"[ESP32] Gagal kirim command: {e}")
            self.connected = False

    def telemetry(self):
        with self.lock:
            return {"connected": self.connected, **self.latest_data}
