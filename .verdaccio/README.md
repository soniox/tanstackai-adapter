# Local Package Testing with Verdaccio

This setup lets you test how your package will look when published to npm, without actually publishing it.

## Quick Start

**Terminal 1 - Start Verdaccio:**
```bash
pnpm verdaccio
```
Keep this running. View registry at http://localhost:4873

**Terminal 2 - Publish & Test:**
```bash
# Publish to local registry
pnpm test:publish

# Test in test-app
cd test-app
pnpm install
pnpm dev
```

## How It Works

- **Normal development**: Uses npm registry (default behavior)
- **Testing**: Only the `test-app` uses local registry (via `.npmrc` scoped config)
- **Isolated**: Each project has its own Verdaccio instance - no conflicts

## Workflow

1. Make changes to your package
2. Run `pnpm test:publish` (builds + publishes to local registry)
3. Test in `test-app` directory
4. When ready, publish to real npm with `npm publish`

## Notes

- Verdaccio only runs when you explicitly start it (`pnpm verdaccio`)
- Your main project always uses npm registry
- Only `test-app` installs from local registry
- Stop Verdaccio with `Ctrl+C` or `pkill -f verdaccio`
