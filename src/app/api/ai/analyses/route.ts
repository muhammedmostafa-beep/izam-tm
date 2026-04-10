import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/ai/analyses — list AI analyses
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const storyId = url.searchParams.get("storyId") || "";

    const where: Record<string, unknown> = {};
    if (storyId) where.storyId = storyId;

    const analyses = await prisma.aiAnalysis.findMany({
      where,
      include: {
        story: { select: { id: true, storyId: true, storyTitle: true } },
        triggeredBy: { select: { id: true, name: true, avatarUrl: true } },
        aiConfig: { select: { id: true, provider: true, modelName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(analyses);
  } catch (error) {
    console.error("GET /api/ai/analyses error:", error);
    return NextResponse.json({ error: "Failed to fetch analyses" }, { status: 500 });
  }
}

// POST /api/ai/analyses — trigger a new analysis (mock for now)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.storyId) return NextResponse.json({ error: "storyId required" }, { status: 400 });

    // Get story with test cases for analysis
    const story = await prisma.userStory.findUnique({
      where: { id: body.storyId },
      include: {
        sections: true,
        testCases: { select: { scenarioClassification: true, testCaseTitle: true } },
      },
    });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });

    const tcs = story.testCases;
    const happy = tcs.filter((t) => t.scenarioClassification === "Happy").length;
    const negative = tcs.filter((t) => t.scenarioClassification === "Negative").length;
    const edge = tcs.filter((t) => t.scenarioClassification === "Edge").length;
    const total = tcs.length || 1;

    // Calculate coverage with heuristic scoring
    const sectionCount = story.sections.length || 1;
    const happyPct = Math.min(100, (happy / sectionCount) * 100);
    const negativePct = Math.min(100, (negative / (sectionCount * 0.8)) * 100);
    const edgePct = Math.min(100, (edge / (sectionCount * 0.5)) * 100);

    // Generate mock suggestions and gaps
    const suggestedTestCases = [];
    const gapsDetected = [];

    if (happyPct < 80) {
      gapsDetected.push({ type: "Happy Path", message: `Only ${happy} happy path TCs for ${sectionCount} sections. Need at least ${sectionCount} for full coverage.` });
      suggestedTestCases.push({ title: `Verify ${story.storyTitle} - positive flow`, scenario: "Happy", reason: "Missing happy path coverage" });
    }
    if (negativePct < 60) {
      gapsDetected.push({ type: "Negative", message: `Negative scenarios at ${Math.round(negativePct)}%. Consider error handling and validation tests.` });
      suggestedTestCases.push({ title: `Validate error handling for ${story.storyTitle}`, scenario: "Negative", reason: "Insufficient negative testing" });
    }
    if (edgePct < 40) {
      gapsDetected.push({ type: "Edge Case", message: `Edge case coverage at ${Math.round(edgePct)}%. Consider boundary values and concurrent operations.` });
      suggestedTestCases.push({ title: `Test boundary conditions for ${story.storyTitle}`, scenario: "Edge", reason: "Missing edge case coverage" });
    }
    if (total < 3) {
      gapsDetected.push({ type: "Overall", message: `Only ${total} test case(s). Stories typically need 5-10 TCs for adequate coverage.` });
    }

    const analysis = await prisma.aiAnalysis.create({
      data: {
        storyId: body.storyId,
        aiConfigId: body.aiConfigId || null,
        triggeredById: body.triggeredById || null,
        happyCoveragePct: Math.round(happyPct * 10) / 10,
        negativeCoveragePct: Math.round(negativePct * 10) / 10,
        edgeCoveragePct: Math.round(edgePct * 10) / 10,
        suggestedTestCases,
        gapsDetected,
      },
      include: {
        story: { select: { id: true, storyId: true, storyTitle: true } },
        triggeredBy: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(analysis, { status: 201 });
  } catch (error) {
    console.error("POST /api/ai/analyses error:", error);
    return NextResponse.json({ error: "Failed to run analysis" }, { status: 500 });
  }
}
