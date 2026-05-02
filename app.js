// app.js v3 — clean rebuild, no template literal corruption
// ============================================================
//  CONFIGURATION — update before deploying
// ============================================================
const CONFIG = {
  password:       'SchAgency2025!',
  proxyUrl: 	  '/api/generate-review',
  sheetId:        '1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4',
  incidentSheet:  'Incidents',
  reviewSheet:    'Reviews',
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID',
  driveFolderName:'Employee Reviews',
};

// ============================================================
//  Default employee list — admin can add more via the UI
// ============================================================
const DEFAULT_EMPLOYEES = [
  'Chris Wolter',
  'Craig Diago',
  'Crissy Shatzel',
  'Iris Salgado',
  'Mark Hill',
  'Matt Grana',
  'Michael Scheiderich',
  'Scott Kesler',
  'Tym LeMoyne',
  'Wendy Alanez',
];

// ============================================================
//  Rating definitions
// ============================================================
const SKILLS = [
  ['s-comm', 'Communication Skills'],
  ['s-crb',  'Client Relationship Building'],
  ['s-tm',   'Time Management'],
  ['s-ps',   'Prospecting Strategy'],
  ['s-ho',   'Handling Objections'],
  ['s-cs',   'Closing Skills'],
];

const BEHAVIORS = [
  ['b-tc', 'Team Collaboration'],
  ['b-ad', 'Adaptability'],
  ['b-sm', 'Self-Motivation'],
  ['b-cg', 'Commitment to Company Goals'],
  ['b-in', 'Integrity'],
];

const RATING_LABELS = {
  '4': 'Exceeds expectations',
  '3': 'Meets expectations',
  '2': 'Needs improvement',
  '1': 'Does not meet expectations',
};

const RATING_SHORT = {
  '4': 'Exceeds',
  '3': 'Meets',
  '2': 'Needs work',
  '1': 'Below min',
};

const PILL_CLASS = { '4': 'p4', '3': 'p3', '2': 'p2', '1': 'p1' };

// ============================================================
//  State
// ============================================================
let currentUser     = null;
let googleToken     = null;
let allIncidents    = [];
let allReviews      = [];
let employees       = [];
let incidentFilter  = 'All';
let historyFilter   = 'All';
let lastReviewText  = '';
let lastReviewEmp   = '';
let lastReviewType  = '';
let lastReviewDate  = '';
let rootFolderId    = null;

// ============================================================
//  Auth
// ============================================================
function togglePassword() {
  const input = document.getElementById('login-pass');
  const btn   = document.getElementById('toggle-pass-btn');
  if (input.type === 'password') {
    input.type   = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type   = 'password';
    btn.textContent = 'Show';
  }
}

function loadSavedPassword() {
  const saved = localStorage.getItem('saved-password');
  if (saved) {
    document.getElementById('login-pass').value     = saved;
    document.getElementById('remember-pass').checked = true;
  }
}

function checkLogin() {
  const user     = document.getElementById('login-user').value;
  const pass     = document.getElementById('login-pass').value;
  const err      = document.getElementById('login-error');
  const remember = document.getElementById('remember-pass').checked;

  if (!user) { err.textContent = 'Please select who you are.'; err.style.display = 'block'; return; }
  if (pass !== CONFIG.password) { err.textContent = 'Incorrect password.'; err.style.display = 'block'; return; }

  if (remember) {
    localStorage.setItem('saved-password', pass);
  } else {
    localStorage.removeItem('saved-password');
  }

  currentUser = user;
  sessionStorage.setItem('auth', '1');
  sessionStorage.setItem('user', user);
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'block';
  initApp();
}

function logout() {
  sessionStorage.clear();
  googleToken = null;
  location.reload();
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkLogin();
});

if (sessionStorage.getItem('auth') === '1') {
  currentUser = sessionStorage.getItem('user');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

// ============================================================
//  Init
// ============================================================
async function initApp() {
  loadEmployees();
  buildRatingGroups();
  setDefaultDates();
  loadGoogleAuth();
  await loadDocxLibrary();
  document.getElementById('header-user').textContent = currentUser;
  document.getElementById('reviewer').value          = currentUser;
  document.getElementById('inc-logger').value        = currentUser;
}

// ============================================================
//  Employee management
// ============================================================
function loadEmployees() {
  const stored = localStorage.getItem('scheiderich-employees');
  employees = stored ? JSON.parse(stored) : [...DEFAULT_EMPLOYEES];
  populateEmployeeDropdowns();
  renderAdminEmployeeList();
  buildFilterBars();
}

function saveEmployees() {
  localStorage.setItem('scheiderich-employees', JSON.stringify(employees));
}

function addEmployee() {
  const name = document.getElementById('new-emp-name').value.trim();
  if (!name) { alert('Please enter a name.'); return; }
  if (employees.includes(name)) { alert('That employee already exists.'); return; }

  employees.push(name);
  employees.sort();
  saveEmployees();
  populateEmployeeDropdowns();
  renderAdminEmployeeList();
  buildFilterBars();

  document.getElementById('new-emp-name').value = '';
  const msg = document.getElementById('emp-success');
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

function removeEmployee(name) {
  if (!confirm(`Remove ${name} from the employee list? This does not delete their records.`)) return;
  employees = employees.filter(e => e !== name);
  saveEmployees();
  populateEmployeeDropdowns();
  renderAdminEmployeeList();
  buildFilterBars();
}

function populateEmployeeDropdowns() {
  const opts = employees.map(e => `<option value="${e}">${e}</option>`).join('');
  const customOpt = '<option value="__custom">Other...</option>';

  const empSel  = document.getElementById('emp-sel');
  const incEmp  = document.getElementById('inc-emp');

  if (empSel) empSel.innerHTML  = '<option value="">Select...</option>' + opts + customOpt;
  if (incEmp) incEmp.innerHTML  = '<option value="">Select...</option>' + opts;
}

function renderAdminEmployeeList() {
  const el = document.getElementById('employee-list-admin');
  if (!el) return;
  el.innerHTML = employees.map(e => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:#fafafa;border:1px solid #eee;border-radius:8px;margin-bottom:6px">
      <span style="font-size:14px">${e}</span>
      <button onclick="removeEmployee('${e}')" style="font-size:12px;padding:3px 10px;border:1px solid #fca5a5;border-radius:6px;background:transparent;color:#991b1b;cursor:pointer">Remove</button>
    </div>`).join('');
}

function buildFilterBars() {
  const empButtons = employees.map(e => {
    const first = e.split(' ')[0];
    return `<button class="f-btn" onclick="filterInc('${e}', this)">${first}</button>`;
  }).join('');

  const incBar = document.getElementById('inc-filter-bar');
  if (incBar) {
    incBar.innerHTML = `
      <button class="f-btn active" onclick="filterInc('All', this)">All</button>
      ${empButtons}
      <button class="f-btn" onclick="filterInc('Compliance', this)">Compliance</button>
      <button class="f-btn" onclick="filterInc('Performance', this)">Performance</button>`;
  }

  const histBar = document.getElementById('history-filter-bar');
  if (histBar) {
    const histEmpBtns = employees.map(e => {
      const first = e.split(' ')[0];
      return `<button class="f-btn" onclick="filterHistory('${e}', this)">${first}</button>`;
    }).join('');
    histBar.innerHTML = `<button class="f-btn active" onclick="filterHistory('All', this)">All</button>${histEmpBtns}`;
  }
}

// ============================================================
//  Tab switching
// ============================================================
function switchTab(name, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'incidents') loadIncidents();
  if (name === 'history')   loadReviews();
}

// ============================================================
//  Review form
// ============================================================
function buildRatingGroups() {
  document.getElementById('skills-group').innerHTML   = SKILLS.map(buildRatingRow).join('');
  document.getElementById('behavior-group').innerHTML = BEHAVIORS.map(buildRatingRow).join('');
}

function buildRatingRow([id, label]) {
  return `
    <div class="rating-row">
      <span class="rating-label">${label}</span>
      <select class="rating-sel" id="${id}" onchange="updatePill('${id}','pill-${id}')">
        <option value="">Rate...</option>
        <option value="4">4 — Exceeds</option>
        <option value="3">3 — Meets</option>
        <option value="2">2 — Needs improvement</option>
        <option value="1">1 — Does not meet</option>
      </select>
      <span id="pill-${id}" class="pill" style="min-width:80px;text-align:center"></span>
    </div>`;
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  ['rev-date', 'inc-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

function onEmpChange() {
  const v = document.getElementById('emp-sel').value;
  document.getElementById('custom-wrap').style.display = v === '__custom' ? 'block' : 'none';
}

function updatePill(selId, pillId) {
  const val  = document.getElementById(selId).value;
  const pill = document.getElementById(pillId);
  if (!val) { pill.textContent = ''; pill.className = 'pill'; return; }
  pill.textContent = RATING_SHORT[val];
  pill.className   = 'pill ' + PILL_CLASS[val];
}

function getEmpName() {
  const v = document.getElementById('emp-sel').value;
  return v === '__custom' ? document.getElementById('custom-name').value.trim() : v;
}

function getRatingsSummary() {
  return [...SKILLS, ...BEHAVIORS].map(([id, label]) => {
    const val = document.getElementById(id).value;
    return `${label}: ${val ? RATING_LABELS[val] : 'Not rated'}`;
  }).join('\n');
}

function formatReviewText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:1.25rem 0 0.5rem;font-size:17px;font-weight:700;border-bottom:1px solid #eee;padding-bottom:4px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:1.5rem 0 0.75rem;font-size:20px;font-weight:700">$1</h1>')
    .replace(/^ {2,}[-*] (.+)$/gm, '<li style="margin-left:3rem;margin-bottom:3px;color:#555">$1</li>')
    .replace(/^[-*•] (.+)$/gm, '<li style="margin-left:1.5rem;margin-bottom:5px;line-height:1.6">$1</li>')
    .replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid #eee;margin:1rem 0">')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function loadDocxLibrary() {
  return new Promise((resolve, reject) => {
    if (typeof docx !== 'undefined') { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/docx@8.5.0/build/index.umd.js';
    script.onload = () => { console.log('docx library loaded successfully'); resolve(); };
    script.onerror = () => { console.error('docx library failed to load'); reject(); };
    document.head.appendChild(script);
  });
}

// ============================================================
//  Generate review
// ============================================================
async function generateReview() {
  const emp = getEmpName();
  if (!emp) { alert('Please select an employee first.'); return; }

  const type       = document.getElementById('rev-type').value;
  const date       = document.getElementById('rev-date').value;
  const reviewer   = document.getElementById('reviewer').value;
  const sNotes     = document.getElementById('skills-notes').value;
  const bNotes     = document.getElementById('behavior-notes').value;
  const strengths  = document.getElementById('strengths').value;
  const growth     = document.getElementById('growth').value;
  const goals      = document.getElementById('goals').value;
  const compliance = document.getElementById('compliance').value;

  const prompt = buildPrompt({ emp, type, date, reviewer, sNotes, bNotes, strengths, growth, goals, compliance });

  const outputBox  = document.getElementById('review-output');
  const outputText = document.getElementById('review-text');
  const loadingBox = document.getElementById('review-loading');
  const genBtn     = document.querySelector('#tab-review .primary-btn');

  outputBox.style.display  = 'none';
  loadingBox.style.display = 'block';
  genBtn.disabled          = true;
  genBtn.textContent       = 'Generating...';

  try {
    const res = await fetch(CONFIG.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || 'No response received.';

    lastReviewText = text;
    lastReviewEmp  = emp;
    lastReviewType = type;
    lastReviewDate = date;

    outputText.innerHTML = formatReviewText(text);
    outputBox.style.display = 'block';
    outputBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert('Error generating review: ' + err.message);
  } finally {
    loadingBox.style.display = 'none';
    genBtn.disabled          = false;
    genBtn.textContent       = 'Generate Full Review Draft';
  }
}

function buildPrompt({ emp, type, date, reviewer, sNotes, bNotes, strengths, growth, goals, compliance }) {
  const year          = new Date().getFullYear();
  const hasCompliance = compliance && compliance.trim();
  const hasGoals      = goals && goals.trim();
  const goalSection   = hasCompliance ? '7' : '6';

  return `You are drafting a professional employee review for the Scheiderich Insurance Agency (an Allstate agency). Use a tone of supportive growth — reviews should motivate and develop the employee, not punish them. Use bullet points where appropriate. Be specific and action-oriented.

EMPLOYEE: ${emp}
REVIEW TYPE: ${type}
DATE: ${date || 'Current date'}
REVIEWER: ${reviewer || 'Agency Manager'}

RATINGS SUMMARY:
${getRatingsSummary()}
${sNotes ? '\nSkills context: ' + sNotes : ''}
${bNotes ? '\nBehavior context: ' + bNotes : ''}

STRENGTHS & ACHIEVEMENTS (rewrite professionally with bullet points):
${strengths || 'Not provided'}

AREAS FOR GROWTH (rewrite in supportive, growth-focused language — frame as opportunities, use bullet points):
${growth || 'Not provided'}

GOALS FOR NEXT PERIOD (use bullet points):
${goals || 'Not provided'}
${hasCompliance ? '\nCOMPLIANCE / FLAGGED ISSUES (address clearly and firmly but professionally):\n' + compliance : ''}

Write a complete professional employee review with these sections:
1. Overview (2–3 sentence summary)
2. Skills & Competencies (reference ratings with context)
3. Behavior & Attitude (reference ratings with context)
4. Strengths & Achievements (bullet points)
5. Areas for Growth & Development (bullet points, supportive framing)${hasCompliance ? '\n6. Compliance & Critical Issues (firm, professional, specific)' : ''}${hasGoals ? '\n' + goalSection + '. Goals for ' + year + ' (bullet points)' : ''}`;
}


async function downloadWordDoc() {
  console.log('docx library status:', typeof docx);
  if (!lastReviewText) { alert('No review to download. Generate a review first.'); return; }

  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
  const lines    = lastReviewText.split('\n');
  const children = [];

  for (const line of lines) {
    if (!line.trim()) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }
    if (line.startsWith('# ')) {
      children.push(new Paragraph({ text: line.replace(/^# /, ''), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith('## ')) {
      children.push(new Paragraph({ text: line.replace(/^## /, ''), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({ text: line.replace(/^### /, ''), heading: HeadingLevel.HEADING_3 }));
    } else if (line.match(/^[-*•] /)) {
      const text = line.replace(/^[-*•] /, '').replace(/\*\*(.*?)\*\*/g, '$1');
      children.push(new Paragraph({ text, bullet: { level: 0 } }));
    } else if (line.match(/^ {2,}[-*] /)) {
      const text = line.replace(/^ {2,}[-*] /, '').replace(/\*\*(.*?)\*\*/g, '$1');
      children.push(new Paragraph({ text, bullet: { level: 1 } }));
    } else if (line.match(/^---+$/)) {
      children.push(new Paragraph({ text: '─────────────────────────────────' }));
    } else {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      const runs  = parts.map((part, i) => new TextRun({ text: part, bold: i % 2 === 1 }));
      children.push(new Paragraph({ children: runs }));
    }
  }

  const doc  = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = lastReviewEmp + ' - ' + lastReviewType + ' - ' + lastReviewDate + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
//  Save review to Google Sheets + Drive
// ============================================================
async function saveReview() {
  if (!lastReviewText) { alert('No review to save. Generate a review first.'); return; }

  const saveBtn = document.querySelector('.output-toolbar .copy-btn:last-child');
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled    = true;

  getGoogleToken(async () => {
    try {
      // 1. Save to Sheets
      const date     = document.getElementById('rev-date').value;
      const type     = document.getElementById('rev-type').value;
      const reviewer = document.getElementById('reviewer').value;
      const row      = [new Date().toISOString(), lastReviewEmp, type, date, reviewer, lastReviewText.substring(0, 5000)];

      const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.reviewSheet}!A:F:append?valueInputOption=USER_ENTERED`;
      await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });

      // 2. Get or create root Drive folder
      if (!rootFolderId) {
        rootFolderId = await getOrCreateFolder(CONFIG.driveFolderName, 'root');
      }

      // 3. Get or create employee subfolder
      const empFolderId = await getOrCreateFolder(lastReviewEmp, rootFolderId);

      // 4. Create the review file in Drive as a Google Doc
      const fileName = lastReviewType + ' - ' + (date || new Date().toISOString().split('T')[0]);
      const meta = JSON.stringify({
        name: fileName,
        mimeType: 'application/vnd.google-apps.document',
        parents: [empFolderId],
      });
      const form = new FormData();
      form.append('metadata', new Blob([meta], { type: 'application/json' }));
      form.append('file', new Blob([lastReviewText], { type: 'text/plain' }));
      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + googleToken },
        body: form,
      });

      saveBtn.textContent = 'Saved!';
      setTimeout(() => { saveBtn.textContent = 'Save to Drive & Sheets'; saveBtn.disabled = false; }, 2000);

    } catch (err) {
      alert('Error saving: ' + err.message);
      saveBtn.textContent = 'Save to Drive & Sheets';
      saveBtn.disabled    = false;
    }
  });
}

async function getOrCreateFolder(name, parentId) {
  // Search for existing folder
  const query    = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { 'Authorization': 'Bearer ' + googleToken },
  });
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const createData = await createRes.json();
  return createData.id;
}

// ============================================================
//  Google OAuth
// ============================================================
function loadGoogleAuth() {
  const script  = document.createElement('script');
  script.src    = 'https://accounts.google.com/gsi/client';
  script.async  = true;
  script.defer  = true;
  document.head.appendChild(script);
}

function getGoogleToken(callback) {
  if (googleToken) { callback(); return; }
  if (typeof google === 'undefined') {
    setTimeout(() => getGoogleToken(callback), 300);
    return;
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.googleClientId,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.error) {
        alert('Google authorization failed: ' + response.error +
          '\n\nPlease make sure you are signing in with your ' +
          'gahomeinsuranceexperts.com Google account.');
        return;
      }
      googleToken = response.access_token;
      callback();
    },
    error_callback: (error) => {
      if (error.type === 'popup_closed') {
        alert('Authorization window was closed. Please try again and complete the Google sign-in.');
      } else {
        alert('Authorization error: ' + error.type);
      }
    },
  });
  client.requestAccessToken({ prompt: 'consent' });
}

// ============================================================
//  Incident log
// ============================================================
async function addIncident() {
  const emp    = document.getElementById('inc-emp').value;
  const date   = document.getElementById('inc-date').value;
  const type   = document.getElementById('inc-type').value;
  const desc   = document.getElementById('inc-desc').value.trim();
  const action = document.getElementById('inc-action').value.trim();
  const logger = document.getElementById('inc-logger').value.trim();

  if (!emp)  { alert('Please select an employee.'); return; }
  if (!desc) { alert('Please describe what happened.'); return; }

  const successMsg = document.getElementById('inc-success');
  const errorMsg   = document.getElementById('inc-error');
  successMsg.style.display = 'none';
  errorMsg.style.display   = 'none';

  getGoogleToken(async () => {
    const row = [new Date().toISOString(), emp, date || new Date().toISOString().split('T')[0], type, desc, action, logger];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.incidentSheet}!A:G:append?valueInputOption=USER_ENTERED`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [row] }),
      });
      if (!res.ok) throw new Error('Sheets API error ' + res.status);

      document.getElementById('inc-emp').value    = '';
      document.getElementById('inc-desc').value   = '';
      document.getElementById('inc-action').value = '';
      setDefaultDates();

      successMsg.style.display = 'block';
      setTimeout(() => { successMsg.style.display = 'none'; }, 3000);
      loadIncidents();
    } catch (err) {
      errorMsg.textContent   = 'Error saving: ' + err.message;
      errorMsg.style.display = 'block';
    }
  });
}

async function loadIncidents() {
  const loadingEl = document.getElementById('inc-loading');
  const listEl    = document.getElementById('inc-list');
  loadingEl.style.display = 'block';
  listEl.innerHTML = '';

  getGoogleToken(async () => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.incidentSheet}!A:G`;
    try {
      const res  = await fetch(url, { headers: { 'Authorization': 'Bearer ' + googleToken } });
      const data = await res.json();
      const rows = (data.values || []).slice(1);
      allIncidents = rows.map(r => ({
        timestamp: r[0] || '', emp: r[1] || '', date: r[2] || '',
        type: r[3] || '', desc: r[4] || '', action: r[5] || '', logger: r[6] || '',
      })).reverse();
    } catch { allIncidents = []; }

    loadingEl.style.display = 'none';
    renderIncidents();
  });
}

function filterInc(filter, btn) {
  incidentFilter = filter;
  document.querySelectorAll('#inc-filter-bar .f-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIncidents();
}

function renderIncidents() {
  const listEl   = document.getElementById('inc-list');
  const filtered = incidentFilter === 'All'
    ? allIncidents
    : allIncidents.filter(i => i.emp === incidentFilter || i.type === incidentFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state">No incidents logged yet.</div>';
    return;
  }

  const typeCls = { 'Compliance':'badge-compliance', 'Performance':'badge-performance', 'Behavior':'badge-behavior', 'Other':'badge-other' };

  listEl.innerHTML = filtered.map(i => `
    <div class="inc-card">
      <div class="inc-meta">
        <span class="inc-name">${i.emp}</span>
        <span class="inc-date">${i.date}</span>
        <span class="pill ${typeCls[i.type] || 'badge-other'}" style="border-radius:6px">${i.type}</span>
        ${i.logger ? `<span style="font-size:12px;color:#888">Logged by ${i.logger}</span>` : ''}
      </div>
      <p class="inc-text">${i.desc}</p>
      ${i.action ? `<p class="inc-followup">Follow-up: ${i.action}</p>` : ''}
    </div>`).join('');
}

// ============================================================
//  Review history
// ============================================================
async function loadReviews() {
  const loadingEl = document.getElementById('history-loading');
  const listEl    = document.getElementById('history-list');
  loadingEl.style.display = 'block';
  listEl.innerHTML = '';

  getGoogleToken(async () => {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.reviewSheet}!A:F`;
    try {
      const res  = await fetch(url, { headers: { 'Authorization': 'Bearer ' + googleToken } });
      const data = await res.json();
      const rows = (data.values || []).slice(1);
      allReviews = rows.map(r => ({
        timestamp: r[0] || '', emp: r[1] || '', type: r[2] || '',
        date: r[3] || '', reviewer: r[4] || '', text: r[5] || '',
      })).reverse();
    } catch { allReviews = []; }

    loadingEl.style.display = 'none';
    renderReviews();
  });
}

function filterHistory(filter, btn) {
  historyFilter = filter;
  document.querySelectorAll('#history-filter-bar .f-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderReviews();
}

function renderReviews() {
  const listEl   = document.getElementById('history-list');
  const filtered = historyFilter === 'All'
    ? allReviews
    : allReviews.filter(r => r.emp === historyFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state">No reviews saved yet. Generate a review and click "Save to Drive & Sheets".</div>';
    return;
  }

  listEl.innerHTML = filtered.map((r, i) => `
    <div class="inc-card">
      <div class="inc-meta">
        <span class="inc-name">${r.emp}</span>
        <span class="inc-date">${r.date}</span>
        <span class="pill p3" style="border-radius:6px">${r.type}</span>
        ${r.reviewer ? `<span style="font-size:12px;color:#888">By ${r.reviewer}</span>` : ''}
      </div>
      <button class="secondary-btn" style="margin-top:8px;font-size:12px;padding:4px 12px" onclick="toggleReviewText(${i})">View review</button>
      <div id="rev-text-${i}" style="display:none;margin-top:10px;font-size:13px;line-height:1.8;white-space:pre-wrap;border-top:1px solid #eee;padding-top:10px">${r.text}</div>
    </div>`).join('');
}

function toggleReviewText(i) {
  const el  = document.getElementById(`rev-text-${i}`);
  const btn = el.previousElementSibling;
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.textContent  = 'Hide review';
  } else {
    el.style.display = 'none';
    btn.textContent  = 'View review';
  }
}

// ============================================================
//  Sheet setup — run once via Admin tab
// ============================================================
async function setupSheetHeaders() {
  getGoogleToken(async () => {
    const incHeaders = [['Timestamp','Employee','Date','Issue Type','Description','Action Taken','Logged By (Manager)']];
    const revHeaders = [['Timestamp','Employee','Review Type','Review Date','Reviewer','Review Text']];

    const base = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values`;
    const opts = { method: 'PUT', headers: { 'Authorization': 'Bearer ' + googleToken, 'Content-Type': 'application/json' } };

    await fetch(`${base}/${CONFIG.incidentSheet}!A1:G1?valueInputOption=USER_ENTERED`, { ...opts, body: JSON.stringify({ values: incHeaders }) });
    await fetch(`${base}/${CONFIG.reviewSheet}!A1:F1?valueInputOption=USER_ENTERED`,   { ...opts, body: JSON.stringify({ values: revHeaders }) });

    alert('Sheet headers set up successfully. Make sure you have both an "Incidents" tab and a "Reviews" tab in your Google Sheet.');
  });
}

document.addEventListener('DOMContentLoaded', loadSavedPassword);
