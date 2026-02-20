# OpsPulse: Real-Time Process Monitor

OpsPulse is a real-time monitoring dashboard for OS labs and operational demos. It streams CPU, memory, disk, network, and process telemetry over WebSockets using FastAPI.

## Features
- Live CPU and memory charts
- Disk and network telemetry
- Process list with terminate action
- Multi-page UI: Home, Dashboard, Processes, System Details, Alerts, Settings, About, Contact
- Light/dark theme with responsive navigation

## Quick Start
1. Install dependencies:
   ```powershell
   python -m pip install -r backend\requirements.txt
   ```
2. Run the backend:
   ```powershell
   cd backend
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
3. Open in browser:
   - `http://127.0.0.1:8000/`

## Structure
- `backend/`: FastAPI server and WebSocket telemetry
- `assets/`: Shared CSS/JS
- `*.html`: Frontend pages

## Notes
- Process termination requires local permissions.
- Alerts/Settings pages are UI-only in this version.
