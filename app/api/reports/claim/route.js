import { NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { buildSummary } from "@/lib/extractor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = getSessionFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in first." }, { status: 401 });
    }

    const prisma = await getPrisma();
    const body = await request.json();
    const guestReports = Array.isArray(body.reports) ? body.reports : [];

    const claimed = [];

    for (const r of guestReports) {
      if (!r || !r.reportType) continue;

      // Check if report already exists in DB
      let existing = null;
      if (r.id) {
        existing = await prisma.report.findUnique({
          where: { id: r.id },
          include: { tests: true },
        });
      }

      if (existing) {
        // Claim existing record
        const updated = await prisma.report.update({
          where: { id: existing.id },
          data: {
            userId: user.id,
            userEmail: user.email,
          },
          include: { tests: true },
        });
        claimed.push({
          ...updated,
          summary: buildSummary(updated.tests || []),
        });
      } else {
        // Create new record for this user
        const testsData = (r.tests || []).map((t) => ({
          name: t.name,
          category: t.category || "Other",
          value: parseFloat(t.value) || 0,
          unit: t.unit || null,
          refLow: t.refLow != null ? parseFloat(t.refLow) : null,
          refHigh: t.refHigh != null ? parseFloat(t.refHigh) : null,
          flag: t.flag || "NORMAL",
          verified: Boolean(t.verified),
        }));

        const created = await prisma.report.create({
          data: {
            userId: user.id,
            userEmail: user.email,
            patientName: r.patientName || "Self",
            reportType: r.reportType,
            labName: r.labName || null,
            reportDate: r.reportDate ? new Date(r.reportDate) : new Date(),
            rawText: r.rawText || null,
            tests: { create: testsData },
          },
          include: { tests: true },
        });
        claimed.push({
          ...created,
          summary: buildSummary(created.tests || []),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      claimedCount: claimed.length,
      reports: claimed,
    });
  } catch (err) {
    console.error("Failed to claim reports:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

