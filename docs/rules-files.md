# Rules Files

Shippie automatically discovers and incorporates project-specific rules files into the review context, providing your AI reviewer with important context about coding standards, best practices, and project-specific guidelines.

## Overview

Rules files help the AI reviewer understand your project's:

- Coding standards and style guidelines
- Framework-specific best practices
- Security requirements
- Architecture patterns
- Custom linting rules

These files are automatically discovered from standard locations and intelligently incorporated into the review prompt.

## Rule Deduplication

Shippie automatically deduplicates rules to avoid redundancy:

- **Content-based**: Rules with identical content are automatically merged
- **Description-based**: Rules with very similar descriptions are deduplicated
- **Path preference**: When duplicates are found, more specific paths (e.g., `.cursor/rules/`) are preferred over root-level files

## Supported Directories

Shippie searches for rules files in these directories:

```
.cursor/rules/          # Cursor editor rules
.shippie/rules/         # Shippie-specific rules
.windsurfrules/         # Windsurf editor rules (legacy)
.windsurf/rules/        # Windsurf editor rules (preferred)
clinerules/             # CLI-specific rules
```

## Root-Level Rules Files

Additionally, these files in the project root are treated as rules files:

```
AGENTS.md               # AI agent instructions
AGENT.md                # Alternative agent instructions  
CLAUDE.md               # Claude-specific instructions
```

## Supported File Types

All directories support both formats:

- **`.mdc`** files: Markdown with frontmatter (recommended)
- **`.md`** files: Standard markdown (with optional frontmatter)

## File Format

### Basic Structure

```markdown
---
description: Brief description of the rule
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# Rule Content

Your rule content goes here in standard markdown.
```

### Frontmatter Properties

| Property      | Type               | Required | Description                               |
| ------------- | ------------------ | -------- | ----------------------------------------- |
| `description` | string             | No       | Brief description shown in rule summary   |
| `globs`       | string[] or string | No       | File patterns this rule applies to        |
| `alwaysApply` | boolean            | No       | Whether to include full content in prompt |

### Globs Format

Globs can be specified in two formats:

**Array format (recommended):**

```yaml
globs:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
```

**String format:**

```yaml
globs: "**/*.ts,**/*.tsx,**/*.js"
```

## Rule Types

### Brief Rules (Default)

Most rules are referenced briefly in the prompt:

```markdown
---
description: TypeScript style guidelines
globs: ["**/*.ts", "**/*.tsx"]
alwaysApply: false
---

# TypeScript Guidelines

- Use strict TypeScript settings
- Prefer interfaces over types for object shapes
- Always specify return types for functions
```

**Appears in prompt as:**

```
See these rules files for more info:
- .cursor/rules/typescript.mdc: TypeScript style guidelines
  Applies to: **/*.ts, **/*.tsx
```

### Always-Apply Rules

Critical rules with `alwaysApply: true` include full content:

```markdown
---
description: Security requirements that must always be followed
globs: ["**/*.ts", "**/*.js"]
alwaysApply: true
---

# Security Rules

These rules must ALWAYS be followed:

1. Never commit secrets or API keys
2. Always validate user input
3. Use parameterized queries for database operations
4. Implement proper authentication checks
```

**Appears in prompt as:**

```
Always-apply rules (full content):

## .cursor/rules/security.mdc
# Security Rules

These rules must ALWAYS be followed:

1. Never commit secrets or API keys
2. Always validate user input
3. Use parameterized queries for database operations
4. Implement proper authentication checks
```

## Files Without Frontmatter

Files without frontmatter are also supported. The first few lines are used as the description:

```markdown
# React Best Practices

Always use functional components.
Prefer hooks over class components.
Keep components small and focused.
```

## Important Documentation Files

Additionally, these files are automatically included as documentation context if they exist:

- `todo.md` - Project todos
- `.same/todos.md` - Alternative todos location
- `CONTRIBUTING.md` - Contribution guidelines

## Example Project Structure

```
my-project/
├── .cursor/rules/
│   ├── typescript.mdc      # TS style rules
│   ├── security.mdc        # Security requirements (alwaysApply: true)
│   └── react.md           # React best practices
├── .windsurf/rules/
│   └── windsurf-specific.mdc # Windsurf editor rules
├── .shippie/rules/
│   └── architecture.mdc    # Architecture patterns
├── AGENTS.md              # AI agent instructions (rules file)
├── CLAUDE.md              # Claude-specific instructions (rules file)
├── CONTRIBUTING.md        # Contribution guide (documentation)
├── todo.md                # Project todos (documentation)
└── src/
    └── components/
```

## Best Practices

### 1. Use Descriptive Filenames

```
✅ typescript-style.mdc
✅ security-requirements.mdc
✅ react-components.mdc

❌ rules.mdc
❌ stuff.mdc
❌ misc.md
```

### 2. Set Appropriate Globs

```yaml
# Specific to file types
globs: ["**/*.ts", "**/*.tsx"]

# Specific to directories
globs: ["src/components/**/*.tsx"]

# Multiple patterns
globs: ["**/*.test.ts", "**/*.spec.ts"]
```

### 3. Use alwaysApply Sparingly

Only use `alwaysApply: true` for:

- Critical security requirements
- Mandatory architecture patterns
- Non-negotiable coding standards

### 4. Keep Rules Focused

Each file should cover one area:

- One file for TypeScript rules
- Separate file for React patterns
- Dedicated file for security requirements

### 5. Provide Clear Descriptions

```yaml
✅ description: "Security requirements for authentication and data validation"
✅ description: "React component patterns and lifecycle best practices"

❌ description: "Some rules"
❌ description: "Important stuff"
```

## Integration with Review Process

1. **Discovery**: Shippie scans all supported directories for `.mdc` and `.md` files
2. **Parsing**: Files are parsed using gray-matter for robust frontmatter handling
3. **Classification**: Rules are categorized as brief or always-apply
4. **Context Building**: Rules are formatted and added to the review prompt
5. **AI Review**: The AI reviewer uses this context to provide relevant feedback

## Example Review Prompt Output

```
// Project Context
See these rules files for more info:
- .cursor/rules/typescript.mdc: TypeScript style guidelines
  Applies to: **/*.ts, **/*.tsx
- .cursor/rules/react.mdc: React component best practices
  Applies to: **/*.tsx

Always-apply rules (full content):

## .cursor/rules/security.mdc
# Security Requirements
Never commit secrets. Always validate input. Use parameterized queries.

Important project documentation:

## CLAUDE.md
# Review Instructions
Focus on security vulnerabilities and performance issues.
```

This provides your AI reviewer with comprehensive context about your project's requirements and standards, leading to more relevant and useful code reviews.
