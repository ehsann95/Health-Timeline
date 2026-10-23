const { lookupRange, classifyFlag } = require("./reference-ranges");

// Reject a promise that takes longer than `ms` (prevents hung OCR from wedging the API)
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

// Extract raw text from an uploaded PDF or image buffer.
// PDF: pdf-parse (text layer). Images: Tesseract OCR.
//
// IMPORTANT: pdf-parse / tesseract.js must be required with LITERAL specifiers
// (never via createRequire(process.cwd()...) or other runtime indirection):
// Vercel packages each route using @vercel/nft, which only traces statically
// visible requires. They are marked external in next.config.js so webpack
// leaves them as native `require()` calls instead of bundling them.
async function extractText(buffer, mimeType, filename) {
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(filename || "");

  if (isPdf) {
    let PDFParse;
    try {
      ({ PDFParse } = require("pdf-parse"));
    } catch (e) {
      console.error("[extractText] failed to load pdf-parse:", e);
      throw new Error(`PDF parser library failed to load: ${e.message}`);
    }
    let parser = null;
    try {
      parser = new PDFParse({ data: new Uint8Array(buffer) });
      const res = await withTimeout(parser.getText(), 30000, "PDF text extraction");
      const text = (res.text || "").trim();
      if (text.replace(/\s/g, "").length > 50) return { text, method: "pdf-text" };
      // Little/no text → it really is a scan; fall through to the message below.
    } catch (e) {
      console.error("[extractText] pdf-parse error:", e);
      throw new Error(`Failed to extract text from this PDF: ${e.message}`);
    } finally {
      if (parser) await parser.destroy().catch(() => {});
    }
  }

  if (!isPdf) {
    // Image → OCR via Tesseract (downloads eng language data on first use)
    let createWorker;
    try {
      ({ createWorker } = require("tesseract.js"));
    } catch (e) {
      console.error("[extractText] failed to load tesseract.js:", e);
      throw new Error(`OCR library failed to load: ${e.message}`);
    }
    const worker = await withTimeout(
      createWorker("eng", 1, { cachePath: "/tmp" }),
      60000,
      "OCR worker init"
    );
    try {
      const { data } = await withTimeout(worker.recognize(buffer), 120000, "OCR recognition");
      return { text: (data.text || "").trim(), method: "ocr" };
    } finally {
      await worker.terminate();
    }
  }

  throw new Error(
    "This PDF has no extractable text layer (likely a scan). Please upload a photo/scan as JPG or PNG for OCR, or a text-based PDF."
  );
}

// Canonicalize common lab-report abbreviations so ranges/trends match curated keys
const WORD_ALIASES = {
  hgb: "Hemoglobin",
  hb: "Hemoglobin",
  haemoglobin: "Hemoglobin",
  hct: "Hematocrit (HCT)",
  hematocrit: "Hematocrit (HCT)",
  plt: "Platelet Count",
  neut: "Neutrophils",
  lymph: "Lymphocytes",
  mono: "Monocytes",
  eo: "Eosinophils",
  baso: "Basophils",
  ret: "Reticulocytes",
  alp: "Alkaline Phosphatase",
  "r.b.c count": "RBC Count",
  "r.b.c": "RBC",
  "rbc count": "RBC Count",
  "total wbc count": "Total WBC Count",
  "sgpt/alt": "ALT (SGPT)",
  "sgot/ast": "AST (SGOT)",
  "bilirubin-total": "Bilirubin Total",
  "bilirubin-direct": "Bilirubin Direct",
  "bilirubin-indirect": "Bilirubin Indirect",
  "albumin/globulin ratio": "A/G Ratio",
  "albumin:globulin ratio": "A/G Ratio",
  "a/g ratio": "A/G Ratio",
};

function collapseRepeats(str) {
  return str
    .replace(/([^\t\n\r]+?)(?:\t+\1)+/g, "$1") // repeated tab columns: "124.00\t124.00..." -> "124.00"
    .replace(/(\b[\d.]+\b)(?:[\t ]+\1)+/g, "$1") // repeated numbers: "3.82 3.82 3.82" -> "3.82"
    .replace(/([A-Za-z]):([A-Za-z])/g, "$1/$2"); // "Albumin:Globulin" -> "Albumin/Globulin"
}

function canonicalName(raw) {
  let name = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  name = name.replace(/\s*\(\s*(total|direct|indirect)\s*\)/i, " $1"); // "Bilirubin (Total)" → "Bilirubin Total"
  name = name.replace(/\bR\.B\.C(?:\.|\b)/i, "RBC");
  const abs = /#$/.test(name);
  const pct = /%$/.test(name);
  const base = name.replace(/[%#]+$/, "").trim().toLowerCase();
  if (WORD_ALIASES[base]) name = WORD_ALIASES[base] + (abs ? " (abs)" : pct ? " %" : "");
  return name;
}

// Strategy A: name-first rows ("Hemoglobin 13.2 g/dL 13 - 17")
const LINE_RE =
  /^[\s>*•\-]*([A-Za-z][A-Za-z0-9 ()\/\-\+%,\.&']{1,45}?)[\s:.*=]+([\d,]+(?:\.\d+)?)\s*([a-zA-Zµ%][a-zA-Zµ%\/^0-9]{0,11})?\s*(?:[\(\[]?\s*([\d.]+)\s*[-–to]+\s*([\d.]+)\s*[\)\]]?)?/;

const NUM = /^\d[\d,]*(?:\.\d+)?$/;
// Unit whitelist (handles messy multi-space layouts where any word could look like a unit)
const UNIT_RE =
  /^(mg\/d[l]|gm\/d[l]|g\/d[l]|u\/l|iu\/l|miu\/l|µiu\/ml|uiu\/ml|ng\/ml|pg\/ml|µg\/dl|ug\/dl|ng\/dl|mg\/l|µg\/l|ug\/l|mmol\/l|meq\/l|µmol\/l|umol\/l|mm\/hr|ml\/min|\/µl|\/ul|mill\/cumm|cells\/µl|10\^[36]\/[µuμ]?l?|f[l]|p[g]|%|g%|mg%|µg|ug|\/hpf)$/i;

// Map raw section headers ("Biochemistry", "Clinical Haemotology") to categories
function sectionCategory(section) {
  if (!section) return "Other";
  const s = section.toLowerCase();
  if (/ha[eé]m[ao]tolog|blood count|cbc/.test(s)) return "CBC";
  if (/liver|lft|hepatic/.test(s)) return "LFT";
  if (/kidney|renal|kft|rft/.test(s)) return "KFT";
  if (/lipid/.test(s)) return "Lipid";
  if (/thyroid/.test(s)) return "Thyroid";
  if (/biochem/.test(s)) return "Biochemistry";
  if (/serolog|immunolog/.test(s)) return "Serology";
  if (/urine/.test(s)) return "Urine";
  if (/coagul/.test(s)) return "Coagulation";
  return "Other";
}

// Shared test-row constructor: prefers the range printed on the report,
// falls back to curated ranges; keeps lakh/cumm rescaling for platelets.
function makeTest(name, value, unit, refLowIn, refHighIn, section, keepUnranged) {
  const range = lookupRange(name);
  const low = refLowIn != null ? refLowIn : range ? range.low : null;
  const high = refHighIn != null ? refHighIn : range ? range.high : null;
  if (low == null && high == null && !range && !keepUnranged) return null;
  let adjLow = low, adjHigh = high;
  // Labs often print platelet counts in lakh/cumm (x100000): "1.5 - 4.5"
  // Skip rescaling when the row carries its own per-µL unit (10^3/µL etc.)
  if (/platelet/i.test(name) && adjHigh != null && adjHigh < 100 && !(unit && /\^/.test(unit))) {
    adjLow = adjLow != null ? adjLow * 100000 : null;
    adjHigh = adjHigh * 100000;
  }
  const category = range ? range.category : sectionCategory(section);
  return {
    name,
    category,
    value,
    unit: unit || (range ? range.unit : null),
    refLow: adjLow,
    refHigh: adjHigh,
    flag: classifyFlag(value, adjLow, adjHigh),
    verified: false,
  };
}

function parseTests(rawText) {
  const results = [];
  let section = null;
  const rawLines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const normalizedLines = [];

  for (let i = 0; i < rawLines.length; i++) {
    let line = collapseRepeats(rawLines[i]);
    if (!line || line.length < 2) continue;

    // Check if line is a standalone test name followed by Method: and/or value line
    const isHeaderOrMeta =
      /^(page|printed|reported|lab|doctor|dr\.|patient|name|age|gender|sex|date|sample|collected|center|ref|method|test|assay|units|biological|\*\*\*|contd|shaheen|tel)/i.test(
        line
      );

    if (!isHeaderOrMeta && !/\d/.test(line)) {
      let lookaheadIdx = i + 1;
      // Skip method / technique descriptions
      while (
        lookaheadIdx < rawLines.length &&
        /^(method|technique|calc(ulated)?)\s*:/i.test(rawLines[lookaheadIdx])
      ) {
        lookaheadIdx++;
      }
      if (lookaheadIdx < rawLines.length) {
        const nextLine = collapseRepeats(rawLines[lookaheadIdx]);
        // If next line starts with a numeric assay result e.g. "0.54 mg/dL 0.00 - 1.40" or "124.00 U/L 2.00 - 50.00"
        if (/^[\d,]+(?:\.\d+)?\s+[a-zA-Z%µ\d]/.test(nextLine)) {
          line = `${line} ${nextLine}`;
          i = lookaheadIdx;
        }
      }
    }
    normalizedLines.push(line);
  }

  for (const line of normalizedLines) {
    if (
      /^(page|printed|reported|lab|doctor|dr\.|patient|name|age|gender|sex|date|sample|collected|center|ref|method|test|assay|units|biological|\*\*\*|contd|shaheen|tel)/i.test(
        line
      )
    ) {
      continue;
    }

    // Section headers set the category context for following rows
    if (!/\d/.test(line)) {
      const sec = line.match(
        /^(biochem.*|.*ha[eé]m[ao]tolog.*|serolog.*|immunolog.*|coagul.*|urine.*|complete blood count.*|liver.*|.*lft.*|kidney.*|.*kft.*|lipid.*|thyroid.*)$/i
      );
      if (sec) {
        section = sec[1];
        continue;
      }
    }

    // Strategy A: name-first rows ("Hemoglobin 13.2 g/dL 13 - 17")
    const m = line.match(LINE_RE);
    if (m) {
      const name = canonicalName(m[1]);
      if (!name || name.length < 2) continue;
      if (/^(total|date|time|mrp|age|tel|sample)$/i.test(name)) continue;
      const value = parseFloat(m[2].replace(/,/g, ""));
      if (!isFinite(value)) continue;
      const unit = m[3] && !/^\d+$/.test(m[3]) ? m[3] : null;
      const t = makeTest(
        name,
        value,
        unit,
        m[4] ? parseFloat(m[4]) : null,
        m[5] ? parseFloat(m[5]) : null,
        section
      );
      if (t) results.push(t);
      continue;
    }

    // Strategy B: range-first rows from tabular lab exports (Jasper etc.)
    //   "2 25 248<TAB>LDH U/L<TAB>nH IFCC<TAB>505.3"    → LDH 505.3 U/L (25-248) HIGH
    //   "21 MPV fL<TAB>10.7"                             → MPV 10.7 fL (no range)
    //   "20 150.00 450.00<TAB>PLT 10^3/μ<TAB>120 mpc"    → Platelet Count 120 (150-450) LOW
    const rm = line.match(/^(\d{1,3})\s+(.+)$/);
    if (!rm) continue;
    const segs = rm[2].split(/\t+/);
    let nameTokens = segs[0].trim().split(/\s+/);
    let restSegs = segs.slice(1);
    let refLow = null, refHigh = null;
    if (NUM.test(nameTokens[0]) && nameTokens[1] && NUM.test(nameTokens[1])) {
      refLow = parseFloat(nameTokens[0].replace(/,/g, ""));
      refHigh = parseFloat(nameTokens[1].replace(/,/g, ""));
      if (nameTokens.length >= 3) {
        nameTokens = nameTokens.slice(2);
      } else if (restSegs.length) {
        // name lives in the next tab-separated segment ("25 248<TAB>LDH U/L<TAB>...")
        nameTokens = restSegs[0].trim().split(/\s+/);
        restSegs = restSegs.slice(1);
      } else {
        nameTokens = [];
      }
    }
    // Drop flag/junk tokens like "." ".."
    while (nameTokens.length && /^[.,]*$/.test(nameTokens[nameTokens.length - 1])) nameTokens.pop();
    if (!nameTokens.length) continue;

    // Result value = last standalone numeric token, searching right-to-left
    let value = null;
    for (const seg of [...restSegs].reverse()) {
      const toks = seg.trim().split(/\s+/);
      for (let i = toks.length - 1; i >= 0; i--) {
        if (NUM.test(toks[i])) { value = parseFloat(toks[i].replace(/,/g, "")); break; }
      }
      if (value != null) break;
    }
    if (value == null) {
      // value may be merged into the name segment (no tab before it)
      for (let i = nameTokens.length - 1; i >= 0; i--) {
        if (NUM.test(nameTokens[i])) { value = parseFloat(nameTokens[i].replace(/,/g, "")); nameTokens.splice(i, 1); break; }
      }
    }
    if (value == null) continue;

    // Unit = rightmost token matching a known unit pattern
    let unit = null;
    for (let i = nameTokens.length - 1; i >= 0; i--) {
      if (UNIT_RE.test(nameTokens[i]) && !NUM.test(nameTokens[i])) {
        unit = nameTokens[i];
        nameTokens.splice(i, 1);
        break;
      }
    }
    const name = canonicalName(nameTokens.join(" "));
    if (!name || name.length < 2 || /^\d/.test(name)) continue;
    if (/^(order|method|remark|sno|flag|print|note|verified|created|collected|accepted)$/i.test(name)) continue;

    const t = makeTest(name, value, unit, refLow, refHigh, section, true);
    if (t) results.push(t);
  }
  return results;
}

// Build a rule-based plain-language summary from parsed tests
function buildSummary(tests) {
  const abnormal = tests.filter((t) => t.flag !== "NORMAL");
  if (!tests.length) return "No test values could be parsed from this report. Please add them manually.";
  if (!abnormal.length) {
    return `All ${tests.length} parsed values are within their reference ranges. No flags raised.`;
  }
  const parts = [];
  const high = abnormal.filter((t) => t.flag === "HIGH");
  const low = abnormal.filter((t) => t.flag === "LOW");
  const seen = new Set();
  for (const t of [...high, ...low]) {
    const range = lookupRange(t.name);
    if (!range) continue;
    if (seen.has(range.key)) continue;
    seen.add(range.key);
    const note = require("./reference-ranges").INTERPRETATIONS[range.key];
    if (note) parts.push(`• ${t.name} is ${t.flag === "HIGH" ? "above" : "below"} range (${t.value}${t.unit ? " " + t.unit : ""}): ${note}`);
    if (parts.length >= 6) break;
  }
  const head = `${abnormal.length} of ${tests.length} values are out of range (${high.length} high, ${low.length} low).`;
  return head + (parts.length ? "\n" + parts.join("\n") : "\nInterpretation rules not available for these tests — please consult a doctor.");
}

// Priority order for standard panels in report naming
const PANEL_ORDER = [
  "CBC",
  "LFT",
  "KFT",
  "Lipid",
  "Blood Sugar",
  "Thyroid",
  "Vitamins",
  "Iron",
  "Cardiac",
  "Inflammation",
];

function getDistinctCategories(tests) {
  if (!tests || !tests.length) return [];
  const counts = {};
  for (const t of tests) {
    const cat = t.category;
    if (cat && cat !== "Other" && cat !== "General") {
      counts[cat] = (counts[cat] || 0) + 1;
    }
  }

  return Object.keys(counts).sort((a, b) => {
    const idxA = PANEL_ORDER.indexOf(a);
    const idxB = PANEL_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

// Automatically infer clean report title from parsed tests
function detectReportType(tests, requestedType) {
  const detected = getDistinctCategories(tests);

  if (requestedType && requestedType !== "Auto-Detect" && requestedType !== "Other" && requestedType !== "Unknown") {
    // If the user explicitly chose a specific type and that's all that's there, keep it
    if (detected.length <= 1) return requestedType;
    // If multiple panels are detected, join them clearly
    if (!detected.includes(requestedType)) {
      detected.unshift(requestedType);
    }
    return detected.length <= 3
      ? detected.join(" + ")
      : `Comprehensive Panel (${detected.slice(0, 3).join(", ")}+)`;
  }

  if (detected.length === 0) {
    return requestedType && requestedType !== "Auto-Detect" ? requestedType : "General Lab Report";
  }
  if (detected.length === 1) {
    return detected[0];
  }
  if (detected.length <= 3) {
    return detected.join(" + ");
  }
  return `Comprehensive Panel (${detected.slice(0, 4).join(", ")})`;
}

module.exports = { extractText, parseTests, buildSummary, detectReportType, getDistinctCategories, LINE_RE };
