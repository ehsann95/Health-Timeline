const { lookupRange, classifyFlag } = require("./reference-ranges");

// Load heavy native-ish packages straight from node_modules at runtime,
// bypassing the bundler (keeps Next's build simple and avoids worker issues).
const runtimeRequire = () => {
  const { createRequire } = require("module");
  return createRequire(process.cwd() + "/package.json");
};

// Reject a promise that takes longer than `ms` (prevents hung OCR from wedging the API)
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms)),
  ]);
}

// Extract raw text from an uploaded PDF or image buffer.
// PDF: pdf-parse (text layer). Images: Tesseract OCR.
async function extractText(buffer, mimeType, filename) {
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(filename || "");
  const req = runtimeRequire();

  if (isPdf) {
    try {
      const { PDFParse } = req("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const res = await withTimeout(parser.getText(), 30000, "PDF text extraction");
        const text = (res.text || "").trim();
        if (text.replace(/\s/g, "").length > 50) return { text, method: "pdf-text" };
      } finally {
        await parser.destroy().catch(() => {});
      }
    } catch (e) {
      // fall through to OCR / error below
    }
  }

  if (!isPdf) {
    // Image → OCR via Tesseract (downloads eng language data on first use)
    const { createWorker } = req("tesseract.js");
    const worker = await withTimeout(createWorker("eng"), 60000, "OCR worker init");
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
  hct: "Hematocrit",
  plt: "Platelet Count",
  neut: "Neutrophils",
  lymph: "Lymphocytes",
  mono: "Monocytes",
  eo: "Eosinophils",
  baso: "Basophils",
  ret: "Reticulocytes",
  alp: "Alkaline Phosphatase",
};

function canonicalName(raw) {
  let name = raw.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  name = name.replace(/\s*\(\s*(total|direct)\s*\)/i, " $1"); // "Bilirubin (Total)" → "Bilirubin Total"
  const abs = /#$/.test(name);
  const pct = /%$/.test(name);
  const base = name.replace(/[%#]+$/, "").trim().toLowerCase();
  if (base === "sgpt/alt") return "ALT (SGPT)";
  if (WORD_ALIASES[base]) name = WORD_ALIASES[base] + (abs ? " (abs)" : pct ? " %" : "");
  return name;
}

// Strategy A: name-first rows ("Hemoglobin 13.2 g/dL 13 - 17")
const LINE_RE =
  /^[\s>*•\-]*([A-Za-z][A-Za-z0-9 ()\/\-\+%,\.&']{1,45}?)[\s:.*=]+([\d,]+(?:\.\d+)?)\s*([a-zA-Zµ%\/^0-9]{0,12})?\s*(?:[\(\[]?\s*([\d.]+)\s*[-–to]+\s*([\d.]+)\s*[\)\]]?)?/;

const NUM = /^\d[\d,]*(?:\.\d+)?$/;
// Unit whitelist (handles messy multi-space layouts where any word could look like a unit)
const UNIT_RE =
  /^(mg\/d[l]|gm\/d[l]|g\/d[l]|u\/l|iu\/l|miu\/l|µiu\/ml|uiu\/ml|ng\/ml|pg\/ml|µg\/dl|ug\/dl|ng\/dl|mg\/l|µg\/l|ug\/l|mmol\/l|meq\/l|µmol\/l|umol\/l|mm\/hr|ml\/min|\/µl|\/ul|mill\/cumm|cells\/µl|10\^[36]\/[µuμ]?l?|f[l]|p[g]|%|g%|mg%|µg|ug|\/hpf)$/i;

// Map raw section headers ("Biochemistry", "Clinical Haemotology") to categories
function sectionCategory(section) {
  if (!section) return "Other";
  const s = section.toLowerCase();
  if (/ha[eé]m[ao]tolog|blood count/.test(s)) return "CBC";
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
  const lines = rawText.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 6) continue;
    // Skip header/footer noise
    if (/^(page|printed|reported|lab|doctor|patient|name|age|sex|date|sample|ref(erence)? by)/i.test(line)) continue;

    // Section headers set the category context for following rows
    if (!/\d/.test(line)) {
      const sec = line.match(/^(biochem.*|.*ha[eé]m[ao]tolog.*|serolog.*|immunolog.*|coagul.*|urine.*|complete blood count.*)$/i);
      if (sec) { section = sec[1]; continue; }
    }

    // Strategy A: name-first rows ("Hemoglobin 13.2 g/dL 13 - 17")
    const m = line.match(LINE_RE);
    if (m) {
      const name = canonicalName(m[1]);
      if (!name || name.length < 2) continue;
      if (/^(total|date|time|mrp|age)$/i.test(name)) continue;
      const value = parseFloat(m[2].replace(/,/g, ""));
      if (!isFinite(value)) continue;
      const unit = m[3] && !/^\d+$/.test(m[3]) ? m[3] : null;
      const t = makeTest(name, value, unit, m[4] ? parseFloat(m[4]) : null, m[5] ? parseFloat(m[5]) : null, section);
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

module.exports = { extractText, parseTests, buildSummary, LINE_RE };
