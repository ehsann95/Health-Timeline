import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request, { params }) {
  try {
    const prisma = await getPrisma();
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await request.json();

    if (body.tests && Array.isArray(body.tests)) {
      // Edit/confirm flow: replace tests with verified values
      for (const t of body.tests) {
        if (t.id) {
          await prisma.test.update({
            where: { id: t.id },
            data: {
              name: t.name,
              value: parseFloat(t.value),
              unit: t.unit || null,
              refLow: t.refLow != null ? parseFloat(t.refLow) : null,
              refHigh: t.refHigh != null ? parseFloat(t.refHigh) : null,
              flag: t.flag,
              verified: true,
            },
          });
        } else {
          await prisma.test.create({
            data: {
              reportId: id,
              name: t.name,
              category: t.category || "Other",
              value: parseFloat(t.value),
              unit: t.unit || null,
              refLow: t.refLow != null ? parseFloat(t.refLow) : null,
              refHigh: t.refHigh != null ? parseFloat(t.refHigh) : null,
              flag: t.flag,
              verified: true,
            },
          });
        }
      }
    }

    const data = {};
    if (body.reportDate) {
      const d = new Date(body.reportDate);
      if (!isNaN(d.getTime())) data.reportDate = d;
    }
    if (body.reportType) data.reportType = body.reportType;
    if (body.labName !== undefined) data.labName = body.labName;
    if (body.patientName) data.patientName = body.patientName;
    if (Object.keys(data).length) {
      await prisma.report.update({ where: { id }, data });
    }

    const report = await prisma.report.findUnique({
      where: { id },
      include: { tests: true },
    });
    return NextResponse.json({ report });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const prisma = await getPrisma();
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    await prisma.report.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
