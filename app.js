// app.js v3 â€” clean rebuild, no template literal corruption
// ============================================================
//  CONFIGURATION â€” update before deploying
// ============================================================
const CONFIG = {
  password: 'SchAgency2025!',
  proxyUrl: '/api/generate-review',
  sheetId: '1M8LvVrgPCarObzGSWeicjpQSh43FvfSDm79wk1efOW4',
  incidentSheet: 'Incidents',
  reviewSheet: 'Reviews',
  googleClientId: '152603955396-3pau8atgci9o9icccmfbirblu0pcjesc.apps.googleusercontent.com',
  driveFolderName: 'Employee Reviews',
};

// ============================================================
//  Default employee list â€” admin can add more via the UI
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
        <option value="4">4 â€” Exceeds</option>
        <option value="3">3 â€” Meets</option>
        <option value="2">2 â€” Needs improvement</option>
        <option value="1">1 â€” Does not meet</option>
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
    .replace(/^[-*â€¢] (.+)$/gm, '<li style="margin-left:1.5rem;margin-bottom:5px;line-height:1.6">$1</li>')
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

  return `You are drafting a professional employee review for the Scheiderich Insurance Agency (an Allstate agency). Use a tone of supportive growth â€” reviews should motivate and develop the employee, not punish them. Use bullet points where appropriate. Be specific and action-oriented.

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

AREAS FOR GROWTH (rewrite in supportive, growth-focused language â€” frame as opportunities, use bullet points):
${growth || 'Not provided'}

GOALS FOR NEXT PERIOD (use bullet points):
${goals || 'Not provided'}
${hasCompliance ? '\nCOMPLIANCE / FLAGGED ISSUES (address clearly and firmly but professionally):\n' + compliance : ''}

Write a complete professional employee review with these sections:
1. Overview (2â€“3 sentence summary)
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

      // 4. Create a blank Google Doc in Drive
      const fileName = lastReviewType + ' - ' + (date || new Date().toISOString().split('T')[0]);
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + googleToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: fileName,
          mimeType: 'application/vnd.google-apps.document',
          parents: [empFolderId],
        }),
      });
      const createdDoc = await createRes.json();
      if (!createRes.ok || !createdDoc.id) {
        throw new Error((createdDoc && createdDoc.error && createdDoc.error.message) || 'Could not create Google Doc.');
      }

      // 5. Format the review content into Google Docs API requests
      const requests = buildGoogleDocsRequests(formatReviewForGoogleDocs(lastReviewText, { employee: lastReviewEmp, reviewType: type, reviewDate: date, reviewer }));
      const docsRes = await fetch(`https://docs.googleapis.com/v1/documents/${createdDoc.id}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + googleToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests }),
      });
      const docsData = await docsRes.json().catch(() => null);
      if (!docsRes.ok) {
        throw new Error((docsData && docsData.error && docsData.error.message) || 'Could not format Google Doc.');
      }

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
//  Sheet setup â€” run once via Admin tab
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






