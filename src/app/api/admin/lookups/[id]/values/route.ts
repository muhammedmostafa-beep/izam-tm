import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// POST /api/admin/lookups/[id]/values — add value to category
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const lastValue = await prisma.lookupValue.findFirst({
      where: { categoryId: id },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const value = await prisma.lookupValue.create({
      data: {
        categoryId: id,
        value: body.value,
        color: body.color || null,
        sortOrder: (lastValue?.sortOrder ?? -1) + 1,
        isActive: body.isActive ?? true,
        isDefault: body.isDefault ?? false,
      },
    });
    return NextResponse.json(value, { status: 201 });
  } catch (error) {
    console.error("POST value error:", error);
    return NextResponse.json({ error: "Failed to add value" }, { status: 500 });
  }
}

// PATCH /api/admin/lookups/[id]/values — update a value or bulk reorder
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Single value update
    if (body.valueId) {
      const updateData: Record<string, unknown> = {};
      if (body.value !== undefined) updateData.value = body.value;
      if (body.color !== undefined) updateData.color = body.color;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;
      if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;
      if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

      const value = await prisma.lookupValue.update({
        where: { id: body.valueId },
        data: updateData,
      });
      return NextResponse.json(value);
    }

    // Bulk reorder
    if (body.order && Array.isArray(body.order)) {
      await Promise.all(
        body.order.map((valueId: string, index: number) =>
          prisma.lookupValue.update({
            where: { id: valueId },
            data: { sortOrder: index },
          })
        )
      );
      const values = await prisma.lookupValue.findMany({
        where: { categoryId: id },
        orderBy: { sortOrder: "asc" },
      });
      return NextResponse.json(values);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("PATCH value error:", error);
    return NextResponse.json({ error: "Failed to update value" }, { status: 500 });
  }
}

// DELETE /api/admin/lookups/[id]/values?valueId=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const valueId = new URL(req.url).searchParams.get("valueId");
    if (!valueId) return NextResponse.json({ error: "valueId required" }, { status: 400 });

    await prisma.lookupValue.delete({ where: { id: valueId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE value error:", error);
    return NextResponse.json({ error: "Failed to delete value" }, { status: 500 });
  }
}
