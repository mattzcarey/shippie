# Project Rules & Context

Shippie gives the review agent project-specific context from two sources: root-level instruction files and Agent Skills.

## Root instruction files

Shippie injects the following files from your repository root (if present) directly into the agent's instructions:

- `AGENTS.md`
- `AGENT.md`
- `CLAUDE.md`

Use these for coding standards, architecture conventions, security requirements, and review focus. The content is plain Markdown — no frontmatter or globs.

### Example `AGENTS.md`

```markdown
# Project Conventions

- TypeScript strict mode; always annotate function return types.
- Prefer interfaces over type aliases for object shapes.

## Security

- Never log secrets or tokens.
- Validate all external input; use parameterized DB queries.

## Review focus

Prioritize correctness, security, and public-API changes.
```

## Agent Skills

flue auto-discovers Agent Skills at:

```
<repo>/.agents/skills/<name>/SKILL.md
```

Each `SKILL.md` needs YAML frontmatter with a `name` and `description`. The directory name must exactly equal the `name` in the frontmatter. The agent loads a skill on demand when its description is relevant to the change under review.

### Example `.agents/skills/db-migrations/SKILL.md`

```markdown
---
name: db-migrations
description: Conventions for reviewing database migration files in db/migrations.
---

# Database Migrations

- Migrations must be reversible; every `up` needs a matching `down`.
- Never drop a column in the same release that stops writing to it.
- Add indexes concurrently to avoid table locks.
```
