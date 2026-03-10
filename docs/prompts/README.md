# AI Prompts

This directory stores reusable prompts used when working with AI coding assistants (Claude, Cursor, etc.) on this project.

## Purpose

- Capture context-rich prompts that can be reused across sessions
- Document prompt patterns that have worked well for specific tasks
- Provide onboarding context prompts for new AI sessions

## Structure

Add prompts as markdown files, organised by area:

```
prompts/
├── README.md           ← this file
├── backend/            ← Supabase schema, RLS, edge function prompts
├── mobile/             ← Flutter feature prompts
├── web/                ← Next.js admin/retailer portal prompts
└── context/            ← Full project context prompts for session starts
```

## Tips

- Include relevant schema or type definitions inline in prompts
- Reference ADRs when asking about architectural decisions
- Use `CLAUDE.md` at the root for persistent project context
