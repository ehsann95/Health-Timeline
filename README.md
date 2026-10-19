# Lab Report Manager (Prototype)

Free, local-first lab report manager: upload PDF/image lab reports, auto-parse
test values, view/search/filter with abnormal highlighting, get rule-based
summaries, and compare trends over time. **No paid services** — everything runs
locally (SQLite + on-device OCR).

## Stack

- Next.js 14 (App Router) + React 18 (plain JS, no TS)
- SQLite via Prisma (`prisma/dev.db`)
- PDF text extraction: `pdf-parse` (v2, `PDFParse.getText()`)
- OCR for images: `tesseract.js` (downloads eng data on first use)
- Charts: `recharts` · Styling: Tailwind CSS 3

## Run

```bash
npm install
npm run db:push     # create SQLite schema
npm run db:seed     # 3 sample reports for instant demo
npm run dev         # http://localhost:3000
```

Production: `npm run build && npm start`

## Features

- **Upload & parse** — text-based PDFs parse automatically; photos/scans use OCR.
  Parsed rows are editable inline ("✏️ Edit values") to fix any misreads.
- **Dashboard** — report cards with abnormal counts, global stats, search
  (test name / type / lab), filters (abnormal / high / low / normal), date range.
- **Row highlighting** — red = above range, blue = below range.
- **Rule-based summary** — plain-language interpretation per abnormal test
  (24 curated rules in `lib/reference-ranges.js`), pluggable with an LLM later.
- **Compare view** — pick any test, see its trend across reports with the
  normal-range band shaded and an Improving / Worsening / Stable badge.
- **Manual workflow** — delete reports, edit/delete/add test values manually.

## Key files

- `lib/reference-ranges.js` — 54 curated test ranges + interpretation rules
- `lib/extractor.js` — text extraction (pdf-parse / tesseract) + regex parser + summary
- `app/api/*` — upload, reports CRUD (GET/PUT/DELETE), trends
- `components/*` — UploadPanel, ReportCard, ComparePanel
- `prisma/schema.prisma` — Report / Test models

## Known limitations (prototype)

- Parser expects common formats (`Name value unit low - high`); unusual layouts
  miss rows — edit them manually after upload.
- No auth / multi-user (schema is ready to extend), no file storage — raw text kept.
- OCR needs internet on first run to fetch the language data; scanned PDFs are
  not supported (upload images instead).
