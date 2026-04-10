import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// PATCH /api/admin/lookups/[id] — update category
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const category = await prisma.lookupCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
      },
      include: { values: { orderBy: { sortOrder: "asc" } } },
    });
    return NextResponse.json(category);
  } catch (error) {
    console.error("PATCH /api/admin/lookups/[id] error:", error);
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

// DELETE /api/admin/lookups/[id] — delete category (non-system only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const category = await prisma.lookupCategory.findUnique({ where: { id } });
    if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (category.isSystem) return NextResponse.json({ error: "Cannot delete system category" }, { status: 403 });

    await prisma.lookupCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/admin/lookups/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 });
  }
}
