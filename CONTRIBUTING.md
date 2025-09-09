# Contributing to QueryBird

Thank you for your interest in contributing to QueryBird! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (version 1.0.0 or higher)
- [Git](https://git-scm.com/)
- A GitHub account

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/querybird.git
   cd querybird
   ```
3. Set up development environment:
   ```bash
   # Start Docker development environment
   npm run dev:docker
   
   # Or install dependencies for local development
   bun install
   ```
4. Create a new branch for your feature:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running the Project

```bash
# Development mode
bun run dev

# Development mode with watch
bun run dev:watch

# Build the project
bun run build

# Build binaries
bun run build:binaries
```

### Testing

```bash
# Run all tests
bun test

# Run tests with coverage
bun test --coverage

# Run specific test file
bun test src/utils/logger.test.ts
```

### Code Quality

```bash
# Type checking
bun run typecheck

# Linting
bun run lint
```

## Project Structure

```
src/
├── core/           # Core functionality (config-watcher, database-manager, etc.)
├── types/          # TypeScript type definitions
├── utils/          # Utility functions
└── main-runner.ts  # Main application entry point

configs/            # Example configuration files
scripts/            # Build and utility scripts
docker/             # Docker configuration files
```

## Making Changes

### Code Style

- Use TypeScript for all new code
- Follow the existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for public functions
- Keep functions small and focused

### Configuration Files

- Add example configurations in the `configs/` directory
- Use descriptive names for configuration files
- Include comments explaining complex configurations

### Testing

- Write tests for new functionality
- Ensure all tests pass before submitting a PR
- Use descriptive test names that explain what is being tested

## Submitting Changes

1. Ensure your code follows the project's style guidelines
2. Run the full test suite: `bun test`
3. Run type checking: `bun run typecheck`
4. Commit your changes with a clear, descriptive commit message
5. Push your branch to your fork
6. Create a Pull Request

### Commit Message Format

Use conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:

- `feat(core): add support for MySQL connections`
- `fix(utils): resolve memory leak in logger`
- `docs(readme): update Docker deployment instructions`

### Pull Request Guidelines

- Provide a clear description of the changes
- Include any relevant issue numbers
- Add screenshots or examples for UI changes
- Ensure the CI checks pass

## Issue Reporting

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce the issue
- Expected vs. actual behavior
- Environment details (OS, Bun version, etc.)
- Any relevant error messages or logs

## Getting Help

- Check the [README.md](README.md) for documentation
- Look through existing issues and pull requests
- Join our community discussions

## License

By contributing to QueryBird, you agree that your contributions will be licensed under the MIT License.
