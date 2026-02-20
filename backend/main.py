from fastapi import FastAPI, WebSocket, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime, timezone
from pydantic import BaseModel
import asyncio
import os
import psutil
import logging

# Initialize FastAPI app
app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"

# Serve static files (frontend assets)
app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

telemetry_cache = {
    "cpu": 0.0,
    "memory": 0.0,
    "disk_percent": 0.0,
    "net_sent": 0,
    "net_recv": 0,
    "processes": [],
    "system": {
        "cpu_count": psutil.cpu_count(logical=True),
        "cpu_freq": psutil.cpu_freq().current if psutil.cpu_freq() else 0.0,
        "mem_total": psutil.virtual_memory().total,
        "disk_total": 0,
        "disk_free": 0,
        "boot_time": datetime.fromtimestamp(psutil.boot_time(), timezone.utc).isoformat(),
        "os_name": os.name,
    },
    "updated_at": None,
}

# History buffer for charts (last 60 seconds)
telemetry_history = []
MAX_HISTORY = 60

# Incident log
incidents = [
    {"timestamp": datetime.now(timezone.utc).isoformat(), "level": "INFO", "message": "OpsPulse Monitoring Started"}
]


class ContactMessage(BaseModel):
    name: str
    email: str
    message: str


def read_page(filename: str) -> HTMLResponse:
    page_path = BASE_DIR / filename
    if not page_path.exists():
        raise HTTPException(status_code=404, detail="Page not found")
    return HTMLResponse(content=page_path.read_text(encoding="utf-8"), status_code=200)


async def telemetry_loop():
    global telemetry_history
    while True:
        try:
            cpu = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            net = psutil.net_io_counters()

            # Process list
            processes = []
            for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
                try:
                    pinfo = proc.info
                    processes.append({
                        "pid": pinfo["pid"],
                        "name": pinfo["name"] or "unknown",
                        "cpu_percent": pinfo["cpu_percent"] or 0.0,
                        "memory_percent": pinfo["memory_percent"] or 0.0,
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            # Update cache
            updated_ts = datetime.now(timezone.utc).isoformat()
            telemetry_cache.update({
                "cpu": cpu,
                "memory": mem.percent,
                "disk_percent": disk.percent,
                "net_sent": net.bytes_sent,
                "net_recv": net.bytes_recv,
                "processes": sorted(processes, key=lambda item: item["cpu_percent"], reverse=True)[:20],
                "system": {
                    **telemetry_cache["system"],
                    "disk_total": disk.total,
                    "disk_free": disk.free,
                },
                "updated_at": updated_ts,
            })

            # Update history
            telemetry_history.append({
                "cpu": cpu,
                "memory": mem.percent,
                "disk": disk.percent,
                "timestamp": updated_ts
            })
            if len(telemetry_history) > MAX_HISTORY:
                telemetry_history.pop(0)

            # Detect incidents (with de-duplication)
            if not hasattr(telemetry_loop, "active_alerts"):
                telemetry_loop.active_alerts = set()

            # CPU Alert
            if cpu > 80:
                if "cpu_high" not in telemetry_loop.active_alerts:
                    incidents.append({"timestamp": updated_ts, "level": "WARNING", "message": f"High CPU Usage Detected: {cpu}%"})
                    telemetry_loop.active_alerts.add("cpu_high")
            elif cpu < 70 and "cpu_high" in telemetry_loop.active_alerts:
                incidents.append({"timestamp": updated_ts, "level": "INFO", "message": f"CPU Usage Normalized: {cpu}%"})
                telemetry_loop.active_alerts.remove("cpu_high")

            # Memory Alert
            if mem.percent > 90:
                if "mem_high" not in telemetry_loop.active_alerts:
                    incidents.append({"timestamp": updated_ts, "level": "CRITICAL", "message": f"Critical Memory Pressure: {mem.percent}%"})
                    telemetry_loop.active_alerts.add("mem_high")
            elif mem.percent < 80 and "mem_high" in telemetry_loop.active_alerts:
                incidents.append({"timestamp": updated_ts, "level": "INFO", "message": f"Memory Pressure Resolved: {mem.percent}%"})
                telemetry_loop.active_alerts.remove("mem_high")

            # Disk Alert
            if disk.percent > 90:
                if "disk_high" not in telemetry_loop.active_alerts:
                    incidents.append({"timestamp": updated_ts, "level": "WARNING", "message": f"Low Disk Space: {disk.percent}% used"})
                    telemetry_loop.active_alerts.add("disk_high")
            elif disk.percent < 85 and "disk_high" in telemetry_loop.active_alerts:
                incidents.append({"timestamp": updated_ts, "level": "INFO", "message": f"Disk Space Stabilized: {disk.percent}% used"})
                telemetry_loop.active_alerts.remove("disk_high")
            
            # Keep only last 15 incidents to allow for history
            if len(incidents) > 15:
                # Keep the first "Monitoring Started" message, remove the second one
                incidents.pop(1)

        except Exception as e:
            logging.error(f"Error in telemetry loop: {e}")
        await asyncio.sleep(1)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_loop())


# Routes
@app.get("/", response_class=HTMLResponse)
async def home():
    return read_page("index.html")


@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return read_page("dashboard.html")


@app.get("/details", response_class=HTMLResponse)
async def details():
    return read_page("details.html")


@app.get("/processes", response_class=HTMLResponse)
async def processes():
    return read_page("processes.html")


@app.get("/alerts", response_class=HTMLResponse)
async def alerts():
    return read_page("alerts.html")


@app.get("/settings", response_class=HTMLResponse)
async def settings():
    return read_page("settings.html")


@app.get("/about", response_class=HTMLResponse)
async def about():
    return read_page("about.html")


@app.get("/contact", response_class=HTMLResponse)
async def contact():
    return read_page("contact.html")


@app.post("/contact")
async def submit_contact(payload: ContactMessage):
    logger.info("Contact form submitted: %s, %s, %s", payload.name, payload.email, payload.message)
    return {"message": "Thank you for reaching out! We will get back to you soon."}


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "updated_at": telemetry_cache.get("updated_at"),
    }


# WebSocket for real-time updates
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await websocket.send_json({
                "cpu": telemetry_cache["cpu"],
                "memory": telemetry_cache["memory"],
                "disk_percent": telemetry_cache["disk_percent"],
                "net_sent": telemetry_cache["net_sent"],
                "net_recv": telemetry_cache["net_recv"],
                "processes": telemetry_cache["processes"],
                "system": telemetry_cache["system"],
                "history": telemetry_history,
                "incidents": incidents,
                "updated_at": telemetry_cache.get("updated_at"),
            })

            await asyncio.sleep(1)
    except Exception as exc:
        logger.error("WebSocket error: %s", exc)
    finally:
        await websocket.close()


# Kill process endpoint
@app.post("/kill/{pid}")
async def kill_process(pid: int):
    try:
        process = psutil.Process(pid)
        process.terminate()
        try:
            process.wait(timeout=2)
            return {"message": f"Process {pid} terminated successfully."}
        except psutil.TimeoutExpired:
            process.kill()
            return {"message": f"Process {pid} force-killed successfully."}
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process not found.")
    except Exception as exc:
        logger.error("Error killing process %s: %s", pid, exc)
        raise HTTPException(status_code=500, detail="Failed to terminate process.")
