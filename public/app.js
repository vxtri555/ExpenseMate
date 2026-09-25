/* ExpenseMate – frontend logic
 * Works in two modes:
 *  1. Online  – talks to the Node/Express + MongoDB backend (/api/...)
 *  2. Offline – if the backend is not running, data is saved in the browser (localStorage)
 */

const CATEGORIES = {
  Food:          { icon: '🍔', color: '#f97316' },
  Transport:     { icon: '🚌', color: '#0ea5e9' },
  Shopping:      { icon: '🛍️', color: '#ec4899' },
  Bills:         { icon: '💡', color: '#eab308' },
  Entertainment: { icon: '🎬', color: '#8b5cf6' },
  Health:        { icon: '💊', color: '#10b981' },
  Education:     { icon: '📚', color: '#6366f1' },
  Other:         { icon: '📦', color: '#64748b' },
};
const API = '/api';
const state = { online: false, expenses: [], allExpenses: [], budget: 0, month: '', charts: {} };

// ---------- Helpers ----------
const $ = (id) => document.getElementById(id);
const rupee = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const monthKey = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };
const toInputDate = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const idOf = (e) => e._id || e.id;

function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.className = 'toast'), 2600);
}

// ---------- Data layer ----------
const local = {
  read: () => JSON.parse(localStorage.getItem('em_expenses') || '[]'),
  write: (list) => localStorage.setItem('em_expenses', JSON.stringify(list)),
  budgets: () => JSON.parse(localStorage.getItem('em_budgets') || '{}'),
};

async function api(path, options = {}) {
  const res = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function detectBackend() {
  try {
    const h = await api('/health');
    state.online = !!h.db;
  } catch { state.online = false; }
  const badge = $('modeBadge');
  badge.textContent = state.online ? '● MongoDB connected' : '● Offline mode';
  badge.title = state.online ? 'Data is saved in MongoDB Atlas' : 'Backend not running - data is saved on this device';
  badge.className = 'mode-badge ' + (state.online ? 'online' : 'offline');
}

async function loadAll() {
  if (state.online) {
    state.allExpenses = await api('/expenses');
    const b = await api('/budget/' + state.month);
    state.budget = b.amount || 0;
  } else {
    state.allExpenses = local.read();
    state.budget = local.budgets()[state.month] || 0;
  }
  state.expenses = state.allExpenses.filter((e) => monthKey(e.date) === state.month);
}

async function saveExpense(data, id) {
  if (state.online) {
    return id ? api('/expenses/' + id, { method: 'PUT', body: JSON.stringify(data) })
              : api('/expenses', { method: 'POST', body: JSON.stringify(data) });
  }
  const list = local.read();
  if (id) {
    const i = list.findIndex((e) => e.id === id);
    list[i] = { ...list[i], ...data };
  } else {
    list.push({ ...data, id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) });
  }
  local.write(list);
}

async function deleteExpense(id) {
  if (state.online) return api('/expenses/' + id, { method: 'DELETE' });
  local.write(local.read().filter((e) => e.id !== id));
}

async function saveBudget(amount) {
  if (state.online) return api('/budget/' + state.month, { method: 'PUT', body: JSON.stringify({ amount }) });
  const b = local.budgets(); b[state.month] = amount;
  localStorage.setItem('em_budgets', JSON.stringify(b));
}

// Demo data for offline first run, so the dashboard is not empty
function seedDemo() {
  if (localStorage.getItem('em_seeded')) return;
  const now = new Date();
  const items = [
    ['Canteen lunch', 120, 'Food', 'UPI'], ['Bus pass', 450, 'Transport', 'Cash'], ['Mobile recharge', 299, 'Bills', 'UPI'],
    ['Movie with friends', 380, 'Entertainment', 'Card'], ['Notebooks & pens', 210, 'Education', 'Cash'], ['Dinner - biryani', 260, 'Food', 'UPI'],
    ['T-shirt', 699, 'Shopping', 'Card'], ['Medicines', 180, 'Health', 'UPI'], ['Auto to college', 90, 'Transport', 'UPI'],
    ['Coffee & snacks', 75, 'Food', 'Cash'], ['Online course', 499, 'Education', 'Net Banking'], ['Electricity share', 650, 'Bills', 'UPI'],
  ];
  const list = [];
  items.forEach(([title, amount, category, paymentMethod], i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - i * 2));
    list.push({ id: 'demo' + i, title, amount, category, paymentMethod, date: toInputDate(d), note: '' });
  });
  for (let m = 1; m <= 5; m++) {
    ['Food', 'Transport', 'Bills', 'Shopping'].forEach((c, j) => {
      list.push({ id: `demo-${m}-${j}`, title: c + ' expenses', amount: 400 + Math.round(Math.random() * 900), category: c,
        paymentMethod: 'UPI', date: toInputDate(new Date(now.getFullYear(), now.getMonth() - m, 5 + j * 5)), note: '' });
    });
  }
  local.write(list);
  const b = local.budgets(); b[monthKey(now)] = 6000;
  localStorage.setItem('em_budgets', JSON.stringify(b));
  localStorage.setItem('em_seeded', '1');
}

// ---------- Rendering ----------
function render() {
  renderDashboard();
  renderTable();
  renderBudget();
  renderReports();
}

function totals() {
  const total = state.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const byCat = {};
  state.expenses.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount)));
  return { total, byCat };
}

function daysInView() {
  const [y, m] = state.month.split('-').map(Number);
  const now = new Date();
  const dim = new Date(y, m, 0).getDate();
  return (y === now.getFullYear() && m === now.getMonth() + 1) ? now.getDate() : dim;
}

function txHtml(e) {
  const c = CATEGORIES[e.category] || CATEGORIES.Other;
  return `<div class="tx">
    <div class="tx-icon" style="background:${c.color}1f">${c.icon}</div>
    <div class="tx-info"><b>${escapeHtml(e.title)}</b><span>${e.category} · ${fmtDate(e.date)} · ${e.paymentMethod || ''}</span></div>
    <div class="tx-amt">-${rupee(e.amount)}</div></div>`;
}

function renderDashboard() {
  const { total, byCat } = totals();
  $('statTotal').textContent = rupee(total);
  $('statCount').textContent = `${state.expenses.length} transactions`;
  $('statAvg').textContent = rupee(Math.round(total / daysInView()));
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  $('statTop').textContent = top ? `${CATEGORIES[top[0]].icon} ${top[0]}` : '—';
  $('statTopAmt').textContent = top ? rupee(top[1]) : ' ';

  const b = state.budget;
  const pct = b ? Math.round((total / b) * 100) : 0;
  $('statLeft').textContent = b ? rupee(Math.max(b - total, 0)) : '—';
  $('statBudget').textContent = b ? `of ${rupee(b)} budget` : 'No budget set';
  $('budgetPct').textContent = b ? pct + '%' : '—';
  const bar = $('budgetBar');
  bar.style.width = Math.min(pct, 100) + '%';
  bar.className = 'progress-bar' + (pct >= 100 ? ' over' : pct >= 80 ? ' warn' : '');
  $('budgetMsg').textContent = !b ? 'Set a budget in the Budget tab to track your limit.'
    : pct >= 100 ? `⚠️ You are over budget by ${rupee(total - b)}.`
    : pct >= 80 ? `Careful - only ${rupee(b - total)} left this month.`
    : `Great! You still have ${rupee(b - total)} to spend this month.`;

  const recent = [...state.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  $('recentList').innerHTML = recent.length ? recent.map(txHtml).join('') : '<p class="muted small">No transactions this month yet.</p>';

  // Category doughnut
  const labels = Object.keys(byCat);
  drawChart('categoryChart', {
    type: 'doughnut',
    data: { labels, datasets: [{ data: labels.map((l) => byCat[l]), backgroundColor: labels.map((l) => CATEGORIES[l].color), borderWidth: 0 }] },
    options: { cutout: '68%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, padding: 10 } } } },
  });

  // Daily trend
  const [y, m] = state.month.split('-').map(Number);
  const dim = new Date(y, m, 0).getDate();
  const daily = Array(dim).fill(0);
  state.expenses.forEach((e) => (daily[new Date(e.date).getDate() - 1] += Number(e.amount)));
  drawChart('trendChart', {
    type: 'bar',
    data: { labels: daily.map((_, i) => i + 1), datasets: [{ data: daily, backgroundColor: '#6366f1', borderRadius: 4, maxBarThickness: 14 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
  });
}

function renderTable() {
  const q = $('searchInput').value.trim().toLowerCase();
  const cat = $('categoryFilter').value;
  const sort = $('sortSelect').value;
  const from = $('fromDate').value, to = $('toDate').value;
  // With a date range set, search across ALL months; otherwise show the selected month
  const base = from || to
    ? state.allExpenses.filter((e) => { const d = toInputDate(e.date); return (!from || d >= from) && (!to || d <= to); })
    : state.expenses;
  let rows = base.filter((e) => (cat === 'All' || e.category === cat) && e.title.toLowerCase().includes(q));
  state.filtered = rows;
  const sum = rows.reduce((s, e) => s + Number(e.amount), 0);
  $('rangeInfo').textContent = rows.length ? `Showing ${rows.length} expenses · Total ${rupee(sum)}` + (from || to ? ` · ${from || 'start'} to ${to || 'today'}` : '') : '';
  rows.sort((a, b) => {
    if (sort === 'date-asc') return new Date(a.date) - new Date(b.date);
    if (sort === 'amount-desc') return b.amount - a.amount;
    if (sort === 'amount-asc') return a.amount - b.amount;
    return new Date(b.date) - new Date(a.date);
  });
  let lastDay = '';
  $('expenseTable').innerHTML = rows.map((e) => {
    const c = CATEGORIES[e.category] || CATEGORIES.Other;
    const day = fmtDate(e.date);
    const head = sort.startsWith('date') && day !== lastDay ? `<p class="day-label">${day}</p>` : '';
    lastDay = day;
    return `${head}<div class="tx">
      <div class="tx-icon" style="background:${c.color}1f">${c.icon}</div>
      <div class="tx-info"><b>${escapeHtml(e.title)}</b>
        <span>${e.category} · ${e.paymentMethod || '-'}${sort.startsWith('date') ? '' : ' · ' + day}</span>
        ${e.note ? `<span style="display:block">📝 ${escapeHtml(e.note)}</span>` : ''}</div>
      <div class="tx-right"><div class="tx-amt">-${rupee(e.amount)}</div>
        <div class="tx-actions">
          <button class="mini-btn" data-edit="${idOf(e)}">Edit</button>
          <button class="mini-btn del" data-del="${idOf(e)}">Delete</button>
        </div></div></div>`;
  }).join('');
  $('emptyState').style.display = rows.length ? 'none' : 'block';
}

function renderBudget() {
  const { total, byCat } = totals();
  const b = state.budget;
  const pct = b ? Math.round((total / b) * 100) : 0;
  const [y, m] = state.month.split('-').map(Number);
  $('budgetMonthLabel').textContent = new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  $('budgetInput').value = b || '';
  const color = pct >= 100 ? 'var(--danger)' : pct >= 80 ? 'var(--warning)' : 'var(--primary)';
  $('budgetRing').style.background = `conic-gradient(${color} ${Math.min(pct, 100) * 3.6}deg, var(--border) 0deg)`;
  $('ringText').textContent = b ? pct + '%' : '—';
  $('ringSpent').textContent = rupee(total);
  $('ringOf').textContent = b ? `of ${rupee(b)}` : 'No budget set';
  const st = $('ringStatus');
  st.textContent = !b ? 'Set a budget to start' : pct >= 100 ? 'Over budget' : pct >= 80 ? 'Almost at limit' : 'On track';
  st.className = 'status ' + (pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok');

  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  $('categoryBreakdown').innerHTML = entries.length ? entries.map(([c, amt]) => {
    const share = total ? Math.round((amt / total) * 100) : 0;
    return `<div class="cat-row"><div class="row-between"><span>${CATEGORIES[c].icon} ${c}</span><span><b>${rupee(amt)}</b> <span class="muted">· ${share}%</span></span></div>
      <div class="progress"><div class="progress-bar" style="width:${share}%;background:${CATEGORIES[c].color}"></div></div></div>`;
  }).join('') : '<p class="muted small">No spending this month yet.</p>';
}

function renderReports() {
  // last 6 months totals
  const [y, m] = state.month.split('-').map(Number);
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(monthKey(new Date(y, m - 1 - i, 1)));
  const sums = months.map((k) => state.allExpenses.filter((e) => monthKey(e.date) === k).reduce((s, e) => s + Number(e.amount), 0));
  drawChart('monthlyChart', {
    type: 'bar',
    data: { labels: months.map((k) => new Date(k + '-01').toLocaleDateString('en-IN', { month: 'short' })),
      datasets: [{ data: sums, backgroundColor: months.map((k) => (k === state.month ? '#4f46e5' : '#c7d2fe')), borderRadius: 8 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
  });

  const pay = {};
  state.expenses.forEach((e) => (pay[e.paymentMethod || 'Other'] = (pay[e.paymentMethod || 'Other'] || 0) + Number(e.amount)));
  drawChart('paymentChart', {
    type: 'pie',
    data: { labels: Object.keys(pay), datasets: [{ data: Object.values(pay), backgroundColor: ['#4f46e5', '#10b981', '#f59e0b', '#ec4899'], borderWidth: 0 }] },
    options: { plugins: { legend: { position: 'right', labels: { boxWidth: 12 } } } },
  });

  // Insights
  const { total, byCat } = totals();
  const prev = sums[4];
  const tips = [];
  if (!state.expenses.length) tips.push('No expenses this month yet. Add your first one to see insights.');
  else {
    const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    tips.push(`${CATEGORIES[top[0]].icon} Most of your money went to <b>${top[0]}</b> (${Math.round((top[1] / total) * 100)}% of spending).`);
    if (prev) {
      const diff = Math.round(((total - prev) / prev) * 100);
      tips.push(diff > 0 ? `📈 You spent <b>${diff}% more</b> than last month.` : `📉 Nice! You spent <b>${Math.abs(diff)}% less</b> than last month.`);
    }
    const big = [...state.expenses].sort((a, b) => b.amount - a.amount)[0];
    tips.push(`💸 Biggest single expense: <b>${escapeHtml(big.title)}</b> (${rupee(big.amount)}).`);
    if (state.budget) {
      const dim = new Date(y, m, 0).getDate();
      const projected = Math.round((total / daysInView()) * dim);
      tips.push(projected > state.budget ? `⚠️ At this pace you will spend about <b>${rupee(projected)}</b> - above your budget.` : `✅ At this pace you will finish around <b>${rupee(projected)}</b>, within budget.`);
    }
  }
  $('insights').innerHTML = tips.map((t) => `<li>${t}</li>`).join('');
}

function drawChart(id, config) {
  if (typeof Chart === 'undefined') return; // Chart.js not loaded (no internet)
  // Only draw charts on the visible screen (hidden canvases have no size)
  if (!$(id).closest('.view').classList.contains('active')) return;
  const dark = document.body.classList.contains('dark');
  Chart.defaults.color = dark ? '#94a3b8' : '#64748b';
  Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
  Chart.defaults.borderColor = dark ? '#1f2937' : '#e2e8f0';
  if (state.charts[id]) state.charts[id].destroy();
  config.options = { responsive: true, maintainAspectRatio: false, animation: { duration: 500 }, ...config.options };
  state.charts[id] = new Chart($(id), config);
}

// ---------- Modal ----------
function openModal(expense) {
  $('expenseForm').reset();
  $('modalTitle').textContent = expense ? 'Edit Expense' : 'Add Expense';
  $('expenseId').value = expense ? idOf(expense) : '';
  $('fTitle').value = expense ? expense.title : '';
  $('fAmount').value = expense ? expense.amount : '';
  $('fDate').value = expense ? toInputDate(expense.date) : toInputDate(new Date());
  $('fCategory').value = expense ? expense.category : 'Food';
  $('fPayment').value = expense ? expense.paymentMethod : 'UPI';
  $('fNote').value = expense ? expense.note || '' : '';
  selectCat($('fCategory').value);
  $('modal').classList.add('show');
  setTimeout(() => $('fTitle').focus(), 50);
}
const closeModal = () => $('modal').classList.remove('show');
function selectCat(c) {
  $('fCategory').value = c;
  document.querySelectorAll('.cat-opt').forEach((b) => b.classList.toggle('active', b.dataset.cat === c));
}
function selectChip(c) {
  $('categoryFilter').value = c;
  document.querySelectorAll('.chip').forEach((b) => b.classList.toggle('active', b.dataset.cat === c));
  renderTable();
}

// ---------- CSV export ----------
function exportCSV() {
  const data = state.filtered || state.expenses;
  if (!data.length) return toast('Nothing to export', true);
  const header = ['Title', 'Amount', 'Category', 'Date', 'Payment', 'Note'];
  const lines = data.map((e) => [e.title, e.amount, e.category, toInputDate(e.date), e.paymentMethod, e.note || '']
    .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expensemate-${state.month}.csv`;
  a.click();
  toast('CSV downloaded');
}

// ---------- Events ----------
function switchView(view) {
  document.querySelectorAll('.nav-link').forEach((l) => l.classList.toggle('active', l.dataset.view === view));
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + view));
  $('viewTitle').textContent = { dashboard: 'ExpenseMate', expenses: 'Expenses', budget: 'Budget', reports: 'Reports' }[view];
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render(); // redraw charts at correct size
}

async function refresh() {
  try { await loadAll(); render(); } catch (err) { toast(err.message, true); }
}

function bindEvents() {
  document.querySelectorAll('.nav-link').forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); switchView(l.dataset.view); }));
  document.querySelectorAll('[data-goto]').forEach((l) => l.addEventListener('click', (e) => { e.preventDefault(); switchView(l.dataset.goto); }));
  $('filterToggle').onclick = () => $('filterPanel').classList.toggle('open');
  $('clearFilters').onclick = () => { $('fromDate').value = ''; $('toDate').value = ''; $('searchInput').value = ''; $('sortSelect').value = 'date-desc'; selectChip('All'); };
  $('catGrid').addEventListener('click', (e) => { const b = e.target.closest('.cat-opt'); if (b) selectCat(b.dataset.cat); });
  $('categoryChips').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) selectChip(b.dataset.cat); });
  document.querySelectorAll('[data-amt]').forEach((b) => (b.onclick = () => ($('budgetInput').value = b.dataset.amt)));
  $('addBtn').onclick = () => openModal();
  $('closeModal').onclick = closeModal;
  $('cancelBtn').onclick = closeModal;
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  $('monthPicker').onchange = (e) => { state.month = e.target.value; refresh(); };
  ['searchInput', 'categoryFilter', 'sortSelect', 'fromDate', 'toDate'].forEach((id) => $(id).addEventListener('input', renderTable));
  $('exportBtn').onclick = exportCSV;

  $('expenseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      title: $('fTitle').value.trim(),
      amount: parseFloat($('fAmount').value),
      date: $('fDate').value,
      category: $('fCategory').value,
      paymentMethod: $('fPayment').value,
      note: $('fNote').value.trim(),
    };
    if (!data.title || !(data.amount > 0)) return toast('Please enter a title and a valid amount', true);
    const id = $('expenseId').value;
    try {
      await saveExpense(data, id);
      closeModal();
      toast(id ? 'Expense updated ✓' : 'Expense added ✓');
      refresh();
    } catch (err) { toast(err.message, true); }
  });

  $('expenseTable').addEventListener('click', async (e) => {
    const editId = e.target.dataset.edit, delId = e.target.dataset.del;
    if (editId) openModal(state.allExpenses.find((x) => String(idOf(x)) === editId));
    if (delId && confirm('Delete this expense?')) {
      try { await deleteExpense(delId); toast('Expense deleted'); refresh(); } catch (err) { toast(err.message, true); }
    }
  });

  $('budgetForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await saveBudget(Number($('budgetInput').value)); toast('Budget saved ✓'); refresh(); } catch (err) { toast(err.message, true); }
  });

  $('themeToggle').onclick = () => {
    const dark = document.body.classList.toggle('dark');
    localStorage.setItem('em_theme', dark ? 'dark' : 'light');
    $('themeToggle').textContent = dark ? '☀️' : '🌙';
    document.querySelector('meta[name=theme-color]').content = dark ? '#0b1020' : '#4f46e5';
    render();
  };
}

// ---------- Init ----------
(async function init() {
  if (localStorage.getItem('em_theme') === 'dark') { document.body.classList.add('dark'); $('themeToggle').textContent = '☀️'; }
  const opts = Object.keys(CATEGORIES).map((c) => `<option value="${c}">${CATEGORIES[c].icon} ${c}</option>`).join('');
  $('fCategory').innerHTML = opts;
  $('categoryFilter').innerHTML = '<option value="All">All categories</option>' + opts;
  $('catGrid').innerHTML = Object.keys(CATEGORIES).map((c) => `<button type="button" class="cat-opt" data-cat="${c}"><span>${CATEGORIES[c].icon}</span>${c}</button>`).join('');
  $('categoryChips').innerHTML = '<button class="chip active" data-cat="All">All</button>' +
    Object.keys(CATEGORIES).map((c) => `<button class="chip" data-cat="${c}">${CATEGORIES[c].icon} ${c}</button>`).join('');
  state.month = monthKey(new Date());
  $('monthPicker').value = state.month;
  const h = new Date().getHours();
  $('greeting').textContent = (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ' 👋';
  bindEvents();
  await detectBackend();
  if (!state.online) seedDemo();
  refresh();
})();

// ---------- PWA: install + offline ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => toast('ExpenseMate installed 🎉'));
