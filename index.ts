import { createMCPServer } from 'mcp-use/server'

const server = createMCPServer('deepwiki-mcp', {
  version: '1.0.0',
  description: 'Ask questions about any public GitHub repo via DeepWiki',
  baseUrl: process.env.MCP_URL,
})

server.tool(
  'ask_question',
  {
    owner: {
      type: 'string',
      description: 'GitHub username or org (e.g. "openai")'
    },
    repo: {
      type: 'string',
      description: 'Repository name (e.g. "whisper")'
    },
    question: {
      type: 'string',
      description: 'Your question about the codebase'
    }
  },
  async ({ owner, repo, question }) => {
    const res = await fetch('https://mcp.deepwiki.com/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner, repo, question })
    })
    const data = await res.json()
    return {
      content: [{ type: 'text', text: data.answer ?? JSON.stringify(data) }]
    }
  }
)

server.tool(
  'read_wiki_structure',
  {
    owner: { type: 'string', description: 'GitHub username or org' },
    repo: { type: 'string', description: 'Repository name' }
  },
  async ({ owner, repo }) => {
    const res = await fetch(
      `https://mcp.deepwiki.com/wiki/structure/${owner}/${repo}`
    )
    const data = await res.json()
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
    }
  }
)

server.start()
