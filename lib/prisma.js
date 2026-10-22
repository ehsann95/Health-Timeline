// Shared Prisma client with environment-aware database resolution.
//
// The schema declares `url = env("DATABASE_URL")` so the location can differ
// per environment:
//  - Vercel serverless / AWS Lambda: root filesystem is read-only (SQLITE_CANTOPEN,
//    error code 14), so SQLite must use the writable /tmp directory
//    (e.g., file:/tmp/lab-reports.db). On cold starts, tables and sample data
//    are automatically bootstrap-created on first use.
//  - Locally: uses repo's prisma/dev.db.
const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

function isServerless() {
  if (
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.VERCEL_REGION ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.AWS_EXECUTION_ENV ||
    process.env.NOW_REGION
  ) {
    return true;
  }
  try {
    const cwd = process.cwd();
    if (cwd.startsWith("/var/task") || cwd.startsWith("/var/runtime")) {
      return true;
    }
  } catch {}
  return false;
}

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim();

  // In a serverless environment (Vercel, AWS Lambda), the filesystem is read-only
  // except for /tmp. Any SQLite file MUST reside in /tmp to avoid Error code 14.
  if (isServerless()) {
    if (raw && (raw.startsWith("file:/tmp/") || raw.startsWith("file:///tmp/"))) {
      return raw;
    }
    return "file:/tmp/lab-reports.db";
  }

  // Local development / persistent server environment:
  if (!raw) {
    return "file:" + path.resolve(process.cwd(), "prisma", "dev.db");
  }

  if (raw.startsWith("file:./") || raw.startsWith("file:../")) {
    return "file:" + path.resolve(process.cwd(), "prisma", raw.slice("file:".length));
  }

  if (raw.startsWith("file:") && !raw.startsWith("file:/")) {
    return "file:" + path.resolve(process.cwd(), "prisma", raw.slice("file:".length));
  }

  return raw;
}

const resolvedDatabaseUrl = resolveDatabaseUrl();
process.env.DATABASE_URL = resolvedDatabaseUrl;

if (isServerless()) {
  try {
    if (!fs.existsSync("/tmp")) {
      fs.mkdirSync("/tmp", { recursive: true });
    }
  } catch {}
}

const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolvedDatabaseUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalThis.__prisma = prisma;

// Idempotent schema bootstrap: required for the empty /tmp database on Vercel
// (each cold start starts blank); a no-op locally where prisma/dev.db already
// has these tables. Statements mirror prisma/schema.prisma exactly.
const BOOTSTRAP_SQL = [
  `CREATE TABLE IF NOT EXISTS "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "userEmail" TEXT,
    "patientName" TEXT NOT NULL DEFAULT 'Self',
    "reportType" TEXT NOT NULL,
    "labName" TEXT,
    "reportDate" DATETIME,
    "rawText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Test" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "value" REAL NOT NULL,
    "unit" TEXT,
    "refLow" REAL,
    "refHigh" REAL,
    "flag" TEXT NOT NULL DEFAULT 'NORMAL',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Test_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT 'Self',
    "gender" TEXT,
    "birthDate" DATETIME,
    "bloodGroup" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "Test_name_idx" ON "Test"("name")`,
  `CREATE INDEX IF NOT EXISTS "Test_reportId_idx" ON "Test"("reportId")`,
  `CREATE INDEX IF NOT EXISTS "Report_userId_idx" ON "Report"("userId")`,
  `CREATE INDEX IF NOT EXISTS "FamilyMember_userId_idx" ON "FamilyMember"("userId")`,
];

function getSampleReports() {
  const daysAgo = (n) => new Date(Date.now() - n * 86400000);
  return [
    {
      patientName: "Self",
      reportType: "CBC",
      labName: "CityLab Diagnostics",
      reportDate: daysAgo(180),
      tests: [
        { name: "Hemoglobin", category: "CBC", value: 13.2, unit: "g/dL", refLow: 13, refHigh: 17, flag: "NORMAL" },
        { name: "WBC", category: "CBC", value: 7200, unit: "/µL", refLow: 4000, refHigh: 11000, flag: "NORMAL" },
        { name: "Platelets", category: "CBC", value: 145000, unit: "/µL", refLow: 150000, refHigh: 450000, flag: "LOW" },
        { name: "RBC", category: "CBC", value: 4.4, unit: "mill/cumm", refLow: 4.5, refHigh: 5.5, flag: "LOW" },
      ],
    },
    {
      patientName: "Self",
      reportType: "LFT",
      labName: "CityLab Diagnostics",
      reportDate: daysAgo(90),
      tests: [
        { name: "ALT (SGPT)", category: "LFT", value: 62, unit: "U/L", refLow: 7, refHigh: 56, flag: "HIGH" },
        { name: "AST (SGOT)", category: "LFT", value: 48, unit: "U/L", refLow: 10, refHigh: 40, flag: "HIGH" },
        { name: "Bilirubin Total", category: "LFT", value: 1.1, unit: "mg/dL", refLow: 0.3, refHigh: 1.2, flag: "NORMAL" },
      ],
    },
    {
      patientName: "Self",
      reportType: "LFT",
      labName: "Metro Health Labs",
      reportDate: daysAgo(10),
      tests: [
        { name: "ALT (SGPT)", category: "LFT", value: 71, unit: "U/L", refLow: 7, refHigh: 56, flag: "HIGH" },
        { name: "AST (SGOT)", category: "LFT", value: 39, unit: "U/L", refLow: 10, refHigh: 40, flag: "NORMAL" },
        { name: "Bilirubin Total", category: "LFT", value: 0.9, unit: "mg/dL", refLow: 0.3, refHigh: 1.2, flag: "NORMAL" },
        { name: "Hemoglobin", category: "CBC", value: 14.1, unit: "g/dL", refLow: 13, refHigh: 17, flag: "NORMAL" },
      ],
    },
  ];
}

let bootstrapped = null;
function ensureDatabase() {
  if (!bootstrapped) {
    bootstrapped = (async () => {
      // Execute bootstrap SQL statements sequentially
      for (const sql of BOOTSTRAP_SQL) {
        await prisma.$executeRawUnsafe(sql);
      }
      // Ensure columns exist in case Report table was created prior to user support
      try {
        const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info("Report")`);
        const colNames = new Set((columns || []).map((c) => c.name));
        if (!colNames.has("userId")) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Report" ADD COLUMN "userId" TEXT`);
        }
        if (!colNames.has("userEmail")) {
          await prisma.$executeRawUnsafe(`ALTER TABLE "Report" ADD COLUMN "userEmail" TEXT`);
        }
      } catch {}
      // If the database has 0 reports (fresh /tmp DB on serverless cold start),
      // populate the initial demo sample reports so the app works identically to local env.
      try {
        const count = await prisma.report.count();
        if (count === 0) {
          for (const r of getSampleReports()) {
            await prisma.report.create({
              data: {
                ...r,
                tests: { create: r.tests },
              },
            });
          }
        }
      } catch (e) {
        console.warn("[ensureDatabase] Seeding sample data skipped:", e.message);
      }
    })().catch((e) => {
      bootstrapped = null; // allow retry on next request
      console.error("[ensureDatabase] Bootstrap failed:", e);
      throw e;
    });
  }
  return bootstrapped;
}

async function getPrisma() {
  await ensureDatabase();
  return prisma;
}

module.exports = { prisma, getPrisma, ensureDatabase, resolveDatabaseUrl, isServerless, getSampleReports };
