/* Sheinbein Empire Dashboard v4 — Multi-page with sidebar nav */

const RAW_PORT = '__PORT_5000__';
const API = (() => {
  if (RAW_PORT.startsWith('__')) return null;
  const base = window.location.pathname.replace(/\/[^/]*$/, '');
  return base + '/' + RAW_PORT;
})();

const STATE = {
  data: null,
  view: 'all',        // 'all' | 'share'
  page: 'overview',
  sortKey: 'r2025',
  sortDir: 'desc',
  search: '',
  charts: {},
};

const YEARS = ['2022', '2023', '2024', '2025', '2026_ytd'];
const YEAR_LABELS = { '2022': '2022', '2023': '2023', '2024': '2024', '2025': '2025', '2026_ytd': '2026 YTD' };
const PAGE_TITLES = {
  overview: 'Overview',
  properties: 'Properties',
  analytics: 'Analytics',
  debt: 'Debt & Risk',
  distributions: 'Distributions',
  table: 'Companies',
};

const COLORS = {
  bg: '#0f1417', panel: '#171d22', panel2: '#1c242a',
  border: '#252e35', borderStrong: '#34404a',
  text: '#e6ecef', textMuted: '#8a969f', textDim: '#606c75',
  accent: '#01696f', accentHi: '#0e8a92',
  gold: '#c9a227', goldDim: '#8c7119',
  green: '#2f9d6b', red: '#b33a3a', yellow: '#d0a52b', grey: '#4a555d',
};

/* ---------- formatting ---------- */
function fmtMoney(n, compact = false) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (compact) {
    if (abs >= 1e9) return sign + '$' + (abs / 1e9).toFixed(2) + 'B';
    if (abs >= 1e6) return sign + '$' + (abs / 1e6).toFixed(2) + 'M';
    if (abs >= 1e3) return sign + '$' + (abs / 1e3).toFixed(0) + 'K';
    return sign + '$' + abs.toFixed(0);
  }
  return sign + '$' + abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtCell(n) {
  if (n === null || n === undefined || Number.isNaN(n) || n === 0) return '—';
  return fmtMoney(n);
}
function fmtPct(n, digits) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (digits !== undefined) return n.toFixed(digits) + '%';
  if (n === Math.floor(n)) return n.toFixed(0) + '%';
  return n.toFixed(1) + '%';
}
function fmtDelta(pct) {
  if (!isFinite(pct)) return '';
  const sign = pct >= 0 ? '+' : '';
  return sign + pct.toFixed(1) + '%';
}
function fmtRatio(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toFixed(2) + 'x';
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function truncate(s, n) {
  return s && s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/* ---------- data loading ---------- */
async function loadData() {
  let baseline = null;
  try {
    const r = await fetch('data.json', { cache: 'no-store' });
    baseline = await r.json();
  } catch (e) {
    console.error('Failed to load data.json', e);
  }

  let live = null;
  if (API) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(API + '/api/data', { signal: ctrl.signal });
      clearTimeout(timer);
      if (r.ok) live = await r.json();
    } catch (e) { /* fall back */ }
  }

  const active = live || baseline;
  setLiveIndicator(Boolean(live));
  return active;
}

function setLiveIndicator(isLive) {
  const el = document.getElementById('live-indicator');
  const lbl = document.getElementById('live-label');
  if (!el) return;
  if (isLive) { el.classList.add('live'); lbl.textContent = 'Live'; }
  else { el.classList.remove('live'); lbl.textContent = 'Cached'; }
}

/* ---------- derived ---------- */
function companyRow(c) {
  const pl = c.pl || {};
  const r = {};
  YEARS.forEach(y => { r['r_' + y] = pl[y] ? (pl[y].income || 0) : 0; });
  const ni2025 = pl['2025'] ? (pl['2025'].net_income || 0) : 0;
  const rev2025 = pl['2025'] ? (pl['2025'].income || 0) : 0;
  const margin2025 = rev2025 ? (ni2025 / rev2025) * 100 : null;

  const es = c.equity_sheet;
  let assets, mortgages, net_equity, your_equity;
  if (es) {
    assets = es.property_value;
    mortgages = es.mortgage;
    net_equity = es.equity_value_based;
    your_equity = es.your_equity_value;
  } else {
    const bs = c.bs || {};
    assets = bs.assets || 0;
    mortgages = bs.mortgages || 0;
    net_equity = assets - (bs.liabilities || 0);
    your_equity = net_equity * ((c.combined_pct || 0) / 100);
  }

  return {
    raw: c,
    name: c.name,
    combined_pct: c.combined_pct || 0,
    r2022: r['r_2022'], r2023: r['r_2023'], r2024: r['r_2024'],
    r2025: r['r_2025'], r2026: r['r_2026_ytd'],
    ni2025,
    rev2025,
    margin2025,
    assets,
    mortgages,
    net_equity,
    your_equity,
    ltv: c.ltv ?? null,
    dscr: c.dscr ?? null,
    debt_service: c.est_annual_debt_service ?? null,
    flags: c.flags || [],
    flagcount: (c.flags || []).length,
    revenue_pct: c.revenue_pct ?? null,
    status: ni2025 > 0 ? 'green' : (ni2025 < 0 ? 'red' : 'grey'),
    is_property: Boolean(es),
    ownership_type: c.ownership_type || 'unknown',
    property_details: c.property_details || {},
    acquisition: c.acquisition || {},
    margins: c.margins || {},
    distributions: c.distributions || { total_distributed: 0, periods: [] },
    coc_return: c.coc_return ?? null,
    roe_return: c.roe_return ?? null,
    coc_return_avg: c.coc_return_avg ?? null,
    roe_return_avg: c.roe_return_avg ?? null,
    avg_annual_revenue: c.avg_annual_revenue ?? null,
    avg_annual_ni: c.avg_annual_ni ?? null,
    proj_2026_revenue: c.proj_2026_revenue ?? null,
    total_cost: c.total_cost ?? null,
    cap_rate: c.cap_rate ?? null,
    noi_2025: c.noi_2025 ?? null,
    cash_invested: (c.acquisition || {}).cash_invested ?? null,
  };
}

function totals(companies, shareView) {
  const t = {
    rev: { '2022': 0, '2023': 0, '2024': 0, '2025': 0, '2026_ytd': 0 },
    ni: { '2022': 0, '2023': 0, '2024': 0, '2025': 0, '2026_ytd': 0 },
    assets: 0, mortgages: 0, net_equity: 0, your_equity: 0,
    prop_count: 0,
  };

  companies.forEach(c => {
    const es = c.equity_sheet;
    const share = (c.combined_pct || 0) / 100;
    const mult = shareView ? share : 1;

    YEARS.forEach(y => {
      const pl = c.pl && c.pl[y];
      if (pl) {
        t.rev[y] += (pl.income || 0) * mult;
        t.ni[y] += (pl.net_income || 0) * mult;
      }
    });

    if (es) {
      t.assets += es.property_value * (shareView ? share : 1);
      t.mortgages += es.mortgage * (shareView ? share : 1);
      if (shareView) {
        t.net_equity += es.your_equity_value;
        t.your_equity += es.your_equity_value;
      } else {
        t.net_equity += es.equity_value_based;
        t.your_equity += es.your_equity_value;
      }
      t.prop_count++;
    } else {
      const bs = c.bs || {};
      const ne = (bs.assets || 0) - (bs.liabilities || 0);
      t.assets += (bs.assets || 0) * mult;
      t.mortgages += (bs.mortgages || 0) * mult;
      t.net_equity += ne * mult;
      t.your_equity += ne * share;
    }
  });

  return t;
}

function ltvColor(ltv) {
  if (ltv === null || ltv === undefined) return 'green';
  if (ltv < 50) return 'green';
  if (ltv < 70) return 'yellow';
  return 'red';
}
function dscrColor(dscr) {
  if (dscr === null || dscr === undefined) return 'grey';
  if (dscr >= 1.5) return 'green';
  if (dscr >= 1.0) return 'yellow';
  return 'red';
}
function flagBadgeClass(flag) {
  const f = flag.toLowerCase();
  if (f.includes('loss') || f.includes('underwater') || f.includes('high ltv')) return 'red';
  if (f.includes('low') || f.includes('renovation')) return 'yellow';
  return '';
}
function hexToColor(cls) {
  return cls === 'red' ? COLORS.red : cls === 'yellow' ? COLORS.yellow : COLORS.green;
}

/* ---------- renderers: header ---------- */
function renderHeader(data) {
  document.getElementById('pulled-at').textContent = data.pulled_at || '—';
  document.getElementById('company-count').textContent = (data.companies || []).length;
  document.querySelectorAll('.view-label').forEach(el => {
    el.textContent = STATE.view === 'share' ? 'Your Share' : 'Total';
  });
}

/* ---------- KPIs ---------- */
function renderKpis(data) {
  const shareView = STATE.view === 'share';
  const t = totals(data.companies, shareView);
  const viewLabel = shareView ? 'Your Share' : 'Total';

  const rev25 = t.rev['2025'];
  const rev24 = t.rev['2024'];
  const revDelta = rev24 ? ((rev25 - rev24) / rev24) * 100 : NaN;

  const ni25 = t.ni['2025'];

  const cards = [
    {
      label: `Revenue 2025 · ${viewLabel}`,
      value: fmtMoney(rev25, true),
      sub: `2024: ${fmtMoney(rev24, true)}`,
      delta: isFinite(revDelta) ? fmtDelta(revDelta) : '',
      deltaClass: revDelta >= 0 ? 'pos' : 'neg',
    },
    {
      label: `Net Income 2025 · ${viewLabel}`,
      value: fmtMoney(ni25, true),
      valueClass: ni25 >= 0 ? 'pos' : 'neg',
      sub: `2024: ${fmtMoney(t.ni['2024'], true)}`,
    },
    {
      label: `Property Value · ${viewLabel}`,
      value: fmtMoney(t.assets, true),
      sub: `${t.prop_count} properties · Market value`,
    },
    {
      label: `Mortgages · ${viewLabel}`,
      value: fmtMoney(t.mortgages, true),
      sub: `Across ${t.prop_count} properties`,
    },
    {
      label: `Net Equity · ${viewLabel}`,
      value: fmtMoney(t.net_equity, true),
      valueClass: t.net_equity >= 0 ? 'pos' : 'neg',
      sub: 'Property value − Mortgages',
    },
    {
      label: 'Your Net Equity',
      value: fmtMoney(t.your_equity, true),
      valueClass: t.your_equity >= 0 ? 'pos' : 'neg',
      sub: 'Ownership-weighted · Value-based',
      accent: 'gold',
    },
  ];

  const html = cards.map(c => `
    <div class="kpi-card ${c.accent ? 'accent-' + c.accent : ''}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value ${c.valueClass || ''}">${c.value}</div>
      <div class="kpi-sub">
        ${c.delta ? `<span class="kpi-delta ${c.deltaClass}">${c.delta}</span> · ` : ''}${c.sub || ''}
      </div>
    </div>
  `).join('');
  document.getElementById('kpi-grid').innerHTML = html;
}

/* ---------- charts common ---------- */
function chartDefaults() {
  Chart.defaults.color = COLORS.textMuted;
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = COLORS.border;
}
function tooltipStyle() {
  return {
    backgroundColor: COLORS.panel2, borderColor: COLORS.borderStrong, borderWidth: 1,
    titleColor: COLORS.text, bodyColor: COLORS.text, padding: 10,
  };
}
function destroyChart(key) {
  if (STATE.charts[key]) { STATE.charts[key].destroy(); delete STATE.charts[key]; }
}

/* ---------- Overview charts ---------- */
function renderRevenueChart(data) {
  const shareView = STATE.view === 'share';
  const t = totals(data.companies, shareView);
  const labels = YEARS.map(y => YEAR_LABELS[y]);
  const values = YEARS.map(y => t.rev[y]);

  destroyChart('revenue');
  const ctx = document.getElementById('revenue-chart').getContext('2d');

  const color = shareView ? COLORS.gold : COLORS.accentHi;
  const bg = shareView ? 'rgba(201,162,39,0.18)' : 'rgba(14,138,146,0.18)';

  STATE.charts.revenue = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{
      label: shareView ? 'Your Share Revenue' : 'Total Revenue',
      data: values, backgroundColor: bg, borderColor: color, borderWidth: 1.5, borderRadius: 4,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' ' + fmtMoney(c.parsed.y, true) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLORS.textMuted } },
        y: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => fmtMoney(v, true) } },
      },
    },
  });
}

function renderEquityChart(data) {
  const rows = data.companies.map(companyRow)
    .filter(r => r.net_equity > 0)
    .sort((a, b) => b.net_equity - a.net_equity)
    .slice(0, 12);

  const labels = rows.map(r => truncate(r.name, 22));
  const totalEq = rows.map(r => r.net_equity);
  const yourEq = rows.map(r => r.your_equity);

  destroyChart('equity');
  const ctx = document.getElementById('equity-chart').getContext('2d');

  STATE.charts.equity = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Net Equity (Total)', data: totalEq, backgroundColor: 'rgba(14,138,146,0.35)', borderColor: COLORS.accentHi, borderWidth: 1, borderRadius: 3 },
      { label: 'Your Share', data: yourEq, backgroundColor: 'rgba(201,162,39,0.75)', borderColor: COLORS.gold, borderWidth: 1, borderRadius: 3 },
    ]},
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 4, left: 4, right: 8 } },
      plugins: {
        legend: { labels: { color: COLORS.text, boxWidth: 12, padding: 14 }, position: 'top', align: 'start' },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtMoney(c.parsed.x, true) } },
      },
      scales: {
        x: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => fmtMoney(v, true) } },
        y: { grid: { display: false }, ticks: { color: '#c7d0d6', font: { size: 10 }, autoSkip: false }, afterFit: s => { s.width = 170; } },
      },
    },
  });
}

function renderYoYChart(data) {
  const shareView = STATE.view === 'share';
  const rows = data.companies.map(companyRow)
    .map(r => {
      // apply share multiplier if Your Share is active
      if (shareView) {
        const m = (r.combined_pct || 0) / 100;
        return { ...r, r2022: r.r2022 * m, r2023: r.r2023 * m, r2024: r.r2024 * m, r2025: r.r2025 * m, r2026: r.r2026 * m };
      }
      return r;
    })
    .sort((a, b) => b.r2025 - a.r2025)
    .slice(0, 10);

  const labels = rows.map(r => truncate(r.name, 22));
  const years = ['2022', '2023', '2024', '2025'];
  const yearColors = { '2022': '#4a555d', '2023': '#6d7d86', '2024': COLORS.accentHi, '2025': COLORS.gold };

  const datasets = years.map(y => ({
    label: y, data: rows.map(r => r['r' + y]),
    backgroundColor: yearColors[y], borderColor: yearColors[y], borderWidth: 0, borderRadius: 3,
  }));

  destroyChart('yoy');
  const ctx = document.getElementById('yoy-chart').getContext('2d');
  STATE.charts.yoy = new Chart(ctx, {
    type: 'bar', data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: COLORS.text, boxWidth: 12, padding: 14 }, position: 'top', align: 'start' },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtMoney(c.parsed.y, true) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: '#c7d0d6', font: { size: 10 }, maxRotation: 40, minRotation: 30 } },
        y: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => fmtMoney(v, true) } },
      },
    },
  });
}

function renderNetWorthChart(data, canvasId, chartKey) {
  const trend = data.net_worth_trend || {};
  const order = ['2022', '2023', '2024', '2025', '2026_ytd'];
  const labels = order.map(y => YEAR_LABELS[y]);
  const values = order.map(y => trend[y] || 0);

  destroyChart(chartKey);
  const el = document.getElementById(canvasId);
  if (!el) return;
  const ctx = el.getContext('2d');

  // gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, el.height || 360);
  grad.addColorStop(0, 'rgba(14,138,146,0.35)');
  grad.addColorStop(1, 'rgba(14,138,146,0.02)');

  STATE.charts[chartKey] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{
      label: 'Net Worth',
      data: values,
      borderColor: COLORS.accentHi,
      backgroundColor: grad,
      borderWidth: 2,
      fill: true,
      tension: 0.32,
      pointBackgroundColor: COLORS.gold,
      pointBorderColor: COLORS.bg,
      pointBorderWidth: 2,
      pointRadius: 5,
      pointHoverRadius: 7,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' ' + fmtMoney(c.parsed.y, true) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLORS.textMuted } },
        y: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => fmtMoney(v, true) } },
      },
    },
  });
}

/* ---------- Properties page ---------- */
function renderProperties(data) {
  const shareView = STATE.view === 'share';
  const rows = data.companies.map(companyRow)
    .filter(r => r.is_property)
    .sort((a, b) => b.net_equity - a.net_equity);

  const grid = document.getElementById('property-grid');
  if (!grid) return;

  grid.innerHTML = rows.map(r => {
    const share = r.combined_pct / 100;
    const value = shareView ? r.assets * share : r.assets;
    const mort = shareView ? r.mortgages * share : r.mortgages;
    const eq = shareView ? r.your_equity : r.net_equity;
    const rev = shareView ? r.r2025 * share : r.r2025;
    const ni = shareView ? r.ni2025 * share : r.ni2025;

    const ltv = r.ltv ?? 0;
    const ltvCls = ltvColor(r.ltv);
    const dscrCls = dscrColor(r.dscr);

    const addr = r.property_details.address || '';
    const mgmt = r.property_details.management || '';
    const acq = r.acquisition || {};
    const totalInvest = (acq.house_cost || 0) + (acq.reno_cost || 0);

    const flagsHtml = (r.flags || []).map(f =>
      `<span class="badge ${flagBadgeClass(f)}">${escapeHtml(f)}</span>`
    ).join('');

    return `
      <div class="prop-card">
        <div class="prop-head">
          <div>
            <div class="prop-name">${escapeHtml(r.name)}</div>
            ${addr ? `<div class="prop-addr">${escapeHtml(addr)}</div>` : ''}
            ${mgmt ? `<div class="prop-mgmt">${escapeHtml(mgmt)}</div>` : ''}
          </div>
          <div class="prop-ownership">
            <span class="label">Your %</span>
            ${fmtPct(r.combined_pct)}
          </div>
        </div>

        <div class="prop-metrics">
          <div class="prop-metric">
            <span class="label">Property Value</span>
            <span class="value">${fmtMoney(value, true)}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Mortgage</span>
            <span class="value">${fmtMoney(mort, true)}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Net Equity</span>
            <span class="value ${eq >= 0 ? 'pos' : 'neg'}">${fmtMoney(eq, true)}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Your Equity</span>
            <span class="value gold">${fmtMoney(r.your_equity, true)}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Avg Annual Revenue</span>
            <span class="value">${fmtMoney((shareView ? (r.avg_annual_revenue || 0) * share : (r.avg_annual_revenue || 0)), true)}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Avg Annual NI</span>
            <span class="value ${(r.avg_annual_ni || 0) >= 0 ? 'pos' : 'neg'}">${fmtMoney((shareView ? (r.avg_annual_ni || 0) * share : (r.avg_annual_ni || 0)), true)}</span>
          </div>
        </div>

        <div class="prop-metrics" style="grid-template-columns: 1fr 1fr 1fr;">
          <div class="prop-metric" title="Cash-on-Cash, computed from 3-year average annual NI">
            <span class="label">CoC (avg)</span>
            <span class="value ${r.coc_return_avg !== null ? (r.coc_return_avg >= 10 ? 'pos' : r.coc_return_avg < 0 ? 'neg' : '') : 'dim'}">${r.coc_return_avg !== null ? r.coc_return_avg.toFixed(1) + '%' : '—'}</span>
          </div>
          <div class="prop-metric" title="Return on Equity, computed from 3-year average annual NI">
            <span class="label">ROE (avg)</span>
            <span class="value ${r.roe_return_avg !== null ? (r.roe_return_avg >= 8 ? 'pos' : r.roe_return_avg < 0 ? 'neg' : '') : 'dim'}">${r.roe_return_avg !== null ? r.roe_return_avg.toFixed(1) + '%' : '—'}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Cap Rate</span>
            <span class="value ${r.cap_rate !== null ? (r.cap_rate >= 6 ? 'pos' : '') : 'dim'}">${r.cap_rate !== null ? r.cap_rate.toFixed(1) + '%' : '—'}</span>
          </div>
        </div>

        <div class="ltv-row">
          <div class="ltv-head">
            <span class="label">Loan-to-Value</span>
            <span class="value">${fmtPct(r.ltv, 1)}</span>
          </div>
          <div class="ltv-bar">
            <div class="fill ${ltvCls}" style="width: ${Math.min(100, Math.max(0, ltv))}%;"></div>
          </div>
        </div>

        ${r.dscr !== null ? `
        <div class="prop-metrics" style="grid-template-columns: 1fr 1fr;">
          <div class="prop-metric">
            <span class="label">DSCR</span>
            <span class="value ${dscrCls === 'red' ? 'neg' : dscrCls === 'green' ? 'pos' : ''}">${fmtRatio(r.dscr)}</span>
          </div>
          <div class="prop-metric">
            <span class="label">Annual Debt Svc</span>
            <span class="value">${fmtMoney(r.debt_service, true)}</span>
          </div>
        </div>` : ''}

        ${flagsHtml ? `<div class="flags-row">${flagsHtml}</div>` : ''}

        ${totalInvest > 0 ? `
        <div class="prop-foot">
          <div>
            <span class="lbl">Purchase</span>
            <span class="val">${fmtMoney(acq.house_cost || 0, true)}</span>
          </div>
          <div>
            <span class="lbl">CapEx</span>
            <span class="val">${fmtMoney(acq.reno_cost || 0, true)}</span>
          </div>
          <div>
            <span class="lbl">Total Cost</span>
            <span class="val">${fmtMoney(totalInvest, true)}</span>
          </div>
          <div>
            <span class="lbl">Appreciation</span>
            <span class="val" style="color:${r.assets - totalInvest > 0 ? '#57c494' : '#e26b6b'}">${fmtMoney(r.assets - totalInvest, true)}</span>
          </div>
        </div>` : ''}
      </div>
    `;
  }).join('');
}

/* ---------- Analytics page ---------- */
function renderConcentration(data) {
  const rows = data.companies.map(companyRow)
    .filter(r => r.r2025 > 0)
    .sort((a, b) => b.r2025 - a.r2025);
  const top = rows.slice(0, 10);
  const rest = rows.slice(10);
  const restSum = rest.reduce((s, r) => s + r.r2025, 0);

  const labels = top.map(r => truncate(r.name, 24));
  const values = top.map(r => r.r2025);
  if (restSum > 0) { labels.push(`Other (${rest.length})`); values.push(restSum); }

  const palette = [
    COLORS.accentHi, COLORS.gold, '#57c494', '#6d7d86', '#a06fc2',
    '#d98c4c', '#4cacd9', '#d94c6f', '#74c94c', '#c94cab', '#4a555d',
  ];

  destroyChart('concentration');
  const ctx = document.getElementById('concentration-chart').getContext('2d');
  STATE.charts.concentration = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{
      data: values,
      backgroundColor: palette.slice(0, labels.length),
      borderColor: COLORS.panel,
      borderWidth: 2,
    }]},
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { color: COLORS.text, boxWidth: 10, padding: 8, font: { size: 10 } } },
        tooltip: { ...tooltipStyle(), callbacks: {
          label: c => {
            const tot = c.dataset.data.reduce((a,b) => a+b, 0);
            const pct = tot ? (c.parsed / tot * 100).toFixed(1) : 0;
            return ' ' + c.label + ': ' + fmtMoney(c.parsed, true) + ' (' + pct + '%)';
          }
        }},
      },
    },
  });
}

function renderTopEarners(data) {
  const rows = data.companies.map(companyRow)
    .sort((a, b) => b.r2025 - a.r2025)
    .slice(0, 10);
  const labels = rows.map(r => truncate(r.name, 22));

  destroyChart('topEarners');
  const ctx = document.getElementById('top-earners-chart').getContext('2d');
  STATE.charts.topEarners = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Revenue', data: rows.map(r => r.r2025), backgroundColor: 'rgba(14,138,146,0.35)', borderColor: COLORS.accentHi, borderWidth: 1, borderRadius: 3 },
      { label: 'Net Income', data: rows.map(r => r.ni2025), backgroundColor: 'rgba(201,162,39,0.75)', borderColor: COLORS.gold, borderWidth: 1, borderRadius: 3 },
    ]},
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: COLORS.text, boxWidth: 12, padding: 14 }, position: 'top', align: 'start' },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtMoney(c.parsed.x, true) } },
      },
      scales: {
        x: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => fmtMoney(v, true) } },
        y: { grid: { display: false }, ticks: { color: '#c7d0d6', font: { size: 10 }, autoSkip: false }, afterFit: s => { s.width = 160; } },
      },
    },
  });
}

function renderHeatmap(data) {
  const rows = data.companies.map(companyRow)
    .sort((a, b) => b.r2025 - a.r2025)
    .slice(0, 15);

  const years = ['2022', '2023', '2024', '2025', '2026_ytd'];

  const marginColor = (m) => {
    if (m === null || m === undefined || Number.isNaN(m)) return null;
    // clamp -100 to 100
    const v = Math.max(-100, Math.min(100, m));
    if (v >= 0) {
      const a = Math.min(1, v / 70);  // 70% margin is strongest
      return `rgba(47,157,107,${0.15 + a * 0.55})`;
    }
    const a = Math.min(1, Math.abs(v) / 50);
    return `rgba(179,58,58,${0.15 + a * 0.55})`;
  };

  const head = `<thead><tr>
    <th class="name-col">Company</th>
    ${years.map(y => `<th>${YEAR_LABELS[y]}</th>`).join('')}
  </tr></thead>`;

  const body = `<tbody>${rows.map(r => {
    const cells = years.map(y => {
      const m = r.margins ? r.margins[y] : null;
      const bg = marginColor(m);
      if (m === null || m === undefined) return `<td class="empty">—</td>`;
      // When margin exceeds ±200%, revenue was near-zero — margin is not meaningful
      if (Math.abs(m) > 200) return `<td class="empty" title="Revenue near zero — margin not meaningful">N/M</td>`;
      return `<td style="background:${bg}">${m.toFixed(0)}%</td>`;
    }).join('');
    return `<tr><td class="name">${escapeHtml(truncate(r.name, 28))}</td>${cells}</tr>`;
  }).join('')}</tbody>`;

  document.getElementById('heatmap').innerHTML = head + body;
}

function renderReturnsChart(data) {
  const rows = data.companies.map(companyRow)
    .filter(r => r.is_property && (r.coc_return !== null || r.roe_return !== null))
    .sort((a, b) => (b.coc_return || 0) - (a.coc_return || 0));

  const labels = rows.map(r => truncate(r.name, 22));
  const cocData = rows.map(r => r.coc_return || 0);
  const roeData = rows.map(r => r.roe_return || 0);
  const capData = rows.map(r => r.cap_rate || 0);

  const ctx = document.getElementById('returns-chart');
  if (!ctx) return;
  destroyChart('returns');

  STATE.charts.returns = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Cash-on-Cash %',
          data: cocData,
          backgroundColor: cocData.map(v => v >= 10 ? 'rgba(47,157,107,0.7)' : v < 0 ? 'rgba(179,58,58,0.7)' : 'rgba(201,162,39,0.7)'),
          borderColor: cocData.map(v => v >= 10 ? '#2f9d6b' : v < 0 ? '#b33a3a' : '#c9a227'),
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Return on Equity %',
          data: roeData,
          backgroundColor: 'rgba(14,138,146,0.5)',
          borderColor: '#0e8a92',
          borderWidth: 1,
          borderRadius: 3,
        },
        {
          label: 'Cap Rate %',
          data: capData,
          backgroundColor: 'rgba(138,150,159,0.35)',
          borderColor: '#8a969f',
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, left: 4, right: 8 } },
      plugins: {
        legend: {
          labels: { color: COLORS.text, boxWidth: 12, padding: 14 },
          position: 'top',
          align: 'start',
        },
        tooltip: {
          ...tooltipStyle(),
          callbacks: { label: (c) => ' ' + c.dataset.label + ': ' + c.parsed.x.toFixed(1) + '%' },
        },
      },
      scales: {
        x: {
          grid: { color: '#1f272d' },
          ticks: { color: COLORS.textMuted, callback: (v) => v + '%' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#c7d0d6', font: { size: 10 }, autoSkip: false },
          afterFit: (scale) => { scale.width = 170; },
        },
      },
    },
  });
}

/* ---------- Debt & Risk page ---------- */
function renderRiskKpis(data) {
  const rows = data.companies.map(companyRow).filter(r => r.is_property && r.mortgages > 0);
  const withLtv = rows.filter(r => r.ltv !== null);
  const withDscr = rows.filter(r => r.dscr !== null);

  const avgLtv = withLtv.length ? withLtv.reduce((s, r) => s + r.ltv, 0) / withLtv.length : 0;
  const worstLtv = withLtv.length ? Math.max(...withLtv.map(r => r.ltv)) : 0;
  const avgDscr = withDscr.length ? withDscr.reduce((s, r) => s + r.dscr, 0) / withDscr.length : 0;
  const totalDebt = rows.reduce((s, r) => s + r.mortgages, 0);

  const cards = [
    { label: 'Average LTV', value: fmtPct(avgLtv, 1), sub: `Across ${withLtv.length} mortgaged properties`, accent: ltvColor(avgLtv) === 'red' ? 'red' : '' },
    { label: 'Worst LTV', value: fmtPct(worstLtv, 1), sub: withLtv.length ? withLtv.find(r => r.ltv === worstLtv).name : '—', accent: ltvColor(worstLtv) === 'red' ? 'red' : '' },
    { label: 'Average DSCR', value: fmtRatio(avgDscr), sub: avgDscr >= 1.5 ? 'Healthy coverage' : avgDscr >= 1.0 ? 'Adequate coverage' : 'Underwater', accent: avgDscr < 1 ? 'red' : '' },
    { label: 'Total Debt', value: fmtMoney(totalDebt, true), sub: `${rows.length} active mortgages` },
  ];

  document.getElementById('risk-kpi-grid').innerHTML = cards.map(c => `
    <div class="kpi-card ${c.accent ? 'accent-' + c.accent : ''}">
      <div class="kpi-label">${c.label}</div>
      <div class="kpi-value">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>
  `).join('');
}

function renderLTVChart(data) {
  const rows = data.companies.map(companyRow)
    .filter(r => r.is_property && r.mortgages > 0 && r.ltv !== null)
    .sort((a, b) => b.ltv - a.ltv);

  const labels = rows.map(r => truncate(r.name, 24));
  const values = rows.map(r => r.ltv);
  const bgs = rows.map(r => {
    const c = ltvColor(r.ltv);
    return c === 'red' ? 'rgba(179,58,58,0.75)' : c === 'yellow' ? 'rgba(208,165,43,0.75)' : 'rgba(47,157,107,0.75)';
  });
  const borders = rows.map(r => hexToColor(ltvColor(r.ltv)));

  destroyChart('ltv');
  const ctx = document.getElementById('ltv-chart').getContext('2d');
  STATE.charts.ltv = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'LTV %', data: values, backgroundColor: bgs, borderColor: borders, borderWidth: 1, borderRadius: 3 }]},
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' LTV: ' + c.parsed.x.toFixed(1) + '%' } },
        annotation: {},
      },
      scales: {
        x: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => v + '%' }, min: 0, max: 100 },
        y: { grid: { display: false }, ticks: { color: '#c7d0d6', font: { size: 10 }, autoSkip: false }, afterFit: s => { s.width = 180; } },
      },
    },
  });
}

function renderDSCRChart(data) {
  const rows = data.companies.map(companyRow)
    .filter(r => r.is_property && r.mortgages > 0 && r.dscr !== null)
    .sort((a, b) => b.dscr - a.dscr);

  const labels = rows.map(r => truncate(r.name, 24));
  const values = rows.map(r => r.dscr);
  const bgs = rows.map(r => {
    const c = dscrColor(r.dscr);
    return c === 'red' ? 'rgba(179,58,58,0.75)' : c === 'yellow' ? 'rgba(208,165,43,0.75)' : 'rgba(47,157,107,0.75)';
  });
  const borders = rows.map(r => hexToColor(dscrColor(r.dscr)));

  destroyChart('dscr');
  const ctx = document.getElementById('dscr-chart').getContext('2d');
  STATE.charts.dscr = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label: 'DSCR', data: values, backgroundColor: bgs, borderColor: borders, borderWidth: 1, borderRadius: 3 }]},
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltipStyle(), callbacks: { label: c => ' DSCR: ' + c.parsed.x.toFixed(2) + 'x' } },
      },
      scales: {
        x: { grid: { color: '#1f272d' }, ticks: { color: COLORS.textMuted, callback: v => v + 'x' } },
        y: { grid: { display: false }, ticks: { color: '#c7d0d6', font: { size: 10 }, autoSkip: false }, afterFit: s => { s.width = 180; } },
      },
    },
  });
}

/* ---------- Distributions page ---------- */
function renderDistributions(data) {
  const PERIODS = ['July', 'October', 'February', 'August', 'December'];
  const rows = data.companies
    .filter(c => c.distributions && (c.distributions.total_distributed > 0 || (c.distributions.periods && c.distributions.periods.length > 0)))
    .map(c => {
      const byPeriod = {};
      PERIODS.forEach(p => { byPeriod[p] = 0; });
      (c.distributions.periods || []).forEach(p => {
        if (p.month in byPeriod) byPeriod[p.month] += p.amount || 0;
        else byPeriod[p.month] = (byPeriod[p.month] || 0) + (p.amount || 0);
      });
      const total = c.distributions.total_distributed || PERIODS.reduce((s, p) => s + (byPeriod[p] || 0), 0);
      return { name: c.name, byPeriod, total };
    })
    .sort((a, b) => b.total - a.total);

  const tbody = document.getElementById('distributions-tbody');
  const tfoot = document.getElementById('distributions-tfoot');
  if (!tbody || !tfoot) return;

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="dim" style="text-align:center; padding: 24px;">No distributions recorded.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="company-name">${escapeHtml(r.name)}</td>
      ${PERIODS.map(p => {
        const v = r.byPeriod[p] || 0;
        return `<td class="num ${v > 0 ? '' : 'dim'}">${v > 0 ? fmtMoney(v) : '—'}</td>`;
      }).join('')}
      <td class="num your-equity">${fmtMoney(r.total)}</td>
    </tr>
  `).join('');

  const totals = PERIODS.map(p => rows.reduce((s, r) => s + (r.byPeriod[p] || 0), 0));
  const grand = rows.reduce((s, r) => s + r.total, 0);
  tfoot.innerHTML = `
    <tr>
      <td>Total</td>
      ${totals.map(t => `<td class="num">${t > 0 ? fmtMoney(t) : '—'}</td>`).join('')}
      <td class="num">${fmtMoney(grand)}</td>
    </tr>
  `;
}

/* ---------- Table page ---------- */
function renderTable(data) {
  const q = STATE.search.trim().toLowerCase();
  let rows = data.companies.map(companyRow);
  if (q) rows = rows.filter(r => r.name.toLowerCase().includes(q));

  const key = STATE.sortKey;
  const dir = STATE.sortDir === 'asc' ? 1 : -1;
  rows.sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    const an = av === null || av === undefined ? -Infinity : av;
    const bn = bv === null || bv === undefined ? -Infinity : bv;
    return (an - bn) * dir;
  });

  const tbody = document.getElementById('company-tbody');
  tbody.innerHTML = rows.map(r => {
    const niCls = r.ni2025 > 0 ? 'pos' : (r.ni2025 < 0 ? 'neg' : 'dim');
    const neCls = r.net_equity > 0 ? 'pos' : (r.net_equity < 0 ? 'neg' : 'dim');
    const ltvDotCls = r.ltv !== null ? ltvColor(r.ltv) : '';
    const dscrDotCls = r.dscr !== null ? dscrColor(r.dscr) : '';
    const typeIcon = r.is_property ? '' : '<span class="type-tag">OP</span>';

    const flagHtml = (r.flags || []).map(f => {
      const cls = flagBadgeClass(f);
      return `<span class="tbl-flag ${cls}" title="${escapeHtml(f)}"></span>`;
    }).join('');

    return `
      <tr>
        <td class="col-status"><span class="status-dot ${r.status}"></span></td>
        <td class="company-name">${escapeHtml(r.name)} ${typeIcon}</td>
        <td class="pct">${fmtPct(r.combined_pct)}</td>
        <td class="num">${fmtCell(r.r2022)}</td>
        <td class="num">${fmtCell(r.r2023)}</td>
        <td class="num">${fmtCell(r.r2024)}</td>
        <td class="num">${fmtCell(r.r2025)}</td>
        <td class="num">${fmtCell(r.r2026)}</td>
        <td class="num ${niCls}">${fmtCell(r.ni2025)}</td>
        <td class="num ${r.margin2025 !== null ? (r.margin2025 >= 0 ? 'pos' : 'neg') : 'dim'}">${r.margin2025 !== null ? r.margin2025.toFixed(1) + '%' : '—'}</td>
        <td class="num">${fmtCell(r.assets)}</td>
        <td class="num">${fmtCell(r.mortgages)}</td>
        <td class="num">${r.ltv !== null ? `<span class="status-dot ${ltvDotCls}" style="margin-right:6px;"></span>${r.ltv.toFixed(1)}%` : '<span class="dim">—</span>'}</td>
        <td class="num">${r.dscr !== null ? `<span class="status-dot ${dscrDotCls}" style="margin-right:6px;"></span>${r.dscr.toFixed(2)}x` : '<span class="dim">—</span>'}</td>
        <td class="num ${r.coc_return !== null ? (r.coc_return >= 10 ? 'pos' : r.coc_return < 0 ? 'neg' : '') : 'dim'}">${r.coc_return !== null ? r.coc_return.toFixed(1) + '%' : '—'}</td>
        <td class="num ${r.roe_return !== null ? (r.roe_return >= 8 ? 'pos' : r.roe_return < 0 ? 'neg' : '') : 'dim'}">${r.roe_return !== null ? r.roe_return.toFixed(1) + '%' : '—'}</td>
        <td class="num ${r.cap_rate !== null ? (r.cap_rate >= 6 ? 'pos' : '') : 'dim'}">${r.cap_rate !== null ? r.cap_rate.toFixed(1) + '%' : '—'}</td>
        <td class="num ${neCls}">${fmtCell(r.net_equity)}</td>
        <td class="num your-equity">${fmtCell(r.your_equity)}</td>
        <td><span class="tbl-flags">${flagHtml || '<span class="dim" style="font-size:10px;">—</span>'}</span></td>
      </tr>
    `;
  }).join('');
  document.getElementById('row-count').textContent = rows.length;

  document.querySelectorAll('#company-table thead th').forEach(th => {
    th.classList.remove('sort-active', 'sort-asc', 'sort-desc');
    if (th.dataset.sort === key) th.classList.add('sort-active', 'sort-' + STATE.sortDir);
  });
}

/* ---------- render dispatchers ---------- */
function renderPage(pageId, data) {
  if (pageId === 'overview') {
    renderKpis(data);
    renderNetWorthChart(data, 'nw-chart', 'nw');
    renderRevenueChart(data);
    renderEquityChart(data);
    renderYoYChart(data);
  } else if (pageId === 'properties') {
    renderProperties(data);
  } else if (pageId === 'analytics') {
    renderNetWorthChart(data, 'nw-chart-lg', 'nwLg');
    renderConcentration(data);
    renderTopEarners(data);
    renderReturnsChart(data);
    renderHeatmap(data);
  } else if (pageId === 'debt') {
    renderRiskKpis(data);
    renderLTVChart(data);
    renderDSCRChart(data);
  } else if (pageId === 'distributions') {
    renderDistributions(data);
  } else if (pageId === 'table') {
    renderTable(data);
  }
}

function renderViewDependent(data) {
  // Re-render things that depend on Total/Share toggle
  renderKpis(data);
  if (STATE.charts.revenue) renderRevenueChart(data);
  if (STATE.charts.yoy) renderYoYChart(data);
  if (STATE.page === 'properties') renderProperties(data);
  document.querySelectorAll('.view-label').forEach(el => {
    el.textContent = STATE.view === 'share' ? 'Your Share' : 'Total';
  });
}

function renderAll(data) {
  STATE.data = data;
  renderHeader(data);
  renderPage(STATE.page, data);
}

/* ---------- navigation ---------- */
function navigate(pageId) {
  if (!PAGE_TITLES[pageId]) pageId = 'overview';
  STATE.page = pageId;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const el = document.getElementById('page-' + pageId);
  if (el) {
    // trigger fade-in
    el.classList.add('active');
    el.style.opacity = '0';
    requestAnimationFrame(() => { el.style.opacity = '1'; });
  }

  document.querySelectorAll('.nav-item, .mtab').forEach(b => {
    b.classList.toggle('active', b.dataset.page === pageId);
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[pageId];

  if (STATE.data) renderPage(pageId, STATE.data);
}

/* ---------- events ---------- */
function wireEvents() {
  document.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      STATE.view = btn.dataset.view;
      if (STATE.data) renderViewDependent(STATE.data);
    });
  });

  document.getElementById('refresh-btn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    try {
      const d = await loadData();
      if (d) renderAll(d);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Refresh';
    }
  });

  document.getElementById('print-btn').addEventListener('click', async () => {
    // Pre-render all pages so charts appear in the printout
    if (STATE.data) {
      ['overview', 'analytics', 'debt', 'distributions', 'properties', 'table'].forEach(p => {
        const el = document.getElementById('page-' + p);
        if (el) el.classList.add('active');
      });
      // Let layout settle
      await new Promise(r => setTimeout(r, 50));
      renderPage('overview', STATE.data);
      renderPage('analytics', STATE.data);
      renderPage('debt', STATE.data);
      renderPage('distributions', STATE.data);
      renderPage('properties', STATE.data);
      renderPage('table', STATE.data);
      await new Promise(r => setTimeout(r, 250));
    }
    window.print();
    // Restore current page after print
    setTimeout(() => navigate(STATE.page), 200);
  });

  document.getElementById('sidebar-toggle').addEventListener('click', () => {
    const sb = document.getElementById('sidebar');
    sb.classList.toggle('collapsed');
    document.body.classList.toggle('sidebar-collapsed');
    // Charts need resize
    setTimeout(() => { Object.values(STATE.charts).forEach(c => c && c.resize()); }, 220);
  });

  document.querySelectorAll('.nav-item, .mtab').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.page));
  });

  document.querySelectorAll('#company-table thead th').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (!key) return;
      if (STATE.sortKey === key) STATE.sortDir = STATE.sortDir === 'asc' ? 'desc' : 'asc';
      else { STATE.sortKey = key; STATE.sortDir = key === 'name' ? 'asc' : 'desc'; }
      if (STATE.data) renderTable(STATE.data);
    });
  });

  const search = document.getElementById('search');
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      STATE.search = search.value;
      if (STATE.data) renderTable(STATE.data);
    }, 120);
  });
}

/* ---------- boot ---------- */
(async function init() {
  chartDefaults();
  wireEvents();
  const data = await loadData();
  if (data) renderAll(data);
})();
