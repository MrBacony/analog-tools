# AnalogTools

> **⚠️ IMPORTANT: Early Development Stage** ⚠️  
> This project is in its early development stage. Breaking changes may happen frequently as the APIs evolve. Use with caution in production environments.

## Introduction

AnalogTools is a collection of utilities and libraries designed to enhance and extend [AnalogJS](https://analogjs.org) - the fullstack meta-framework for Angular. These tools aim to provide solutions for common challenges in developing AnalogJS applications, focusing on authentication, session management, and more.

## Available Packages

| Package                   | Description                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `@analog-tools/auth`      | Authentication utilities for AnalogJS applications, including OAuth integration, session management, protected routes, and Angular-specific components |
| `@analog-tools/inject`    | Dependency injection utilities for AnalogJS server-side applications                                                      |
| `@analog-tools/logger`    | Logging utility for AnalogJS applications                                                                                |
| `@analog-tools/session`   | Session management system with pluggable storage backends (including Redis and Unstorage support)                         |

## Installation & Usage

Each package can be installed separately:

```sh
# Authentication
npm install @analog-tools/auth

# Session management
npm install @analog-tools/session

# Utilities
npm install @analog-tools/inject
npm install @analog-tools/logger
```

Refer to each package's README for detailed usage instructions.

## Development

This project is built as an [Nx workspace](https://nx.dev).

### Run tasks

To run the dev server for the example app, use:

```sh
npx nx serve analog-example
```

To create a production bundle:

```sh
npx nx build analog-example
```

To see all available targets to run for a project, run:

```sh
npx nx show project analog-tools
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
