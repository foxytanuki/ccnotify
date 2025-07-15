# ccnotify

CLI tool for creating Claude Code Stop Hooks with Discord and ntfy notifications.

## Development

This project uses pnpm for package management and TypeScript for development.

### Setup

```bash
pnpm install
```

### Available Scripts

- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm run dev` - Run the CLI in development mode
- `pnpm run test` - Run tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run lint` - Check code with Biome
- `pnpm run lint:fix` - Fix linting issues
- `pnpm run format` - Format code with Biome
- `pnpm run clean` - Remove build artifacts

### Project Structure

```
src/
├── index.ts           # Entry point and CLI setup
├── commands/          # Command implementations
├── services/          # Core business logic
├── utils/             # Utility functions
└── types/             # TypeScript type definitions

tests/
├── unit/              # Unit tests
├── integration/       # Integration tests
└── e2e/               # End-to-end tests
```

## Usage

*Usage documentation will be added as commands are implemented.*