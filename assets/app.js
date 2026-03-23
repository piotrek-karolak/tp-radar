// TP Radar — Dashboard logic

const RISK_ORDER = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

// ── Formatting helpers ──────────────────────────────────────

function fmtMln(value) {
  if (value === null || value === undefined) return '—';
  return (value / 1_000_000).toFixed(1) + ' mln PLN';
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

function riskClass(level) {
  return (level || 'low').toLowerCase();
}

// ── Card rendering ──────────────────────────────────────────

function renderCard(company) {
  const f = company.financials || {};
  const rpOp = (company.related_party_flows || {}).operational || {};
  const rpFin = (company.related_party_flows || {}).financial || {};
  const risk = company.tp_risk || {};
  const group = company.group || {};
  const aff = company.group_affiliation || {};

  const riskPct = Math.round((risk.score || 0) / 10 * 100);
  const topRisks = (risk.top_risks || []).slice(0, 3);

  // Group meta line
  const groupMeta = [
    aff.group_name || '',
    aff.role || '',
    group.subsidiaries_count ? `${group.subsidiaries_count} spółek` : '',
    (group.countries || []).slice(0, 4).join(' · ')
  ].filter(Boolean).join(' · ');

  // Financial rows
  const hasPurchases = rpOp.purchases > 0;
  const hasSales = rpOp.sales > 0;
  const hasGuarantees = rpFin.guarantees_issued > 0;
  const hasLoans = rpFin.loans_granted > 0;

  return `
    <div class="card" data-risk="${risk.overall || 'LOW'}" data-name="${company.name.toLowerCase()}">
      <div class="card-header">
        <span class="risk-badge ${riskClass(risk.overall)}">${risk.overall || 'N/A'}</span>
        <div>
          <div class="company-name">${company.name}</div>
          <div class="company-meta">${groupMeta}</div>
        </div>
      </div>

      <div>
        <div class="card-section-label">Wyniki finansowe</div>
        <div class="financials-grid">
          <div class="fin-item">
            <div class="fin-label">Przychody</div>
            <div class="fin-value">${fmtMln(f.revenue)}</div>
          </div>
          <div class="fin-item">
            <div class="fin-label">Zysk operacyjny</div>
            <div class="fin-value">${fmtMln(f.operating_profit)}</div>
          </div>
          <div class="fin-item">
            <div class="fin-label">Marża EBIT</div>
            <div class="fin-value">${fmtPct(f.ebit_margin)}</div>
          </div>
          <div class="fin-item">
            <div class="fin-label">Zysk netto</div>
            <div class="fin-value">${fmtMln(f.net_profit)}</div>
          </div>
        </div>
      </div>

      <div>
        <div class="card-section-label">Transakcje z powiązanymi</div>
        ${hasPurchases ? `
        <div class="rp-row">
          <span class="rp-label">Zakupy ←</span>
          <span class="rp-value">${fmtMln(rpOp.purchases)}<span class="rp-pct">${rpOp.purchases_pct_revenue != null ? '(' + rpOp.purchases_pct_revenue.toFixed(0) + '% przychodów)' : ''}</span></span>
        </div>` : ''}
        ${hasSales ? `
        <div class="rp-row">
          <span class="rp-label">Sprzedaż →</span>
          <span class="rp-value">${fmtMln(rpOp.sales)}<span class="rp-pct">${rpOp.sales_pct_revenue != null ? '(' + rpOp.sales_pct_revenue.toFixed(0) + '% przychodów)' : ''}</span></span>
        </div>` : ''}
        ${hasGuarantees ? `
        <div class="rp-row">
          <span class="rp-label">Gwarancje</span>
          <span class="rp-value">${fmtMln(rpFin.guarantees_issued)}</span>
        </div>` : ''}
        ${hasLoans ? `
        <div class="rp-row">
          <span class="rp-label">Pożyczki</span>
          <span class="rp-value">${fmtMln(rpFin.loans_granted)}</span>
        </div>` : ''}
      </div>

      <div>
        <div class="card-section-label">Ryzyko TP</div>
        <div class="risk-meter">
          <div class="risk-bar-track">
            <div class="risk-bar-fill ${riskClass(risk.overall)}" style="width:${riskPct}%"></div>
          </div>
          <span class="risk-score-label" style="color:var(--${riskClass(risk.overall)}-color)">
            ${risk.score || 0}/10 · ${risk.overall || '—'}
          </span>
        </div>
        <div class="risk-items" style="margin-top:8px;">
          ${topRisks.map(r => `
            <div class="risk-item">
              <span class="ri-name">${r.name}</span>
              <span class="ri-level ${riskClass(r.level)}">${r.level}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card-footer">
        <span>Analiza: ${fmtDate(company.analyzed_at)}</span>
        <a href="${company.report_file}">Pełny raport →</a>
      </div>
    </div>
  `;
}

// ── Filter + Search ─────────────────────────────────────────

let allCompanies = [];

function filterAndRender() {
  const riskFilter = document.getElementById('filter-risk').value;
  const searchTerm = document.getElementById('search').value.toLowerCase().trim();

  let filtered = allCompanies.filter(c => {
    const matchRisk = riskFilter === 'all' || (c.tp_risk || {}).overall === riskFilter;
    const matchSearch = !searchTerm || c.name.toLowerCase().includes(searchTerm);
    return matchRisk && matchSearch;
  });

  // Sort by risk level descending, then by date descending
  filtered.sort((a, b) => {
    const ra = RISK_ORDER[(a.tp_risk || {}).overall] || 0;
    const rb = RISK_ORDER[(b.tp_risk || {}).overall] || 0;
    if (rb !== ra) return rb - ra;
    return (b.analyzed_at || '').localeCompare(a.analyzed_at || '');
  });

  const grid = document.getElementById('grid');
  const count = document.getElementById('count');

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <h3>Brak wyników</h3>
        <p>Zmień filtry lub dodaj nową spółkę.</p>
      </div>
    `;
  } else {
    grid.innerHTML = filtered.map(renderCard).join('');
  }

  count.textContent = `${filtered.length} z ${allCompanies.length} spółek`;
}

// ── Init ─────────────────────────────────────────────────────

async function init() {
  try {
    // Add cache-buster so GitHub Pages always fetches fresh data
    const resp = await fetch(`companies.json?v=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    allCompanies = data.companies || [];

    // Update header stats
    const stats = document.getElementById('stats');
    const criticalCount = allCompanies.filter(c => (c.tp_risk || {}).overall === 'CRITICAL').length;
    const highCount = allCompanies.filter(c => (c.tp_risk || {}).overall === 'HIGH').length;
    stats.textContent = `${allCompanies.length} spółek w bazie · ${criticalCount} CRITICAL · ${highCount} HIGH`;

    filterAndRender();
  } catch (err) {
    document.getElementById('grid').innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <h3>Błąd ładowania danych</h3>
        <p>${err.message}</p>
      </div>
    `;
  }
}

// Event listeners
document.getElementById('filter-risk').addEventListener('change', filterAndRender);
document.getElementById('search').addEventListener('input', filterAndRender);

document.getElementById('add-btn').addEventListener('click', () => {
  document.getElementById('modal').classList.add('active');
});

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('active');
});

document.getElementById('modal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal')) {
    document.getElementById('modal').classList.remove('active');
  }
});

init();
