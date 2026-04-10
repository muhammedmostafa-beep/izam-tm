import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/admin/approvals — list change requests
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "";
    const entityType = url.searchParams.get("entityType") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (entityType) where.entityType = entityType;

    const [requests, total] = await Promise.all([
      prisma.changeRequest.findMany({
        where,
        include: {
          submittedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          reviewedBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.changeRequest.count({ where }),
    ]);

    return NextResponse.json({
      data: requests,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET approvals error:", error);
    return NextResponse.json({ error: "Failed to fetch approvals" }, { status: 500 });
  }
}

// POST /api/admin/approvals — submit a change request
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.entityType || !body.entityId || !body.changesDiff || !body.submittedById) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cr = await prisma.changeRequest.create({
      data: {
        submittedById: body.submittedById,
        entityType: body.entityType,
        entityId: body.entityId,
        changesDiff: body.changesDiff,
        status: "pending",
      },
      include: {
        submittedBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(cr, { status: 201 });
  } catch (error) {
    console.error("POST approvals error:", error);
    return NextResponse.json({ error: "Failed to submit change request" }, { status: 500 });
  }
}
