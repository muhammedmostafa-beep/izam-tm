import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { searchJiraIssues } from "@/lib/jira";

// GET /api/admin/jira/[id]/sync — list sync logs
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const logs = await prisma.jiraSyncLog.findMany({
      where: { jiraConfigId: id },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("GET sync logs error:", error);
    return NextResponse.json({ error: "Failed to fetch sync logs" }, { status: 500 });
  }
}

// POST /api/admin/jira/[id]/sync — trigger real sync
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const config = await prisma.jiraConfig.findUnique({
      where: { id },
      include: { projectMappings: true },
    });

    if (!config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    if (!config.oauthTokenEncrypted || !config.refreshTokenEncrypted) {
      return NextResponse.json({ error: "Missing Jira credentials (email or token)" }, { status: 400 });
    }

    const email = config.refreshTokenEncrypted;
    const apiToken = config.oauthTokenEncrypted;
    const siteUrl = config.jiraSiteUrl;

    if (config.projectMappings.length === 0) {
      return NextResponse.json({ error: "No projects mapped to sync" }, { status: 400 });
    }

    const syncLogs = [];

    // Loop through each mapped project
    for (const mapping of config.projectMappings) {
      if (!mapping.tmEpicId) continue;

      let itemsCreated = 0;
      let itemsUpdated = 0;
      let itemsFailed = 0;

      // Create log entry
      const log = await prisma.jiraSyncLog.create({
        data: {
          jiraConfigId: config.id,
          projectKey: mapping.jiraProjectKey,
          startedAt: new Date(),
        },
      });

      try {
        // Fetch up to 100 recent issues (can paginate in a real robust system)
        const jql = `project = "${mapping.jiraProjectKey}" ORDER BY updated DESC`;
        const { issues } = await searchJiraIssues(siteUrl, email, apiToken, jql, 100);

        for (const issue of issues) {
          const isBug = issue.fields.issuetype.name.toLowerCase().includes("bug");
          const status = issue.fields.status.name;

          if (isBug) {
            // Upsert ProductionBug
            await prisma.productionBug.upsert({
              where: { bugId: issue.key },
              update: {
                bugTitle: issue.fields.summary,
                bugStatus: status,
                linkedEpicId: mapping.tmEpicId,
              },
              create: {
                bugId: issue.key,
                bugTitle: issue.fields.summary,
                bugStatus: status,
                linkedEpicId: mapping.tmEpicId,
              },
            });
          } else {
            // Upsert UserStory
            await prisma.userStory.upsert({
              where: { storyId: issue.key },
              update: {
                storyTitle: issue.fields.summary,
                storyStatus: status,
                epicId: mapping.tmEpicId,
              },
              create: {
                storyId: issue.key,
                storyTitle: issue.fields.summary,
                storyStatus: status,
                epicId: mapping.tmEpicId,
              },
            });
          }
          itemsUpdated++; // Consider all fetched as updated to keep loop simple
        }

        // Close out the log
        const completedLog = await prisma.jiraSyncLog.update({
          where: { id: log.id },
          data: {
            itemsCreated: 0,
            itemsUpdated: itemsUpdated,
            itemsFailed: 0,
            completedAt: new Date(),
          },
        });
        syncLogs.push(completedLog);
      } catch (err) {
        console.error(`Sync failed for project ${mapping.jiraProjectKey}:`, err);
        // Mark log as failed
        await prisma.jiraSyncLog.update({
          where: { id: log.id },
          data: {
            itemsFailed: 1, // Indicate failure
            completedAt: new Date(),
            errors: JSON.parse(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" })),
          },
        });
      }
    }

    return NextResponse.json({ success: true, syncLogs }, { status: 201 });
  } catch (error) {
    console.error("POST sync error:", error);
    return NextResponse.json({ error: "Failed to trigger sync" }, { status: 500 });
  }
}
