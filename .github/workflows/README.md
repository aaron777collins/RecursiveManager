# GitHub Actions CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and quality assurance.

## Workflows

### CI Workflow (`ci.yml`)

The main continuous integration workflow that runs on every push and pull request to `main` and `develop` branches.

#### Jobs

1. **Lint** - Code quality checks
   - Runs ESLint on all TypeScript files across all packages
   - Checks code formatting with Prettier
   - Ensures code style consistency

2. **Test** - Unit and integration testing
   - Runs Jest test suites with coverage reporting
   - Uploads coverage reports to Codecov (if configured)
   - Ensures 80%+ code coverage (per quality gates)

3. **Build** - Build verification
   - Compiles all TypeScript packages
   - Runs type-checking across all packages
   - Ensures no TypeScript errors

4. **Test Matrix** - Cross-version compatibility
   - Tests on Node.js versions 18, 20, and 22
   - Ensures compatibility across LTS versions
   - Runs in parallel for faster feedback

5. **Quality Gate** - Final verification
   - Runs only if all other jobs pass
   - Provides clear success signal
   - Blocks merge if any check fails

#### Triggers

- **Push**: Runs on pushes to `main` and `develop` branches
- **Pull Request**: Runs on PRs targeting `main` and `develop` branches

#### Requirements

The workflow expects the following npm scripts to be available:

- `npm run lint` - Run ESLint across all packages
- `npm test` - Run Jest tests
- `npm run test:coverage` - Run tests with coverage reporting
- `npm run build` - Build all packages
- `npm run type-check` - TypeScript type checking without emit

#### Caching

The workflow uses npm caching to speed up dependency installation:
- Cache key is based on `package-lock.json`
- Subsequent runs are significantly faster

#### Coverage Reporting

Coverage reports are uploaded to Codecov if a `CODECOV_TOKEN` secret is configured:
1. Go to [codecov.io](https://codecov.io/)
2. Add your repository
3. Copy the token
4. Add it as a GitHub secret named `CODECOV_TOKEN`

The workflow will continue even if Codecov upload fails (`fail_ci_if_error: false`).

## Local Testing

Before pushing, you can run the same checks locally:

```bash
# Run all checks that CI will run
npm run lint           # ESLint
npm run type-check     # TypeScript checking
npm test               # Tests
npm run test:coverage  # Tests with coverage
npm run build          # Build all packages

# Check Prettier formatting
npx prettier --check "packages/**/*.{ts,tsx}" "*.config.js"

# Fix Prettier formatting
npx prettier --write "packages/**/*.{ts,tsx}" "*.config.js"
```

## Success Criteria

For the CI workflow to pass, all of the following must succeed:

- ✅ ESLint passes with no errors
- ✅ Prettier formatting is correct
- ✅ All tests pass on Node.js 18, 20, and 22
- ✅ Test coverage meets thresholds (80%+)
- ✅ TypeScript compilation succeeds
- ✅ Type checking passes with no errors

## Troubleshooting

### Linting Failures

If ESLint fails, run locally and fix:
```bash
npm run lint
# or to auto-fix
npx turbo run lint -- --fix
```

### Test Failures

Run tests locally to debug:
```bash
npm test
# or run specific package
cd packages/common && npm test
```

### Type Errors

Check TypeScript errors:
```bash
npm run type-check
# or check specific package
cd packages/core && npm run type-check
```

### Formatting Issues

Fix Prettier formatting:
```bash
npx prettier --write "packages/**/*.{ts,tsx}" "*.config.js"
```

## Future Enhancements

Potential additions to the CI/CD pipeline:

- **Release Workflow**: Automated npm publishing and GitHub releases
- **Security Scanning**: Dependency vulnerability scanning with Snyk or Dependabot
- **Performance Testing**: Benchmark tests for critical paths
- **E2E Testing**: Integration tests with real AI frameworks
- **Docker Build**: Build and push Docker images
- **Deployment**: Automated deployment to staging/production environments

## Maintenance

The workflow is configured to use:
- `actions/checkout@v4` - Latest stable checkout action
- `actions/setup-node@v4` - Latest stable Node.js setup
- `codecov/codecov-action@v4` - Latest Codecov uploader

These should be periodically updated to their latest versions.
