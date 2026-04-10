import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/fields — list all entity field configs
export async function GET(req: NextRequest) {
  try {
    const entityType = new URL(req.url).searchParams.get("entityType");

    const where = entityType ? { entityType } : {};
    const configs = await prisma.entityFieldConfig.findMany({
      where,
      include: {
        lookupCategory: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ entityType: "asc" }, { sortOrder: "asc" }],
    });

    return NextResponse.json(configs);
  } catch (error) {
    console.error("GET /api/admin/fields error:", error);
    return NextResponse.json({ error: "Failed to fetch field configs" }, { status: 500 });
  }
}

// PATCH /api/admin/fields — update a field config
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updateData: Record<string, unknown> = {};
    if (body.fieldLabel !== undefined) updateData.fieldLabel = body.fieldLabel;
    if (body.isRequired !== undefined) updateData.isRequired = body.isRequired;
    if (body.isVisible !== undefined) updateData.isVisible = body.isVisible;
    if (body.defaultValue !== undefined) updateData.defaultValue = body.defaultValue;
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

    const config = await prisma.entityFieldConfig.update({
      where: { id: body.id },
      data: updateData,
      include: { lookupCategory: { select: { id: true, name: true } } },
    });

    return NextResponse.json(config);
  } catch (error) {
    console.error("PATCH /api/admin/fields error:", error);
    return NextResponse.json({ error: "Failed to update field config" }, { status: 500 });
  }
}
