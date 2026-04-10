import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/ai/config — list AI configs
export async function GET() {
  try {
    const configs = await prisma.aiConfig.findMany({
      select: {
        id: true, provider: true, modelName: true, isActive: true,
        configuredBy: { select: { id: true, name: true } },
        _count: { select: { analyses: true } },
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("GET /api/ai/config error:", error);
    return NextResponse.json({ error: "Failed to fetch AI configs" }, { status: 500 });
  }
}

// POST /api/ai/config — create AI config
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = await prisma.aiConfig.create({
      data: {
        provider: body.provider,
        modelName: body.modelName,
        apiKeyEncrypted: body.apiKey || "placeholder",
        configuredById: body.configuredById,
        isActive: true,
      },
    });
    return NextResponse.json(config, { status: 201 });
  } catch (error) {
    console.error("POST /api/ai/config error:", error);
    return NextResponse.json({ error: "Failed to create AI config" }, { status: 500 });
  }
}
