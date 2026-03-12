# Recommended MCP Servers for languageAI

## 1. GitHub MCP Server

**Purpose:** Manage PRs, issues, and code reviews directly from Claude.

**Setup:**
```bash
claude mcp add github -- npx -y @modelcontextprotocol/server-github
```

Set the `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable with a token that has repo access.

---

## 2. Supabase MCP Server

**Purpose:** Query the database, inspect schema, check RLS policies, and debug data issues without leaving Claude.

**Setup:**
```bash
claude mcp add supabase -- npx -y @supabase/mcp-server-supabase@latest \
  --supabase-url "$EXPO_PUBLIC_SUPABASE_URL" \
  --supabase-service-key "$SUPABASE_SERVICE_ROLE_KEY"
```

Note: The service role key is needed for the MCP server to bypass RLS. Keep it in your local env only.

---

## 3. Web Search (Brave Search)

**Purpose:** Look up current Expo, Supabase, Stripe, and React Native docs. Useful for debugging version-specific issues.

**Setup:**
```bash
claude mcp add brave-search -- npx -y @anthropic-ai/mcp-server-brave-search
```

Set `BRAVE_API_KEY` environment variable.

---

## 4. Sentry MCP Server

**Purpose:** View crash reports, error traces, and performance issues from production/TestFlight builds.

**Setup:**
```bash
claude mcp add sentry -- npx -y @sentry/mcp-server-sentry
```

Set `SENTRY_AUTH_TOKEN` and `SENTRY_ORG` environment variables.

---

## 5. Filesystem MCP (already built-in to Claude Code)

No extra setup needed. Claude Code can already read/write project files.

---

## Note on Expo/EAS MCP

There is no official Expo MCP server yet. For build status checks, use:
```bash
eas build:list --platform ios --status=in-progress
```

If an Expo MCP server becomes available, add it here.
