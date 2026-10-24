---
name: Bug report
about: Create a report to help us improve Renderloom
title: '[BUG] '
labels: bug
assignees: ''
---

> **SECURITY NOTICE: NEVER SHARE API KEYS OR SENSITIVE TOKENS**
> Do not paste API keys, bearer tokens, passwords, or raw authorization headers in this issue or in attached logs. Renderloom masks credentials automatically in server logs, but always inspect stack traces and logs before submitting.

### Description
A clear and concise description of the bug.

### Environment
- **OS:** (e.g. Linux 6.x, macOS 14.x, Windows 11 via WSL2)
- **Bun Version:** (`bun --version`)
- **Browser:** (e.g. Chrome 125, Firefox 126, Safari 17)
- **LLM Provider & Model:** (e.g. OpenAI `gpt-4o`, Anthropic `claude-3-5-sonnet-20241022`)
- **Renderloom Commit / Tag:** (`git rev-parse --short HEAD`)

### Steps to Reproduce
1. Start server with `bun run dev`
2. Open workspace at `http://localhost:5173`
3. Enter prompt: '...'
4. Click 'Generate'
5. Observe error

### Expected Behavior
A clear and concise description of what you expected to happen.

### Actual Behavior
What actually happened (e.g. error message in UI, failed candidate status).

### Relevant Logs / Error Output
```text
(Paste sanitized console or server log output here)
```

### Additional Context
Any additional context (e.g. custom base URL, unusual image dimensions, style preset used).
