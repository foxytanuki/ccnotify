# Release Process

This document describes the release process for ccnotify.

## Automated Release via GitHub Actions

### Method 1: Tag-based Release

1. Create and push a version tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. GitHub Actions will automatically:
   - Run all tests
   - Build the package
   - Create a GitHub Release
   - Publish to npm

### Method 2: Manual Workflow Dispatch

1. Go to Actions → Release workflow
2. Click "Run workflow"
3. Enter the version number (e.g., "1.0.0")
4. Click "Run workflow"

## Prerequisites

Before releasing, ensure:

1. **NPM_TOKEN** is set in GitHub Secrets:
   - Get token from npm: `npm token create`
   - Add to GitHub: Settings → Secrets → Actions → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your npm token

2. All tests pass locally:
   ```bash
   pnpm run ci:strict
   ```

3. Version is updated in package.json (if releasing manually)

## Manual Release Process

If you need to release manually:

1. Update version:
   ```bash
   npm version patch  # or minor, major
   ```

2. Build and test:
   ```bash
   pnpm run build
   pnpm test
   ```

3. Publish:
   ```bash
   npm publish
   ```

4. Create GitHub release:
   ```bash
   git push --tags
   ```

## Version Guidelines

- **Patch** (x.x.1): Bug fixes, documentation updates
- **Minor** (x.1.x): New features, backwards compatible
- **Major** (1.x.x): Breaking changes

## Post-Release

After a successful release:

1. Verify package on npm: https://www.npmjs.com/package/ccnotify
2. Test installation: `npm install -g ccnotify`
3. Update documentation if needed
4. Announce release if significant changes