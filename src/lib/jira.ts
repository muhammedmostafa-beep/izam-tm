/**
 * Jira Cloud REST API service.
 * Uses Basic Auth (email + API token) for Jira Cloud.
 * Docs: https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 */

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
  avatarUrls: Record<string, string>;
  style?: string;
}

export interface JiraBoard {
  id: number;
  name: string;
  type: string; // scrum, kanban, simple
  location?: {
    projectId?: number;
    projectKey?: string;
    projectName?: string;
  };
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string; // active, closed, future
  startDate?: string;
  endDate?: string;
  goal?: string;
}

export interface JiraConnectionResult {
  success: boolean;
  serverInfo?: {
    baseUrl: string;
    serverTitle: string;
    version: string;
  };
  error?: string;
}

function buildAuthHeader(email: string, apiToken: string): string {
  const encoded = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${encoded}`;
}

async function jiraFetch<T>(
  siteUrl: string,
  path: string,
  email: string,
  apiToken: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const baseUrl = siteUrl.replace(/\/+$/, "");
  const url = `${baseUrl}${path}`;

  const res = await fetch(url, {
    method: options?.method || "GET",
    headers: {
      Authorization: buildAuthHeader(email, apiToken),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Jira API ${res.status}: ${errBody.slice(0, 300)}`);
  }

  return res.json();
}

/**
 * Test connection to Jira Cloud.
 */
export async function testJiraConnection(
  siteUrl: string,
  email: string,
  apiToken: string
): Promise<JiraConnectionResult> {
  try {
    const info = await jiraFetch<{
      baseUrl: string;
      serverTitle: string;
      versionNumbers: number[];
    }>(siteUrl, "/rest/api/3/serverInfo", email, apiToken);

    return {
      success: true,
      serverInfo: {
        baseUrl: info.baseUrl,
        serverTitle: info.serverTitle,
        version: info.versionNumbers?.join(".") || "unknown",
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Get all projects accessible to the authenticated user.
 */
export async function getJiraProjects(
  siteUrl: string,
  email: string,
  apiToken: string,
  query?: string
): Promise<JiraProject[]> {
  const allProjects: JiraProject[] = [];
  let startAt = 0;
  const maxResults = 50;

  // Use search endpoint if query is present
  if (query && query.trim().length > 0) {
    const data = await jiraFetch<{
      values: JiraProject[];
    }>(
      siteUrl,
      `/rest/api/3/project/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      email,
      apiToken
    );
    return data.values || [];
  }

  // Otherwise paginate all projects
  let hasMore = true;
  while (hasMore) {
    const data = await jiraFetch<{
      values: JiraProject[];
      total: number;
      isLast: boolean;
    }>(
      siteUrl,
      `/rest/api/3/project/search?startAt=${startAt}&maxResults=${maxResults}&orderBy=name`,
      email,
      apiToken
    );

    allProjects.push(...(data.values || []));

    if (data.isLast || allProjects.length >= data.total) {
      hasMore = false;
    } else {
      startAt += maxResults;
    }
  }

  return allProjects;
}

/**
 * Get all boards (Scrum/Kanban) from Jira Software.
 */
export async function getJiraBoards(
  siteUrl: string,
  email: string,
  apiToken: string,
  projectKeyOrId?: string
): Promise<JiraBoard[]> {
  const allBoards: JiraBoard[] = [];
  let startAt = 0;
  const maxResults = 50;

  let hasMore = true;
  while (hasMore) {
    let path = `/rest/agile/1.0/board?startAt=${startAt}&maxResults=${maxResults}`;
    if (projectKeyOrId) {
      path += `&projectKeyOrId=${encodeURIComponent(projectKeyOrId)}`;
    }

    const data = await jiraFetch<{
      values: JiraBoard[];
      total: number;
      isLast: boolean;
    }>(siteUrl, path, email, apiToken);

    allBoards.push(...(data.values || []));

    if (data.isLast || allBoards.length >= data.total) {
      hasMore = false;
    } else {
      startAt += maxResults;
    }
  }

  return allBoards;
}

/**
 * Get sprints for a given board.
 */
export async function getJiraSprints(
  siteUrl: string,
  email: string,
  apiToken: string,
  boardId: number,
  state?: "active" | "closed" | "future"
): Promise<JiraSprint[]> {
  let path = `/rest/agile/1.0/board/${boardId}/sprint?maxResults=50`;
  if (state) {
    path += `&state=${state}`;
  }

  const data = await jiraFetch<{
    values: JiraSprint[];
  }>(siteUrl, path, email, apiToken);

  return data.values || [];
}

/**
 * Basic Jira Issue representation for syncing.
 */
export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      name: string;
      subtask: boolean;
    };
    status: {
      name: string;
    };
    priority?: {
      name: string;
    };
    created: string;
    updated: string;
    [key: string]: unknown;
  };
}

/**
 * Search Jira issues using JQL
 */
export async function searchJiraIssues(
  siteUrl: string,
  email: string,
  apiToken: string,
  jql: string,
  maxResults = 100,
  startAt = 0
): Promise<{ issues: JiraIssue[]; total: number }> {
  // Use POST for search to avoid long URL issues with complex JQL
  const data = await jiraFetch<{
    issues: JiraIssue[];
    total: number;
    maxResults: number;
    startAt: number;
  }>(siteUrl, "/rest/api/3/search", email, apiToken, {
    method: "POST",
    body: {
      jql,
      maxResults,
      startAt,
      fields: ["summary", "description", "issuetype", "status", "priority", "created", "updated"],
    },
  });

  return {
    issues: data.issues || [],
    total: data.total || 0,
  };
}
