import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/lookups — list all categories with values
export async function GET() {
  try {
    const categories = await prisma.lookupCategory.findMany({
      include: {
        values: {
          orderBy: { sortOrder: "asc" },
        },
        _count: { select: { fieldConfigs: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("GET /api/admin/lookups error:", error);
    return NextResponse.json({ error: "Failed to fetch lookups" }, { status: 500 });
  }
}

// POST /api/admin/lookups — create a new category
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const category = await prisma.lookupCategory.create({
      data: {
        name: body.name,
        description: body.description || null,
        isSystem: false,
      },
      include: { values: true },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/lookups error:", error);
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}
