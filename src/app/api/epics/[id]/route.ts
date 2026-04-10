import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/epics/[id] — single epic with full details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const epic = await prisma.epic.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
        userStories: {
          include: {
            owner: { select: { id: true, name: true } },
            _count: { select: { testCases: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        linkedBugs: {
          select: { id: true, bugId: true, bugTitle: true, severity: true, bugStatus: true },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!epic) {
      return NextResponse.json({ error: "Epic not found" }, { status: 404 });
    }

    return NextResponse.json(epic);
  } catch (error) {
    console.error("GET /api/epics/[id] error:", error);
    return NextResponse.json({ error: "Failed to fetch epic" }, { status: 500 });
  }
}

// PATCH /api/epics/[id] — update epic
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const epic = await prisma.epic.update({
      where: { id },
      data: {
        ...(body.epicTitle !== undefined && { epicTitle: body.epicTitle }),
        ...(body.ownerId !== undefined && { ownerId: body.ownerId || null }),
        ...(body.customFields !== undefined && { customFields: body.customFields }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(epic);
  } catch (error) {
    console.error("PATCH /api/epics/[id] error:", error);
    return NextResponse.json({ error: "Failed to update epic" }, { status: 500 });
  }
}

// DELETE /api/epics/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.epic.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/epics/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete epic" }, { status: 500 });
  }
}
