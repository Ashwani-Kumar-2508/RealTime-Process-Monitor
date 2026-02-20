import os

class Config:
    APP_NAME = "Real-Time Process Monitoring Dashboard"
    VERSION = "1.0.0"
    DESCRIPTION = "A professional real-time process monitoring dashboard with WebSocket support."
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", 5000))
    DEBUG = os.getenv("DEBUG", "true").lower() == "true"