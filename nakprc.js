#!/usr/bin/env node
/**
 * nakprc-thinking-patterns - Generate LLM thinking patterns for any project.
 * Zero dependencies - uses only Node.js built-in modules.
 */
import { readFileSync, writeFileSync, existsSync, readdir as readdirSync } from 'fs';
import { readdir, stat } from 'fs/promises';
import { join, resolve, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parser ─────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'tp';
  const subcmd = args[1] || 'start';
  const opts = {
    path: process.cwd(),
    json: false, short: false, verbose: false,
    output: null, depth: 10, section: 'all'
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    switch (a) {
      case '-o': case '--output': opts.output = args[++i]; break;
      case '-j': case '--json': opts.json = true; break;
      case '-s': case '--short': opts.short = true; break;
      case '-v': case '--verbose': opts.verbose = true; break;
      case '-d': case '--depth': opts.depth = parseInt(args[++i]) || 10; break;
      case '-p': case '--path': opts.path = args[++i]; break;
      case '-h': case '--help': opts.help = true; break;
      case '--version': opts.version = true; break;
      case 'mcp': opts.mcp = true; break;
    }
  }
  return { cmd, subcmd, opts };
}

// ─── Main Entry ─────────────────────────────────────────
async function main() {
  const { cmd, subcmd, opts } = parseArgs();

  if (opts.version) {
    const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));
    console.log(`nakprc-thinking-patterns v${pkg.version}`);
    return;
  }
  if (opts.help) { printHelp(); return; }
  if (opts.mcp) { await startMCPServer(); return; }
  if (cmd !== 'tp') { printHelp(); return; }

  const targetDir = resolve(opts.path);
  if (!existsSync(targetDir)) {
    console.error(`❌ Directory not found: ${targetDir}`);
    process.exit(1);
  }

  if (subcmd === 'start' || subcmd === 'analyze') {
    const analysis = await analyzeProject(targetDir, opts.depth);

    if (opts.json) {
      const out = JSON.stringify(analysis, null, 2);
      if (opts.output) writeFileSync(opts.output, out);
      else console.log(out);
      return;
    }
    if (opts.short) { printSummary(analysis); return; }
    if (opts.section && opts.section !== 'all') {
      const pats = analysis.thinkingPatterns.filter(p => p.section === opts.section);
      console.log(generatePatternOutput(pats));
      return;
    }
    const output = generateFullOutput(analysis, opts.verbose);
    if (opts.output) writeFileSync(opts.output, output);
    else console.log(output);
  }
}

// ─── Project Analyzer ───────────────────────────────────
const IGNORED_DIRS = [
  'node_modules', '.git', '.svn', '.hg', '.vscode', '.idea',
  'dist', 'build', 'out', '.next', '.nuxt', '.output', 'coverage',
  '__pycache__', '.mypy_cache', '.tox', 'venv', '.venv', 'env',
  '.angular', '.parcel-cache', 'target', '.gradle', '.mvn',
  'Pods', 'vendor', '.cache', '.turbo', '.parcel', 'pnp*', '.yarn'
];

async function scanFiles(root, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return [];
  const entries = [];
  try {
    const items = await readdir(root, { withFileTypes: true });
    for (const entry of items) {
      const name = entry.name;
      if (IGNORED_DIRS.includes(name)) continue;
      if (name.startsWith('.') && name !== '..') continue;
      if (name === '.DS_Store' || name === 'Thumbs.db') continue;

      const full = join(root, name);
      if (entry.isDirectory()) {
        const sub = await scanFiles(full, depth + 1, maxDepth);
        entries.push(...sub);
      } else {
        let sz = 0;
        try { sz = (await stat(full)).size; } catch {}
        entries.push({
          path: full, name, ext: extname(name), depth, size: sz
        });
      }
    }
  } catch {}
  return entries;
}

async function analyzeProject(rootDir, maxDepth = 10) {
  // Read package.json first (always try)
  let packageData = {};
  try { packageData = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')); } catch {}

  const files = await scanFiles(rootDir, 0, maxDepth);
  const baseDir = rootDir + '/';

  // Build relative paths
  for (const f of files) {
    f.relPath = f.path.substring(baseDir.length);
  }

  // Structure
  const topLevelDirs = new Set();
  const topLevelFiles = [];
  const srcByDir = {};
  const largestFiles = [];
  const hiddenFiles = [];

  for (const f of files) {
    const parts = f.relPath.split('/');
    const topDir = parts.length > 1 ? parts[0] : '';

    if (f.relPath.startsWith('.')) hiddenFiles.push(f.relPath);
    if (topDir) topLevelDirs.add(topDir);
    if (f.depth === 0) topLevelFiles.push(f.name);
    if (f.size > 50000) largestFiles.push({ path: f.relPath, size: f.size });

    if (f.depth > 0 && topDir) {
      if (!srcByDir[topDir]) srcByDir[topDir] = new Set();
      srcByDir[topDir].add(f.name);
    }
  }

  largestFiles.sort((a, b) => b.size - a.size);

  // Languages
  const extLang = {
    'js': 'JavaScript', 'jsx': 'JavaScript (JSX)', 'ts': 'TypeScript', 'tsx': 'TypeScript (TSX)',
    'py': 'Python', 'rs': 'Rust', 'go': 'Go', 'rb': 'Ruby', 'java': 'Java',
    'c': 'C', 'cpp': 'C++', 'h': 'C/C++ Header', 'cs': 'C#', 'php': 'PHP',
    'swift': 'Swift', 'kt': 'Kotlin', 'dart': 'Dart', 'html': 'HTML',
    'css': 'CSS', 'scss': 'SCSS', 'sass': 'Sass', 'less': 'Less',
    'json': 'JSON', 'yaml': 'YAML', 'yml': 'YAML', 'toml': 'TOML',
    'md': 'Markdown', 'sh': 'Shell', 'bash': 'Shell (Bash)', 'sql': 'SQL',
    'vue': 'Vue', 'svelte': 'Svelte', 'graphql': 'GraphQL', 'gql': 'GraphQL',
    'xml': 'XML', 'txt': 'Text', 'cfg': 'Config', 'ini': 'INI',
    'wasm': 'WebAssembly', 'jl': 'Julia', 'r': 'R'
  };

  const langMap = new Map();
  for (const f of files) {
    if (!f.ext) continue;
    const lang = extLang[f.ext] || f.ext.toUpperCase() + ' File';
    if (!langMap.has(lang)) langMap.set(lang, { files: 0, lines: 0 });
    const l = langMap.get(lang);
    l.files++;
    l.lines += Math.floor(f.size / 50);
  }

  const totalLines = Array.from(langMap.values()).reduce((s, l) => s + l.lines, 0);
  const languages = Array.from(langMap.entries())
    .map(([name, data]) => ({
      name,
      weight: totalLines > 0 ? (data.lines / totalLines) * 100 : 0,
      fileCount: data.files,
      totalLines: data.lines
    }))
    .sort((a, b) => b.weight - a.weight);

  // Metrics
  let maxDepthVal = 0, totalSize = 0;
  let hasTests = false, hasConfig = false, hasReadme = false;
  let hasGitignore = false, hasLockfile = false, hasTypescript = false;
  let hasLinting = false, hasTestFramework = false;

  for (const f of files) {
    maxDepthVal = Math.max(maxDepthVal, f.depth);
    totalSize += f.size;
    const p = f.relPath.toLowerCase();
    if (['test', 'spec', '__tests__', 'e2e', 'cypress', 'playwright'].some(k => p.includes(k))) hasTests = true;
    if ((packageData.scripts || {})[Object.keys(packageData.scripts || {}).find(k => k.includes('test'))]) hasTests = true;
    if (['config', 'rc', 'ignore', 'docker'].some(k => p.includes(k))) hasConfig = true;
    if (p.includes('readme')) hasReadme = true;
    if (p.includes('.gitignore') || p.includes('gitignore')) hasGitignore = true;
    if (p.includes('lock') || p.includes('.lock') || p.includes('yarn.lock') || p.includes('pnpm-lock') || p.includes('package-lock') || p.includes('.lockfile')) hasLockfile = true;
    if (packageData.devDependencies || packageData.dependencies) hasLockfile = true; // npm always has a lockfile
    if (p.includes('typescript') || p.includes('tsconfig') || f.ext === '.ts' || f.ext === '.tsx') hasTypescript = true;
    if (['eslint', 'prettier', 'stylelint'].some(k => p.includes(k))) hasLinting = true;
    if (['eslint', 'prettier', 'stylelint', 'xo', 'biome'].some(k => (packageData.devDependencies || {})[k])) hasLinting = true;
    if (['jest', 'vitest', 'mocha'].some(k => p.includes(k))) hasTestFramework = true;
    if (['jest', 'vitest', 'mocha', 'cypress', 'playwright', 'ava'].some(k => (packageData.devDependencies || {})[k])) hasTestFramework = true;
  }

  // Dependencies from package.json
  const deps = [];
  const devDeps = [];
  for (const [name, version] of Object.entries(packageData.dependencies || {})) {
    const isDev = categorizeAsDev(name);
    (isDev ? devDeps : deps).push({ name, version });
  }
  for (const [name, version] of Object.entries(packageData.devDependencies || {})) {
    devDeps.push({ name, version });
  }

  // Detect frameworks from package.json content
  const pkgText = JSON.stringify(packageData);
  const allText = pkgText;

  const fwMap = new Map();
  const frameworks = [
    ['react', 'react-dom'], ['@react'], ['next'], ['nuxt', 'vue'], ['@angular'], ['svelte', 'svelte-kit'],
    ['@remix-run'], ['@nestjs', 'nest'], ['express'], ['fastify'], ['koa'], ['hapi'],
    ['django'], ['flask'], ['fastapi'], ['rails', 'sinatra'],
    ['tailwind'], ['prisma'], ['typeorm'], ['mongoose'], ['drizzle'], ['sequelize'],
    ['redis'], ['pg', 'pg-hstore'], ['mysql', 'mysql2'], ['mongodb'],
    ['typescript'], ['jest'], ['vitest'], ['mocha', 'chai'], ['cypress'], ['playwright'],
    ['eslint'], ['prettier'], ['webpack'], ['vite'], ['rollup'], ['esbuild'],
    ['socket.io'], ['graphql', 'apollo', 'urql'], ['redux', 'zustand', 'recoil', 'jotai', 'mobx'],
    ['axios', 'node-fetch', 'got'], ['zod', 'joi', 'yup', 'valibot'], ['lodash', 'ramda']
  ];

  for (const [keywords, name, type] of [
    [['react', 'react-dom'], 'React', 'Frontend Framework'],
    [['next'], 'Next.js', 'Full-stack Framework'],
    [['vue'], 'Vue', 'Frontend Framework'],
    [['nuxt'], 'Nuxt', 'Full-stack Framework'],
    [['@angular'], 'Angular', 'Frontend Framework'],
    [['svelte', 'svelte-kit'], 'Svelte', 'Frontend Framework'],
    [['@remix-run'], 'Remix', 'Full-stack Framework'],
    [['@nestjs', 'nest'], 'NestJS', 'Backend Framework'],
    [['express'], 'Express', 'Backend Framework'],
    [['fastify'], 'Fastify', 'Backend Framework'],
    [['koa'], 'Koa', 'Backend Framework'],
    [['django'], 'Django', 'Backend Framework'],
    [['flask'], 'Flask', 'Backend Framework'],
    [['fastapi'], 'FastAPI', 'Backend Framework'],
    [['rails', 'sinatra'], 'Rails/Sinatra', 'Backend Framework'],
    [['tailwind'], 'Tailwind CSS', 'Styling'],
    [['prisma'], 'Prisma ORM', 'Database'],
    [['typeorm'], 'TypeORM', 'Database'],
    [['mongoose'], 'Mongoose', 'Database'],
    [['drizzle'], 'Drizzle ORM', 'Database'],
    [['sequelize'], 'Sequelize', 'Database'],
    [['redis'], 'Redis', 'Database/Cache'],
    [['pg', 'pg-hstore'], 'PostgreSQL', 'Database'],
    [['mysql', 'mysql2'], 'MySQL', 'Database'],
    [['mongodb'], 'MongoDB', 'Database'],
    [['typescript'], 'TypeScript', 'Language Runtime'],
    [['jest'], 'Jest', 'Test Framework'],
    [['vitest'], 'Vitest', 'Test Framework'],
    [['mocha', 'chai'], 'Mocha/Chai', 'Test Framework'],
    [['cypress'], 'Cypress', 'E2E Testing'],
    [['playwright'], 'Playwright', 'E2E Testing'],
    [['eslint'], 'ESLint', 'Linting'],
    [['prettier'], 'Prettier', 'Formatting'],
    [['webpack'], 'Webpack', 'Build Tool'],
    [['vite'], 'Vite', 'Build Tool'],
    [['rollup'], 'Rollup', 'Build Tool'],
    [['esbuild'], 'esbuild', 'Build Tool'],
    [['socket.io'], 'Socket.IO', 'Real-time'],
    [['graphql', 'apollo', 'urql'], 'GraphQL', 'API'],
    [['redux', 'zustand', 'recoil', 'jotai', 'mobx'], 'State Management', 'Utility'],
    [['axios', 'node-fetch', 'got'], 'HTTP Client', 'Utility'],
    [['zod', 'joi', 'yup', 'valibot'], 'Validation', 'Utility'],
    [['lodash', 'ramda'], 'Utility Library', 'Utility'],
  ]) {
    let score = 0;
    for (const kw of keywords) {
      if (allText.includes(kw)) score += 2;
    }
    if (score >= 2) fwMap.set(name, type);
  }

  const frameworksArr = Array.from(fwMap.entries()).map(([name, type]) => ({ name, type, confidence: 'high' }));

  // Entry points
  const entryPoints = [];
  if (packageData.main) entryPoints.push(`main: ${packageData.main}`);
  if (packageData.module) entryPoints.push(`module: ${packageData.module}`);
  if (packageData.bin) {
    if (typeof packageData.bin === 'string') entryPoints.push(`bin: ${packageData.bin}`);
    else Object.entries(packageData.bin).forEach(([k, v]) => entryPoints.push(`bin.${k}: ${v}`));
  }

  // Build system
  const buildSystems = {
    'npm': 'package-lock.json', 'pnpm': 'pnpm-lock.yaml', 'yarn': 'yarn.lock', 'bun': 'bun.lockb',
    'pip': 'requirements.txt', 'pipenv': 'Pipfile', 'cargo': 'Cargo.toml',
    'go_modules': 'go.mod', 'gradle': 'build.gradle', 'maven': 'pom.xml',
    'mix': 'mix.exs', 'nuget': '*.csproj', 'make': 'Makefile'
  };
  let buildSystem = 'unknown';
  // Check for lockfiles first
  for (const [sys, indicator] of Object.entries(buildSystems)) {
    for (const f of files) {
      if (f.name.includes(indicator) || f.name === indicator) {
        buildSystem = sys;
        break;
      }
    }
    if (buildSystem !== 'unknown') break;
  }
  // Fallback: if package.json exists, it's npm
  if (buildSystem === 'unknown' && packageData.name) buildSystem = 'npm';

  // Source/test/dist roots
  const roots = {
    source: ['src', 'lib', 'app', 'packages', 'apps', 'core', 'shared'],
    test: ['test', 'tests', '__tests__', 'spec', 'specs', 'e2e', 'cypress'],
    dist: ['dist', 'build', 'out', '.next', '.output', '.nuxt']
  };
  function detectRoot(prefixes) {
    for (const r of prefixes) {
      if (topLevelDirs.has(r)) return r;
    }
    return undefined;
  }

  const configFiles = files.filter(f => {
    const name = f.name.toLowerCase();
    // Explicit config file patterns
    return ['tsconfig', 'jsconfig', 'package.json', '.env', 'Dockerfile'].some(k => name.includes(k)) ||
           ['rc', 'rc.', 'ignore', 'eslintrc', 'prettierrc', 'babel', 'gitignore', 'justfile', 'makefile', 'license', 'readme', 'changelog', 'contributing', '.github'].some(k => name.includes(k)) ||
           name.endsWith('.yml') || name.endsWith('.yaml');
  }).map(f => f.relPath).slice(0, 20);

  const analysis = {
    rootDir,
    structure: {
      topLevelDirs: Array.from(topLevelDirs).sort(),
      topLevelFiles,
      srcStructure: Object.fromEntries(Object.entries(srcByDir).map(([k, v]) => [k, Array.from(v)])),
      totalFiles: files.filter(f => !f.isDirectory).length,
      totalDirs: files.filter(f => f.isDirectory).length + 1,
      largestFiles: largestFiles.slice(0, 10),
      hiddenFiles: hiddenFiles.slice(0, 20)
    },
    languages,
    frameworks: frameworksArr,
    dependencies: deps,
    devDependencies: devDeps,
    packageData,
    architecture: {
      entryPoints,
      mainDirectory: 'project root',
      buildSystem,
      hasTsConfig: files.some(f => f.name.includes('tsconfig')),
      hasPackageManifest: !!packageData,
      configFiles,
      sourceRoot: detectRoot(roots.source),
      testRoot: detectRoot(roots.test),
      distRoot: detectRoot(roots.dist)
    },
    metrics: {
      totalFiles: files.filter(f => !f.isDirectory).length,
      totalLines,
      totalSize,
      maxDepth: maxDepthVal,
      hasTests, hasConfig, hasReadme, hasGitignore,
      hasLockfile, hasTypescript, hasLinting, hasTestFramework
    },
    thinkingPatterns: []
  };

  // Generate thinking patterns
  analysis.thinkingPatterns = [
    ...genArchitecturePatterns(analysis),
    ...genStructurePatterns(analysis),
    ...genApproachPatterns(analysis)
  ];

  return analysis;
}

function categorizeAsDev(name) {
  const dev = ['jest', 'mocha', 'vitest', 'eslint', 'prettier', 'webpack', 'vite', 'rollup', 'ts-node', 'nodemon', 'typescript', 'supertest', 'husky', 'commitlint', 'lint-staged', 'rimraf', 'concurrently', 'cross-env', '@types/', 'jest-environment', 'ts-jest', 'babel-jest', 'webpack-dev-server', 'storybook', 'semantic-release', 'typedoc', 'jsdoc', 'prisma', 'drizzle-kit', 'typeorm', 'sequelize-cli'];
  return dev.some(d => name.includes(d));
}

// ─── Pattern Generators ─────────────────────────────────
function genArchitecturePatterns(a) {
  return [
    {
      id: 'entry-points', title: 'Entry Points & Code Flow', section: 'architecture', priority: 'critical',
      content: `### Entry Points & Code Flow
- **Primary entry point**: ${a.architecture.entryPoints.length > 0 ? a.architecture.entryPoints.join(', ') : 'Auto-detected from config'}
- **Source root**: ${a.architecture.sourceRoot || 'project root'}
- **Test root**: ${a.architecture.testRoot || 'Not detected'}
- **Output directory**: ${a.architecture.distRoot || 'dist/ or build/'}
- **Config files**: ${a.architecture.configFiles.length > 0 ? a.architecture.configFiles.join(', ') : 'none detected'}

**Key question to ask**: What is the top-level file that bootstraps this application? Trace the code flow from entry point down.

**When adding features**: Start from the right entry point. Don't introduce new entry points unless the project structure demands it.`
    },
    {
      id: 'arch-style', title: 'Architecture Style & Organization', section: 'architecture', priority: 'critical',
      content: `### Architecture Style & Organization
- **Build system**: ${a.architecture.buildSystem}
- **Has TypeScript**: ${a.architecture.hasTsConfig ? 'Yes' : 'No'}
- **Has package manifest**: ${a.architecture.hasPackageManifest ? 'Yes' : 'No'}

**Key question to ask**: What architectural pattern does this project follow? How is the code organized across modules?

**When adding features**: Respect existing module boundaries. Mirror the patterns used by similar existing features.`
    },
    {
      id: 'framework-layer', title: 'Framework Layer & Abstractions', section: 'architecture', priority: 'high',
      content: a.frameworks.length > 0
        ? `### Framework Layer & Abstractions

Detected frameworks:
${a.frameworks.map(f => `- **${f.name}** (${f.type}) — Confidence: ${f.confidence}`).join('\n')}

**Key question to ask**: What are the framework-specific conventions? What patterns does the framework encourage?

**When adding features**: Use the framework's idiomatic patterns. Follow its conventions for organization, data flow, and lifecycle.`
        : `### Framework Layer & Abstractions

No major frameworks detected. This may be a vanilla/utility project.

**Recommendation**: Check actual import statements to confirm the tech stack.`
    }
  ];
}

function genStructurePatterns(a) {
  const topDirs = a.structure.topLevelDirs.join(', ');
  const topFiles = a.structure.topLevelFiles.join(', ');
  const srcEntries = Object.entries(a.structure.srcStructure);

  return [
    {
      id: 'dir-overview', title: 'Directory Structure Overview', section: 'structure', priority: 'critical',
      content: `### Directory Structure Overview
- **Total files**: ${a.structure.totalFiles.toLocaleString()}
- **Total directories**: ${a.structure.totalDirs.toLocaleString()}
- **Top-level directories**: ${topDirs || 'none'}
- **Top-level files**: ${topFiles || 'none'}
- **Ignored paths**: node_modules, .git, dist, build, coverage, __pycache__, etc.

**Key question to ask**: Where do similar files live in this project's hierarchy?

**When adding features**: Mirror existing directory patterns. Follow the convention used by the last similar feature added.`
    },
    {
      id: 'source-org', title: 'Source Code Organization', section: 'structure', priority: 'critical',
      content: srcEntries.length > 0
        ? `### Source Code Organization

${srcEntries.slice(0, 12).map(([dir, files]) => `- **${dir}/** (${files.length} files): ${files.slice(0, 6).join(', ')}${files.length > 6 ? '..' : ''}`).join('\n')}${srcEntries.length > 12 ? `\n- ... and ${srcEntries.length - 12} more directories` : ''}

**Key question to ask**: What organizational pattern does the source directory follow (feature-based, domain-based, layered)?

**When adding features**: Follow the existing pattern exactly.`
        : `### Source Code Organization

No structured source directories detected at top level.

**Recommendation**: Look deeper for the actual source organization.`
    },
    {
      id: 'lang-dist', title: 'Language Distribution & Tech Stack', section: 'structure', priority: 'high',
      content: `### Language Distribution & Tech Stack

${a.languages.length > 0 ? a.languages.map(l => `- **${l.name}**: ${l.fileCount} files, ${l.totalLines.toLocaleString()} lines (${l.weight.toFixed(1)}%)`).join('\n') : 'No language data available'}
- **Total lines**: ${a.metrics.totalLines.toLocaleString()}
- **Total size**: ${formatBytes(a.metrics.totalSize)}

**Key question to ask**: What are the primary languages? What patterns does each language follow?

**When adding features**: Stick to the primary language. Introducing new languages requires justification.`
    },
    {
      id: 'file-analysis', title: 'File Size & Complexity Indicators', section: 'structure', priority: 'medium',
      content: a.structure.largestFiles.length > 0
        ? `### File Size & Complexity Indicators

Potentially large files to be aware of:
${a.structure.largestFiles.map(f => `- **${f.path}**: ${formatBytes(f.size)} (${Math.round(f.size / 1024)}KB)`).join('\n')}

**Key question to ask**: Are there monolithic files that might be candidates for refactoring?

**When adding features**: Consider whether the feature should live in an existing file or be split into smaller modules.`
        : `### File Size & Complexity Indicators

No large files detected (>50KB). The codebase appears well-distributed.

**Key question to ask**: No obvious bottleneck files to worry about.`
    },
    {
      id: 'root-files', title: 'Root Directory Files', section: 'structure', priority: 'high',
      content: `### Root Directory Files

${a.structure.topLevelFiles.length > 0 ? a.structure.topLevelFiles.map(f => `- **${f}**`).join('\n') : 'No files at project root.'}

**Key question to ask**: Which root files control build, linting, testing, and deployment?

**When adding features**: Check if new config should go in a root file or dedicated directory.`
    }
  ];
}

function genApproachPatterns(a) {
  const scripts = a.packageData?.scripts;
  const scriptContent = scripts
    ? Object.entries(scripts).map(([name, cmd]) => `- **\`${name}\`**: ${cmd}`).join('\n')
    : 'No package.json scripts detected.';

  const depsContent = a.dependencies.length > 0
    ? a.dependencies.slice(0, 15).map(d => `- **${d.name}@${d.version}**`).join('\n')
    : 'No dependencies detected.';

  const devDepsContent = a.devDependencies.length > 0
    ? a.devDependencies.slice(0, 15).map(d => `- **${d.name}@${d.version}** (dev)`).join('\n')
    : 'No dev dependencies detected.';

  return [
    {
      id: 'workflow', title: 'Development Workflow & Scripts', section: 'approach', priority: 'critical',
      content: `### Development Workflow & Scripts
Scripts defined in the project:
${scriptContent}

${a.metrics.hasLinting ? '- **Linting**: ESLint/Prettier is configured' : ''}
${a.metrics.hasLockfile ? '- **Lockfile**: Dependency versions are locked' : ''}

**Key question to ask**: What are the commands to run tests, linting, and type-checking? What is the standard development workflow?

**When adding features**: Always run the project's own test suite and linter before committing.`
    },
    {
      id: 'testing', title: 'Testing Strategy & Conventions', section: 'approach', priority: 'high',
      content: `### Testing Strategy & Conventions
- **Has tests**: ${a.metrics.hasTests ? 'Yes' : 'No tests detected'}
- **Test framework(s)**: ${a.frameworks.filter(f => ['jest', 'vitest', 'mocha', 'cypress', 'playwright'].some(k => f.name.toLowerCase().includes(k))).map(f => f.name).join(', ')}

**Key question to ask**: What testing framework does this project use? How are tests organized?

**When adding features**: Write tests following the project's existing patterns. Look at existing test files to understand the convention.`
    },
    {
      id: 'conventions', title: 'Code Conventions & Style Guide', section: 'approach', priority: 'high',
      content: `### Code Conventions & Style Guide
- **Has README**: ${a.metrics.hasReadme ? 'Yes' : 'No README found'}
- **Has Git ignore**: ${a.metrics.hasGitignore ? 'Yes' : 'No .gitignore found'}
- **Max directory depth**: ${a.metrics.maxDepth}

**Key question to ask**: Does the project have a CONTRIBUTING guide, style guide, or code of conduct?

**When adding features**: Check the README for conventions. Follow the project's naming, structure, and style.`
    },
    {
      id: 'deps', title: 'Dependency Management Strategy', section: 'approach', priority: 'medium',
      content: `### Dependency Management Strategy
**Production (${a.dependencies.length}):**
${depsContent}${a.dependencies.length > 15 ? `\n- ... and ${a.dependencies.length - 15} more` : ''}

**Development (${a.devDependencies.length}):**
${devDepsContent}${a.devDependencies.length > 15 ? `\n- ... and ${a.devDependencies.length - 15} more` : ''}

**Key question to ask**: What are the key production dependencies? What features does the project depend on?

**When adding features**: Check if needed functionality already exists in dependencies. Be cautious about adding new dependencies.`
    },
    {
      id: 'metrics', title: 'Codebase Health Metrics', section: 'approach', priority: 'medium',
      content: `### Codebase Health Metrics
- **Total files**: ${a.metrics.totalFiles.toLocaleString()}
- **Total lines**: ${a.metrics.totalLines.toLocaleString()}
- **Total size**: ${formatBytes(a.metrics.totalSize)}
- **Max directory depth**: ${a.metrics.maxDepth}
- **Has TypeScript**: ${a.metrics.hasTypescript ? 'Yes' : 'No'}
- **Has linting**: ${a.metrics.hasLinting ? 'Yes' : 'No'}
- **Has test framework**: ${a.metrics.hasTestFramework ? 'Yes' : 'No'}

**Key question to ask**: What is the scale of this codebase? Are there health concerns?

**When adding features**: Be mindful of codebase size. Small focused changes are more likely accepted.`
    }
  ];
}

// ─── Output Formatters ──────────────────────────────────
function generateFullOutput(a, verbose = false) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  🧠 LLM THINKING PATTERNS FOR THIS PROJECT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');

  if (a.packageData?.name) {
    lines.push(`  **Project**: ${a.packageData.name} v${a.packageData.version || '0.0.0'}`);
    if (a.packageData.description) lines.push(`  **Description**: ${a.packageData.description}`);
  }
  lines.push(`  **Path**: ${a.rootDir}`);
  lines.push('');

  const sorted = [...a.thinkingPatterns].sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2, low: 3 };
    return p[a.priority] - p[b.priority];
  });

  for (const pattern of sorted) {
    lines.push('─────────────────────────────────────────────────────────────');
    lines.push(`  ## [${pattern.priority.toUpperCase()}] ${pattern.title}`);
    lines.push('─────────────────────────────────────────────────────────────');
    lines.push('');
    lines.push(pattern.content);
    lines.push('');
  }

  if (verbose) {
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  📊 RAW DATA');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`  Frameworks: ${a.frameworks.map(f => f.name).join(', ') || 'none'}`);
    lines.push(`  Build: ${a.architecture.buildSystem}`);
    lines.push(`  Language breakdown:`);
    for (const lang of a.languages) {
      lines.push(`    - ${lang.name}: ${lang.fileCount} files, ${lang.totalLines.toLocaleString()} lines (${lang.weight.toFixed(1)}%)`);
    }
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('  🧠 THINKING FRAMEWORK SUMMARY');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('  When working with this project, always ask yourself:');
  lines.push('');
  lines.push('  1. **Where does this fit?** — Which directory/module does this belong to?');
  lines.push('  2. **How is it done elsewhere?** — What pattern already exists for this?');
  lines.push('  3. **What are the conventions?** — Naming, structure, style guide?');
  lines.push('  4. **What breaks?** — What tests or builds might be affected?');
  lines.push('  5. **What\'s the entry point?** — How does this connect to the main code flow?');
  lines.push('');

  return lines.join('\n');
}

function generatePatternOutput(patterns) {
  const lines = [];
  const sorted = [...patterns].sort((a, b) => {
    const p = { critical: 0, high: 1, medium: 2, low: 3 };
    return p[a.priority] - p[b.priority];
  });
  for (const p of sorted) {
    lines.push('─'.repeat(60));
    lines.push(`## [${p.priority.toUpperCase()}] ${p.title}`);
    lines.push('─'.repeat(60));
    lines.push(p.content);
    lines.push('');
  }
  return lines.join('\n');
}

function printSummary(a) {
  console.log('📋 PROJECT SUMMARY');
  console.log('─'.repeat(40));
  if (a.packageData?.name) {
    console.log(`📦 ${a.packageData.name}@${a.packageData.version || '0.0.0'}`);
    if (a.packageData.description) console.log(`   ${a.packageData.description}`);
  }
  console.log(`📊 Files: ${a.metrics.totalFiles.toLocaleString()} (${a.metrics.totalLines.toLocaleString()} lines)`);
  console.log(`📂 Structure: ${a.structure.topLevelDirs.join(', ')}${a.structure.topLevelDirs.length > 8 ? '..' : ''}`);
  console.log(`🔧 Build: ${a.architecture.buildSystem}`);
  console.log('');
  if (a.frameworks.length > 0) {
    console.log('🛠 Frameworks:');
    a.frameworks.forEach(f => console.log(`   - ${f.name} (${f.type})`));
    console.log('');
  }
  console.log(`📦 Dependencies: ${a.dependencies.length} prod | ${a.devDependencies.length} dev`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function printHelp() {
  console.log(`nakprc-thinking-patterns — Generate LLM thinking patterns for any project

USAGE:
  nakprc tp start [options]      Analyze current project and generate thinking patterns
  nakprc tp start --path <dir>   Analyze a specific directory
  nakprc --help                  Show this help
  nakprc --version               Show version

OPTIONS:
  -o, --output <path>    Write output to file
  -j, --json             Output raw JSON
  -s, --short            Summary only (no full patterns)
  -v, --verbose          Include detailed metrics
  -d, --depth <n>        Scan depth (default: 10)
  -p, --path <dir>       Target directory
  --section <s>          Output specific section: architecture|structure|approach|all

EXAMPLES:
  nakprc tp start                           # Analyze current directory
  nakprc tp start -o patterns.md            # Write to file
  nakprc tp start -s                        # Quick summary
  nakprc tp start -d 15                     # Deeper scan
  nakprc tp start --section architecture    # Architecture only

For MCP server mode, run: nakprc mcp
`);
}

// ─── MCP Server (minimal stdio-based JSON-RPC) ──────────
async function startMCPServer() {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Send init notification
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', id: 0 }) + '\n');

  rl.on('line', async (line) => {
    let buffer = line;
    try {
      const msg = JSON.parse(buffer);
      const { id, method, params } = msg;

      if (method === 'initialize') {
        process.stdout.write(JSON.stringify({
          jsonrpc: '2.0', id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'nakprc-thinking-patterns', version: '1.0.0' }
          }
        }) + '\n');
        return;
      }

      if (method === 'tools/list') {
        const tools = [
          { name: 'analyze_project', description: 'Analyze a project and generate thinking patterns for LLMs.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, short: { type: 'boolean' }, depth: { type: 'number' } } } },
          { name: 'get_thinking_patterns', description: 'Get thinking patterns for a project, optionally filtered by section.', inputSchema: { type: 'object', properties: { path: { type: 'string' }, section: { type: 'string', enum: ['architecture', 'structure', 'approach', 'all'] } } } },
          { name: 'get_project_summary', description: 'Get a brief summary of the project.', inputSchema: { type: 'object', properties: { path: { type: 'string' } } } }
        ];
        process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result: { tools } }) + '\n');
        return;
      }

      if (method === 'tools/call') {
        const { arguments: args, name } = params;
        try {
          const path = args?.path || process.cwd();
          const analysis = await analyzeProject(path, args?.depth || 10);

          let result = '';
          switch (name) {
            case 'analyze_project': result = args?.short ? summaryText(analysis) : generateFullOutput(analysis, false); break;
            case 'get_thinking_patterns':
              const pats = args?.section && args.section !== 'all'
                ? analysis.thinkingPatterns.filter(p => p.section === args.section)
                : analysis.thinkingPatterns;
              result = pats.map(p => `## ${p.title}\n[${p.priority} priority]\n\n${p.content}`).join('\n\n---\n\n');
              break;
            case 'get_project_summary': result = summaryText(analysis); break;
            default: result = `Unknown tool: ${name}`;
          }

          process.stdout.write(JSON.stringify({
            jsonrpc: '2.0', id,
            result: { content: [{ type: 'text', text: result }] }
          }) + '\n');
        } catch (err) {
          process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -1, message: err.message } }) + '\n');
        }
      }
    } catch {}
  });
}

function summaryText(a) {
  const lines = [];
  if (a.packageData?.name) lines.push(`**Project**: ${a.packageData.name}@${a.packageData.version || '0.0.0'}`);
  if (a.packageData?.description) lines.push(`**Description**: ${a.packageData.description}`);
  lines.push('');
  lines.push(`**Files**: ${a.metrics.totalFiles.toLocaleString()} (${a.metrics.totalLines.toLocaleString()} lines, ${formatBytes(a.metrics.totalSize)})`);
  lines.push(`**Build**: ${a.architecture.buildSystem}`);
  lines.push(`**Structure**: ${a.structure.topLevelDirs.join(', ')}${a.structure.topLevelDirs.length > 8 ? '..' : ''}`);
  lines.push('');
  if (a.frameworks.length > 0) lines.push(`**Frameworks**: ${a.frameworks.map(f => f.name).join(', ')}`);
  if (a.dependencies.length > 0) lines.push(`**Dependencies**: ${a.dependencies.length} prod | ${a.devDependencies.length} dev`);
  return lines.join('\n');
}

// ─── Run ─────────────────────────────────────────────────
main().catch((err) => { console.error('Error:', err.message); process.exit(1); });
