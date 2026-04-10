import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/approvals/[id] — approve or reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    if (!body.status || !["approved", "rejected"].includes(body.status)) {
      return NextResponse.json({ error: "Status must be 'approved' or 'rejected'" }, { status: 400 });
    }

    const cr = await prisma.changeRequest.update({
      where: { id },
      data: {
        status: body.status,
        reviewedById: body.reviewedById || null,
        reviewComment: body.reviewComment || null,
        reviewedAt: new Date(),
      },
      include: {
        submittedBy: { select: { id: true, name: true, avatarUrl: true } },
        reviewedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(cr);
  } catch (error) {
    console.error("PATCH approval error:", error);
    return NextResponse.json({ error: "Failed to update approval" }, { status: 500 });
  }
}
