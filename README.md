# 🧠 nakprc-thinking-patterns

An MCP server that generates LLM thinking patterns for any project. Analyzes project architecture, directory structure, dependencies, frameworks, and generates comprehensive reasoning frameworks that help AI assistants understand and navigate codebases effectively.

## Features

- **🏗 Architecture Analysis** - Entry points, build systems, module resolution, framework layers
- **📂 Structure Mapping** - Directory hierarchy, file distribution, language breakdown
- **🧭 Approach Patterns** - Development workflow, testing strategy, code conventions
- **📊 Codebase Metrics** - File counts, line counts, complexity indicators
- **🤖 MCP Server** - Integrated with MCP SDK for AI assistant consumption
- **🖥 CLI** - Run `nakprc tp start` anywhere to analyze the current project

## Installation

```bash
# Install globally
npm install -g nakprc-thinking-patterns

# Or run directly
npx nakprc-thinking-patterns
```

No external dependencies required - uses only Node.js built-in modules.

## Usage

### CLI - Analyze Current Project

```bash
cd /path/to/your/project
nakprc tp start
```

### CLI Options

```bash
nakprc tp start                       # Full thinking patterns to stdout
nakprc tp start -o output.md          # Write to file
nakprc tp start -j                    # Raw JSON output
nakprc tp start -s                    # Quick summary only
nakprc tp start -v                    # Include detailed metrics
nakprc tp start -d 15                 # Scan depth 15 (default: 10)
nakprc tp start --section architecture # Architecture patterns only
nakprc tp start --path /some/dir       # Analyze specific directory
nakprc --version                       # Show version
nakprc --help                          # Show help
```

### MCP Server

Configure in your MCP settings (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "nakprc-thinking-patterns": {
      "command": "nakprc",
      "args": ["mcp"]
    }
  }
}
```

Available MCP tools:
- **analyze_project** - Full project analysis
- **get_thinking_patterns** - Get thinking patterns by section
- **get_project_summary** - Quick summary

## Generated Thinking Patterns

### Architecture Patterns
- **Entry Points & Code Flow** - Entry points, source/test roots, config files
- **Architecture Style** - Build system, TypeScript, manifest detection
- **Framework Layer** - Detected frameworks with confidence levels

### Structure Patterns
- **Directory Structure Overview** - File counts, directory hierarchy
- **Source Code Organization** - Feature-based, domain-based pattern detection
- **Language Distribution** - Language breakdown by file count and lines
- **File Size & Complexity** - Large file identification
- **Root Directory Files** - Important config files at project root

### Approach Patterns
- **Development Workflow** - npm scripts, linting, lockfile detection
- **Testing Strategy** - Test framework detection and conventions
- **Code Conventions** - README, gitignore, style guide detection
- **Dependency Management** - Production vs dev dependencies
- **Codebase Health Metrics** - Scale, type coverage, test coverage

## Example Output

```
══════════════════════════════════════════════════════════════════
  🧠 LLM THINKING PATTERNS FOR THIS PROJECT
══════════════════════════════════════════════════════════════════

  **Project**: my-app v2.1.0
  **Path**: /path/to/project

─────────────────────────────────────────────────────────────
  ## [CRITICAL] Entry Points & Code Flow
────────────────────────────────────────────────────────────────

### Entry Points & Code Flow
- **Primary entry point**: main: src/index.ts, module: src/index.ts
- **Source root**: src
- **Test root**: tests
- **Output directory**: dist/ or build/
- **Config files**: tsconfig.json, .eslintrc, package.json

**Key question to ask**: What is the top-level file that bootstraps this application?

───────────────────────────────────────────────────────────────
  ## [HIGH] Framework Layer & Abstractions
────────────────────────────────────────────────────────────────

### Framework Layer & Abstractions

Detected frameworks:
- **React** (Frontend Framework) — Confidence: high
- **TypeScript** (Language Runtime) — Confidence: high
- **Vitest** (Test Framework) — Confidence: high

────────────────────────────────────────────────────────────────
  ## [MEDIUM] Codebase Health Metrics
─────────────────────────────────────────────────────────────────────

### Codebase Health Metrics
- **Total files**: 128
- **Total lines**: 5,420
- **Total size**: 245.3KB
- **Max directory depth**: 4
- **Has TypeScript**: Yes
- **Has linting**: Yes
- **Has test framework**: Yes
```

## Project Detection

Automatically detects:

### Package Managers
npm, pnpm, yarn, bun, pip, pipenv, cargo, go_modules, gradle, maven, mix, nuget, make, bazel

### Languages
TypeScript, JavaScript, Python, Rust, Go, Ruby, Java, C/C++, C#, PHP, Swift, Kotlin, Dart, HTML, CSS, SCSS, JSON, YAML, TOML, Markdown, Shell, SQL, GraphQL, XML, and more

### Frontend Frameworks
React, Next.js, Vue, Nuxt, Angular, Svelte, Remix

### Backend Frameworks
NestJS, Express, Fastify, Koa, Hapi, Django, Flask, FastAPI, Rails, Sinatra

### Databases
Prisma, TypeORM, Mongoose, Drizzle, Sequelize, PostgreSQL, MySQL, MongoDB, Redis

### Build Tools
Webpack, Vite, Rollup, esbuild, Parcel

### Testing Frameworks
Jest, Vitest, Mocha, Chai, Cypress, Playwright

### Other
ESLint, Prettier, Stylelint, Socket.IO, GraphQL, Apollo, State Management libs, Validation libs, HTTP clients

## Development

```bash
# No build step needed - pure Node.js!
# Just install globally:
npm install -g nakprc-thinking-patterns

# Or use directly:
node nakprc.js tp start
```

## Deploy

Hosted at: https://ai.nakprc.com/llm/thinking-patterns

## License

MIT
