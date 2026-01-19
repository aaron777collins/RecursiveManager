# RecursiveManager Documentation

This directory contains the VitePress-based documentation site for RecursiveManager.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Documentation Structure

```
docs/
├── .vitepress/
│   └── config.ts          # VitePress configuration
├── index.md               # Homepage
├── guide/                 # User guides
│   ├── introduction.md
│   ├── installation.md
│   ├── quick-start.md
│   └── ...
├── api/                   # API reference
│   ├── overview.md
│   ├── cli-commands.md
│   └── ...
├── architecture/          # Architecture docs
│   ├── overview.md
│   ├── system-design.md
│   └── ...
└── contributing/          # Contributing guides
    ├── getting-started.md
    ├── development-setup.md
    └── ...
```

## Writing Documentation

### Adding a New Page

1. Create a new `.md` file in the appropriate directory
2. Add frontmatter if needed:
   ```markdown
   ---
   title: Page Title
   description: Page description
   ---
   ```
3. Write your content using markdown
4. Add the page to the sidebar in `.vitepress/config.ts`

### Markdown Features

VitePress supports:
- GitHub-flavored markdown
- Code blocks with syntax highlighting
- Custom containers (tip, warning, danger, etc.)
- Frontmatter
- Table of contents
- And more...

See [VitePress documentation](https://vitepress.dev/guide/markdown) for details.

## Development

### Live Reload

The dev server supports hot module replacement. Changes to markdown files will be reflected immediately.

### Testing Links

Before committing, check for broken links:
```bash
npm run build
# Check console for any broken internal links
```

## Deployment

The documentation can be deployed to:
- GitHub Pages
- Netlify
- Vercel
- Any static hosting service

### GitHub Pages

Add this workflow to `.github/workflows/docs.yml`:

```yaml
name: Deploy Docs

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

## Contributing

When adding documentation:
1. Keep it concise and clear
2. Include code examples where applicable
3. Add cross-references to related pages
4. Test all code examples
5. Check for broken links before committing

## Status

🚧 **In Progress**: Documentation is being written alongside implementation.

Current status:
- ✅ Site structure and configuration
- ✅ Introduction and installation guides
- ✅ Architecture overview
- ✅ Contributing guides
- 🚧 API reference (to be written during implementation)
- 🚧 User guides (to be written during implementation)
