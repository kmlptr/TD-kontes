// ======================
// 1. KELAS UTAMA GCS
// ======================
class GroundControlStation {
    constructor() {
        this.mapElements = {};
        this.isArmed = false;
        this.currentMode = 'STABILIZE';
        this.vehicleType = 'DRONE';
        this.lastMoveTime = Date.now();
        this.pathVisible = false;
        this.autoCenter = false;
        this.telemetryTimer = null;
        this.isConnected = false; // status koneksi GCS

        this.init();
    }

    // ======================
    // 2. INISIALISASI UTAMA
    // ======================
    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initMap();
            this.setupControls();
            this.startTelemetryLoop();
        });
    }

    // ======================
    // 3. MAP DAN PATH
    // ======================
   initMap() {
    const map = L.map('map').setView([0, 0], 10);
    L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
    // maxZoom : 20,
    subdomains:['mt0','mt1','mt2','mt3']
    }).addTo(map);


    const droneIcon = L.icon({
        iconUrl: 'assets/drone2.PNG',  // path ke logo drone (PNG/SVG)
        iconSize: [60, 39],
        iconAnchor: [30, 19],
    });

    const vehicleMarker = L.marker([0, 0], { icon: droneIcon, rotationAngle: 0 }).addTo(map);
    const vehiclePath = L.polyline([], { color: 'blue', opacity: 1 }).addTo(map);

    this.mapElements = { map, vehicleMarker, vehiclePath, pathPoints: [] };

    // interval untuk menghapus titik lama (biar fading)
    setInterval(() => {
        const now = Date.now();
        // keep hanya titik dalam 5 detik terakhir
        this.mapElements.pathPoints = this.mapElements.pathPoints.filter(p => now - p.timestamp < 10000);
        this.mapElements.vehiclePath.setLatLngs(this.mapElements.pathPoints.map(p => p.latlng));
    }, 500);
}

updateMap(data) {
    const { vehicleMarker, vehiclePath, pathPoints, map } = this.mapElements;

    if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const pos = [data.latitude, data.longitude];
        vehicleMarker.setLatLng(pos);

        // Rotasi sesuai heading
        if (typeof data.heading === 'number') {
            vehicleMarker.setRotationAngle(data.heading);
            vehicleMarker.setRotationOrigin("center center");
        }

        // Simpan titik dengan timestamp
        pathPoints.push({ latlng: pos, timestamp: Date.now() });
        vehiclePath.setLatLngs(pathPoints.map(p => p.latlng));

        this.lastMoveTime = Date.now();
        this.pathVisible = true;

        if (this.autoCenter) {
            map.setView(pos, 20);
        }
    }
}

    // ======================
    // 4. KONTROL & EVENT
    // ======================
   setupControls() {
    // ARM/DISARM Button
    document.getElementById('armBtn').addEventListener('click', async () => {
        if (!this.isArmed) {
            // 🚨 Cek dulu apakah safety aktif sebelum arm
            const safetyBtn = document.getElementById('safetySwitch');
            const isSafetyOn = safetyBtn.dataset.enabled === "true";
            if (isSafetyOn) {
                alert("Safety harus OFF sebelum ARM!");
                return;
            }
        }
        
        const command = this.isArmed ? 'disarm' : 'arm';
        
        try {
            const res = await fetch(BASE_IP + "/arm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: command })
            });
            
            const result = await res.json();
            
            if (result && result.status === "ok") {
                // Update UI berdasarkan respons server
                this.isArmed = result.armed;
                
                if (this.isArmed) {
                    this.updateDisplay('armedStatus', 'ARMED');
                    document.getElementById('armBtn').textContent = 'DISARM';
                    document.getElementById('armBtn').className = 'btn btn-danger';
                    console.log("Drone berhasil di-ARM");
                } else {
                    this.updateDisplay('armedStatus', 'DISARMED');
                    document.getElementById('armBtn').textContent = 'ARM';
                    document.getElementById('armBtn').className = 'btn btn-success';
                    console.log("Drone berhasil di-DISARM");
                }
            } else {
                console.error("Gagal", command, ":", result ? result.error : "Unknown error");
                alert("Gagal " + command + ": " + (result ? result.error : "Unknown error"));
            }
        } catch (err) {
            console.error("Error", command, ":", err);
            alert("Koneksi error saat " + command);
        }
    });

    // SET MODE Button
    document.getElementById('setModeBtn').addEventListener('click', async () => {
        const mode = document.getElementById('flightMode').value;
        try {
            const res = await fetch(BASE_IP + "/set_mode", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mode })
            });
            const result = await res.json();
            if (result && result.mode) {
                this.updateTelemetry({ mode: result.mode });
                console.log("Mode berhasil diubah:", result.mode);
            } else if (result && result.error) {
                console.error("Gagal set mode:", result.error);
                alert("Gagal mengubah mode: " + result.error);
            }
        } catch (err) {
            console.error("Gagal set mode:", err);
            alert("Koneksi error saat mengubah mode");
        }
    });

    // VEHICLE TYPE Buttons

const roverBtn = document.getElementById("roverBtn");
const statusMsg = document.getElementById("statusMsg"); // elemen buat nampilin status

roverBtn.addEventListener("click", () => {
    // Cek status armed dari telemetry global (misal: latest_data.armed)
    if (typeof latest_data !== "undefined" && latest_data.armed === true) {
        statusMsg.textContent = "❌ Tidak bisa pindah ke Rover saat ARMED! Disarm dulu.";
        return;
    }

    // Kalau sudah disarm -> boleh set mode
    fetch(BASE_IP + "/set_mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ROVER" })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            statusMsg.textContent = "✅ Mode Rover dipilih!";
        } else {
            statusMsg.textContent = "⚠️ Gagal set mode Rover!";
        }
    })
    .catch(err => {
        statusMsg.textContent = "❌ Error set mode Rover: " + err;
    });
});


document.getElementById("droneBtn").addEventListener("click", () => {
    fetch(BASE_IP + "/set_mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "DRONE" })
    })
    .then(res => res.json())
    .then(data => {
        statusMsg.textContent = "Mode Drone dipilih ✅";
    })
    .catch(err => {
        statusMsg.textContent = "Gagal set mode Drone: " + err;
    });
});
    // AUTO-CENTER Button
    document.getElementById('toggleAutoCenterBtn').addEventListener('click', () => {
        this.autoCenter = !this.autoCenter;
        document.getElementById('toggleAutoCenterBtn').textContent =
            this.autoCenter ? 'Disable Auto-Center' : 'Enable Auto-Center';
    });

    // SAFETY SWITCH
    const safetyBtn = document.getElementById('safetySwitch');
    if (safetyBtn) {
        // Inisialisasi state awal
        let enabled = safetyBtn.dataset.enabled === "true";
        
        // Event toggle safety
        safetyBtn.addEventListener('click', async (e) => {
            const newState = !enabled;
            
            // Disable button sementara
            safetyBtn.disabled = true;
            const originalText = safetyBtn.textContent;
            safetyBtn.textContent = "Loading...";
            
            try {
                const res = await fetch(BASE_IP + "/safety", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ state: newState ? "on" : "off" })
                });
                
                const result = await res.json();
                
                if (result && result.status === "ok") {
                    // Update UI jika berhasil
                    enabled = newState;
                    safetyBtn.dataset.enabled = newState.toString();
                    
                    if (newState) {
                        safetyBtn.textContent = "SAFETY ON";
                        safetyBtn.classList.remove("off");
                        safetyBtn.classList.add("on");
                        this.sendLedCommand("on");
                    } else {
                        safetyBtn.textContent = "SAFETY OFF";
                        safetyBtn.classList.remove("on");
                        safetyBtn.classList.add("off");
                        this.sendLedCommand("off");
                    }
                    
                    console.log("Safety switch berhasil diubah:", newState ? "ON" : "OFF");
                    
                } else {
                    console.error("Gagal mengubah safety:", result ? result.error : "Unknown error");
                    alert("Gagal mengubah safety: " + (result ? result.error : "Unknown error"));
                }
            } catch (err) {
                console.error("Error mengubah safety:", err);
                alert("Koneksi error saat mengubah safety");
            } finally {
                // Selalu enable button kembali
                safetyBtn.disabled = false;
            }
        });
    }

    // REBOOT BUTTON
    document.addEventListener("DOMContentLoaded", function () {
        const rebootBtn = document.getElementById("rebootControllerBtn");

        rebootBtn.addEventListener("click", async function () {
            rebootBtn.disabled = true;
            rebootBtn.innerText = "Rebooting...";

            try {
                const response = await fetch(BASE_IP + "/api/reboot", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });

                const result = await response.json();
                
                if (response.ok && result && result.status === "ok") {
                    alert("✅ Pixhawk berhasil direboot!");
                } else {
                    alert("❌ Gagal reboot Pixhawk: " + (result && result.message ? result.message : "Unknown error"));
                }
            } catch (err) {
                console.error(err);
                alert("⚠️ Error: tidak bisa terhubung ke server.");
            } finally {
                rebootBtn.disabled = false;
                rebootBtn.innerText = "Reboot Controller";
            }
        });
    });
}

// LED COMMAND FUNCTION
sendLedCommand(state) {
    fetch(BASE_IP + "/led", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: state })
    })
    .then(res => res.json())
    .then(data => console.log("LED response:", data))
    .catch(err => console.error("LED error:", err));
}

// SEND COMMAND FUNCTION (for other commands)
sendCommand(command, params = {}) {
    console.log(`Mengirim perintah: ${command}`, params);
    
    if (command === 'set_mode') {
        this.currentMode = params.mode || 'UNKNOWN';
        this.updateDisplay('modeStatus', `MODE: ${this.currentMode}`);
        
        // Kirim ke server
        fetch(BASE_IP + "/set_mode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: params.mode })
        })
        .then(res => res.json())
        .then(data => {
            if (data && data.mode) {
                this.updateDisplay('modeStatus', `MODE: ${data.mode}`);
            }
        })
        .catch(err => console.error("Gagal set mode:", err));
    }
    
    // Tambahkan perintah lainnya di sini jika needed
}

    // ======================
    // 5. LOOP TELEMETRI
    // ======================
    startTelemetryLoop() {
        const fetchTelemetry = () => {
            fetch(BASE_IP + "/telemetry")
                .then(res => res.json())
                .then(data => {
                    this.updateTelemetry(data);
                    this.updateMap(data);
                })
                .catch(err => console.error("Gagal ambil telemetry:", err));
        };

        this.telemetryTimer = setInterval(fetchTelemetry, 200);
    }
    updateTelemetry(data) {
    if (!data || typeof data !== "object") return;

    // --- Status ARM / DISARM ---
    if (typeof data.armed === "boolean") {
        this.isArmed = data.armed;

        const armedStatusElement = document.getElementById("armedStatus");
        if (armedStatusElement) {
            armedStatusElement.textContent = this.isArmed ? "ARMED" : "DISARMED";
            armedStatusElement.classList.toggle("armed-true", this.isArmed);
            armedStatusElement.classList.toggle("armed-false", !this.isArmed);
        }

        const armBtn = document.getElementById("armBtn");
        if (armBtn) {
            armBtn.textContent = this.isArmed ? "DISARM" : "ARM";
            armBtn.className = this.isArmed ? "btn btn-danger" : "btn btn-success";
        }
    }

    // --- Mode (langsung dari telemetry atau hasil set_mode) ---
    if (typeof data.mode === "string" && data.mode.trim() !== "") {
        this.currentMode = data.mode;
        this.updateDisplay("modeStatus", `MODE: ${this.currentMode.toUpperCase()}`);
    }

    // --- Telemetry Numeric ---
    this.updateDisplay(
        "altitudeValue",
        (typeof data.altitude === "number" && !isNaN(data.altitude)) 
            ? `${data.altitude.toFixed(2)} m` 
            : "-"
    );
    this.updateDisplay(
        "speedValue",
        (typeof data.speed === "number" && !isNaN(data.speed)) 
            ? `${data.speed.toFixed(1)} m/s` 
            : "-"
    );
    this.updateDisplay(
        "headingValue",
        (typeof data.heading === "number" && !isNaN(data.heading)) 
            ? `${data.heading.toFixed(0)}°` 
            : "-"
    );

    // --- GPS ---
    const lat = (typeof data.latitude === "number" && !isNaN(data.latitude)) ? data.latitude : null;
    const lon = (typeof data.longitude === "number" && !isNaN(data.longitude)) ? data.longitude : null;
    this.updateDisplay(
        "gpsValue",
        (lat !== null && lon !== null)
            ? `Lat: ${lat.toFixed(6)}, Lon: ${lon.toFixed(6)}`
            : "-"
    );
    
    this.updateDisplay(
        "gpsCount",
        (typeof data.satellites === "number" && !isNaN(data.satellites))
            ? `${data.satellites}`
            : "0"
    );

    // --- Motors ---
    const motors = data.motors || {};
    this.updateDisplay("motor1status", motors.motor1 != null ? `${motors.motor1}%` : "-");
    this.updateDisplay("motor2status", motors.motor2 != null ? `${motors.motor2}%` : "-");
    this.updateDisplay("motor3status", motors.motor3 != null ? `${motors.motor3}%` : "-");
    this.updateDisplay("motor4status", motors.motor4 != null ? `${motors.motor4}%` : "-");

    // --- Compass ---
// --- Compass ---
if (typeof data.heading === "number" && !isNaN(data.heading)) {
    const compass = document.getElementById("compass-rose");
    if (compass) {
        compass.style.transform = `rotate(${-data.heading}deg)`;
    }
}

// --- Gyro (Attitude) ---
if (data.attitude && typeof data.attitude === "object") {
    const pitch = (!isNaN(data.attitude.pitch)) ? data.attitude.pitch : 0;
    const roll  = (!isNaN(data.attitude.roll)) ? data.attitude.roll : 0;
    const yaw   = (!isNaN(data.attitude.yaw)) ? data.attitude.yaw : 0;

    const pitchOffset = Math.max(Math.min(pitch * 3, 80), -80); // geser lebih jelas

    const horizon = document.getElementById("horizon");
    if (horizon) {
        horizon.style.transformOrigin = "center center"; // aman
        horizon.style.transform = `rotate(${roll}deg) translateY(${pitchOffset}px)`;
    }

    if (typeof this.updateDisplay === "function") {
        this.updateDisplay("pitchValue", pitch.toFixed(1));
        this.updateDisplay("rollValue", roll.toFixed(1));
        this.updateDisplay("yawValue", yaw.toFixed(1));
    }
}

    // --- Vehicle Type (DRONE/ROVER) ---
    if (typeof data.type === "string") {
        this.vehicleType = data.type;
        this.updateDisplay("vehicleTypeValue", this.vehicleType.toUpperCase());
    }
}

    // ======================
    // 6. UTILITAS
    // ======================
    updateDisplay(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
}

// ======================
// 7. FUNGSI KAMERA
// ======================
const cameraImage = document.getElementById("cameraStream");
const cameraToggleBtn = document.getElementById("startCameraBtn");
const flashBtn = document.getElementById("FlashBtn");
let isStreaming = false;

// Ganti dengan IP Zerotier / LAN Raspberry Pi (TANPA /video_feed)
// const BASE_IP = "http://127.0.0.1:8000";
// const BASE_IP = "http://192.168.193.2:8000";
// const BASE_IP = "http://192.168.0.192:8000";
// const BASE_IP = "http://192.168.0.181:8000";

let BASE_IP = ""; // awalnya kosong

const ipInput = document.getElementById("ipInput");
const setIpBtn = document.getElementById("setIpBtn");
const currentIp = document.getElementById("currentIp");

// Saat tombol "Set IP" diklik
setIpBtn.addEventListener("click", () => {
  const ipValue = ipInput.value.trim();

  if (ipValue) {
    BASE_IP = "http://" + ipValue; // tambahkan protokol
    currentIp.textContent = "Terhubung ke: " + BASE_IP;
    currentIp.style.color = "green";
    console.log("BASE_IP diupdate:", BASE_IP);
  } else {
    alert("Masukkan IP terlebih dahulu!");
  }
});


cameraToggleBtn.addEventListener("click", () => {
  if (isStreaming) {
    // 🔴 Stop streaming → kosongkan src
    cameraImage.src = "";
    isStreaming = false;
    cameraToggleBtn.textContent = "Start Camera";
    cameraToggleBtn.style.backgroundColor = "#28a745";
  } else {
    // 🟢 Start streaming dari Raspberry Pi
    cameraImage.src = BASE_IP + "/video_feed?ts=" + Date.now(); 
    isStreaming = true;
    cameraToggleBtn.textContent = "Stop Camera";
    cameraToggleBtn.style.backgroundColor = "#dc3545";
  }
});

// Tombol Flash
let flashState = false; // awalnya mati

const FlashBtn = document.getElementById("FlashBtn");

FlashBtn.addEventListener("click", () => {
  // toggle state
  flashState = !flashState;
  const state = flashState ? "on" : "off";

  fetch(BASE_IP + "/flash", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state: state })
  })
  .then(res => res.json())
  .then(data => {
    console.log("Flash response:", data);
    // ubah teks tombol sesuai status
    flashBtn.textContent = flashState ? "Flash OFF" : "Flash ON";
  })
  .catch(err => console.error("Error:", err));
});



// function initCameraStream() {
//     const video = document.getElementById('cameraStream');

//     if (!navigator.fDevices || !navigator.mediaDevices.getUserMedia) {
//         console.error("Camera access is not supported in this browser.");
//         return;
//     }

//     navigator.mediaDevices.getUserMedia({ video: true, audio: false })
//         .then(stream => { video.srcObject = stream; })
//         .catch(error => { console.error("Error accessing camera:", error); });
// }

// let cameraStream = null;
// const cameraVideo = document.getElementById("cameraStream");
// const cameraToggleBtn = document.getElementById("startCameraBtn");

// cameraToggleBtn.addEventListener("click", async () => {
//     if (cameraStream) {
//         cameraVideo.pause();
//         cameraVideo.srcObject = null;
//         cameraStream.getTracks().forEach(track => track.stop());
//         cameraStream = null;
//         cameraToggleBtn.textContent = "Start Camera";
//         cameraToggleBtn.style.backgroundColor = "#28a745";
//     } else {
//         try {
//             cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
//             cameraVideo.srcObject = cameraStream;
//             await cameraVideo.play();
//             cameraToggleBtn.textContent = "Stop Camera";
//             cameraToggleBtn.style.backgroundColor = "#dc3545";
//         } catch (err) {
//             alert("Please check camera permissions: " + err.message);
//         }
//     }
// });

// ======================
// 8. ENTRY POINT
// ======================
window.addEventListener('DOMContentLoaded', () => {
    initCameraStream();
});

// ======================
// 9. FUNGSI HALAMAN & SLIDER
// ======================
function showPage(page) {
    document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
    document.getElementById('page-' + page).style.display = 'block';
}



function updateValue(slider) {
    const valueDisplay = slider.parentElement.querySelector(".value");
    valueDisplay.textContent = slider.value + "%";

    if (document.getElementById("lockAll").checked) {
        document.querySelectorAll('.slider-item input[type="range"]').forEach(s => {
            if (s !== slider) {
                s.value = slider.value;
                s.parentElement.querySelector(".value").textContent = slider.value + "%";
            }
        });
    }
}



function setActiveSidebar(el) {
    document.querySelectorAll('.sidebar ul li a').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
}

// Contoh fungsi untuk update GPS count dengan efek visual
function updateGpsCount(count) {
    const gpsCountElement = document.getElementById('gpsCount');
    
    // Update nilai
    gpsCountElement.textContent = count;
    gpsCountElement.setAttribute('data-count', count);
    
    // Tambahkan efek visual berdasarkan jumlah satellite
    if (count === 0) {
        gpsCountElement.classList.add('critical');
        gpsCountElement.classList.remove('warning');
    } else if (count < 4) {
        gpsCountElement.classList.add('warning');
        gpsCountElement.classList.remove('critical');
    } else {
        gpsCountElement.classList.remove('warning', 'critical');
    }
    
    // Efek animasi untuk perubahan nilai
    gpsCountElement.style.animation = 'none';
    setTimeout(() => {
        gpsCountElement.style.animation = 'pulse 0.5s ease';
    }, 10);
}


document.addEventListener("DOMContentLoaded", function() {
    const statusEl = document.getElementById("connectionStatusLabel");
    const loader = document.getElementById("connectionLoader");

    // Simulasi koneksi otomatis
    setTimeout(() => {
        statusEl.textContent = "Connected";
        statusEl.style.color = "green";
        loader.style.display = "none"; // hide loader
    }, 2000); // misal 2 detik untuk connect
});





// Contoh penggunaan
// updateGpsCount(8); // Untuk 8 satellites (hijau)
// updateGpsCount(2); // Untuk 2 satellites (kuning)  
// updateGpsCount(0); // Untuk 0 satellites (merah, berkedip)
// updateGpsCount(gpsCountElement)

// ===========
// gyro dan konpas
// =====
async function fetchTelemetry() {
  try {
    const res = await fetch(BASE_IP + "/telemetry");
    const data = await res.json();

    // Compass
    if (typeof data.heading === "number") {
      document.getElementById("compass-rose").style.transform = `rotate(${-data.heading}deg)`;
      document.getElementById("headingValue").textContent = data.heading.toFixed(0);
    }

    // Gyro
    if (data.attitude) {
      const pitch = data.attitude.pitch ?? 0;
      const roll = data.attitude.roll ?? 0;
      document.getElementById("horizon").style.transform = `rotate(${roll}deg) translateY(${pitch}px)`;
      document.getElementById("pitchValue").textContent = pitch.toFixed(1);
      document.getElementById("rollValue").textContent = roll.toFixed(1);
    }

  } catch (err) {
    console.error("Gagal ambil telemetry:", err);
  }
}



// ============
// pesan dengan Auto-Scroll
// ============
document.addEventListener("DOMContentLoaded", () => {
    const messageContainer = document.getElementById("messageContainer");
    // const BASE_IP = "http://127.0.0.1:8000"; // ganti IP laptop jika akses dari device lain
    const autoScrollBtn = document.getElementById("toggleAutoScrollBtn");
    let autoScrollEnabled = false; // default auto-scroll aktif

    // toggle auto-scroll
    autoScrollBtn.addEventListener("click", () => {
        autoScrollEnabled = !autoScrollEnabled;
        autoScrollBtn.textContent = autoScrollEnabled ? "Disable Auto-Scroll" : "Enable Auto-Scroll";
    });

    function fetchMessages() {
        fetch(BASE_IP + "/messages")
            .then(response => response.json())
            .then(data => {
                messageContainer.innerHTML = ""; // kosongkan dulu
                data.slice(-100).forEach(msg => {  // tampilkan max 20 pesan terakhir
                    const div = document.createElement("div");
                    if (msg.text.toLowerCase().includes("connected")) {
                        div.className = "connected-message";
                    } else {
                        div.className = "message-item";
                    }
                    div.textContent = `[${msg.timestamp}] ${msg.text}`;
                    messageContainer.appendChild(div);
                });

                // Auto-scroll jika aktif
                if (autoScrollEnabled) {
                    messageContainer.scrollTop = messageContainer.scrollHeight;
                }
            })
            .catch(err => {
                console.error("Error fetching messages:", err);
            });
    }

    // ambil pesan setiap 1 detik
    setInterval(fetchMessages, 2000);
    fetchMessages(); // panggil pertama kali
});


document.addEventListener('DOMContentLoaded', () => {
    const compassRose = document.getElementById("compass-rose");

    // Hapus angka lama
    document.querySelectorAll(".compass-rose .deg").forEach(el => el.remove());

    // Radius lebih kecil supaya angka tetap di lingkaran
    const compassRadius = 60; // setengah ukuran kompas

    for (let deg = 0; deg < 360; deg += 30) {
        const span = document.createElement("span");
        span.className = "deg";
        span.textContent = deg + "°";

        const rad = deg * (Math.PI / 180);
        const x = compassRadius + (compassRadius - 10) * Math.sin(rad);
        const y = compassRadius - (compassRadius - 10) * Math.cos(rad); // Y positif ke bawah

        span.style.position = "absolute";
        span.style.left = `${x}px`;
        span.style.top = `${y}px`;
        span.style.transform = "translate(-50%, -50%)";
        span.style.fontSize = "14px";
        span.style.fontWeight = "bold";
        span.style.color = "#fff";
        span.style.textShadow = "0 0 5px #ffffffff";

        compassRose.appendChild(span);
    }
});
// ======================
// 10. TELEMETRI HALAMAN PREFLIGHT
// ======================

document.addEventListener('DOMContentLoaded', () => {
    const preflightContainer = document.getElementById("page-preflight");
    if (!preflightContainer) return;

    // const BASE_IP = "http://127.0.0.1:8000";

    const elements = {
        accelX: document.getElementById("accelX"),
        accelY: document.getElementById("accelY"),
        accelZ: document.getElementById("accelZ"),
        gyroX: document.getElementById("gyroX"),
        gyroY: document.getElementById("gyroY"),
        gyroZ: document.getElementById("gyroZ"),
        roll: document.getElementById("roll"),
        pitch: document.getElementById("pitch"),
        yaw: document.getElementById("yaw"),
    };

    async function updatePreflightTelemetry() {
        try {
            const res = await fetch(BASE_IP + "/telemetry");
            const data = await res.json();

            // Accelerometer
            if (data.accel) {
                elements.accelX.textContent = data.accel.x?.toFixed(2) ?? 0;
                elements.accelY.textContent = data.accel.y?.toFixed(2) ?? 0;
                elements.accelZ.textContent = data.accel.z?.toFixed(2) ?? 0;
            }

            // Gyroscope
            if (data.gyro) {
                elements.gyroX.textContent = data.gyro.x?.toFixed(2) ?? 0;
                elements.gyroY.textContent = data.gyro.y?.toFixed(2) ?? 0;
                elements.gyroZ.textContent = data.gyro.z?.toFixed(2) ?? 0;
            }

            // Attitude
            if (data.attitude) {
                elements.roll.textContent = data.attitude.roll?.toFixed(1) ?? 0;
                elements.pitch.textContent = data.attitude.pitch?.toFixed(1) ?? 0;
                elements.yaw.textContent = data.attitude.yaw?.toFixed(1) ?? 0;
            }

        } catch (err) {
            console.error("Gagal ambil telemetry Preflight:", err);
        }
    }
    

    // Loop telemetry tiap 200ms
    setInterval(updatePreflightTelemetry, 200);
    updatePreflightTelemetry(); // panggil pertama kali
});

// // Nyalakan LED
fetch(BASE_IP+"/led", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({state: "on"})
});

// Matikan LED
fetch(BASE_IP+"/led", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({state: "off"})
});




// ======================
// Tambahan: Reboot, LED, dan Status Koneksi
// ======================
document.addEventListener("DOMContentLoaded", () => {
    const rebootBtn = document.getElementById("rebootControllerBtn");
    const statusEl = document.getElementById("connectionStatusLabel");
    const loader = document.getElementById("connectionLoader");
    const connectingText = document.querySelector(".connection-controls span"); // teks "CONNECTING TO CONTROLLER..."
    const ledBtn = document.getElementById("ledToggleBtn");

    // --- Reboot Pixhawk ---
    if (rebootBtn) {
        rebootBtn.addEventListener("click", async () => {
            rebootBtn.disabled = true;
            rebootBtn.innerText = "Rebooting...";
            try {
                const response = await fetch(BASE_IP + "/api/reboot", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" }
                });
                if (response.ok) {
                    alert("✅ Pixhawk berhasil direboot!");
                } else {
                    alert("❌ Gagal reboot Pixhawk!");
                }
            } catch (err) {
                console.error(err);
                alert("⚠️ Error: tidak bisa terhubung ke server.");
            } finally {
                rebootBtn.disabled = false;
                rebootBtn.innerText = "Reboot Controller";
            }
        });
    }

    // --- LED Control ---
    if (ledBtn) {
        ledBtn.addEventListener("click", () => {
            const state = ledBtn.dataset.state === "on" ? "off" : "on";
            ledBtn.dataset.state = state;

            fetch(BASE_IP + "/led", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state })
            })
            .then(res => res.json())
            .then(data => console.log("LED response:", data))
            .catch(err => console.error("LED error:", err));

            ledBtn.textContent = state === "on" ? "LED ON" : "LED OFF";
        });
    }

    // --- Status Koneksi --- 
    async function checkConnection() {
        try {
            const res = await fetch(BASE_IP + "/telemetry", { method: "GET", cache: "no-store" });
            if (res.ok) {
                statusEl.textContent = "Connected";
                statusEl.style.color = "green";

                // sembunyikan loader dan teks connecting
                if (loader) loader.style.display = "none";
                if (connectingText) connectingText.style.display = "none";
            } else {
                throw new Error("Server tidak merespons");
            }
        } catch (err) {
            statusEl.textContent = "Disconnected";
            statusEl.style.color = "red";

            // tampilkan loader dan teks connecting
            if (loader) loader.style.display = "inline-block";
            if (connectingText) connectingText.style.display = "inline";
            
            console.error("Koneksi gagal:", err);
        }
    }
    

    // Cek koneksi setiap 2 detik
    setInterval(checkConnection, 2000);
    checkConnection(); // panggil pertama kali
});

// =========
// upload firmware
// =======
document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("firmwareFile");
    const portSelect = document.getElementById("firmwarePort");
    const uploadBtn = document.getElementById("uploadFirmwareBtn");
    const statusEl = document.getElementById("uploadStatus");

    // --- Pilih port USB Pixhawk ---
    async function refreshPorts() {
        portSelect.innerHTML = `<option value="">-- Pilih port --</option>`;
        try {
            const ports = await navigator.serial.getPorts();
            ports.forEach((port, i) => {
                portSelect.innerHTML += `<option value="${i}">Port ${i+1}</option>`;
            });
        } catch (err) {
            console.error("Tidak bisa ambil port serial:", err);
        }
    }

    // Tombol untuk request port baru
    const usbBtn = document.createElement("button");
    usbBtn.textContent = "Deteksi Port USB";
    usbBtn.onclick = async () => {
        try {
            const port = await navigator.serial.requestPort();
            await refreshPorts();
            statusEl.textContent = "Port dipilih: " + port;
        } catch (err) {
            console.error("User tidak memilih port:", err);
        }
    };
    fileInput.parentNode.insertBefore(usbBtn, fileInput);

    refreshPorts(); // refresh saat load

    // --- Upload firmware ---
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        const portIndex = portSelect.value;
        if (!file || portIndex === "") {
            alert("Pilih file firmware dan port USB terlebih dahulu!");
            return;
        }

        const formData = new FormData();
        formData.append("firmware", file);
        formData.append("port", portIndex);

        statusEl.textContent = "Status: Uploading...";
        try {
            const res = await fetch(BASE_IP + "/api/upload_firmware", {
                method: "POST",
                body: formData
            });
            const result = await res.json();
            statusEl.textContent = "Status: " + result.message;
        } catch (err) {
            console.error(err);
            statusEl.textContent = "Status: Error saat upload!";
        }
    });
});




// ===========
// USBB
// =========
document.addEventListener("DOMContentLoaded", () => {
    const usbSelect = document.getElementById("usbPort");

    // Ambil daftar port USB dari server
    async function loadUsbPorts() {
        try {
            const res = await fetch(BASE_IP + "/api/usb-ports");
            const ports = await res.json();
            
            // Kosongkan dulu list
            usbSelect.innerHTML = '<option value="">-- Pilih Port --</option>';

            // Isi port
            ports.forEach(port => {
                const option = document.createElement("option");
                option.value = port;
                option.textContent = port;
                usbSelect.appendChild(option);
            });
        } catch (err) {
            console.error("Gagal memuat port USB:", err);
        }
    }

    loadUsbPorts();
});



// config

document.addEventListener("DOMContentLoaded", () => {
    const paramTableBody = document.getElementById("paramTableBody");
    const configStatus = document.getElementById("configStatus");

    async function fetchParameters() {
        configStatus.textContent = "Status: Loading parameters...";
        try {
            const res = await fetch("/api/parameters");
            const params = await res.json();
            paramTableBody.innerHTML = "";
            for (let key in params) {
                const tr = document.createElement("tr");
                tr.innerHTML = `
                    <td>${key}</td>
                    <td><input type="text" value="${params[key]}" data-param="${key}"></td>
                    <td><button class="updateParamBtn" data-param="${key}">Update</button></td>
                `;
                paramTableBody.appendChild(tr);
            }
            configStatus.textContent = "Status: Parameters loaded";
        } catch (err) {
            console.error(err);
            configStatus.textContent = "Status: Failed to load parameters";
        }
    }

    paramTableBody.addEventListener("click", async (e) => {
        if (!e.target.classList.contains("updateParamBtn")) return;
        const key = e.target.dataset.param;
        const value = e.target.closest("tr").querySelector("input").value;

        configStatus.textContent = `Status: Updating ${key}...`;
        try {
            const res = await fetch("/api/set_parameter", {
                method: "POST",
                headers: {"Content-Type":"application/json"},
                body: JSON.stringify({param:key,value:value})
            });
            const result = await res.json();
            configStatus.textContent = result.status === "ok" 
                ? `Status: ${key} updated!` 
                : `Status: Failed to update ${key}`;
        } catch(err) {
            console.error(err);
            configStatus.textContent = `Status: Error updating ${key}`;
        }
    });

    document.getElementById("refreshParamsBtn").addEventListener("click", fetchParameters);
    document.getElementById("saveParamsBtn").addEventListener("click", () => {
    });
    document.getElementById("resetParamsBtn").addEventListener("click", () => {
        configStatus.textContent = "Status: Reset parameters to default... (implement API)";
    });

    fetchParameters();
});



// +=============
// Lgoer
// =============
document.getElementById("downloadLogBtn").addEventListener("click", () => {
  const status = document.getElementById("logStatus");
  status.innerText = "Status: Mengunduh...";

  // Contoh: ambil file log dari server Flask/Python
  fetch("/download-log")
    .then(response => {
      if (!response.ok) throw new Error("Gagal mengunduh log");
      return response.blob();
    })
    .then(blob => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "flight_log.bin"; // nama file log
      document.body.appendChild(a);
      a.click();
      a.remove();
      status.innerText = "Status: Download selesai";
    })
    .catch(err => {
      status.innerText = "Status: " + err.message;
    });
});




// Jalankan GCS
new GroundControlStation();