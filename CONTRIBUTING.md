# Contributing Guide

Welcome to the Analog Tools Monorepo! We appreciate your interest in contributing. This guide will help you get started and ensure a smooth contribution process.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Testing](#testing)
- [Code Style](#code-style)
- [Pull Requests](#pull-requests)
- [Community & Support](#community--support)

---

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to foster a welcoming and respectful community.

## Getting Started

1. **Fork the repository** and clone it locally:
   ```zsh
   git clone https://github.com/YOUR_USERNAME/analog-tools.git
   cd analog-tools
   ```
2. **Install dependencies** (requires Node.js v18.13.0+ and npm):
   ```zsh
   npm install
   ```
3. **Set up Nx CLI** (optional, for global usage):
   ```zsh
   npm install -g nx
   ```

## Project Structure

This is an [Nx](https://nx.dev/) monorepo. Key directories:

- `apps/` – Demo Application projects (e.g., analog-example)
- `packages/` – Reusable libraries (auth, logger, etc.)
- `docs/` – Documentation
- `docker/` – Docker, keycloak and redis

## Development Workflow

- Use Nx for all development tasks (build, test, lint, etc.):
  ```zsh
  npx nx run <project>:<target>
  # Example: npx nx run analog-example:serve
  ```
- Generate new libraries, components, or apps using Nx generators:
  ```zsh
  npx nx g @nx/angular:component my-component --project=analog-example
  ```
- Use feature branches for your work:
  ```zsh
  git checkout -b feat/my-feature
  ```

## Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history:

```
<type>(<scope>): <description>

[optional body]
[optional footer(s)]
```

**Types:** feat, fix, docs, style, refactor, test, chore

## Testing

- Run all tests:
  ```zsh
  npx nx run-many --target=vite:test --all
  ```
- Run tests for a specific project:
  ```zsh
  npx nx run <project>:vite:test
  ```

## Code Style

- Use [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) for code quality and formatting.
- Lint your code before pushing:
  ```zsh
  npx nx run-many --target=lint --all
  ```
- Follow the Angular, AnalogJS, and Nx style guides.

## Pull Requests

- Ensure your branch is up to date with `main`.
- Include tests for new features or bug fixes.
- Add or update documentation as needed.
- Describe your changes clearly in the PR description.
- Link related issues if applicable.

## Community & Support

- For questions, open a [Discussion](https://github.com/analogjs/analog-tools/discussions) or join our community chat.
- For bugs or feature requests, open an [Issue](https://github.com/analogjs/analog-tools/issues).

Thank you for contributing! 🚀
