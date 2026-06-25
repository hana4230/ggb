const SUPABASE_URL = 'https://ojocvcucyqsvqjgrgeqf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fx0ITj_6Fxfx4SPdV_9h2g_ONqrUIEG';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const CATEGORIES = {
  income: ['급여', '용돈', '부수입', '기타수입'],
  expense: ['식비', '교통', '주거', '문화/여가', '의료', '교육', '쇼핑', '기타지출']
};
const CATEGORY_COLORS = ['#4263eb','#2e8b57','#e0533d','#f0a500','#9b59b6','#16a085','#e67e22','#7f8c8d'];

let entries = [];
let currentType = 'income';

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n).toLocaleString('ko-KR') + '원';

async function fetchEntries() {
  const { data, error } = await db.from('entries').select('*').order('date', { ascending: false });
  if (error) {
    alert('데이터를 불러오지 못했습니다: ' + error.message);
    return;
  }
  entries = data.map(e => ({ ...e, amount: Number(e.amount) }));
}

function refreshCategoryOptions() {
  const sel = $('fCategory');
  sel.innerHTML = CATEGORIES[currentType].map(c => `<option value="${c}">${c}</option>`).join('');
}

document.querySelectorAll('.type-toggle button').forEach(btn => {
  btn.addEventListener('click', () => {
    currentType = btn.dataset.type;
    document.querySelectorAll('.type-toggle button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    refreshCategoryOptions();
  });
});

function monthKey(dateStr) {
  return dateStr.slice(0, 7); // YYYY-MM
}

function populateMonthFilter() {
  const months = Array.from(new Set(entries.map(e => monthKey(e.date)))).sort().reverse();
  const current = monthKey(new Date().toISOString().slice(0, 10));
  if (!months.includes(current)) months.unshift(current);
  const sel = $('filterMonth');
  const prevVal = sel.value || current;
  sel.innerHTML = months.map(m => `<option value="${m}">${m}</option>`).join('');
  sel.value = months.includes(prevVal) ? prevVal : current;
}

function renderSummary() {
  const month = $('filterMonth').value;
  const monthEntries = entries.filter(e => monthKey(e.date) === month);
  const income = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const expense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
  $('sumIncome').textContent = fmt(income);
  $('sumExpense').textContent = fmt(expense);
  $('sumBalance').textContent = fmt(income - expense);
}

function renderTable() {
  const month = $('filterMonth').value;
  const type = $('filterType').value;
  let list = entries.filter(e => monthKey(e.date) === month);
  if (type !== 'all') list = list.filter(e => e.type === type);
  list.sort((a, b) => b.date.localeCompare(a.date));

  const tbody = $('tableBody');
  tbody.innerHTML = list.map(e => `
    <tr>
      <td>${e.date}</td>
      <td>${e.type === 'income' ? '수입' : '지출'}</td>
      <td>${e.category}</td>
      <td>${e.memo || ''}</td>
      <td class="amount ${e.type}">${e.type === 'income' ? '+' : '-'}${fmt(e.amount)}</td>
      <td class="actions">
        <button data-action="edit" data-id="${e.id}">수정</button>
        <button data-action="delete" data-id="${e.id}">삭제</button>
      </td>
    </tr>
  `).join('');
  $('emptyMsg').style.display = list.length ? 'none' : 'block';
}

function renderChart() {
  const month = $('filterMonth').value;
  const expenses = entries.filter(e => e.type === 'expense' && monthKey(e.date) === month);
  const totals = {};
  expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + e.amount; });
  const cats = Object.keys(totals);
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  const svg = $('pieChart');
  const legend = $('legend');

  if (!total) {
    svg.innerHTML = `<circle cx="50" cy="50" r="45" fill="#eef0f3"></circle>`;
    legend.innerHTML = `<div style="color:var(--muted);">지출 내역이 없습니다.</div>`;
    return;
  }

  let angleStart = -90;
  let paths = '';
  let legendHtml = '';
  cats.forEach((cat, i) => {
    const value = totals[cat];
    const angle = (value / total) * 360;
    const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
    const x1 = 50 + 45 * Math.cos((angleStart * Math.PI) / 180);
    const y1 = 50 + 45 * Math.sin((angleStart * Math.PI) / 180);
    const angleEnd = angleStart + angle;
    const x2 = 50 + 45 * Math.cos((angleEnd * Math.PI) / 180);
    const y2 = 50 + 45 * Math.sin((angleEnd * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    paths += `<path d="M50,50 L${x1},${y1} A45,45 0 ${largeArc} 1 ${x2},${y2} Z" fill="${color}"></path>`;
    const pct = ((value / total) * 100).toFixed(1);
    legendHtml += `<div class="row"><span class="swatch" style="background:${color}"></span>${cat} - ${fmt(value)} (${pct}%)</div>`;
    angleStart = angleEnd;
  });
  svg.innerHTML = paths;
  legend.innerHTML = legendHtml;
}

function renderAll() {
  populateMonthFilter();
  renderSummary();
  renderTable();
  renderChart();
}

$('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('editId').value;
  const date = $('fDate').value;
  const category = $('fCategory').value;
  const amount = parseFloat($('fAmount').value);
  const memo = $('fMemo').value.trim();

  if (!date || !category || !amount || amount <= 0) return;

  $('submitBtn').disabled = true;
  let error;
  if (id) {
    ({ error } = await db.from('entries').update({
      type: currentType, date, category, amount, memo
    }).eq('id', id));
  } else {
    ({ error } = await db.from('entries').insert({
      type: currentType, date, category, amount, memo
    }));
  }
  $('submitBtn').disabled = false;

  if (error) {
    alert('저장에 실패했습니다: ' + error.message);
    return;
  }

  await fetchEntries();
  resetForm();
  renderAll();
});

function resetForm() {
  $('editId').value = '';
  $('fDate').value = '';
  $('fAmount').value = '';
  $('fMemo').value = '';
  $('submitBtn').textContent = '추가';
}

$('tableBody').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  if (action === 'delete') {
    if (confirm('이 내역을 삭제할까요?')) {
      const { error } = await db.from('entries').delete().eq('id', id);
      if (error) {
        alert('삭제에 실패했습니다: ' + error.message);
        return;
      }
      await fetchEntries();
      renderAll();
    }
  } else if (action === 'edit') {
    const entry = entries.find(en => en.id === id);
    if (!entry) return;
    currentType = entry.type;
    document.querySelectorAll('.type-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.type === entry.type);
    });
    refreshCategoryOptions();
    $('fDate').value = entry.date;
    $('fCategory').value = entry.category;
    $('fAmount').value = entry.amount;
    $('fMemo').value = entry.memo;
    $('editId').value = entry.id;
    $('submitBtn').textContent = '수정 완료';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
});

$('filterMonth').addEventListener('change', () => { renderSummary(); renderTable(); renderChart(); });
$('filterType').addEventListener('change', renderTable);

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

$('btnExport').addEventListener('click', () => {
  downloadJSON(entries, `가계부_${new Date().toISOString().slice(0, 10)}.json`);
});

$('btnImportTrigger').addEventListener('click', () => $('fileImport').click());

$('fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error('invalid');
      const rows = imported.map(({ type, date, category, amount, memo }) => ({
        type, date, category, amount, memo: memo || ''
      }));
      const mode = confirm('기존 내역에 추가하려면 확인, 전체 교체하려면 취소를 누르세요.') ? 'merge' : 'replace';
      if (mode === 'replace') {
        const { error: delError } = await db.from('entries').delete().not('id', 'is', null);
        if (delError) throw delError;
      }
      if (rows.length) {
        const { error: insError } = await db.from('entries').insert(rows);
        if (insError) throw insError;
      }
      await fetchEntries();
      renderAll();
      alert('가져오기가 완료되었습니다.');
    } catch (err) {
      alert('가져오기에 실패했습니다: ' + (err.message || ''));
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('btnShareLink').addEventListener('click', () => {
  const url = `${location.origin}${location.pathname}`;
  $('shareLinkInput').value = url;
  $('shareLinkBox').style.display = 'block';
  navigator.clipboard?.writeText(url).catch(() => {});
});

async function init() {
  refreshCategoryOptions();
  $('fDate').value = new Date().toISOString().slice(0, 10);
  await fetchEntries();
  renderAll();
}

init();
