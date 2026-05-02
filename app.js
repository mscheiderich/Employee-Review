@@
 function formatReviewText(text) {
   return text
     .replace(/\r\n/g, '\n')
     .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
@@
     .replace(/\n\n/g, '<br><br>')
     .replace(/\n/g, '<br>');
 }
 
+const GOOGLE_DOC_LAYOUT = {
+  title: 'ANNUAL EMPLOYEE REVIEW',
+  subtitle: 'Scheiderich Insurance Agency - Allstate',
+  metadataLabels: ['Employee', 'Review Type', 'Review Period', 'Review Date', 'Reviewer'],
+  sectionHeaders: new Set([
+    'OVERVIEW',
+    'SKILLS & COMPETENCIES',
+    'BEHAVIOR & ATTITUDE',
+    'GOALS & DEVELOPMENT PLAN',
+    'FINAL COMMENTS',
+    'NEXT REVIEW DATE',
+    'STRENGTHS & ACHIEVEMENTS',
+    'AREAS FOR GROWTH & DEVELOPMENT',
+    'GOALS FOR NEXT PERIOD',
+    'COMPLIANCE OR FLAGGED ISSUES',
+  ]),
+};
+
+function formatReviewForGoogleDocs(text, context = {}) {
+  const blocks = [];
+  const bodyBlocks = parseGoogleDocBodyBlocks(text);
+  blocks.push({ type: 'title', text: GOOGLE_DOC_LAYOUT.title });
+  blocks.push({ type: 'subtitle', text: GOOGLE_DOC_LAYOUT.subtitle });
+  blocks.push({ type: 'spacer' });
+  [
+    ['Employee', context.employee || ''],
+    ['Review Type', context.reviewType || ''],
+    ['Review Period', buildReviewPeriod(context.reviewDate)],
+    ['Review Date', context.reviewDate || ''],
+    ['Reviewer', context.reviewer || ''],
+  ].forEach(([label, value]) => {
+    blocks.push({ type: 'metadata', label, value: normalizeDocLine(value) });
+  });
+  blocks.push({ type: 'spacer' });
+  blocks.push(...bodyBlocks);
+  return compressGoogleDocBlocks(blocks);
+}
+
+function parseGoogleDocBodyBlocks(text) {
+  const blocks = [];
+  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
+  for (const rawLine of lines) {
+    const trimmed = rawLine.trim();
+    if (!trimmed) { pushGoogleDocSpacer(blocks); continue; }
+    if (/^---+$/.test(trimmed)) { pushGoogleDocSpacer(blocks); continue; }
+    if (/^\s*[-*•]\s+/.test(rawLine)) {
+      const bulletText = normalizeDocLine(rawLine.replace(/^\s*[-*•]\s+/, ''));
+      if (bulletText) blocks.push({ type: 'bullet', text: bulletText });
+      continue;
+    }
+    const clean = normalizeDocLine(trimmed);
+    if (!clean) { pushGoogleDocSpacer(blocks); continue; }
+    if (isTitleLine(clean) || isSubtitleLine(clean) || isMetadataLine(clean)) continue;
+    if (isSectionHeading(clean)) { blocks.push({ type: 'sectionHeading', text: clean.replace(/:$/, '').toUpperCase() }); continue; }
+    const labelParagraph = splitLabelParagraph(clean);
+    if (labelParagraph) { blocks.push({ type: 'labelParagraph', label: labelParagraph.label, value: labelParagraph.value }); continue; }
+    blocks.push({ type: 'paragraph', text: clean });
+  }
+  return compressGoogleDocBlocks(blocks);
+}
+
+function compressGoogleDocBlocks(blocks) {
+  const compact = [];
+  for (const block of blocks) {
+    if (block.type === 'spacer') {
+      if (compact.length && compact[compact.length - 1].type !== 'spacer') compact.push(block);
+      continue;
+    }
+    compact.push(block);
+  }
+  while (compact.length && compact[0].type === 'spacer') compact.shift();
+  while (compact.length && compact[compact.length - 1].type === 'spacer') compact.pop();
+  return compact;
+}
+
+function pushGoogleDocSpacer(blocks) {
+  if (!blocks.length || blocks[blocks.length - 1].type !== 'spacer') blocks.push({ type: 'spacer' });
+}
+
+function normalizeDocLine(text) {
+  return String(text || '')
+    .replace(/^\s*#{1,6}\s*/, '')
+    .replace(/\*\*/g, '')
+    .replace(/\*/g, '')
+    .replace(/\s+/g, ' ')
+    .trim();
+}
+
+function isTitleLine(text) {
+  return normalizeDocLine(text).toUpperCase() === GOOGLE_DOC_LAYOUT.title;
+}
+
+function isSubtitleLine(text) {
+  const normalized = normalizeDocLine(text);
+  return /Scheiderich Insurance Agency/i.test(normalized) && /Allstate/i.test(normalized);
+}
+
+function isMetadataLine(text) {
+  const normalized = normalizeDocLine(text);
+  return GOOGLE_DOC_LAYOUT.metadataLabels.some((label) => normalized.toLowerCase().startsWith(label.toLowerCase() + ':'));
+}
+
+function isSectionHeading(text) {
+  const normalized = normalizeDocLine(text).replace(/:$/, '').trim();
+  const upper = normalized.toUpperCase();
+  if (GOOGLE_DOC_LAYOUT.sectionHeaders.has(upper)) return true;
+  return upper.length > 0 && upper.length < 80 && upper === normalized && /^[A-Z0-9 &/,:.'()-]+$/.test(upper);
+}
+
+function splitLabelParagraph(text) {
+  const normalized = normalizeDocLine(text);
+  const match = normalized.match(/^([A-Za-z][A-Za-z0-9 &/()-]{1,60}):\s*(.*)$/);
+  if (!match) return null;
+  const label = match[1].trim();
+  if (GOOGLE_DOC_LAYOUT.sectionHeaders.has(label.toUpperCase())) return null;
+  if (label.length > 60) return null;
+  return { label, value: match[2].trim() };
+}
+
+function buildReviewPeriod(reviewDate) {
+  if (reviewDate) {
+    const parsed = new Date(reviewDate);
+    if (!Number.isNaN(parsed.getTime())) return String(parsed.getFullYear());
+  }
+  return String(new Date().getFullYear());
+}
+
+function buildGoogleDocsRequests(blocks) {
+  const requests = [];
+  let cursor = 1;
+  for (const block of blocks) {
+    if (block.type === 'spacer') { cursor = insertPlainLine(requests, cursor); continue; }
+    if (block.type === 'title') {
+      cursor = insertStyledLine(requests, cursor, block.text, {
+        textStyle: makeTextStyle(16, true),
+        paragraphStyle: makeParagraphStyle('CENTER', 115, 4, 0, true),
+      });
+      continue;
+    }
+    if (block.type === 'subtitle') {
+      cursor = insertStyledLine(requests, cursor, block.text, {
+        textStyle: makeTextStyle(11, true),
+        paragraphStyle: makeParagraphStyle('CENTER', 115, 8, 0, true),
+      });
+      continue;
+    }
+    if (block.type === 'metadata') {
+      const lineText = block.value ? `${block.label}: ${block.value}` : `${block.label}:`;
+      cursor = insertStyledLine(requests, cursor, lineText, {
+        textStyle: makeTextStyle(11, false),
+        paragraphStyle: makeParagraphStyle('START', 115, 2, 0, false),
+        boldPrefixLength: block.label.length + 1,
+      });
+      continue;
+    }
+    if (block.type === 'sectionHeading') {
+      cursor = insertStyledLine(requests, cursor, block.text.toUpperCase(), {
+        textStyle: makeTextStyle(13, true),
+        paragraphStyle: makeParagraphStyle('START', 115, 6, 12, true),
+      });
+      continue;
+    }
+    if (block.type === 'labelParagraph') {
+      const lineText = block.value ? `${block.label}: ${block.value}` : `${block.label}:`;
+      cursor = insertStyledLine(requests, cursor, lineText, {
+        textStyle: makeTextStyle(11, false),
+        paragraphStyle: makeParagraphStyle('START', 115, 4, 0, false),
+        boldPrefixLength: block.label.length + 1,
+      });
+      continue;
+    }
+    if (block.type === 'bullet') {
+      cursor = insertStyledLine(requests, cursor, block.text, {
+        textStyle: makeTextStyle(11, false),
+        paragraphStyle: makeParagraphStyle('START', 115, 3, 0, false),
+        bullet: true,
+      });
+      continue;
+    }
+    cursor = insertStyledLine(requests, cursor, block.text, {
+      textStyle: makeTextStyle(11, false),
+      paragraphStyle: makeParagraphStyle('START', 115, 4, 0, false),
+    });
+  }
+  return requests;
+}
+
+function insertPlainLine(requests, cursor) {
+  requests.push({ insertText: { location: { index: cursor }, text: '\n' } });
+  return cursor + 1;
+}
+
+function insertStyledLine(requests, cursor, text, options = {}) {
+  const startIndex = cursor;
+  const endIndex = startIndex + text.length;
+  requests.push({ insertText: { location: { index: startIndex }, text: text + '\n' } });
+  if (options.paragraphStyle) {
+    requests.push({
+      updateParagraphStyle: {
+        range: { startIndex, endIndex: endIndex + 1 },
+        paragraphStyle: options.paragraphStyle,
+        fields: options.paragraphFields || 'alignment,lineSpacing,spaceAbove,spaceBelow,keepWithNext',
+      },
+    });
+  }
+  if (options.textStyle) {
+    requests.push({
+      updateTextStyle: {
+        range: { startIndex, endIndex },
+        textStyle: options.textStyle,
+        fields: options.textFields || 'foregroundColor,fontSize,bold,underline',
+      },
+    });
+  }
+  if (options.boldPrefixLength) {
+    requests.push({
+      updateTextStyle: {
+        range: { startIndex, endIndex: startIndex + options.boldPrefixLength },
+        textStyle: makeTextStyle(11, true),
+        fields: 'foregroundColor,fontSize,bold,underline',
+      },
+    });
+  }
+  if (options.bullet) {
+    requests.push({
+      createParagraphBullets: {
+        range: { startIndex, endIndex: endIndex + 1 },
+        bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
+      },
+    });
+  }
+  return endIndex + 1;
+}
+
+function makeParagraphStyle(alignment, lineSpacing, spaceBelow, spaceAbove, keepWithNext) {
+  const style = {
+    alignment,
+    lineSpacing,
+    spaceBelow: { magnitude: spaceBelow, unit: 'PT' },
+    spaceAbove: { magnitude: spaceAbove, unit: 'PT' },
+  };
+  if (keepWithNext) style.keepWithNext = true;
+  return style;
+}
+
+function makeTextStyle(fontSize, bold) {
+  return {
+    foregroundColor: { color: { rgbColor: { red: 0, green: 0, blue: 0 } } },
+    fontSize: { magnitude: fontSize, unit: 'PT' },
+    bold: !!bold,
+    underline: false,
+  };
+}
@@
 async function saveReview() {
   if (!lastReviewText) { alert('No review to save. Generate a review first.'); return; }
@@
-      // 4. Create the review file in Drive as a Google Doc
+      // 4. Create a blank Google Doc in Drive
       const fileName = lastReviewType + ' - ' + (date || new Date().toISOString().split('T')[0]);
-      const meta = JSON.stringify({
-        name: fileName,
-        mimeType: 'application/vnd.google-apps.document',
-        parents: [empFolderId],
-      });
-      const form = new FormData();
-      form.append('metadata', new Blob([meta], { type: 'application/json' }));
-      form.append('file', new Blob([lastReviewText], { type: 'text/plain' }));
-      await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
+      const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
         method: 'POST',
-        headers: { 'Authorization': 'Bearer ' + googleToken },
-        body: form,
+        headers: {
+          'Authorization': 'Bearer ' + googleToken,
+          'Content-Type': 'application/json',
+        },
+        body: JSON.stringify({
+          name: fileName,
+          mimeType: 'application/vnd.google-apps.document',
+          parents: [empFolderId],
+        }),
       });
+      const createdDoc = await createRes.json();
+      if (!createRes.ok || !createdDoc.id) {
+        throw new Error((createdDoc && createdDoc.error && createdDoc.error.message) || 'Could not create Google Doc.');
+      }
+
+      // 5. Format the review content into Google Docs API requests
+      const requests = buildGoogleDocsRequests(formatReviewForGoogleDocs(lastReviewText, {
+        employee: lastReviewEmp,
+        reviewType: type,
+        reviewDate: date,
+        reviewer,
+      }));
+      const docsRes = await fetch(`https://docs.googleapis.com/v1/documents/${createdDoc.id}:batchUpdate`, {
+        method: 'POST',
+        headers: {
+          'Authorization': 'Bearer ' + googleToken,
+          'Content-Type': 'application/json',
+        },
+        body: JSON.stringify({ requests }),
+      });
+      const docsData = await docsRes.json().catch(() => null);
+      if (!docsRes.ok) {
+        throw new Error((docsData && docsData.error && docsData.error.message) || 'Could not format Google Doc.');
+      }
