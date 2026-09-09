/**
 * MINISTRY OF RAILWAYS - CONTROL OFFICE APPLICATION (COA)
 * AI-POWERED AUTOMATIC RAILWAY BLOCK PLANNING COPILOT
 * Client Application Logic with 3-Way Mode Switching (Tricolor White, Dark, High-Contrast)
 */

// Global State
let currentSystemData = null;
let lastOptimizationResult = null;
let activeTab = 'tab-marey';
let userApiKey = localStorage.getItem('IR_GEMINI_API_KEY') || '';

// Initialize Theme: default to tricolor-light on white
let storedTheme = localStorage.getItem('IR_GOV_THEME') || 'tricolor-light';
if (storedTheme === 'gov-light') storedTheme = 'tricolor-light';
let currentTheme = storedTheme;
let currentFontSize = 14;

// Priority Color Palette (Tri-color Contrast & Operational Clarity)
const TRAIN_COLORS = {
  1: { line: '#0284c7', name: 'Vande Bharat / Rajdhani', fill: 'rgba(2, 132, 199, 0.2)' },
  2: { line: '#046a38', name: 'Mail / Express', fill: 'rgba(4, 106, 56, 0.2)' },
  3: { line: '#ff671f', name: 'Passenger MEMU', fill: 'rgba(255, 103, 31, 0.2)' },
  4: { line: '#7c3aed', name: 'Goods / Freight', fill: 'rgba(124, 58, 237, 0.2)' }
};

const SPECIFIC_COLORS = {
  '22436': '#0284c7', // Vande Bharat (High-Speed Electric Cyan)
  '12424': '#dc2626', // Rajdhani (Royal Crimson)
  '12555': '#046a38', // Gorakhdham (India Green)
  '12174': '#0891b2', // Pratapgarh LTT (Cyan-Blue)
  '20104': '#002147', // Gorakhpur LTT (Navy Blue)
  '12591': '#0d9488', // Gorakhpur Yesvantpur (Teal)
  '04153': '#ff671f', // MEMU Passenger (India Saffron)
  'BOXN-7041': '#7c3aed', // Coal Goods (Purple)
  'BCN-9120': '#db2777'  // Container Goods (Deep Pink)
};

// High Contrast Accessible Colors (WCAG AAA - Vibrant Multi-Color Palette)
const CONTRAST_COLORS = {
  '22436': '#00E5FF', // Vande Bharat (Electric Cyber Cyan)
  '12424': '#FFE600', // Rajdhani Express (Vivid Gold Yellow)
  '12555': '#00FF66', // Gorakhdham Superfast (Signal Neon Green)
  '12174': '#00FFFF', // Pratapgarh LTT (High Cyan)
  '20104': '#FFFFFF', // Gorakhpur LTT (Pure White)
  '12591': '#38BDF8', // Gorakhpur Yesvantpur (Sky Blue)
  '04153': '#FFAA00', // MEMU Passenger (Vivid Amber)
  'BOXN-7041': '#FF44EC', // Coal Goods (Hot Magenta)
  'BCN-9120': '#FF3344'  // Container Goods (Signal Red)
};

// DOM Elements Initialization
document.addEventListener('DOMContentLoaded', () => {
  // Apply initial theme
  applyTheme(currentTheme);

  // Initialize Lucide icons
  refreshIcons();

  // Start live clock
  startLiveClock();

  // Setup Event Listeners
  setupEventListeners();

  // Setup Drag & Drop File Upload
  setupDragAndDrop();

  // Initial Data Fetch & Solver Render
  fetchInitialStatus();
});

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function applyTheme(theme) {
  currentTheme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('IR_GOV_THEME', theme);

  // Update active state on 3-way mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === theme);
  });

  // If Marey chart exists, re-render it with adapted colors
  if (lastOptimizationResult && activeTab === 'tab-marey') {
    renderMareyChart(lastOptimizationResult);
  }
}

function startLiveClock() {
  const clockEl = document.getElementById('current-clock');
  function update() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');
    if (clockEl) clockEl.textContent = `${hrs}:${mins}:${secs} IST`;
  }
  update();
  setInterval(update, 1000);
}

function setupEventListeners() {
  // 3-Way Mode Selector: Light (Tricolor White), Dark, Contrast
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-mode');
      applyTheme(mode);
    });
  });

  // Font Resizer Controls
  document.getElementById('btn-font-dec')?.addEventListener('click', () => {
    if (currentFontSize > 12) {
      currentFontSize -= 1;
      document.documentElement.style.setProperty('--base-font-size', currentFontSize + 'px');
    }
  });
  document.getElementById('btn-font-reset')?.addEventListener('click', () => {
    currentFontSize = 14;
    document.documentElement.style.setProperty('--base-font-size', '14px');
  });
  document.getElementById('btn-font-inc')?.addEventListener('click', () => {
    if (currentFontSize < 18) {
      currentFontSize += 1;
      document.documentElement.style.setProperty('--base-font-size', currentFontSize + 'px');
    }
  });

  // Tab Navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      switchTab(tabId);
    });
  });

  // Quick Solve Button
  document.getElementById('btn-quick-solve')?.addEventListener('click', () => {
    triggerOptimization();
  });

  // Reset Data Button
  document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
    if (confirm('Reset corridor dataset to North Central Railway default schedule?')) {
      showLoader();
      try {
        const res = await fetch('/api/data/reset', { method: 'POST' });
        if (res.ok) {
          await fetchInitialStatus();
          appendChatMessage('Corridor timetable and network successfully reset to default NCR settings.', 'assistant');
        }
      } catch (err) {
        console.error('Reset error:', err);
      } finally {
        hideLoader();
      }
    }
  });

  // Scenario Cards
  document.querySelectorAll('.scenario-card').forEach(card => {
    card.addEventListener('click', async () => {
      document.querySelectorAll('.scenario-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const scenarioId = card.getAttribute('data-scenario');
      showLoader();
      try {
        const res = await fetch(`/api/data/scenario/${scenarioId}`, { method: 'POST' });
        if (res.ok) {
          const result = await res.json();
          lastOptimizationResult = result;
          renderDashboard(result);
          appendChatMessage(`Switched to preset scenario: **${card.querySelector('.scenario-name').textContent}**. Schedule re-optimized with OR-Tools CP-SAT.`, 'assistant');
        }
      } catch (err) {
        console.error('Scenario switch error:', err);
      } finally {
        hideLoader();
      }
    });
  });

  // Manual Block Parameters Form
  document.getElementById('btn-apply-manual-block')?.addEventListener('click', () => {
    const dept = document.getElementById('input-department').value;
    const seg = document.getElementById('input-segment').value;
    const start = document.getElementById('input-start-time').value;
    const dur = parseInt(document.getElementById('input-duration').value, 10);
    const prio = document.getElementById('input-priority').value;

    const blockReq = {
      Request_ID: `REQ-MANUAL-${Math.floor(Math.random() * 900 + 100)}`,
      Department: dept,
      Segment_ID: seg,
      Required_Duration_Mins: dur,
      Preferred_Window_Start: start,
      Priority: prio
    };

    triggerOptimization(blockReq);
  });

  // Chart Toggles
  document.getElementById('toggle-baseline')?.addEventListener('change', () => {
    if (lastOptimizationResult) renderMareyChart(lastOptimizationResult);
  });
  document.getElementById('toggle-siding-markers')?.addEventListener('change', () => {
    if (lastOptimizationResult) renderMareyChart(lastOptimizationResult);
  });

  // Copilot Form
  document.getElementById('copilot-form')?.addEventListener('submit', handleChatSubmit);

  // Suggestion Chips
  document.querySelectorAll('.suggestion-chips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      const chatInput = document.getElementById('chat-input');
      if (chatInput) {
        chatInput.value = prompt;
        chatInput.focus();
      }
    });
  });

  // Gemini API Key Drawer Toggle
  document.getElementById('btn-toggle-key')?.addEventListener('click', () => {
    document.getElementById('api-key-drawer')?.classList.toggle('d-none');
  });

  // Save API Key Button
  document.getElementById('btn-save-key')?.addEventListener('click', () => {
    const key = document.getElementById('input-api-key')?.value.trim();
    if (key) {
      userApiKey = key;
      localStorage.setItem('IR_GEMINI_API_KEY', key);
      alert('Gemini API key saved locally in browser.');
      document.getElementById('api-key-drawer')?.classList.add('d-none');
    }
  });

  // Notice Actions: Copy & Print
  document.getElementById('btn-copy-notice')?.addEventListener('click', () => {
    const content = document.getElementById('notice-text-content')?.textContent;
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        alert('T/409 Caution Order copied to clipboard.');
      });
    }
  });

  document.getElementById('btn-print-notice')?.addEventListener('click', () => {
    window.open('/api/notice/html', '_blank');
  });
}

function switchTab(tabId) {
  activeTab = tabId;

  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Update tab content panels
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === tabId);
  });

  // Toggle chart controls visibility
  const mareyControls = document.getElementById('marey-controls');
  if (mareyControls) {
    mareyControls.style.display = (tabId === 'tab-marey') ? 'flex' : 'none';
  }

  // Re-render components if needed
  if (lastOptimizationResult) {
    if (tabId === 'tab-marey') {
      setTimeout(() => renderMareyChart(lastOptimizationResult), 50);
    } else if (tabId === 'tab-topology') {
      renderTopologyView(lastOptimizationResult);
    } else if (tabId === 'tab-timetable') {
      renderTimetableTable(lastOptimizationResult.trains);
    } else if (tabId === 'tab-notice') {
      renderDispatchNotice(lastOptimizationResult);
    }
  }

  refreshIcons();
}

async function fetchInitialStatus() {
  showLoader();
  try {
    const res = await fetch('/api/data/status');
    if (res.ok) {
      currentSystemData = await res.json();
      if (currentSystemData.last_result) {
        lastOptimizationResult = currentSystemData.last_result;
        renderDashboard(lastOptimizationResult);
      } else {
        await triggerOptimization();
      }
    }
  } catch (err) {
    console.error('Failed to fetch status:', err);
  } finally {
    hideLoader();
  }
}

async function triggerOptimization(blockRequest = null) {
  showLoader();
  try {
    const res = await fetch('/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: blockRequest ? JSON.stringify(blockRequest) : null
    });

    if (res.ok) {
      const result = await res.json();
      lastOptimizationResult = result;
      renderDashboard(result);
    } else {
      console.error('Optimization failed');
    }
  } catch (err) {
    console.error('Optimization error:', err);
  } finally {
    hideLoader();
  }
}

function renderDashboard(result) {
  if (!result) return;

  // 1. Render KPIs
  renderKPIs(result.kpis, result.block_window);

  // 2. Render Active Tab View
  if (activeTab === 'tab-marey') {
    renderMareyChart(result);
  } else if (activeTab === 'tab-topology') {
    renderTopologyView(result);
  } else if (activeTab === 'tab-timetable') {
    renderTimetableTable(result.trains);
  } else if (activeTab === 'tab-notice') {
    renderDispatchNotice(result);
  }

  refreshIcons();
}

function renderKPIs(kpis, blk) {
  const totalDelayEl = document.getElementById('kpi-total-delay');
  const delayBadgeEl = document.getElementById('kpi-delay-badge');
  const delaySubEl = document.getElementById('kpi-delay-sub');

  const blockDurEl = document.getElementById('kpi-block-duration');
  const windowSpanEl = document.getElementById('kpi-window-span');
  const blockSegEl = document.getElementById('kpi-block-segment');

  const throughputEl = document.getElementById('kpi-throughput');
  const headwayEl = document.getElementById('kpi-headway-compliance');
  const solverTimeEl = document.getElementById('kpi-solver-time');

  if (totalDelayEl) totalDelayEl.textContent = kpis.total_delay_added_mins;
  if (delayBadgeEl) delayBadgeEl.innerHTML = `<i data-lucide="clock"></i> +${kpis.total_delay_added_mins} mins total delay`;
  if (delaySubEl) delaySubEl.innerHTML = `<i data-lucide="pause-circle"></i> ${kpis.trains_held} train(s) regulated at sidings`;

  if (blockDurEl) blockDurEl.textContent = blk.duration_mins;
  if (windowSpanEl) windowSpanEl.innerHTML = `<i data-lucide="clock"></i> ${blk.granted_start_str} – ${blk.granted_end_str}`;
  if (blockSegEl) blockSegEl.innerHTML = `<i data-lucide="map-pin"></i> ${blk.segment_id} (${blk.department})`;

  if (throughputEl) throughputEl.textContent = kpis.section_throughput_efficiency_pct.toFixed(1);
  if (headwayEl) headwayEl.textContent = kpis.safety_headway_compliance_pct.toFixed(1);
  if (solverTimeEl) solverTimeEl.innerHTML = `<i data-lucide="cpu"></i> Solved in ${kpis.solver_time_sec}s (CP-SAT)`;

  refreshIcons();
}

function renderMareyChart(result) {
  const chartEl = document.getElementById('plotly-marey-chart');
  if (!chartEl || !window.Plotly) return;

  const showBaseline = document.getElementById('toggle-baseline')?.checked ?? true;
  const showSidingMarkers = document.getElementById('toggle-siding-markers')?.checked ?? true;

  const network = result.network;
  const stations = network.Station_Nodes;
  const blk = result.block_window;

  // Station Y ticks
  const yValues = stations.map(s => s.km);
  const yText = stations.map(s => `${s.code} (${s.name})`);

  const traces = [];

  const isLight = (currentTheme === 'tricolor-light');
  const isContrast = (currentTheme === 'high-contrast');

  // Baseline dash color
  let baselineColor = '#94A3B8';
  if (currentTheme === 'dark') baselineColor = '#475569';
  if (isContrast) baselineColor = '#666666';

  // 1. Plot Baseline Trajectories (if toggled)
  if (showBaseline) {
    result.trains.forEach(t => {
      const xBase = t.baseline_trajectory.map(p => minutesToHHMM(p.arrival_min));
      const yBase = t.baseline_trajectory.map(p => p.km);

      traces.push({
        x: xBase,
        y: yBase,
        mode: 'lines',
        name: `${t.train_id} Baseline`,
        line: {
          color: baselineColor,
          width: 1.5,
          dash: 'dot'
        },
        hoverinfo: 'text',
        hovertext: t.baseline_trajectory.map(p => 
          `<b>${t.train_id} (${t.train_name}) [BASELINE SCHEDULE]</b><br>` +
          `Station: ${p.station_name} (${p.station_code})<br>` +
          `Time: ${p.arrival_time_str}<br>` +
          `Section: ${p.km} Km`
        ),
        showlegend: false
      });
    });
  }

  // 2. Plot Solved Optimal Trajectories
  result.trains.forEach(t => {
    let color = SPECIFIC_COLORS[t.train_id] || TRAIN_COLORS[t.priority_rank]?.line || '#0284c7';
    if (isContrast) {
      color = CONTRAST_COLORS[t.train_id] || '#ffffff';
    }

    const xSolved = [];
    const ySolved = [];
    const hoverTexts = [];

    t.solved_trajectory.forEach((p, idx) => {
      xSolved.push(minutesToHHMM(p.arrival_min));
      ySolved.push(p.km);
      hoverTexts.push(
        `<b>${t.train_id} ${t.train_name}</b> (Priority ${t.priority_rank})<br>` +
        `Arrival at: ${p.station_name} (${p.station_code})<br>` +
        `Time: ${p.arrival_time_str}<br>` +
        `Delay: +${Math.round(p.arrival_min - t.baseline_trajectory[idx].arrival_min)} mins<br>` +
        `${p.is_siding_hold ? `<b style="color:#FF671F;">⚠️ SIDING LOOP HOLD: ${p.hold_duration_mins}m</b>` : ''}`
      );

      if (p.departure_min > p.arrival_min) {
        xSolved.push(minutesToHHMM(p.departure_min));
        ySolved.push(p.km);
        hoverTexts.push(
          `<b>${t.train_id} ${t.train_name}</b> (Priority ${t.priority_rank})<br>` +
          `Departure from: ${p.station_name}<br>` +
          `Time: ${p.departure_time_str}<br>` +
          `Regulated for: ${p.hold_duration_mins} mins on Loop Line`
        );
      }
    });

    traces.push({
      x: xSolved,
      y: ySolved,
      mode: 'lines+markers',
      name: `${t.train_id} (${t.train_type})`,
      line: {
        color: color,
        width: (t.priority_rank === 1) ? 3.5 : 2.5
      },
      marker: {
        size: isContrast ? 6 : 5,
        color: color
      },
      hoverinfo: 'text',
      hovertext: hoverTexts,
      showlegend: true
    });

    // 3. Highlight Siding Holds with Distinct Markers
    if (showSidingMarkers && t.siding_holds.length > 0) {
      const xHold = [];
      const yHold = [];
      const holdHover = [];

      t.siding_holds.forEach(h => {
        const stn = stations.find(s => s.code === h.station_code);
        if (stn) {
          xHold.push(h.start_time_str);
          yHold.push(stn.km);
          holdHover.push(
            `<b>⚠️ SIDING LOOP REGULATION: ${t.train_id}</b><br>` +
            `Station: ${h.station_name} Loop Siding<br>` +
            `Hold Window: ${h.start_time_str} to ${h.end_time_str}<br>` +
            `Duration: ${h.hold_duration_mins} minutes<br>` +
            `Operational Rationale: ${h.reason}`
          );
        }
      });

      if (xHold.length > 0) {
        traces.push({
          x: xHold,
          y: yHold,
          mode: 'markers',
          name: `Siding Holds (${t.train_id})`,
          marker: {
            symbol: 'diamond',
            size: isContrast ? 12 : 10,
            color: isContrast ? '#FFFF00' : '#FF671F',
            line: { color: isContrast ? '#000000' : '#FFFFFF', width: 2 }
          },
          hoverinfo: 'text',
          hovertext: holdHover,
          showlegend: false
        });
      }
    }
  });

  // Boundaries for X-axis
  const startHour = '12:00';
  const endHour = '20:00';

  // Maintenance Block Window Shading Box
  let blockFill = 'rgba(220, 38, 38, 0.22)';
  let blockBorder = '#DC2626';
  if (currentTheme === 'dark') {
    blockFill = 'rgba(220, 38, 38, 0.35)';
  } else if (isContrast) {
    blockFill = 'rgba(255, 51, 68, 0.4)';
    blockBorder = '#FFE600';
  }

  const blockShape = {
    type: 'rect',
    xref: 'x',
    yref: 'y',
    x0: blk.granted_start_str,
    x1: blk.granted_end_str,
    y0: blk.start_km,
    y1: blk.end_km,
    fillcolor: blockFill,
    line: {
      color: blockBorder,
      width: 2.5,
      dash: 'dash'
    }
  };

  const blockAnnotation = {
    x: blk.granted_start_str,
    y: (blk.start_km + blk.end_km) / 2,
    xref: 'x',
    yref: 'y',
    text: `🛑 ${blk.department} Block (${blk.duration_mins}m)<br>${blk.granted_start_str} - ${blk.granted_end_str}`,
    showarrow: true,
    arrowhead: 2,
    ax: 65,
    ay: -25,
    font: {
      family: 'Inter, sans-serif',
      size: 11,
      color: isContrast ? '#FFE600' : '#FFFFFF',
      weight: 800
    },
    bgcolor: isContrast ? '#000000' : '#FF671F',
    bordercolor: isContrast ? '#00E5FF' : '#FFFFFF',
    borderwidth: 1.5,
    borderpad: 6
  };

  // Determine Plotly theme canvas colors
  let paperBg = '#FFFFFF';
  let plotBg = '#FFFFFF';
  let fontColor = '#002147';
  let gridColor = '#E5E7EB';
  let legendBg = '#FAFAFC';
  let legendBorder = '#D1D5DB';

  if (currentTheme === 'dark') {
    paperBg = '#080D1A';
    plotBg = '#0F1A33';
    fontColor = '#F8FAFC';
    gridColor = 'rgba(255, 255, 255, 0.08)';
    legendBg = '#0C1427';
    legendBorder = 'rgba(255, 255, 255, 0.15)';
  } else if (isContrast) {
    paperBg = '#000000';
    plotBg = '#000000';
    fontColor = '#FFFFFF';
    gridColor = '#262626';
    legendBg = '#000000';
    legendBorder = '#00E5FF';
  }

  const layout = {
    paper_bgcolor: paperBg,
    plot_bgcolor: plotBg,
    margin: { l: 85, r: 40, t: 30, b: 50 },
    xaxis: {
      title: { 
        text: 'Time of Day (HH:MM IST)', 
        font: { color: fontColor, size: 11, family: 'Inter', weight: 700 } 
      },
      color: fontColor,
      gridcolor: gridColor,
      range: [startHour, endHour],
      tickformat: '%H:%M',
      showgrid: true,
      zeroline: false
    },
    yaxis: {
      title: { 
        text: 'Corridor Section (Stations & Km Distance)', 
        font: { color: fontColor, size: 11, family: 'Inter', weight: 700 } 
      },
      color: fontColor,
      gridcolor: gridColor,
      tickvals: yValues,
      ticktext: yText,
      autorange: false,
      range: [-5, 225],
      showgrid: true,
      zeroline: false
    },
    shapes: [blockShape],
    annotations: [blockAnnotation],
    legend: {
      orientation: 'h',
      y: 1.09,
      x: 0,
      font: { color: fontColor, size: 10, family: 'Inter', weight: 600 },
      bgcolor: legendBg,
      bordercolor: legendBorder,
      borderwidth: 1
    },
    hovermode: 'closest'
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false
  };

  window.Plotly.newPlot(chartEl, traces, layout, config);
}

function renderTopologyView(result) {
  const container = document.getElementById('track-schematic-nodes');
  const sidingGrid = document.getElementById('siding-summary-grid');
  if (!container || !sidingGrid) return;

  container.innerHTML = '';
  sidingGrid.innerHTML = '';

  const stations = result.network.Station_Nodes;
  const blk = result.block_window;

  // Count holds per station
  const holdsByStation = {};
  result.trains.forEach(t => {
    t.siding_holds.forEach(h => {
      holdsByStation[h.station_code] = (holdsByStation[h.station_code] || 0) + 1;
    });
  });

  stations.forEach((stn, idx) => {
    // Station node element
    const holdsCount = holdsByStation[stn.code] || 0;
    const nodeDiv = document.createElement('div');
    nodeDiv.className = 'stn-node';
    nodeDiv.innerHTML = `
      <div class="stn-circle ${holdsCount > 0 ? 'has-hold' : ''}" title="${stn.name} (${stn.km} Km) - ${stn.platform_count} Platforms">
        ${stn.code}
      </div>
      <span class="stn-code">${stn.code}</span>
      <span class="stn-name">${stn.name}</span>
      <span class="stn-km"><i data-lucide="map-pin" style="width:10px;height:10px;display:inline;"></i> ${stn.km} Km</span>
      ${stn.has_siding ? `<span class="stn-siding-badge"><i data-lucide="git-branch" style="width:10px;height:10px;display:inline;"></i> ${stn.loop_lines} Loops</span>` : ''}
      ${holdsCount > 0 ? `<span class="badge badge-saffron mt-1"><i data-lucide="pause-circle" style="width:10px;height:10px;display:inline;"></i> ${holdsCount} Held</span>` : ''}
    `;
    container.appendChild(nodeDiv);

    // Connector segment line to next station
    if (idx < stations.length - 1) {
      const nextStn = stations[idx + 1];
      const segId = `${stn.code}-${nextStn.code}`;
      const isBlocked = (segId === blk.segment_id);

      const lineDiv = document.createElement('div');
      lineDiv.className = `track-segment-line ${isBlocked ? 'segment-blocked' : ''}`;
      lineDiv.title = `Segment ${segId} (${nextStn.km - stn.km} Km)${isBlocked ? ' - MAINTENANCE BLOCK ACTIVE' : ''}`;
      container.appendChild(lineDiv);
    }

    // Siding Card in grid
    const card = document.createElement('div');
    card.className = `siding-card ${holdsCount > 0 ? 'active-hold' : ''}`;
    card.innerHTML = `
      <div class="siding-title">
        <span><i data-lucide="building-2" style="width:13px;height:13px;display:inline;vertical-align:-2px;"></i> ${stn.name} (${stn.code})</span>
        <span class="stn-km"><i data-lucide="map-pin" style="width:11px;height:11px;display:inline;"></i> ${stn.km} Km</span>
      </div>
      <div class="siding-meta">
        <div>Platforms: <strong>${stn.platform_count}</strong> | Loop Siding Lines: <strong>${stn.loop_lines}</strong></div>
        <div style="margin-top:3px;">Siding Status: <strong style="color:${holdsCount > 0 ? '#FF671F' : '#046A38'}">${holdsCount > 0 ? `⚠️ ${holdsCount} Train(s) Regulated` : '✓ Clear / Unoccupied'}</strong></div>
      </div>
    `;
    sidingGrid.appendChild(card);
  });

  refreshIcons();
}

function getTrainIcon(type, id) {
  if (type.includes('Vande') || id === '22436') return '⚡';
  if (type.includes('Rajdhani') || id === '12424') return '👑';
  if (type.includes('Passenger') || type.includes('MEMU')) return '🚊';
  if (type.includes('Freight') || type.includes('Goods') || id.includes('BOXN') || id.includes('BCN')) return '📦';
  return '🚆';
}

function renderTimetableTable(trains) {
  const tbody = document.getElementById('timetable-tbody');
  const onTimeCountEl = document.getElementById('trains-ontime-count');
  const heldCountEl = document.getElementById('trains-held-count');
  if (!tbody) return;

  tbody.innerHTML = '';
  let onTime = 0;
  let held = 0;

  trains.forEach(t => {
    if (t.status === 'ON_TIME') onTime++;
    if (t.status === 'HELD_AT_SIDING') held++;

    const baseArr = minutesToHHMM(t.baseline_arrival_mins);
    const solvedArr = minutesToHHMM(t.solved_arrival_mins);
    const delay = Math.round(t.total_delay_mins);

    let statusBadgeClass = 'status-ontime';
    let statusText = '✓ ON TIME';
    if (t.status === 'HELD_AT_SIDING') {
      statusBadgeClass = 'status-held';
      statusText = '⏸ HELD AT SIDING';
    } else if (delay > 2) {
      statusBadgeClass = 'status-delayed';
      statusText = '⏱ REGULATED';
    }

    // Loop holds string
    let holdsStr = '<span style="color:var(--text-muted);">Direct Run</span>';
    if (t.siding_holds.length > 0) {
      holdsStr = t.siding_holds.map(h => 
        `<span class="badge badge-saffron"><i data-lucide="corner-down-right"></i> ${h.station_name} (${h.hold_duration_mins}m)</span>`
      ).join(' ');
    }

    const trainIcon = getTrainIcon(t.train_type, t.train_id);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${trainIcon} ${t.train_id}</strong></td>
      <td><strong>${t.train_name}</strong></td>
      <td>${t.train_type}</td>
      <td><span class="badge badge-track">P-${t.priority_rank}</span></td>
      <td>${t.baseline_trajectory[0].departure_time_str}</td>
      <td>${baseArr}</td>
      <td><strong style="color:${delay > 0 ? '#C2410C' : '#046A38'}">${solvedArr}</strong></td>
      <td><strong>+${delay}m</strong></td>
      <td>${holdsStr}</td>
      <td><span class="badge-status ${statusBadgeClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });

  if (onTimeCountEl) onTimeCountEl.innerHTML = `<i data-lucide="check-circle-2"></i> ${onTime} On-Time`;
  if (heldCountEl) heldCountEl.innerHTML = `<i data-lucide="pause-circle"></i> ${held} Held at Siding`;

  refreshIcons();
}

function renderDispatchNotice(result) {
  const noticeEl = document.getElementById('notice-text-content');
  if (!noticeEl) return;

  fetch('/api/notice/text')
    .then(r => r.text())
    .then(text => {
      noticeEl.textContent = text;
    })
    .catch(err => {
      console.error('Error fetching notice:', err);
    });
}

// AI Copilot Chat Handler
async function handleChatSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('chat-input');
  if (!input) return;
  const query = input.value.trim();
  if (!query) return;

  input.value = '';

  // Append user message
  appendChatMessage(query, 'user');

  // Loading message placeholder
  const tempMsgId = 'msg-' + Date.now();
  appendChatMessage('Analyzing section constraints and parsing operational parameters...', 'assistant', tempMsgId);

  try {
    const res = await fetch('/api/copilot/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        api_key: userApiKey || null
      })
    });

    if (res.ok) {
      const data = await res.json();

      // Remove loading message
      document.getElementById(tempMsgId)?.remove();

      // Append real assistant reply
      appendChatMessage(data.reply_text, 'assistant');

      // If structured parameters were extracted, show the badge
      if (data.extracted_parameters) {
        showParsedParametersBadge(data.extracted_parameters);
      }

      // If auto-triggered solve, re-fetch status and update dashboard
      if (data.auto_trigger_solve) {
        await fetchInitialStatus();
      }
    }
  } catch (err) {
    console.error('Chat error:', err);
    document.getElementById(tempMsgId)?.remove();
    appendChatMessage('Error processing command. Please verify connection to the railway server.', 'assistant');
  }
}

function appendChatMessage(text, sender, elementId = null) {
  const container = document.getElementById('copilot-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `message msg-${sender}`;
  if (elementId) msgDiv.id = elementId;

  // Convert markdown bold to HTML
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n•/g, '<br>•');

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  msgDiv.innerHTML = `
    <div class="msg-content">${formatted}</div>
    <div class="msg-time"><i data-lucide="clock" style="width:10px;height:10px;display:inline;"></i> ${timeStr} IST</div>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
  refreshIcons();
}

function showParsedParametersBadge(p) {
  const badge = document.getElementById('nlp-extracted-badge');
  const content = document.getElementById('nlp-badge-content');
  if (!badge || !content) return;

  badge.classList.remove('d-none');
  content.innerHTML = `
    <div><i data-lucide="activity" style="width:11px;height:11px;display:inline;"></i> Action: <strong>${p.action_type}</strong> | Dept: <strong>${p.department}</strong></div>
    <div><i data-lucide="map-pin" style="width:11px;height:11px;display:inline;"></i> Segment: <strong>${p.segment_id}</strong> (${p.from_station} ⇄ ${p.to_station})</div>
    <div><i data-lucide="clock" style="width:11px;height:11px;display:inline;"></i> Duration: <strong>${p.duration_mins}m</strong> | Start: <strong>${p.start_time} hrs</strong></div>
  `;
  refreshIcons();
}

// Drag & Drop Dataset Ingestion Setup
function setupDragAndDrop() {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input-upload');
  if (!dropArea || !fileInput) return;

  dropArea.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropArea.classList.remove('dragover');
    });
  });

  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      handleFileUpload(fileInput.files[0]);
    }
  });
}

async function handleFileUpload(file) {
  const name = file.name.toLowerCase();
  let fileType = 'schedules';
  if (name.includes('network')) fileType = 'network';
  else if (name.includes('block')) fileType = 'blocks';

  const formData = new FormData();
  formData.append('file_type', fileType);
  formData.append('file', file);

  showLoader();
  try {
    const res = await fetch('/api/data/upload', {
      method: 'POST',
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      lastOptimizationResult = data.last_result;
      renderDashboard(data.last_result);
      appendChatMessage(`Uploaded **${file.name}**: ${data.message}`, 'assistant');
    } else {
      const err = await res.json();
      alert(`Upload failed: ${err.detail || 'Invalid format'}`);
    }
  } catch (err) {
    console.error('File upload error:', err);
    alert('Upload failed. Please ensure file is valid CSV or JSON.');
  } finally {
    hideLoader();
  }
}

function showLoader() {
  document.getElementById('chart-loader')?.classList.remove('d-none');
}

function hideLoader() {
  document.getElementById('chart-loader')?.classList.add('d-none');
}

function minutesToHHMM(minutes) {
  const total = Math.round(minutes) % (24 * 60);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
