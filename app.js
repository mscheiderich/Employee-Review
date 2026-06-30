// app.js v3 — clean rebuild, no template literal corruption
// ============================================================
//  CONFIGURATION — update before deploying
// ============================================================
const CONFIG = {
  proxyUrl: '/api/generate-review',
  sheetId: '1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4',
  incidentSheet: 'Incidents',
  reviewSheet: 'Reviews',
  googleClientId: '152603955396-3pau8atgci9o9icccmfbirblu0pcjesc.apps.googleusercontent.com',
  driveFolderName: 'Employee Reviews',
};

// ============================================================
//  Default employee list — admin can add more via the UI
// ============================================================
const DEFAULT_EMPLOYEES = [
  'Chris Wolter',
  'Craig Diego',
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
let currentReviewId = null;
let reviewEditMode  = false;
let rootFolderId    = null;

// ============================================================
//  Auth
// ============================================================
let currentUserRole = 'reviewer';

async function loadApprovedUsers() {
  try {
    const res = await fetch('/api/users');
    if (!res.ok) return [];
    const data = await res.json();
    console.log('Users from API:', JSON.stringify(data));
    if (Array.isArray(data)) return data;
    if (data.value) {
      const parsed = typeof data.value === 'string'
        ? JSON.parse(data.value)
        : data.value;
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch(e) {
    console.error('Failed to load users:', e);
    return [];
  }
}

async function handleGoogleLogin(googleUser) {
  console.log('handleGoogleLogin called with:', googleUser.email);
  const email = googleUser.email;
  const users = await loadApprovedUsers();
  const match = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!match) {
    document.getElementById('login-error').textContent =
      'Access denied. Your account is not approved.';
    document.getElementById('login-error').style.display = 'block';
    googleToken = null;
    return;
  }
  console.log('User matched:', match);
  currentUser = match.name;
  currentUserRole = match.role;
  sessionStorage.setItem('auth', '1');
  sessionStorage.setItem('user', match.name);
  sessionStorage.setItem('role', match.role);
  sessionStorage.setItem('email', email);
  console.log('Session set, showing app...');
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  applyRolePermissions();
  initApp();
}

function applyRolePermissions() {
  const isAdmin = currentUserRole === 'admin';
  const adminTab = document.querySelector('[data-tab="admin"]');
  if (adminTab) adminTab.style.display = isAdmin ? '' : 'none';
  if (!isAdmin) {
    const adminContent = document.getElementById('admin');
    if (adminContent) adminContent.style.display = 'none';
  }
}

function logout() {
  sessionStorage.clear();
  googleToken = null;
  location.reload();
}

if (sessionStorage.getItem('auth') === '1') {
  currentUser = sessionStorage.getItem('user');
  currentUserRole = sessionStorage.getItem('role') || 'reviewer';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  applyRolePermissions();
  initApp();
}

// ============================================================
//  Init
// ============================================================
async function initApp() {
  await loadEmployees();
  buildRatingGroups();
  setDefaultDates();

  await loadDocxLibrary();
  document.getElementById('header-user').textContent = currentUser;
  document.getElementById('reviewer').value          = currentUser;
  await loadDriveFolderSetting();
  if (currentUserRole === 'admin') { loadUsersList(); loadEmployeesList(); }
}

// ============================================================
//  Employee management
// ============================================================
async function loadEmployees() {
  try {
    const res = await fetch('/api/get-settings?key=employee-list');
    const data = await res.json();
    employees = data.value ? JSON.parse(data.value) : [...DEFAULT_EMPLOYEES];
  } catch {
    employees = [...DEFAULT_EMPLOYEES];
  }
  populateEmployeeDropdowns();
  renderAdminEmployeeList();
  buildFilterBars();
}

function saveEmployees() {
  fetch('/api/save-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'employee-list', value: JSON.stringify(employees) }),
  });
}

function addReviewEmployee() {
  const name = document.getElementById('new-review-emp-name').value.trim();
  if (!name) { alert('Please enter a name.'); return; }
  if (employees.includes(name)) { alert('That employee already exists.'); return; }

  employees.push(name);
  employees.sort();
  saveEmployees();
  populateEmployeeDropdowns();
  renderAdminEmployeeList();
  buildFilterBars();

  document.getElementById('new-review-emp-name').value = '';
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

function formatReviewForGoogleDocs(text, context = {}) {
  const blocks = [];
  const titleText = 'ANNUAL EMPLOYEE REVIEW';
  const subtitleText = 'Scheiderich Insurance Agency - Allstate';

  blocks.push({ type: 'title', text: titleText });
  blocks.push({ type: 'subtitle', text: subtitleText });
  pushSpacer(blocks);

  const metadata = [
    ['Employee', context.employee || ''],
    ['Review Type', context.reviewType || ''],
    ['Review Period', buildReviewPeriod(context.reviewDate)],
    ['Review Date', context.reviewDate || ''],
    ['Reviewer', context.reviewer || ''],
  ];

  metadata.forEach(([label, value]) => {
    blocks.push({
      type: 'metadata',
      label,
      value: normalizeDocText(value),
    });
  });

  pushSpacer(blocks);

  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      pushSpacer(blocks);
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      pushSpacer(blocks);
      continue;
    }

    const bulletMatch = trimmed.match(/^\s*[-*\u2022]\s+(.+)$/);
    if (bulletMatch) {
      const bulletText = normalizeDocText(bulletMatch[1]);
      if (bulletText) {
        blocks.push({ type: 'bullet', text: bulletText });
      }
      continue;
    }

    const clean = normalizeDocText(trimmed);
    if (!clean) {
      pushSpacer(blocks);
      continue;
    }

    if (isTitleLine(clean) || isSubtitleLine(clean) || isMetadataLine(clean)) {
      continue;
    }

    if (isSectionHeading(clean)) {
      blocks.push({ type: 'sectionHeading', text: clean.toUpperCase() });
      continue;
    }

    const labelParagraph = splitLabelParagraph(clean);
    if (labelParagraph) {
      blocks.push({
        type: 'labelParagraph',
        label: labelParagraph.label,
        value: labelParagraph.value,
      });
      continue;
    }

    blocks.push({ type: 'paragraph', text: clean });
  }

  return blocks;
}

function pushSpacer(blocks) {
  if (blocks.length === 0 || blocks[blocks.length - 1].type !== 'spacer') {
    blocks.push({ type: 'spacer' });
  }
}

function normalizeDocText(text) {
  return String(text || '')
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-*\u2022]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTitleLine(text) {
  return normalizeDocText(text).toUpperCase() === 'ANNUAL EMPLOYEE REVIEW';
}

function isSubtitleLine(text) {
  const normalized = normalizeDocText(text);
  return /Scheiderich Insurance Agency/i.test(normalized) && /Allstate/i.test(normalized);
}

function isMetadataLine(text) {
  return /^(Employee|Review Type|Review Period|Review Date|Reviewer)\s*:/i.test(normalizeDocText(text));
}

function isSectionHeading(text) {
  const normalized = normalizeDocText(text).replace(/:$/, '').trim();
  const upper = normalized.toUpperCase();
  const known = new Set([
    'OVERVIEW',
    'SKILLS & COMPETENCIES',
    'BEHAVIOR & ATTITUDE',
    'GOALS & DEVELOPMENT PLAN',
    'FINAL COMMENTS',
    'STRENGTHS & ACHIEVEMENTS',
    'AREAS FOR GROWTH & DEVELOPMENT',
    'GOALS FOR NEXT PERIOD',
    'COMPLIANCE OR FLAGGED ISSUES',
  ]);

  if (known.has(upper)) return true;
  return upper.length > 0 && upper.length < 80 && upper === normalized && /^[A-Z0-9 &/,:.'()-]+$/.test(upper);
}

function splitLabelParagraph(text) {
  const normalized = normalizeDocText(text);
  const match = normalized.match(/^([A-Za-z][A-Za-z0-9 &/()-]{1,60}):\s*(.*)$/);
  if (!match) return null;

  const label = match[1].trim();
  if (label.length > 60) return null;
  return {
    label,
    value: match[2].trim(),
  };
}

function buildReviewPeriod(reviewDate) {
  if (reviewDate) {
    const parsed = new Date(reviewDate);
    if (!Number.isNaN(parsed.getTime())) {
      return String(parsed.getFullYear());
    }
  }
  return String(new Date().getFullYear());
}

function buildGoogleDocsRequests(blocks) {
  const requests = [];
  let cursor = 1;

  for (const block of blocks) {
    if (block.type === 'spacer') {
      cursor = insertPlainLine(requests, cursor, '');
      continue;
    }

    if (block.type === 'title') {
      cursor = insertStyledLine(requests, cursor, block.text, {
        textStyle: makeTextStyle(16, true),
        paragraphStyle: makeParagraphStyle('CENTER', 100, 6, 0, true),
      });
      continue;
    }

    if (block.type === 'subtitle') {
      cursor = insertStyledLine(requests, cursor, block.text, {
        textStyle: makeTextStyle(11, true),
        paragraphStyle: makeParagraphStyle('CENTER', 100, 8, 0, true),
      });
      continue;
    }

    if (block.type === 'metadata') {
      const lineText = block.value ? block.label + ': ' + block.value : block.label + ':';
      cursor = insertStyledLine(requests, cursor, lineText, {
        textStyle: makeTextStyle(11, false),
        paragraphStyle: makeParagraphStyle('START', 115, 2, 0, false),
        boldPrefixLength: block.label.length,
      });
      continue;
    }

    if (block.type === 'sectionHeading') {
      cursor = insertStyledLine(requests, cursor, block.text.toUpperCase(), {
        textStyle: makeTextStyle(13, true),
        paragraphStyle: makeParagraphStyle('START', 100, 4, 12, true),
      });
      continue;
    }

    if (block.type === 'labelParagraph') {
      const lineText = block.value ? block.label + ': ' + block.value : block.label + ':';
      cursor = insertStyledLine(requests, cursor, lineText, {
        textStyle: makeTextStyle(11, false),
        paragraphStyle: makeParagraphStyle('START', 115, 4, 0, false),
        boldPrefixLength: block.label.length,
      });
      continue;
    }

    if (block.type === 'bullet') {
      cursor = insertStyledLine(requests, cursor, block.text, {
        textStyle: makeTextStyle(11, false),
        paragraphStyle: makeParagraphStyle('START', 115, 2, 0, false),
        bullet: true,
      });
      continue;
    }

    cursor = insertStyledLine(requests, cursor, block.text, {
      textStyle: makeTextStyle(11, false),
      paragraphStyle: makeParagraphStyle('START', 115, 4, 0, false),
    });
  }

  return requests;
}

function insertPlainLine(requests, cursor, text) {
  requests.push({
    insertText: {
      location: { index: cursor },
      text: '\n',
    },
  });
  return cursor + 1;
}

function insertStyledLine(requests, cursor, text, options = {}) {
  const startIndex = cursor;
  const endIndex = startIndex + text.length;

  requests.push({
    insertText: {
      location: { index: startIndex },
      text: text + '\n',
    },
  });

  if (options.paragraphStyle) {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex, endIndex: endIndex + 1 },
        paragraphStyle: options.paragraphStyle,
        fields: options.paragraphFields || 'alignment,lineSpacing,spaceAbove,spaceBelow,keepWithNext',
      },
    });
  }

  if (options.textStyle) {
    requests.push({
      updateTextStyle: {
        range: { startIndex, endIndex },
        textStyle: options.textStyle,
        fields: options.textFields || 'foregroundColor,fontSize,bold,underline',
      },
    });
  }

  if (options.boldPrefixLength) {
    requests.push({
      updateTextStyle: {
        range: { startIndex, endIndex: startIndex + options.boldPrefixLength },
        textStyle: makeTextStyle(11, true),
        fields: 'foregroundColor,fontSize,bold,underline',
      },
    });
  }

  if (options.bullet) {
    requests.push({
      createParagraphBullets: {
        range: { startIndex, endIndex: endIndex + 1 },
        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
      },
    });
  }

  return endIndex + 1;
}

function makeParagraphStyle(alignment, lineSpacing, spaceBelow, spaceAbove, keepWithNext) {
  const style = {
    alignment: alignment,
    lineSpacing: lineSpacing,
    spaceBelow: { magnitude: spaceBelow, unit: 'PT' },
    spaceAbove: { magnitude: spaceAbove, unit: 'PT' },
  };

  if (keepWithNext) {
    style.keepWithNext = true;
  }

  return style;
}

function makeTextStyle(fontSize, bold) {
  return {
    foregroundColor: {
      color: {
        rgbColor: {
          red: 0,
          green: 0,
          blue: 0,
        },
      },
    },
    fontSize: { magnitude: fontSize, unit: 'PT' },
    bold: !!bold,
    underline: false,
  };
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
  currentReviewId = null; // a fresh generation is a new review, not an edit of an open draft
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

  const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
  const children = buildWordExportChildren(Paragraph, TextRun, AlignmentType);

  const doc  = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = lastReviewEmp + ' - ' + lastReviewType + ' - ' + lastReviewDate + '.docx';
  a.click();
  URL.revokeObjectURL(url);
}

function buildWordExportChildren(Paragraph, TextRun, AlignmentType) {
  const children = [];
  const reviewerInput = document.getElementById('reviewer');
  const reviewDateInput = document.getElementById('rev-date');
  const reviewer = reviewerInput ? reviewerInput.value : '';
  const reviewDate = lastReviewDate || (reviewDateInput ? reviewDateInput.value : '');

  children.push(new Paragraph({
    children: [new TextRun({ text: 'ANNUAL EMPLOYEE REVIEW', bold: true, size: 32 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Scheiderich Insurance Agency - Allstate', bold: true, size: 22 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 240 },
  }));
  [
    ['Employee', lastReviewEmp],
    ['Review Type', lastReviewType],
    ['Review Period', buildReviewPeriod(reviewDate)],
    ['Review Date', reviewDate],
    ['Reviewer', reviewer],
  ].forEach(([label, value]) => {
    children.push(buildWordLabelParagraph(Paragraph, TextRun, label, cleanWordText(value)));
  });
  pushWordBlankParagraph(children, Paragraph);

  const lines = String(lastReviewText || '').replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) {
      pushWordBlankParagraph(children, Paragraph);
      continue;
    }

    if (isWordDividerLine(line)) {
      continue;
    }

    const bullet = getWordBulletLine(line);
    if (bullet) {
      children.push(new Paragraph({
        children: [new TextRun({ text: bullet.text })],
        bullet: { level: bullet.level },
        spacing: { after: 60 },
      }));
      continue;
    }

    const clean = cleanWordText(line);
    if (!clean || isWordTitleLine(clean) || isWordSubtitleLine(clean) || isWordMetadataLine(clean)) {
      continue;
    }

    const sectionHeading = getWordSectionHeadingText(clean);
    if (sectionHeading) {
      children.push(new Paragraph({
        children: [new TextRun({ text: sectionHeading, bold: true, size: 24 })],
        spacing: { before: 240, after: 80 },
      }));
      continue;
    }

    const labelParagraph = splitWordLabelParagraph(clean);
    if (labelParagraph) {
      children.push(buildWordLabelParagraph(Paragraph, TextRun, labelParagraph.label, labelParagraph.value, 100));
      continue;
    }

    children.push(new Paragraph({
      children: [new TextRun({ text: clean })],
      spacing: { after: 100 },
    }));
  }

  return children;
}

function normalizeWordSpecialChars(text) {
  return String(text || '')
    .replace(/\u00e2\u201d\u20ac/g, '-')
    .replace(/\u00e2\u20ac[\u201c\u201d]/g, '-')
    .replace(/\u00e2\u20ac\u00a2/g, '-')
    .replace(/[\u2013\u2014\u2022\u2500\u2501]/g, '-');
}

function cleanWordText(text) {
  return normalizeWordSpecialChars(text)
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*[-*]\s+/, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isWordDividerLine(text) {
  const compact = normalizeWordSpecialChars(text).replace(/\s+/g, '');
  return /^[-_=~*]{3,}$/.test(compact);
}

function getWordBulletLine(text) {
  const match = normalizeWordSpecialChars(text).match(/^(\s*)[-*]\s+(.+)$/);
  if (!match) return null;
  const bulletText = cleanWordText(match[2]);
  if (!bulletText) return null;
  return {
    level: match[1].length >= 2 ? 1 : 0,
    text: bulletText,
  };
}

function isWordTitleLine(text) {
  return cleanWordText(text).toUpperCase() === 'ANNUAL EMPLOYEE REVIEW';
}

function isWordSubtitleLine(text) {
  const clean = cleanWordText(text);
  return /Scheiderich Insurance Agency/i.test(clean) && /Allstate/i.test(clean);
}

function isWordMetadataLine(text) {
  return /^(Employee|Review Type|Review Period|Review Date|Reviewer)\s*:/i.test(cleanWordText(text));
}

function getWordSectionHeadingText(text) {
  const clean = cleanWordText(text).replace(/^\d+[.)]\s*/, '').replace(/:$/, '').trim();
  const upper = clean.toUpperCase();
  const sections = new Set([
    'OVERVIEW',
    'SKILLS & COMPETENCIES',
    'BEHAVIOR & ATTITUDE',
    'GOALS & DEVELOPMENT PLAN',
    'FINAL COMMENTS',
    'STRENGTHS & ACHIEVEMENTS',
    'AREAS FOR GROWTH',
    'AREAS FOR GROWTH & DEVELOPMENT',
    'GOALS FOR NEXT PERIOD',
    'COMPLIANCE & CRITICAL ISSUES',
    'COMPLIANCE OR FLAGGED ISSUES',
  ]);
  return sections.has(upper) ? upper : '';
}

function splitWordLabelParagraph(text) {
  const match = cleanWordText(text).match(/^([A-Za-z][A-Za-z0-9 &/()-]{1,60}):\s*(.*)$/);
  if (!match) return null;
  return {
    label: match[1].trim(),
    value: match[2].trim(),
  };
}

function buildWordLabelParagraph(Paragraph, TextRun, label, value, spacingAfter = 40) {
  return new Paragraph({
    children: [
      new TextRun({ text: label, bold: true }),
      new TextRun({ text: value ? ': ' + value : ':' }),
    ],
    spacing: { after: spacingAfter },
  });
}

function pushWordBlankParagraph(children, Paragraph) {
  children.push(new Paragraph({ text: '' }));
}

// ============================================================
//  Inline review editing
// ============================================================
// Pull the textarea value back into lastReviewText, re-render, and leave
// edit mode. Safe to call when not editing (no-op). Shared by the "Done"
// toggle and by both save paths so unsaved edits are never lost.
function flushReviewEdit() {
  if (!reviewEditMode) return;
  const ta = document.getElementById('review-edit-textarea');
  if (ta) lastReviewText = ta.value;
  document.getElementById('review-text').innerHTML = formatReviewText(lastReviewText);
  reviewEditMode = false;
  const editBtn = document.querySelector('.output-toolbar .copy-btn');
  if (editBtn) editBtn.textContent = 'Edit Text';
}

function toggleEditReview() {
  if (!lastReviewText && !reviewEditMode) { alert('No review to edit. Generate a review first.'); return; }
  const textEl  = document.getElementById('review-text');
  const editBtn = document.querySelector('.output-toolbar .copy-btn'); // first toolbar btn = Edit Text

  if (reviewEditMode) {
    // Leaving edit mode: commit the textarea back into the source of truth.
    flushReviewEdit();
    return;
  }

  // Entering edit mode: swap rendered HTML for a textarea seeded with RAW text.
  reviewEditMode = true;
  textEl.innerHTML =
    `<textarea id="review-edit-textarea" style="width:100%;height:400px;box-sizing:border-box;` +
    `font:14px/1.6 inherit;padding:12px;border:1px solid #ddd;border-radius:8px;">` +
    `${escapeHtml(lastReviewText)}</textarea>`;
  if (editBtn) editBtn.textContent = 'Done';
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============================================================
//  Save review — DRAFT (KV only, no Doc)
// ============================================================
async function saveDraft() {
  flushReviewEdit(); // capture any in-progress textarea edits
  if (!lastReviewText) { alert('No review to save. Generate a review first.'); return; }

  const draftBtn = document.querySelector('.output-toolbar .copy-btn:nth-child(3)'); // Save Draft
  const origLabel = draftBtn ? draftBtn.textContent : 'Save Draft';
  if (draftBtn) { draftBtn.textContent = 'Saving...'; draftBtn.disabled = true; }

  getGoogleToken(async () => {
    try {
      const res = await fetch('/api/reviews-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + googleToken },
        body: JSON.stringify({
          id: currentReviewId,
          employee: lastReviewEmp,
          reviewType: document.getElementById('rev-type').value,
          reviewDate: document.getElementById('rev-date').value,
          reviewer: document.getElementById('reviewer').value,
          reviewText: lastReviewText,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.error) || 'Draft save failed.');
      }
      currentReviewId = data.id;
      alert('Draft saved');
    } catch (err) {
      alert('Error saving draft: ' + err.message);
    } finally {
      if (draftBtn) { draftBtn.textContent = origLabel; draftBtn.disabled = false; }
    }
  });
}

// ============================================================
//  Save review — FINALIZE (creates/updates the Google Doc)
// ============================================================
async function saveReview() {
  flushReviewEdit(); // capture any in-progress textarea edits
  if (!lastReviewText) { alert('No review to save. Generate a review first.'); return; }

  const saveBtn = document.querySelector('.output-toolbar .copy-btn:last-child');
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled    = true;

  const date     = document.getElementById('rev-date').value;
  const type     = document.getElementById('rev-type').value;
  const reviewer = document.getElementById('reviewer').value;

  // Build the Google Docs formatting requests (unchanged helpers)
  const requests = buildGoogleDocsRequests(formatReviewForGoogleDocs(lastReviewText, { employee: lastReviewEmp, reviewType: type, reviewDate: date, reviewer }));

  getGoogleToken(async () => {
    try {
      const res = await fetch('/api/reviews-finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + googleToken },
        body: JSON.stringify({
          id: currentReviewId,
          employee: lastReviewEmp,
          reviewType: type,
          reviewDate: date,
          reviewer,
          reviewText: lastReviewText,
          requests,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.success) {
        throw new Error((data && data.error) || 'Save failed.');
      }

      currentReviewId = data.id;
      saveBtn.textContent = 'Saved!';
      alert('Review finalized and saved.\n\n' + (data.docUrl || ''));
      setTimeout(() => { saveBtn.textContent = 'Finalize & Save'; saveBtn.disabled = false; }, 2000);

    } catch (err) {
      alert('Error saving: ' + err.message);
      saveBtn.textContent = 'Finalize & Save';
      saveBtn.disabled    = false;
    }
  });
}

async function getOrCreateFolder(name, parentId) {
  const driveId = '0ALICr0fW_IE7Uk9PVA';
  const query = encodeURIComponent(
    `name='${name}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${driveId}`,
    { headers: { 'Authorization': 'Bearer ' + googleToken } }
  );
  const searchData = await searchRes.json();
  console.log('Folder search result:', JSON.stringify(searchData));
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }
  const createRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + googleToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentId],
        driveId: driveId
      }),
    }
  );
  const createData = await createRes.json();
  console.log('Folder create result:', JSON.stringify(createData));
  return createData.id;
}

// ============================================================
//  Google OAuth
// ============================================================
function getGoogleToken(callback) {
  if (googleToken) { if (callback) callback(); return; }
  if (typeof google === 'undefined') {
    setTimeout(() => getGoogleToken(callback), 300);
    return;
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.googleClientId,
    scope: 'openid email https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents',
    callback: async (response) => {
      if (response.error) {
        alert('Google authorization failed: ' + response.error +
          '\n\nPlease make sure you are signing in with your ' +
          'gahomeinsuranceexperts.com Google account.');
        return;
      }
      googleToken = response.access_token;
      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: 'Bearer ' + googleToken } }
      );
      if (!profileRes.ok) {
        alert('Failed to fetch Google profile. Please try again.');
        return;
      }
      const profile = await profileRes.json();
      console.log('Profile fetched:', JSON.stringify(profile));
      console.log('Calling handleGoogleLogin...');
      await handleGoogleLogin({ email: profile.email });
      if (callback) callback();
    },
    error_callback: (error) => {
      if (error.type === 'popup_closed') {
        alert('Authorization window was closed. Please try again and complete the Google sign-in.');
      } else {
        alert('Authorization error: ' + error.type);
      }
    },
  });
  client.requestAccessToken({ prompt: '' });
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

  if (!emp)  { alert('Please select an employee.'); return; }
  if (!desc) { alert('Please describe what happened.'); return; }

  const successMsg = document.getElementById('inc-success');
  const errorMsg   = document.getElementById('inc-error');
  successMsg.style.display = 'none';
  errorMsg.style.display   = 'none';

  getGoogleToken(async () => {
    try {
      const res = await fetch('/api/save-incident', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + googleToken,
        },
        body: JSON.stringify({
          employee: emp,
          date: date,
          type: type,
          description: desc,
          actionTaken: action,
        }),
      });
      if (!res.ok) throw new Error('Save failed: ' + res.status);

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
    try {
      const res  = await fetch('/api/get-incidents', {
        headers: { 'Authorization': 'Bearer ' + googleToken },
      });
      const data = await res.json();
      allIncidents = (data.incidents || []).map(i => ({
        id:        i.id          || '',
        createdAt: i.createdAt   || '',
        emp:       i.employee    || '',
        date:      i.date        || '',
        type:      i.type        || '',
        desc:      i.description || '',
        action:    i.actionTaken || '',
        logger:    i.loggedBy    || '',
        entries:   i.entries     || [],
      }));
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

  listEl.innerHTML = filtered.map(i => {
    // Colon-safe DOM suffix: the full id ("incident:123") is unsafe in a CSS
    // selector, so derive a bare-number suffix for element ids/markup only.
    // The FULL id is still passed to addIncidentNote() / the API.
    const domId = String(i.id).split(':')[1] || i.id;
    const created = i.createdAt || i.date;

    // Append-only follow-ups, oldest -> newest (server appends in order).
    const entriesHtml = (i.entries || []).map(e => `
      <div class="inc-followup">
        <div style="font-size:12px;color:#888">${formatIncidentTime(e.addedAt)}${e.addedBy ? ' &middot; ' + e.addedBy : ''}</div>
        <div>${e.text || ''}</div>
      </div>`).join('');

    // Only offer the update affordance for records that have a real id to
    // append to (old records predate ids and cannot be appended to).
    const updateHtml = i.id ? `
      <button class="secondary-btn" style="margin-top:10px" onclick="document.getElementById('note-wrap-${domId}').style.display='block'; this.style.display='none'">Add Update</button>
      <button class="secondary-btn" style="margin-top:10px" onclick="downloadIncidentPdf('${i.id}')">Export PDF</button>
      <div id="note-wrap-${domId}" style="display:none;margin-top:10px">
        <textarea id="note-input-${domId}" rows="2" placeholder="Add a follow-up update..."></textarea>
        <button class="secondary-btn" style="margin-top:8px" onclick="addIncidentNote('${i.id}')">Save Update</button>
      </div>` : '';

    return `
    <div class="inc-card">
      <div class="inc-meta">
        <span class="inc-name">${i.emp}</span>
        <span class="inc-date">${created}</span>
        <span class="pill ${typeCls[i.type] || 'badge-other'}" style="border-radius:6px">${i.type}</span>
        ${i.logger ? `<span style="font-size:12px;color:#888">Logged by ${i.logger}</span>` : ''}
      </div>
      <p class="inc-text">${i.desc}</p>
      ${i.action ? `<p class="inc-followup">Follow-up: ${i.action}</p>` : ''}
      ${entriesHtml}
      ${updateHtml}
    </div>`;
  }).join('');
}

function formatIncidentTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? iso : d.toLocaleString();
}

async function addIncidentNote(id) {
  const domId = String(id).split(':')[1] || id;
  const ta = document.getElementById('note-input-' + domId);
  const note = ta ? ta.value.trim() : '';
  if (!note) { alert('Please enter an update before saving.'); return; }

  getGoogleToken(async () => {
    try {
      const res = await fetch('/api/add-incident-note', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + googleToken,
        },
        body: JSON.stringify({ id: id, note: note }),
      });
      if (!res.ok) throw new Error('Save failed: ' + res.status);

      if (ta) ta.value = '';
      loadIncidents();
    } catch (err) {
      alert('Error saving update: ' + err.message);
    }
  });
}

function downloadIncidentPdf(id) {
  // Open the window synchronously, as the FIRST thing, while we still have the
  // user-gesture context — any await/lookup before this risks the pop-up blocker.
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow pop-ups for this site to export the PDF.'); return; }

  // Look up by id (NOT array index — the rendered list may be filtered).
  const inc = allIncidents.find(x => x.id === id);
  if (!inc) { win.close(); alert('Incident not found.'); return; }

  const actionHtml = inc.action ? `
    <h2>Initial Action Taken</h2>
    <div class="body-text">${escapeHtml(inc.action)}</div>` : '';

  const entriesHtml = (inc.entries && inc.entries.length) ? `
    <h2>Follow-up Updates</h2>
    ${inc.entries.map(e => `
      <div class="followup">
        <div class="followup-meta">${escapeHtml(formatIncidentTime(e.addedAt))} &middot; ${escapeHtml(e.addedBy || '')}</div>
        <div class="body-text">${escapeHtml(e.text || '')}</div>
      </div>`).join('')}` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Incident Report - ${escapeHtml(inc.emp)} - ${escapeHtml(inc.date)}</title>
  <style>
    @page { margin: 0.75in; }
    body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
           color: #1b1b24; line-height: 1.45; max-width: 720px; margin: 0 auto; padding: 24px; }
    h1 { text-align: center; font-size: 22px; margin: 0 0 4px; }
    .subhead { text-align: center; font-size: 14px; font-weight: bold; margin: 0 0 24px; }
    h2 { font-size: 15px; margin: 24px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .label-block { margin-bottom: 8px; }
    .label-row { margin: 2px 0; }
    .label { font-weight: bold; display: inline-block; min-width: 140px; }
    .body-text { white-space: pre-wrap; }
    .followup { border-left: 3px solid #999; padding-left: 12px; margin: 12px 0; }
    .followup-meta { font-size: 12px; color: #555; margin-bottom: 4px; }
  </style>
</head>
<body onload="window.focus();window.print();">
  <h1>INCIDENT REPORT</h1>
  <div class="subhead">Scheiderich Insurance Agency - Allstate</div>

  <div class="label-block">
    <div class="label-row"><span class="label">Employee:</span> ${escapeHtml(inc.emp)}</div>
    <div class="label-row"><span class="label">Issue Type:</span> ${escapeHtml(inc.type)}</div>
    <div class="label-row"><span class="label">Date of Incident:</span> ${escapeHtml(inc.date)}</div>
    <div class="label-row"><span class="label">Logged:</span> ${escapeHtml(formatIncidentTime(inc.createdAt))}</div>
    <div class="label-row"><span class="label">Logged by:</span> ${escapeHtml(inc.logger)}</div>
  </div>

  <h2>Incident Description</h2>
  <div class="body-text">${escapeHtml(inc.desc)}</div>
  ${actionHtml}
  ${entriesHtml}
</body>
</html>`;

  win.document.write(html);
  win.document.close();
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
    try {
      const res  = await fetch('/api/reviews-list', { headers: { 'Authorization': 'Bearer ' + googleToken } });
      const data = await res.json();
      allReviews = (data && data.reviews) || []; // already newest-first from the server
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
    : allReviews.filter(r => r.employee === historyFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<div class="empty-state">No reviews saved yet. Generate a review and click "Save Draft" or "Finalize &amp; Save".</div>';
    return;
  }

  listEl.innerHTML = filtered.map((r, i) => {
    const isDraft = r.status !== 'final';
    const badge = isDraft
      ? '<span class="pill" style="border-radius:6px;background:#fef3c7;color:#92400e">DRAFT</span>'
      : '<span class="pill" style="border-radius:6px;background:#dcfce7;color:#166534">FINAL</span>';
    return `
    <div class="inc-card">
      <div class="inc-meta">
        <span class="inc-name">${r.employee || ''}</span>
        <span class="inc-date">${r.reviewDate || ''}</span>
        <span class="pill p3" style="border-radius:6px">${r.reviewType || ''}</span>
        ${badge}
        ${r.reviewer ? `<span style="font-size:12px;color:#888">By ${r.reviewer}</span>` : ''}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="secondary-btn" style="font-size:12px;padding:4px 12px" onclick="loadReviewForEdit('${r.id}')">Edit</button>
        <button class="secondary-btn" style="font-size:12px;padding:4px 12px" onclick="toggleReviewText(${i})">View review</button>
      </div>
      <div id="rev-text-${i}" style="display:none;margin-top:10px;font-size:13px;line-height:1.8;white-space:pre-wrap;border-top:1px solid #eee;padding-top:10px">${r.reviewText || ''}</div>
    </div>`;
  }).join('');
}

// Load a saved review (draft or final) back into the editor for further edits.
function loadReviewForEdit(id) {
  const record = allReviews.find(r => r.id === id);
  if (!record) { alert('Could not find that review to edit.'); return; }

  lastReviewText  = record.reviewText || '';
  lastReviewEmp   = record.employee || '';
  lastReviewType  = record.reviewType || '';
  lastReviewDate  = record.reviewDate || '';
  currentReviewId = record.id;
  reviewEditMode  = false;

  // Populate the form fields.
  if (lastReviewType) document.getElementById('rev-type').value = lastReviewType;
  if (lastReviewDate) document.getElementById('rev-date').value = lastReviewDate;
  document.getElementById('reviewer').value = record.reviewer || '';

  // Employee selector: try the dropdown, fall back to the custom-name path.
  const empSel = document.getElementById('emp-sel');
  empSel.value = lastReviewEmp;
  if (empSel.value !== lastReviewEmp) {
    empSel.value = '__custom';
    onEmpChange();
    document.getElementById('custom-name').value = lastReviewEmp;
  } else {
    onEmpChange();
  }

  // Render and reveal the output card.
  document.getElementById('review-text').innerHTML = formatReviewText(lastReviewText);
  const editBtn = document.querySelector('.output-toolbar .copy-btn');
  if (editBtn) editBtn.textContent = 'Edit Text';
  const outputBox = document.getElementById('review-output');
  outputBox.style.display = 'block';

  // Switch to the review tab (first .tab button is a valid btn for switchTab).
  switchTab('review', document.querySelector('.tab'));
  outputBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
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


async function saveDriveFolderSetting() {
  const input = document.getElementById('drive-folder-input');
  const val = input ? input.value.trim() : '';
  if (!val) { alert('Please paste a folder ID first.'); return; }
  await fetch('/api/save-settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'drive-folder-id', value: val }),
  });
  alert('Drive folder saved: ' + val);
}

async function loadDriveFolderSetting() {
  try {
    const res = await fetch('/api/get-settings?key=drive-folder-id');
    const data = await res.json();
    const input = document.getElementById('drive-folder-input');
    if (data.value && input) input.value = data.value;
  } catch { /* silent */ }
}

async function loadUsersList() {
  const users = await loadApprovedUsers();
  const container = document.getElementById('users-list');
  if (!container) return;
  container.innerHTML = users.map(u => `
    <div style="display:flex;align-items:center;justify-content:space-between;
    padding:8px 0;border-bottom:1px solid #eee;">
      <div>
        <strong>${u.name}</strong>
        <span style="color:#888;font-size:12px;">${u.email}</span>
        <span class="pill ${u.role === 'admin' ? 'p4' : 'p2'}"
          style="margin-left:8px;">${u.role}</span>
      </div>
      <button onclick="removeUser('${u.email}')"
        style="background:none;border:1px solid #ddd;border-radius:6px;
        padding:4px 10px;cursor:pointer;color:#991b1b;">Remove</button>
    </div>
  `).join('');
}

async function addUser() {
  const name = document.getElementById('new-user-name').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const role = document.getElementById('new-user-role').value;
  if (!name || !email) { alert('Please fill in name and email.'); return; }
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', name, email, role })
  });
  if (res.ok) {
    document.getElementById('new-user-name').value = '';
    document.getElementById('new-user-email').value = '';
    await loadUsersList();
  } else {
    const err = await res.json();
    alert(err.error || 'Failed to add user.');
  }
}

async function removeUser(email) {
  if (!confirm(`Remove ${email}?`)) return;
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', email })
  });
  if (res.ok) await loadUsersList();
}

// ============================================================
//  Employee portal auth (login page)
// ============================================================
function toggleEmpPassword() {
  const input = document.getElementById('emp-password');
  const span = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    span.textContent = 'HIDE';
  } else {
    input.type = 'password';
    span.textContent = 'SHOW';
  }
}

function toggleNewEmpPassword() {
  const input = document.getElementById('new-emp-password');
  const span = input.nextElementSibling;
  if (input.type === 'password') {
    input.type = 'text';
    span.textContent = 'HIDE';
  } else {
    input.type = 'password';
    span.textContent = 'SHOW';
  }
}

async function employeeLogin() {
  const username = document.getElementById('emp-username').value.trim();
  const password = document.getElementById('emp-password').value.trim();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if (!username || !password) {
    errEl.textContent = 'Please enter username and password.';
    errEl.style.display = 'block';
    return;
  }
  try {
    const res = await fetch('/api/users?type=employees');
    const employees = await res.json();
    const list = Array.isArray(employees) ? employees :
      (employees.value ? JSON.parse(employees.value) : []);
    const match = list.find(e =>
      e.username.toLowerCase() === username.toLowerCase() &&
      e.password === password
    );
    if (!match) {
      errEl.textContent = 'Invalid username or password.';
      errEl.style.display = 'block';
      return;
    }
    sessionStorage.setItem('auth', 'employee');
    sessionStorage.setItem('empName', match.name);
    sessionStorage.setItem('empReviewName', match.reviewName);
    window.location.href = '/employee.html';
  } catch(e) {
    errEl.textContent = 'Login failed. Please try again.';
    errEl.style.display = 'block';
  }
}

// ============================================================
//  Employee portal management (admin tab)
// ============================================================
async function loadEmployeesList() {
  const container = document.getElementById('employees-list');
  if (!container) return;
  try {
    const res = await fetch('/api/users?type=employees');
    const data = await res.json();
    const list = Array.isArray(data) ? data :
      (data.value ? JSON.parse(data.value) : []);
    if (list.length === 0) {
      container.innerHTML =
        '<p style="color:#888;font-size:13px;">No employee accounts yet.</p>';
      return;
    }
    container.innerHTML = list.map(e => `
      <div style="display:flex;align-items:center;
        justify-content:space-between;padding:8px 0;
        border-bottom:1px solid #eee;">
        <div>
          <strong>${e.name}</strong>
          <span style="color:#888;font-size:12px;margin-left:8px;">
            @${e.username}</span>
          <span style="color:#aaa;font-size:12px;margin-left:8px;">
            Reviews as: ${e.reviewName}</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="resetEmpPassword('${e.username}')"
            style="background:none;border:1px solid #ddd;
            border-radius:6px;padding:4px 10px;cursor:pointer;
            color:#666;font-size:12px;">Reset Password</button>
          <button onclick="removeEmployee('${e.username}')"
            style="background:none;border:1px solid #ddd;
            border-radius:6px;padding:4px 10px;cursor:pointer;
            color:#991b1b;font-size:12px;">Remove</button>
        </div>
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML =
      '<p style="color:red;font-size:13px;">Failed to load employees.</p>';
  }
}

async function addEmployee() {
  const name = document.getElementById('new-emp-name').value.trim();
  const username = document.getElementById('new-emp-username').value.trim();
  const reviewName = document.getElementById('new-emp-reviewname').value.trim();
  const password = document.getElementById('new-emp-password').value.trim();
  if (!name || !username || !reviewName || !password) {
    alert('Please fill in all fields.'); return;
  }
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add-employee', name, username, reviewName, password })
  });
  if (res.ok) {
    document.getElementById('new-emp-name').value = '';
    document.getElementById('new-emp-username').value = '';
    document.getElementById('new-emp-reviewname').value = '';
    document.getElementById('new-emp-password').value = '';
    await loadEmployeesList();
  } else {
    const err = await res.json();
    alert(err.error || 'Failed to add employee.');
  }
}

async function removeEmployee(username) {
  if (!confirm(`Remove employee account @${username}?`)) return;
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove-employee', username })
  });
  if (res.ok) await loadEmployeesList();
}

async function resetEmpPassword(username) {
  const newPass = prompt(`Enter new password for @${username}:`);
  if (!newPass) return;
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'reset-password', username, password: newPass })
  });
  if (res.ok) {
    alert('Password updated successfully.');
  } else {
    alert('Failed to update password.');
  }
}






