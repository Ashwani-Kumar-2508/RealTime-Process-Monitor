const dashboardState = {
    cpuChart: null,
    memChart: null,
    searchQuery: "",
    isHistoryLoaded: false,
};

function formatPercent(value) {
    return `${value.toFixed(1)}%`;
}

function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
        size /= 1024;
        unit += 1;
    }
    return `${size.toFixed(1)} ${units[unit]}`;
}

function initCharts() {
    const cpuEl = document.getElementById("cpuChart");
    const memEl = document.getElementById("memoryChart");
    if (!cpuEl || !memEl || typeof Chart === "undefined") return;

    const baseOptions = {
        type: "line",
        options: {
            responsive: true,
            animation: false,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100 },
            },
            plugins: { legend: { display: false } },
        },
    };

    dashboardState.cpuChart = new Chart(cpuEl, {
        ...baseOptions,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: "#3ee1b1",
                backgroundColor: "rgba(62, 225, 177, 0.2)",
                fill: true,
                tension: 0.3,
            }],
        },
    });

    dashboardState.memChart = new Chart(memEl, {
        ...baseOptions,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: "#5aa9ff",
                backgroundColor: "rgba(90, 169, 255, 0.2)",
                fill: true,
                tension: 0.3,
            }],
        },
    });
}

function pushChartPoint(chart, value) {
    if (!chart) return;
    const maxPoints = 30;
    const label = new Date().toLocaleTimeString();
    if (chart.data.labels.length >= maxPoints) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
    }
    chart.data.labels.push(label);
    chart.data.datasets[0].data.push(value);
    chart.update("none");
}

function updateMetrics(stats) {
    const cpu = document.getElementById("cpuValue");
    const mem = document.getElementById("memoryValue");
    const disk = document.getElementById("diskValue");
    const net = document.getElementById("networkValue");
    const updated = document.getElementById("lastUpdated");
    const telemetryUpdated = document.getElementById("telemetryUpdated");

    if (cpu) cpu.textContent = formatPercent(stats.cpu);
    if (mem) mem.textContent = formatPercent(stats.memory);
    if (disk) disk.textContent = formatPercent(stats.disk_percent);
    if (net) net.textContent = `${formatBytes(stats.net_sent)} sent / ${formatBytes(stats.net_recv)} recv`;
    if (updated) updated.textContent = new Date().toLocaleTimeString();
    if (telemetryUpdated && stats.updated_at) {
        const ts = new Date(stats.updated_at);
        telemetryUpdated.textContent = Number.isNaN(ts.getTime()) ? stats.updated_at : ts.toLocaleTimeString();
    }

    // Update System Details if on that page
    if (document.body.dataset.page === "details" && stats.system) {
        const sys = stats.system;
        document.querySelectorAll("[data-sys-cpu-cores]").forEach(el => el.textContent = sys.cpu_count);
        document.querySelectorAll("[data-sys-cpu-freq]").forEach(el => el.textContent = `${(sys.cpu_freq / 1000).toFixed(2)} GHz`);
        document.querySelectorAll("[data-sys-mem-total]").forEach(el => el.textContent = formatBytes(sys.mem_total));
        document.querySelectorAll("[data-sys-disk-total]").forEach(el => el.textContent = formatBytes(sys.disk_total));
        document.querySelectorAll("[data-sys-disk-free]").forEach(el => el.textContent = formatBytes(sys.disk_free));
        document.querySelectorAll("[data-sys-os]").forEach(el => el.textContent = sys.os_name);
    }
}

function updateIncidents(incidents) {
    const list = document.getElementById("incidents-list");
    if (!list) return;

    if (!incidents || incidents.length === 0) {
        list.innerHTML = `<div class="status"><span class="status__value">No active incidents.</span></div>`;
        return;
    }

    list.innerHTML = "";
    incidents.slice().reverse().forEach(inc => {
        const color = inc.level === "CRITICAL" ? "var(--danger)" : (inc.level === "WARNING" ? "var(--warning)" : "var(--accent)");
        const item = document.createElement("div");
        item.className = "status";
        item.style.flexDirection = "column";
        item.style.alignItems = "flex-start";
        item.style.gap = "4px";
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
                <span class="status__title">${inc.level}</span>
                <span style="font-size: 0.7rem; color: var(--muted);">${new Date(inc.timestamp).toLocaleTimeString()}</span>
            </div>
            <span class="status__value" style="font-size: 0.95rem; opacity: 0.9;">${inc.message}</span>
        `;
        list.appendChild(item);
    });
}

function updateProcessTable(processes) {
    const table = document.getElementById("processTable");
    if (!table) return;

    let filtered = processes;
    if (dashboardState.searchQuery) {
        const query = dashboardState.searchQuery.toLowerCase();
        filtered = processes.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.pid.toString().includes(query)
        );
    }

    table.innerHTML = "";
    if (!filtered || filtered.length === 0) {
        table.innerHTML = `<tr><td colspan="5">${dashboardState.searchQuery ? "No matching processes." : "No process data available."}</td></tr>`;
        return;
    }
    filtered.forEach((proc) => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${proc.pid}</td>
            <td>${proc.name}</td>
            <td>${proc.cpu_percent.toFixed(1)}%</td>
            <td>${proc.memory_percent.toFixed(1)}%</td>
            <td><button class="button button--ghost" data-kill="${proc.pid}" style="padding: 4px 12px; font-size: 0.85rem;">Terminate</button></td>
        `;
        table.appendChild(row);
    });

    table.querySelectorAll("[data-kill]").forEach((btn) => {
        btn.addEventListener("click", () => killProcess(btn.dataset.kill));
    });
}

function killProcess(pid) {
    const confirmKill = confirm(`Terminate process ${pid}?`);
    if (!confirmKill) return;

    fetch(`/kill/${pid}`, { method: "POST" })
        .then((res) => {
            if (!res.ok) throw new Error("Failed to terminate process");
            return res.json();
        })
        .then((data) => alert(data.message || "Process terminated."))
        .catch(() => alert("Unable to terminate process."));
}

function initSearch() {
    const searchInput = document.getElementById("processSearch");
    if (!searchInput) return;
    searchInput.addEventListener("input", (e) => {
        dashboardState.searchQuery = e.target.value;
    });
}

function connectWebSocket() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${protocol}://${location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.addEventListener("open", () => {
        console.log("WebSocket connected");
        const badge = document.querySelector(".badge");
        if (badge) {
            badge.textContent = "Live connection active";
            badge.style.color = "var(--accent)";
        }
    });

    socket.addEventListener("message", (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            console.warn("Invalid telemetry payload", error);
            return;
        }

        // Initialize history once
        if (!dashboardState.isHistoryLoaded && data.history && data.history.length > 0) {
            if (dashboardState.cpuChart && dashboardState.memChart) {
                const maxHistory = 30; // Match chart max points
                const history = data.history.slice(-maxHistory);

                dashboardState.cpuChart.data.labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());
                dashboardState.cpuChart.data.datasets[0].data = history.map(h => h.cpu);

                dashboardState.memChart.data.labels = history.map(h => new Date(h.timestamp).toLocaleTimeString());
                dashboardState.memChart.data.datasets[0].data = history.map(h => h.memory);

                dashboardState.cpuChart.update("none");
                dashboardState.memChart.update("none");
                dashboardState.isHistoryLoaded = true;
            }
        }

        updateMetrics(data);
        if (dashboardState.isHistoryLoaded) {
            pushChartPoint(dashboardState.cpuChart, data.cpu);
            pushChartPoint(dashboardState.memChart, data.memory);
        }
        updateProcessTable(data.processes);
        updateIncidents(data.incidents);
    });

    socket.addEventListener("close", () => {
        console.warn("WebSocket disconnected. Reconnecting...");
        dashboardState.isHistoryLoaded = false;
        const badge = document.querySelector(".badge");
        if (badge) {
            badge.textContent = "Disconnected - Reconnecting...";
            badge.style.color = "var(--danger)";
        }
        setTimeout(connectWebSocket, 2000);
    });
}

initCharts();
initSearch();
connectWebSocket();
