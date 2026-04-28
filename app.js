// ============================================================
//  CONFIGURATION — update these values before deploying
// ============================================================
const CONFIG = {
  password:      'Allstate2026$$',          // Change this to your desired password
  proxyUrl:      'proxy.php',               // Path to your proxy.php on the server
  sheetId:       '1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4',
  sheetName:     'Incidents',               // Tab name inside your Google Sheet
  // Google OAuth — fill in after setting up OAuth in Google Cloud Console
  googleClientId: '152603955396-tsmdqffv4d0v3kuhfdpvi3hp83jehkru.apps.googleusercontent.com',  // e.g. 123456789-abc.apps.googleusercontent.com
};

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
//  Auth
// ============================================================
function checkLogin() {
  const pass = document.getElementById('login-pass').value;
  const err  = document.getElementById('login-error');
  if (pass === CONFIG.password) {
    sessionStorage.setItem('auth', '1');
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    initApp();
  } else {
    err.style.display = 'block';
    document.getElementById('login-pass').value = '';
  }
}

function logout() {
  sessionStorage.removeItem('auth');
  location.reload();
}

document.getElementById('login-pass').addEventListener('keydown', e => {
  if (e.key === 'Enter') checkLogin();
});

// Auto-login if session is still active
if (sessionStorage.getItem('auth') === '1') {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
}

// ============================================================
//  Init
// ============================================================
function initApp() {
  buildRatingGroups();
  setDefaultDates();
  loadGoogleAuth();
}

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
  const rd = document.getElementById('rev-date');
  const id = document.getElementById('inc-date');
  if (rd) rd.value = today;
  if (id) id.value = today;
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
}

// ============================================================
//  Review form helpers
// ============================================================
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
  return v === '__custom'
    ? document.getElementById('custom-name').value.trim()
    : v;
}

function getRatingsSummary() {
  return [...SKILLS, ...BEHAVIORS].map(([id, label]) => {
    const val = document.getElementById(id).value;
    return `${label}: ${val ? RATING_LABELS[val] : 'Not rated'}`;
  }).join('\n');
}

// ============================================================
//  Generate review — calls proxy.php → Anthropic API
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

  const outputBox   = document.getElementById('review-output');
  const outputText  = document.getElementById('review-text');
  const loadingBox  = document.getElementById('review-loading');
  const generateBtn = document.querySelector('#tab-review .primary-btn');

  outputBox.style.display  = 'none';
  loadingBox.style.display = 'block';
  generateBtn.disabled     = true;
  generateBtn.textContent  = 'Generating...';

  try {
    const res = await fetch(CONFIG.proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || 'No response received.';

    outputText.textContent   = text;
    outputBox.style.display  = 'block';
    outputBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    alert('Error generating review: ' + err.message + '\n\nCheck that proxy.php is uploaded to your server.');
  } finally {
    loadingBox.style.display = 'none';
    generateBtn.disabled     = false;
    generateBtn.textContent  = 'Generate Full Review Draft';
  }
}

function buildPrompt({ emp, type, date, reviewer, sNotes, bNotes, strengths, growth, goals, compliance }) {
  const year = new Date().getFullYear();
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
${hasCompliance ? '\nCOMPLIANCE / FLAGGED ISSUES (address clearly and firmly but professionally — state what cannot happen again):\n' + compliance : ''}

Write a complete, professional employee review with the following sections:
1. Overview (2–3 sentence summary of this employee's performance period)
2. Skills & Competencies (reference the ratings above with context and specific examples)
3. Behavior & Attitude (reference the ratings above with context)
4. Strengths & Achievements (bullet points, warm and specific)
5. Areas for Growth & Development (bullet points, supportive framing — opportunities not failures)${hasCompliance ? '\n6. Compliance & Critical Issues (firm, professional, specific about what cannot continue)' : ''}${hasGoals ? '\n' + goalSection + '. Goals for ' + year + ' (bullet points, specific and measurable)' : ''}

Keep the tone professional, warm, and action-oriented. This review should motivate the employee while giving them a clear picture of where they need to grow.`;
}

function copyReview() {
  const text = document.getElementById('review-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.copy-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy to clipboard'; }, 2000);
  });
}

// ============================================================
//  Google Sheets — OAuth 2.0 (write access)
// ============================================================
let googleToken = null;

function loadGoogleAuth() {
  // Load the Google Identity Services library
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
}

function getGoogleToken(callback) {
  if (googleToken) { callback(); return; }

  const client = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.googleClientId,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    callback: (response) => {
      if (response.error) {
        alert('Google sign-in failed: ' + response.error);
        return;
      }
      googleToken = response.access_token;
      callback();
    },
  });

  client.requestAccessToken();
}

// ============================================================
//  Incident log
// ============================================================
let allIncidents = [];
let currentFilter = 'All';

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
    const row = [
      new Date().toISOString(),
      emp,
      date || new Date().toISOString().split('T')[0],
      type,
      desc,
      action,
      logger,
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.sheetName}!A:G:append?valueInputOption=USER_ENTERED`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + googleToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      });

      if (!res.ok) throw new Error('Sheets API error ' + res.status);

      // Clear the form
      document.getElementById('inc-emp').value    = '';
      document.getElementById('inc-desc').value   = '';
      document.getElementById('inc-action').value = '';
      document.getElementById('inc-logger').value = '';
      setDefaultDates();

      successMsg.style.display = 'block';
      setTimeout(() => { successMsg.style.display = 'none'; }, 3000);

      loadIncidents();
    } catch (err) {
      errorMsg.textContent = 'Error saving: ' + err.message;
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
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.sheetName}!A:G`;

    try {
      const res  = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + googleToken },
      });
      const data = await res.json();
      const rows = (data.values || []).slice(1); // skip header row

      allIncidents = rows.map(r => ({
        timestamp: r[0] || '',
        emp:       r[1] || '',
        date:      r[2] || '',
        type:      r[3] || '',
        desc:      r[4] || '',
        action:    r[5] || '',
        logger:    r[6] || '',
      })).reverse(); // newest first

    } catch (err) {
      allIncidents = [];
    }

    loadingEl.style.display = 'none';
    renderIncidents();
  });
}

function filterInc(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderIncidents();
}

function renderIncidents() {
  const listEl = document.getElementById('inc-list');

  let filtered = allIncidents;
  if (currentFilter !== 'All') {
    filtered = allIncidents.filter(i =>
      i.emp === currentFilter || i.type === currentFilter
    );
  }

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state">No incidents logged yet.<br>Use the form above to document issues as they arise.</div>';
    return;
  }

  const typeBadge = {
    'Compliance':  'badge-compliance',
    'Performance': 'badge-performance',
    'Behavior':    'badge-behavior',
    'Other':       'badge-other',
  };

  listEl.innerHTML = filtered.map((i, idx) => `
    <div class="inc-card">
      <div class="inc-meta">
        <span class="inc-name">${i.emp}</span>
        <span class="inc-date">${i.date}</span>
        <span class="pill ${typeBadge[i.type] || 'badge-other'}" style="border-radius:6px">${i.type}</span>
        ${i.logger ? `<span style="font-size:12px;color:#888">Logged by ${i.logger}</span>` : ''}
      </div>
      <p class="inc-text">${i.desc}</p>
      ${i.action ? `<p class="inc-followup">Follow-up: ${i.action}</p>` : ''}
    </div>`).join('');
}

// ============================================================
//  Set up Google Sheet header row (run once on first use)
//  Open browser console and call: setupSheetHeaders()
// ============================================================
async function setupSheetHeaders() {
  getGoogleToken(async () => {
    const headers = [['Timestamp', 'Employee', 'Date', 'Issue Type', 'Description', 'Action Taken', 'Logged By']];
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${CONFIG.sheetName}!A1:G1?valueInputOption=USER_ENTERED`;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + googleToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: headers }),
    });

    if (res.ok) {
      console.log('Sheet headers set up successfully.');
    } else {
      console.error('Failed to set up headers:', await res.text());
    }
  });
}
