const { getPrisma } = require("../lib/prisma");
const { execSync } = require("child_process");

// Generates 3 sample reports so the app demos instantly
function makeSample() {
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

async function main() {
  const prisma = await getPrisma();
  const existing = await prisma.report.count();
  if (existing > 0) {
    console.log("Seed skipped: reports already exist:", existing);
    return;
  }
  for (const r of makeSample()) {
    await prisma.report.create({ data: { ...r, tests: { create: r.tests } } });
  }
  console.log("Seeded", makeSample().length, "sample reports");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => {
    const prisma = await getPrisma();
    await prisma.$disconnect();
  });
