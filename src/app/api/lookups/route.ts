import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/lookups — all categories with values
export async function GET() {
  try {
    const categories = await prisma.lookupCategory.findMany({
      include: {
        values: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error("GET /api/lookups error:", error);
    return NextResponse.json({ error: "Failed to fetch lookups" }, { status: 500 });
  }
}
