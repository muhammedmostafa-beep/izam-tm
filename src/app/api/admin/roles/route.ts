import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/roles — list all roles
export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(roles);
  } catch (error) {
    console.error("GET /api/admin/roles error:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

// POST /api/admin/roles — create role
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });

    const role = await prisma.role.create({
      data: {
        name: body.name,
        permissions: body.permissions || {},
      },
    });
    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/roles error:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}

// PATCH /api/admin/roles — update role permissions
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const role = await prisma.role.update({
      where: { id: body.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.permissions !== undefined && { permissions: body.permissions }),
      },
    });
    return NextResponse.json(role);
  } catch (error) {
    console.error("PATCH /api/admin/roles error:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}
