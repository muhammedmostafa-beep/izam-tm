import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/test-cases
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const storyId = searchParams.get("storyId");
    const testLevel = searchParams.get("testLevel");
    const testType = searchParams.get("testType");
    const executionStatus = searchParams.get("executionStatus");
    const scenarioClassification = searchParams.get("scenarioClassification");
    const automationStatus = searchParams.get("automationStatus");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { testCaseId: { contains: search, mode: "insensitive" } },
        { testCaseTitle: { contains: search, mode: "insensitive" } },
      ];
    }
    if (storyId) where.storyId = storyId;
    if (testLevel) where.testLevel = testLevel;
    if (testType) where.testType = testType;
    if (executionStatus) where.executionStatus = executionStatus;
    if (scenarioClassification) where.scenarioClassification = scenarioClassification;
    if (automationStatus) where.automationStatus = automationStatus;

    const [testCases, total] = await Promise.all([
      prisma.testCase.findMany({
        where,
        include: {
          story: { select: { id: true, storyId: true, storyTitle: true } },
          storySection: { select: { id: true, sectionTitle: true } },
          reviewer: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { defectLinks: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.testCase.count({ where }),
    ]);

    return NextResponse.json({
      data: testCases,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/test-cases error:", error);
    return NextResponse.json({ error: "Failed to fetch test cases" }, { status: 500 });
  }
}

// POST /api/test-cases
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const lastTC = await prisma.testCase.findFirst({
      orderBy: { createdAt: "desc" },
      select: { testCaseId: true },
    });
    let nextNum = 1;
    if (lastTC?.testCaseId) {
      const match = lastTC.testCaseId.match(/TC-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    const testCaseId = `TC-${String(nextNum).padStart(4, "0")}`;

    const testCase = await prisma.testCase.create({
      data: {
        testCaseId,
        testCaseTitle: body.testCaseTitle,
        storyId: body.storyId || null,
        storySectionId: body.storySectionId || null,
        requirementRef: body.requirementRef || null,
        testLevel: body.testLevel || null,
        testType: body.testType || null,
        scenarioClassification: body.scenarioClassification || null,
        priority: body.priority || null,
        automationStatus: body.automationStatus || "Manual",
        reviewerId: body.reviewerId || null,
        testDataReference: body.testDataReference || null,
        executionCycle: body.executionCycle || null,
        executionStatus: body.executionStatus || "Not Run",
        requirementCoverage: body.requirementCoverage || "Not Covered",
        comments: body.comments || null,
        customFields: body.customFields || {},
      },
      include: {
        story: { select: { id: true, storyId: true, storyTitle: true } },
        storySection: { select: { id: true, sectionTitle: true } },
      },
    });

    return NextResponse.json(testCase, { status: 201 });
  } catch (error) {
    console.error("POST /api/test-cases error:", error);
    return NextResponse.json({ error: "Failed to create test case" }, { status: 500 });
  }
}
