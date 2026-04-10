import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/stories/[id]/sections — list sections for a story
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sections = await prisma.storySection.findMany({
      where: { storyId: id },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json(sections);
  } catch (error) {
    console.error("GET sections error:", error);
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
}

// POST /api/stories/[id]/sections — create section
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Get next sort order
    const lastSection = await prisma.storySection.findFirst({
      where: { storyId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const nextOrder = (lastSection?.sortOrder ?? -1) + 1;

    const section = await prisma.storySection.create({
      data: {
        storyId: id,
        sectionTitle: body.sectionTitle,
        sectionContent: body.sectionContent || null,
        sortOrder: nextOrder,
      },
    });

    return NextResponse.json(section, { status: 201 });
  } catch (error) {
    console.error("POST sections error:", error);
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}

// PATCH /api/stories/[id]/sections — bulk update (reorder, edit, delete)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Single section update
    if (body.sectionId) {
      const section = await prisma.storySection.update({
        where: { id: body.sectionId },
        data: {
          ...(body.sectionTitle !== undefined && { sectionTitle: body.sectionTitle }),
          ...(body.sectionContent !== undefined && { sectionContent: body.sectionContent }),
          ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
        },
      });
      return NextResponse.json(section);
    }

    // Bulk reorder
    if (body.order && Array.isArray(body.order)) {
      await Promise.all(
        body.order.map((sectionId: string, index: number) =>
          prisma.storySection.update({
            where: { id: sectionId },
            data: { sortOrder: index },
          })
        )
      );
      const sections = await prisma.storySection.findMany({
        where: { storyId: id },
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(sections);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("PATCH sections error:", error);
    return NextResponse.json({ error: "Failed to update sections" }, { status: 500 });
  }
}

// DELETE /api/stories/[id]/sections?sectionId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sectionId = new URL(req.url).searchParams.get("sectionId");
    if (!sectionId) return NextResponse.json({ error: "sectionId required" }, { status: 400 });

    await prisma.storySection.delete({ where: { id: sectionId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE sections error:", error);
    return NextResponse.json({ error: "Failed to delete section" }, { status: 500 });
  }
}
