# Recommended Claude Code Hooks for languageAI

Add these to your `.claude/settings.json` or configure via `claude hooks add`.

## 1. Post-Edit Quality Check

Run type checking and linting after significant file edits.

```json
{
  "hooks": {
    "post-tool-use": [
      {
        "tool": "Edit",
        "command": "npx tsc --noEmit 2>&1 | head -20",
        "description": "Type check after edits"
      }
    ]
  }
}
```

## 2. Protect Sensitive Directories

Warn before writing to native directories or generated files.

```json
{
  "hooks": {
    "pre-tool-use": [
      {
        "tool": "Write",
        "command": "echo \"$FILE_PATH\" | grep -E '^(ios/|android/|node_modules/|dist/)' && echo 'BLOCKED: Do not write to native/generated directories without explicit permission' && exit 1 || exit 0",
        "description": "Block writes to ios/, android/, node_modules/, dist/"
      }
    ]
  }
}
```

## 3. Run Tests After New Test Files

```json
{
  "hooks": {
    "post-tool-use": [
      {
        "tool": "Write",
        "command": "echo \"$FILE_PATH\" | grep -E '\\.test\\.(ts|tsx)$' && npm test -- --bail 2>&1 | tail -20 || exit 0",
        "description": "Run tests when test files are created/modified"
      }
    ]
  }
}
```

## Manual Quality Check Commands

Run these before committing:

```bash
# Full quality check
npx tsc --noEmit && npm run lint && npm test

# Quick check
npx tsc --noEmit
```
