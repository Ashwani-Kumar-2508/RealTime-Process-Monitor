from flask import Flask, jsonify
from flask_socketio import SocketIO
import psutil
import os
import threading
from flask_cors import CORS
import eventlet
eventlet.monkey_patch()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

def get_system_stats():
    processes = []
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            process_info = proc.info
            process_info["cpu_percent"] = proc.cpu_percent(interval=None)
            process_info["memory_percent"] = proc.memory_percent()
            processes.append(process_info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    return {
        "cpu": psutil.cpu_percent(interval=0),
        "memory": psutil.virtual_memory().percent,
        "processes": processes
    }

def send_system_stats():
    while True:
        stats = get_system_stats()
        socketio.emit("system_stats", stats)
        eventlet.sleep(0.1)

@app.route('/kill/<int:pid>', methods=['POST'])
def kill_process(pid):
    try:
        os.kill(pid, 9)
        return jsonify({"message": f"Process {pid} killed successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    threading.Thread(target=send_system_stats, daemon=True).start()
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)

from flask import Flask, jsonify
from flask_socketio import SocketIO
import psutil
import os
import threading
from flask_cors import CORS
import eventlet
eventlet.monkey_patch()

app = Flask(__name__)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

def get_system_stats():
    processes = []
    for proc in psutil.process_iter(['pid', 'name']):
        try:
            process_info = proc.info
            process_info["cpu_percent"] = proc.cpu_percent(interval=None)
            process_info["memory_percent"] = proc.memory_percent()
            processes.append(process_info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    return {
        "cpu": psutil.cpu_percent(interval=0),
        "memory": psutil.virtual_memory().percent,
        "processes": processes
    }

def send_system_stats():
    while True:
        stats = get_system_stats()
        socketio.emit("system_stats", stats)
        eventlet.sleep(0.1)

@app.route('/kill/<int:pid>', methods=['POST'])
def kill_process(pid):
    try:
        os.kill(pid, 9)
        return jsonify({"message": f"Process {pid} killed successfully!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    threading.Thread(target=send_system_stats, daemon=True).start()
    socketio.run(app, debug=True, host="0.0.0.0", port=5000)
