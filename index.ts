import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import express from "express";

function createServer() {
  const server = new McpServer({
    name: "deepwiki-mcp",
    version: "1.0.0",
  });

  server.tool(
    "ask_question",
    "Ask a question about any public GitHub repository",
    {
      owner: z.string().describe("GitHub username or org (e.g. 'openai')"),
      repo: z.string().describe("Repository name (e.g. 'whisper')"),
      question: z.string().describe("Your question about the codebase"),
    },
    async ({ owner, repo, question }) => {
      const response = await fetch("https://mcp.deepwiki.com/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, question }),
      });
      const data = (await response.json()) as any;
      return {
        content: [{ type: "text" as const, text: data.answer ?? JSON.stringify(data) }],
      };
    }
  );

  server.tool(
    "read_wiki_structure",
    "Get the documentation structure/table of contents for a GitHub repo",
    {
      owner: z.string().describe("GitHub username or org"),
      repo: z.string().describe("Repository name"),
    },
    async ({ owner, repo }) => {
      const response = await fetch(
        `https://mcp.deepwiki.com/wiki/structure/${owner}/${repo}`
      );
      const data = (await response.json()) as any;
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("Error handling MCP request:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

app.get("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

app.delete("/mcp", (_req, res) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed.",
    },
    id: null,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DeepWiki MCP server running on port ${PORT}`);
});
