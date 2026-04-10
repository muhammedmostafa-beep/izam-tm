import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET /api/reports/summary — global dashboard summary
export async function GET() {
  try {
    const [epicCount, storyCount, tcCount, bugCount, userCount] = await Promise.all([
      prisma.epic.count(),
      prisma.userStory.count(),
      prisma.testCase.count(),
      prisma.productionBug.count(),
      prisma.user.count({ where: { isActive: true } }),
    ]);

    // Test case execution breakdown
    const [passed, failed, notRun, blocked] = await Promise.all([
      prisma.testCase.count({ where: { executionStatus: "Passed" } }),
      prisma.testCase.count({ where: { executionStatus: "Failed" } }),
      prisma.testCase.count({ where: { executionStatus: "Not Run" } }),
      prisma.testCase.count({ where: { executionStatus: "Blocked" } }),
    ]);

    // Bug severity breakdown
    const [criticalBugs, highBugs, openBugs, closedBugs] = await Promise.all([
      prisma.productionBug.count({ where: { severity: "Critical" } }),
      prisma.productionBug.count({ where: { severity: "High" } }),
      prisma.productionBug.count({ where: { bugStatus: "Open" } }),
      prisma.productionBug.count({ where: { bugStatus: "Closed" } }),
    ]);

    // Scenario classification
    const [happy, negative, edge] = await Promise.all([
      prisma.testCase.count({ where: { scenarioClassification: "Happy" } }),
      prisma.testCase.count({ where: { scenarioClassification: "Negative" } }),
      prisma.testCase.count({ where: { scenarioClassification: "Edge" } }),
    ]);

    // Automation stats
    const [automated, manual] = await Promise.all([
      prisma.testCase.count({ where: { automationStatus: "Automated" } }),
      prisma.testCase.count({ where: { automationStatus: "Manual" } }),
    ]);

    // Recent activity count
    const recentActivity = await prisma.auditLog.count({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    return NextResponse.json({
      totals: { epics: epicCount, stories: storyCount, testCases: tcCount, bugs: bugCount, users: userCount },
      execution: { passed, failed, notRun, blocked, total: tcCount },
      severity: { critical: criticalBugs, high: highBugs, open: openBugs, closed: closedBugs, total: bugCount },
      scenarios: { happy, negative, edge, total: tcCount },
      automation: { automated, manual, total: tcCount },
      recentActivity,
    });
  } catch (error) {
    console.error("GET /api/reports/summary error:", error);
    return NextResponse.json({ error: "Failed to generate summary" }, { status: 500 });
  }
}
