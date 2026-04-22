import { MCPClient } from "mcp-use";
import { MCPServer } from "mcp-use/server";
import { z } from "zod";

const server = new MCPServer({
  name: "deepwiki-mcp",
  version: "1.0.0",
  description: "DeepWiki MCP wrapper with widget support",
  baseUrl: process.env.MCP_URL,
  host: "0.0.0.0",
  autoCreateSessionOnInvalidId: true,
});

const upstreamClient = new MCPClient({
  mcpServers: {
    deepwiki: {
      url: "https://mcp.deepwiki.com/mcp",
    },
  },
});

let upstreamReady: Promise<Record<string, unknown>> | null = null;

async function ensureUpstreamReady() {
  if (!upstreamReady) {
    upstreamReady = upstreamClient.createAllSessions();
  }

  try {
    await upstreamReady;
  } catch (error) {
    upstreamReady = null;
    throw error;
  }
}

async function callDeepWikiTool<TArgs extends Record<string, unknown>>(
  name: string,
  args: TArgs
) {
  await ensureUpstreamReady();
  const session = upstreamClient.getSession("deepwiki");
  return session.callTool(name, args);
}

function getTextFromToolResult(result: any): string {
  if (!result?.content || !Array.isArray(result.content)) {
    return "No content returned.";
  }

  const textParts = result.content
    .filter((item: any) => item?.type === "text" && typeof item.text === "string")
    .map((item: any) => item.text.trim())
    .filter(Boolean);

  if (textParts.length > 0) {
    return textParts.join("\n\n");
  }

  return "No text content returned.";
}

function toRepoName(owner: string, repo: string): string {
  return `${owner}/${repo}`;
}

server.tool(
  {
    name: "ask_question",
    description: "Ask a question about any public GitHub repository",
    schema: z.object({
      owner: z.string().describe("GitHub username or org (e.g. 'openai')"),
      repo: z.string().describe("Repository name (e.g. 'whisper')"),
      question: z.string().describe("Your question about the codebase"),
    }),
  },
  async ({ owner, repo, question }) => {
    try {
      const repoName = toRepoName(owner, repo);
      const result = await callDeepWikiTool("ask_question", {
        repoName,
        question,
      });
      const answer = getTextFromToolResult(result);

      return {
        content: [{ type: "text", text: answer }],
        structuredContent: {
          owner,
          repo,
          question,
          answer,
          sourceUrl: `https://deepwiki.com/${repoName}`,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error calling DeepWiki.";
      const repoName = toRepoName(owner, repo);

      return {
        content: [{ type: "text", text: `DeepWiki request failed: ${message}` }],
        structuredContent: {
          owner,
          repo,
          question,
          answer: `DeepWiki request failed: ${message}`,
          sourceUrl: `https://deepwiki.com/${repoName}`,
        },
      };
    }
  }
);

server.tool(
  {
    name: "read_wiki_structure",
    description: "Get the documentation structure/table of contents for a GitHub repo",
    schema: z.object({
      owner: z.string().describe("GitHub username or org"),
      repo: z.string().describe("Repository name"),
    }),
  },
  async ({ owner, repo }) => {
    try {
      const repoName = toRepoName(owner, repo);
      const result = await callDeepWikiTool("read_wiki_structure", {
        repoName,
      });
      const text = getTextFromToolResult(result);

      return {
        content: [{ type: "text", text }],
        structuredContent: {
          owner,
          repo,
          structure: text,
          sourceUrl: `https://deepwiki.com/${repoName}`,
        },
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error calling DeepWiki.";
      const repoName = toRepoName(owner, repo);

      return {
        content: [{ type: "text", text: `DeepWiki request failed: ${message}` }],
        structuredContent: {
          owner,
          repo,
          structure: `DeepWiki request failed: ${message}`,
          sourceUrl: `https://deepwiki.com/${repoName}`,
        },
      };
    }
  }
);

const port = Number(process.env.PORT || 3000);

server.listen(port).then(() => {
  console.log(`DeepWiki MCP server running on port ${port}`);
});
