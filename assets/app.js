// TP Radar — Dashboard logic

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// ── Formatting helpers ──────────────────────────────────────

function fmtMln(value) {
  if (value === null || value === undefined) return '—';
  const mln = value / 1_000_000;
  if (mln >= 1000) return (mln / 1000).toFixed(1).replace('.', ',') + ' mld';
  return mln.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' mln';
}

function fmtPct(value) {
  if (value === null || value === undefined) return '—';
  return value.toFixed(1) + '%';
}

function fmtDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

// ── Card rendering ──────────────────────────────────────────

function renderCard(company) {
  const f   = company.financials || {};
  const rpOp  = (company.related_party_flows || {}).operational || {};
  const rpFin = (company.related_party_flows || {}).financial   || {};
  const risk  = company.tp_risk || {};
  const aff   = company.group_affiliation || {};

  const level = risk.overall || 'LOW';
  const topRisks = (risk.top_risks || []).slice(0, 3);

  const groupMeta = [
    aff.group_name  || '',
    aff.parent_country ? `· ${aff.parent_country}` : '',
  ].filter(Boolean).join(' ');

  const rpPurchases = rpOp.purchases;
  const rpSales     = rpOp.sales;
  const rpLoans     = rpFin.loans_received_from_rp || rpFin.loans_granted;
  const rpGuarantees = rpFin.guarantees_issued;

  // Pick 2 most important RP flows for display
  const kpi1 = { val: fmtMln(f.revenue),    key: 'Przychody' };
  const kpi2 = { val: fmtMln(f.net_profit), key: 'Zysk netto' };

  const rpItems = [
    rpPurchases  ? { label: 'Zakupy RP',      val: fmtMln(rpPurchases) }  : null,
    rpSales      ? { label: 'Sprzedaż RP',    val: fmtMln(rpSales) }      : null,
    rpLoans      ? { label: 'Pożyczki RP',    val: fmtMln(rpLoans) }      : null,
    rpGuarantees ? { label: 'Gwarancje',      val: fmtMln(rpGuarantees) } : null,
  ].filter(Boolean).slice(0, 2);

  const riskItemsHtml = topRisks.map(r => `
    <li class="card-risk-item">
      <span class="ritem-name">${r.name}</span>
      <span class="ritem-badge ${r.level}">${r.level}</span>
    </li>
  `).join('');

  const rpItemsHtml = rpItems.map(rp => `
    <li class="card-risk-item">
      <span class="ritem-name">${rp.label}</span>
      <span style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted);flex-shrink:0">${rp.val}</span>
    </li>
  `).join('');

  return `
    <article class="card" data-risk="${level}" data-name="${company.name.toLowerCase()}"
             onclick="window.location='${company.report_file}'">
      <div class="card-stripe ${level}"></div>
      <div class="card-inner">

        <div class="card-top">
          <span class="risk-badge ${level}"><span class="risk-dot"></span>${level}</span>
          <span class="score-badge">${risk.score || 0}/10</span>
        </div>

        <div>
          <h2 class="card-name">${company.name}</h2>
          <p class="card-group">${groupMeta || 'Spółka niezależna'}</p>
        </div>

        <div class="card-kpis">
          <div class="kpi-tile">
            <div class="kpi-val">${kpi1.val}</div>
            <div class="kpi-key">${kpi1.key}</div>
          </div>
          <div class="kpi-tile">
            <div class="kpi-val">${kpi2.val}</div>
            <div class="kpi-key">${kpi2.key}</div>
          </div>
        </div>

        ${riskItemsHtml ? `<ul class="card-risks">${riskItemsHtml}</ul>` : ''}

        <div class="card-foot">
          <span class="card-krs">KRS ${company.krs}</span>
          <a class="card-link" href="${company.report_file}" onclick="event.stopPropagation()">Raport →</a>
        </div>

      </div>
    </article>
  `;
}

// ── Filter + Search ─────────────────────────────────────────

let allCompanies = [];

function filterAndRender() {
  const riskFilter = document.querySelector('.filter-chip.active')?.dataset.risk || 'all';
  const searchTerm = document.getElementById('search').value.toLowerCase().trim();

  let filtered = allCompanies.filter(c => {
    const matchRisk   = riskFilter === 'all' || (c.tp_risk || {}).overall === riskFilter;
    const matchSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm);
    return matchRisk && matchSearch;
  });

  filtered.sort((a, b) => {
    const ra = RISK_ORDER[(a.tp_risk || {}).overall] || 0;
    const rb = RISK_ORDER[(b.tp_risk || {}).overall] || 0;
    if (rb !== ra) return rb - ra;
    return (b.analyzed_at || '').localeCompare(a.analyzed_at || '');
  });

  const grid  = document.getElementById('grid');
  const count = document.getElementById('count');

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Brak wyników</h3>
        <p style="font-size:13px;margin-top:6px;">Zmień filtry lub dodaj nową spółkę.</p>
      </div>`;
  } else {
    grid.innerHTML = filtered.map(renderCard).join('');
  }

  // Empty slot — always at the end of the grid
  const emptySlot = document.createElement('div');
  emptySlot.className = 'card card-empty';
  emptySlot.innerHTML = `
    <span class="card-empty-icon">+</span>
    <span class="card-empty-label">Dodaj spółkę</span>
    <span class="card-empty-hint">analizuj [nazwa spółki]</span>
  `;
  grid.appendChild(emptySlot);

  count.textContent = `${filtered.length} / ${allCompanies.length}`;
}

// ── Init ─────────────────────────────────────────────────────

async function init() {
  try {
    const resp = await fetch(`companies.json?v=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    allCompanies = data.companies || [];

    // Update header stats — render stat pills into #page-stats
    const criticalCount = allCompanies.filter(c => (c.tp_risk || {}).overall === 'CRITICAL').length;
    const highCount     = allCompanies.filter(c => (c.tp_risk || {}).overall === 'HIGH').length;
    const mediumCount   = allCompanies.filter(c => (c.tp_risk || {}).overall === 'MEDIUM').length;
    const lowCount      = allCompanies.filter(c => (c.tp_risk || {}).overall === 'LOW').length;

    const statsEl = document.getElementById('page-stats');
    if (statsEl) {
      statsEl.innerHTML = `
        <div class="stat-pill">
          <span class="stat-dot" style="background:#888"></span>
          <span class="stat-num">${allCompanies.length}</span>
          <span class="stat-label">spółki</span>
        </div>
        ${criticalCount ? `<div class="stat-pill">
          <span class="stat-dot" style="background:#dc2626"></span>
          <span class="stat-num">${criticalCount}</span>
          <span class="stat-label">CRITICAL</span>
        </div>` : ''}
        ${highCount ? `<div class="stat-pill">
          <span class="stat-dot" style="background:#ea580c"></span>
          <span class="stat-num">${highCount}</span>
          <span class="stat-label">HIGH</span>
        </div>` : ''}
        ${mediumCount ? `<div class="stat-pill">
          <span class="stat-dot" style="background:#ca8a04"></span>
          <span class="stat-num">${mediumCount}</span>
          <span class="stat-label">MEDIUM</span>
        </div>` : ''}
        ${lowCount ? `<div class="stat-pill">
          <span class="stat-dot" style="background:#16a34a"></span>
          <span class="stat-num">${lowCount}</span>
          <span class="stat-label">LOW</span>
        </div>` : ''}
      `;
    }

    filterAndRender();
  } catch (err) {
    document.getElementById('grid').innerHTML = `
      <div class="empty-state">
        <h3>Błąd ładowania danych</h3>
        <p style="font-size:13px;margin-top:6px;">${err.message}</p>
      </div>`;
  }
}

document.getElementById('filter-chips').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  filterAndRender();
});
document.getElementById('search').addEventListener('input', filterAndRender);

document.getElementById('add-btn').addEventListener('click', () => {
  document.getElementById('modal').classList.add('active');
});

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('active');
});

document.getElementById('modal').addEventListener('click', e => {
  if (e.target === document.getElementById('modal'))
    document.getElementById('modal').classList.remove('active');
});

init();
