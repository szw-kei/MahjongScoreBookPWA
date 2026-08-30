const STORAGE_KEY = 'mahjongScoreBookPWA.v2';
const DEFAULT_STATE = {
  players: ['', '', '', ''],
  playerCount: 4,
  companyMode: false,
  rate: 50,
  matches: []
};

let state = loadState();
let calcContext = null;
let calcText = '0';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    const saved = JSON.parse(raw);
    const result = { ...structuredClone(DEFAULT_STATE), ...saved };
    result.players = Array.isArray(saved.players) ? saved.players.slice(0, 4) : [...DEFAULT_STATE.players];
    while (result.players.length < 4) result.players.push('');
    result.matches = Array.isArray(saved.matches) ? saved.matches : [];
    result.rate = Number.isFinite(Number(result.rate)) ? Number(result.rate) : 50;
    if (result.playerCount === 3) result.companyMode = false;
    result.matches.forEach(row => normalizeRow(row, result.playerCount, result.companyMode));
    return result;
  } catch (error) {
    console.error(error);
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeRow(row, count, companyMode) {
  row.scores = Array.from({ length: count }, (_, i) => row.scores?.[i] ?? '');
  row.uma = Array.from({ length: count }, (_, i) => row.uma?.[i] ?? (companyMode ? '' : 0));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function formatNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
}

function formatUma(value) {
  const number = Number(value) || 0;
  if (number > 0) return `○${formatNumber(number)}`;
  if (number < 0) return `×${formatNumber(Math.abs(number))}`;
  return '0';
}

function autoCorrect(values) {
  const numbers = values.map(value => value === '' || value == null ? null : Number(value));
  const missing = numbers.filter(value => value === null).length;

  if (missing === 1) {
    const sum = numbers.reduce((total, value) => total + (value ?? 0), 0);
    return numbers.map(value => value === null ? -sum : value);
  }

  if (missing === 0) {
    const sum = numbers.reduce((total, value) => total + value, 0);
    if (sum !== 0) {
      const max = Math.max(...numbers);
      const index = numbers.indexOf(max);
      numbers[index] -= sum;
    }
  }

  return numbers;
}

function addMatch() {
  const count = state.playerCount;
  state.matches.push({
    scores: Array(count).fill(''),
    uma: Array(count).fill(state.companyMode ? '' : 0)
  });
  saveState();
  render();
}

function changePlayerCount(count) {
  state.playerCount = count;
  if (count === 3) state.companyMode = false;
  state.players = state.players.slice(0, count);
  while (state.players.length < count) state.players.push('');
  state.matches.forEach(row => normalizeRow(row, count, state.companyMode));
  saveState();
  render();
}

function calculateTotals() {
  const count = state.playerCount;
  const scores = Array(count).fill(0);
  const umas = Array(count).fill(0);

  state.matches.forEach(row => {
    normalizeRow(row, count, state.companyMode);
    row.scores.forEach((value, index) => { scores[index] += Number(value) || 0; });
    row.uma.forEach((value, index) => { umas[index] += Number(value) || 0; });
  });

  const totals = scores.map((score, index) => state.companyMode ? score + umas[index] * 5 : score);
  return { scores, umas, totals, income: totals.map(value => value * state.rate) };
}

function openCalculator(matchIndex, playerIndex, kind) {
  const row = state.matches[matchIndex];
  calcText = row[kind][playerIndex] === '' ? '0' : String(row[kind][playerIndex]);
  calcContext = { matchIndex, playerIndex, kind };
  document.getElementById('calcValue').textContent = calcText;
  document.getElementById('calculatorDialog').showModal();
}

function closeCalculator(shouldSave) {
  if (!calcContext) return;
  if (shouldSave) {
    const { matchIndex, playerIndex, kind } = calcContext;
    const row = state.matches[matchIndex];
    const value = calcText === '' || calcText === '-' ? '' : Number(calcText);
    row[kind][playerIndex] = Number.isFinite(value) ? value : '';
    row[kind] = autoCorrect(row[kind]);
    saveState();
    render();
  }
  calcContext = null;
  document.getElementById('calculatorDialog').close();
}

function renderSetup() {
  const count = state.playerCount;
  const names = Array.from({ length: count }, (_, index) => `
    <input class="name-input" data-index="${index}" value="${escapeHtml(state.players[index])}" placeholder="${index + 1}人目">
  `).join('');

  return `
    <section class="card">
      <h2 class="section-title">新しい対局</h2>
      <div class="form-grid">
        <div>
          <div class="small-note">対局人数</div>
          <div class="segmented">
            <button data-count="3" class="${count === 3 ? 'active' : ''}">3人打ち</button>
            <button data-count="4" class="${count === 4 ? 'active' : ''}">4人打ち</button>
          </div>
        </div>
        ${count === 4 ? `
          <label class="setting-row inline-setting">
            <span>会社モード</span>
            <input id="newCompanyMode" type="checkbox" ${state.companyMode ? 'checked' : ''}>
          </label>
        ` : ''}
        <div>
          <div class="small-note">参加者名</div>
          <div class="name-grid">${names}</div>
        </div>
        <button id="startBtn" class="primary-btn">${state.matches.length ? '対局を続ける' : '対局を開始'}</button>
      </div>
    </section>
  `;
}

function renderMatches() {
  if (!state.matches.length) {
    return `<section class="card"><p class="small-note">「対局を開始」を押すと半荘1が追加されます。</p></section>`;
  }

  const count = state.playerCount;
  const names = state.players.slice(0, count).map((name, index) => name || `${index + 1}人目`);

  if (state.companyMode) {
    const rows = state.matches.map((row, matchIndex) => {
      normalizeRow(row, count, true);
      const cells = names.map((_, playerIndex) => {
        const uma = row.uma[playerIndex];
        const score = row.scores[playerIndex];
        const umaClass = Number(uma) > 0 ? 'uma-positive' : Number(uma) < 0 ? 'uma-negative' : '';
        return `
          <td><button class="cell-btn ${umaClass}" data-mi="${matchIndex}" data-pi="${playerIndex}" data-kind="uma">${uma === '' ? '' : formatUma(uma)}</button></td>
          <td><button class="cell-btn" data-mi="${matchIndex}" data-pi="${playerIndex}" data-kind="scores">${score === '' ? '' : formatNumber(score)}</button></td>
        `;
      }).join('');
      return `<tr><th class="row-label">${matchIndex + 1}</th>${cells}</tr>`;
    }).join('');

    return `
      <section class="card">
        <h2 class="section-title">対局成績</h2>
        <div class="table-wrap">
          <table class="score-table company-table">
            <thead>
              <tr>
                <th class="row-label" rowspan="2">半荘</th>
                ${names.map(name => `<th colspan="2">${escapeHtml(name)}</th>`).join('')}
              </tr>
              <tr>
                ${names.map(() => '<th class="subhead">ウマ</th><th class="subhead">スコア</th>').join('')}
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <button id="addMatchBtn" class="secondary-btn add-row">＋ 半荘を追加</button>
        <p class="small-note">ウマ・スコアともに1人だけ空欄にすると、残りから自動計算します。常に合計0になります。</p>
      </section>
    `;
  }

  const rows = state.matches.map((row, matchIndex) => {
    normalizeRow(row, count, false);
    const cells = names.map((_, playerIndex) =>
      `<td><button class="cell-btn" data-mi="${matchIndex}" data-pi="${playerIndex}" data-kind="scores">${row.scores[playerIndex] === '' ? '' : formatNumber(row.scores[playerIndex])}</button></td>`
    ).join('');
    return `<tr><th class="row-label">${matchIndex + 1}</th>${cells}</tr>`;
  }).join('');

  return `
    <section class="card">
      <h2 class="section-title">対局成績</h2>
      <div class="table-wrap">
        <table class="score-table">
          <thead><tr><th class="row-label">半荘</th>${names.map(name => `<th>${escapeHtml(name)}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <button id="addMatchBtn" class="secondary-btn add-row">＋ 半荘を追加</button>
      <p class="small-note">1人だけ空欄にすると、残りから自動計算します。常に合計0になります。</p>
    </section>
  `;
}
function renderTotals() {
  if (!state.matches.length) return '';
  const totals = calculateTotals();
  const values = (array, formatter) => array.map(value => `<span>${formatter(value)}</span>`).join('');

  if (!state.companyMode) {
    return `
      <div class="totals-sticky"><div class="totals-inner">
        <div class="total-row total-main"><span class="label">合計</span>${values(totals.totals, formatNumber)}</div>
        <div class="total-row total-income"><span class="label">収支</span>${values(totals.income, formatNumber)}</div>
      </div></div>
    `;
  }

  const names = state.players.slice(0, state.playerCount).map((name, index) => name || `${index + 1}人目`);
  return `
    <div class="totals-sticky"><div class="totals-inner">
      <table class="totals-company-table">
        <thead>
          <tr>
            <th class="total-label-head" rowspan="2">集計</th>
            ${names.map(name => `<th colspan="2">${escapeHtml(name)}</th>`).join('')}
          </tr>
          <tr>
            ${names.map(() => '<th>ウマ</th><th>スコア</th>').join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>合計</th>
            ${names.map((_, i) => `<td class="uma-total ${Number(totals.umas[i]) > 0 ? 'uma-positive' : Number(totals.umas[i]) < 0 ? 'uma-negative' : ''}">${formatUma(totals.umas[i])}</td><td>${formatNumber(totals.scores[i])}</td>`).join('')}
          </tr>
          <tr class="income-row">
            <th>収支</th>
            ${names.map((_, i) => `<td colspan="2">${formatNumber(totals.income[i])}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    </div></div>
  `;
}

function render() {
  document.getElementById('app').innerHTML = renderSetup() + renderMatches() + renderTotals();
  bindMainEvents();
}

function bindMainEvents() {
  document.querySelectorAll('[data-count]').forEach(button => {
    button.onclick = () => changePlayerCount(Number(button.dataset.count));
  });

  document.querySelectorAll('.name-input').forEach(input => {
    input.oninput = () => {
      state.players[Number(input.dataset.index)] = input.value;
      saveState();
    };
  });

  const company = document.getElementById('newCompanyMode');
  if (company) {
    company.onchange = () => {
      state.companyMode = company.checked;
      state.matches.forEach(row => normalizeRow(row, state.playerCount, state.companyMode));
      saveState();
      render();
    };
  }

  const start = document.getElementById('startBtn');
  if (start) start.onclick = () => {
    if (!state.matches.length) addMatch();
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  document.querySelectorAll('.cell-btn').forEach(button => {
    button.onclick = () => openCalculator(Number(button.dataset.mi), Number(button.dataset.pi), button.dataset.kind);
  });

  const add = document.getElementById('addMatchBtn');
  if (add) add.onclick = addMatch;
}

document.getElementById('settingsBtn').onclick = () => {
  document.getElementById('companyModeToggle').checked = state.companyMode;
  document.getElementById('rateInput').value = state.rate;
  document.getElementById('settingsDialog').showModal();
};
document.getElementById('closeSettings').onclick = () => document.getElementById('settingsDialog').close();
document.getElementById('companyModeToggle').onchange = event => {
  state.companyMode = event.target.checked && state.playerCount === 4;
  state.matches.forEach(row => normalizeRow(row, state.playerCount, state.companyMode));
  saveState();
  render();
};
document.getElementById('rateInput').onchange = event => {
  const value = Number(event.target.value);
  state.rate = Number.isFinite(value) && value >= 0 ? value : 50;
  event.target.value = state.rate;
  saveState();
  render();
};
document.getElementById('resetBtn').onclick = () => {
  if (!confirm('すべての対局データと参加者名をリセットします。よろしいですか？')) return;
  state = structuredClone(DEFAULT_STATE);
  saveState();
  document.getElementById('settingsDialog').close();
  render();
};

document.querySelectorAll('#calculatorDialog [data-key]').forEach(button => {
  button.onclick = () => {
    const key = button.dataset.key;
    if (key === 'ok') return closeCalculator(true);
    if (key === 'clear') calcText = '0';
    else if (key === 'back') calcText = calcText.length > 1 ? calcText.slice(0, -1) : '0';
    else if (key === 'minus') calcText = calcText.startsWith('-') ? calcText.slice(1) : (calcText === '0' ? '-0' : `-${calcText}`);
    else if (calcText === '0') calcText = key;
    else if (calcText === '-0') calcText = `-${key}`;
    else calcText += key;
    document.getElementById('calcValue').textContent = calcText;
  };
});

document.getElementById('calculatorDialog').addEventListener('cancel', event => {
  event.preventDefault();
  closeCalculator(false);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}

render();
