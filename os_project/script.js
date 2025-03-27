const socket = io('http://127.0.0.1:5000');

const themeToggleBtn = document.getElementById('theme-toggle');
const themeToggleDarkIcon = document.getElementById('theme-toggle-dark-icon');
const themeToggleLightIcon = document.getElementById('theme-toggle-light-icon');

function setTheme(isDark) {
    if (isDark) {
        document.documentElement.classList.add('dark');
        themeToggleDarkIcon.classList.add('hidden');
        themeToggleLightIcon.classList.remove('hidden');
        localStorage.setItem('color-theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        themeToggleDarkIcon.classList.remove('hidden');
        themeToggleLightIcon.classList.add('hidden');
        localStorage.setItem('color-theme', 'light');
    }
}

themeToggleBtn.addEventListener('click', () => {
    const isDark = !document.documentElement.classList.contains('dark');
    setTheme(isDark);
    updateChartColors();
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('color-theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const isDark = savedTheme === 'dark' || 
                   (savedTheme === null && systemPrefersDark);
    
    setTheme(isDark);
});

let cpuChart, memoryChart;

function getChartColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        cpu: isDark ? 'rgb(103, 232, 249)' : 'rgb(75, 192, 192)',
        memory: isDark ? 'rgb(147, 197, 253)' : 'rgb(54, 162, 235)',
        gridLines: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        text: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'
    };
}

function initCharts() {
    const colors = getChartColors();
    const chartConfig = {
        type: 'line',
        options: {
            responsive: true,
            animation: { duration: 0 },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        color: colors.text,
                        callback: function(value) {
                            return value + '%';
                        }
                    },
                    grid: {
                        color: colors.gridLines
                    }
                },
                x: {
                    ticks: {
                        color: colors.text
                    },
                    grid: {
                        color: colors.gridLines
                    }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    };

    cpuChart = new Chart(document.getElementById('cpuChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: colors.cpu,
                tension: 0.1
            }]
        }
    });

    memoryChart = new Chart(document.getElementById('memoryChart'), {
        ...chartConfig,
        data: {
            labels: [],
            datasets: [{
                data: [],
                borderColor: colors.memory,
                tension: 0.1
            }]
        }
    });
}

function updateChartColors() {
    if (!cpuChart || !memoryChart) return;

    const colors = getChartColors();

    cpuChart.data.datasets[0].borderColor = colors.cpu;
    cpuChart.options.scales.y.ticks.color = colors.text;
    cpuChart.options.scales.y.grid.color = colors.gridLines;
    cpuChart.options.scales.x.ticks.color = colors.text;
    cpuChart.options.scales.x.grid.color = colors.gridLines;
    cpuChart.update('none');

    memoryChart.data.datasets[0].borderColor = colors.memory;
    memoryChart.options.scales.y.ticks.color = colors.text;
    memoryChart.options.scales.y.grid.color = colors.gridLines;
    memoryChart.options.scales.x.ticks.color = colors.text;
    memoryChart.options.scales.x.grid.color = colors.gridLines;
    memoryChart.update('none');
}

function updateCharts(cpuUsage, memoryUsage) {
    const maxDataPoints = 30;

    if (cpuChart.data.labels.length >= maxDataPoints) {
        cpuChart.data.labels.shift();
        cpuChart.data.datasets[0].data.shift();
    }
    cpuChart.data.labels.push(new Date().toLocaleTimeString());
    cpuChart.data.datasets[0].data.push(cpuUsage);
    cpuChart.update('none');

    if (memoryChart.data.labels.length >= maxDataPoints) {
        memoryChart.data.labels.shift();
        memoryChart.data.datasets[0].data.shift();
    }
    memoryChart.data.labels.push(new Date().toLocaleTimeString());
    memoryChart.data.datasets[0].data.push(memoryUsage);
    memoryChart.update('none');
}

socket.on("connect", () => {
    initCharts();
});

socket.on("system_stats", (data) => {
    updateCharts(data.cpu, data.memory);

    const tableBody = document.getElementById("processTable");
    tableBody.innerHTML = ""; 

    data.processes.forEach(proc => {
        let row = document.createElement("tr");
        row.className = "hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors";
        row.innerHTML = `
            <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${proc.pid}</td>
            <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${proc.name}</td>
            <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${proc.cpu_percent.toFixed(2)}%</td>
            <td class="px-4 py-2 text-gray-800 dark:text-gray-200">${proc.memory_percent.toFixed(2)}%</td>
            <td class="px-4 py-2">
                <button 
                    onclick="killProcess(${proc.pid})" 
                    class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500 transition-colors"
                >
                    Kill
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
});

function killProcess(pid) {
    fetch(`http://127.0.0.1:5000/kill/${pid}`, { method: "POST" })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert("Error: " + data.error);
            } else {
                alert(data.message);
            }
        })
        .catch(error => console.error("Error killing process:", error));
}