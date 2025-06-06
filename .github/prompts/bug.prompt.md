---
mode: 'agent'
tools: ['githubRepo', 'codebase', 'create_issue']
description: 'Generate a Bug Issue for the given codebase.'
---

Create a bug issue for the given information. USE the github mcp The issue should use the template (bug_report)[../ISSUE_TEMPLATE/bug_report.md]. If applicable, include any relevant code snippets or error messages.
The repository owner is {{githubRepo.owner}} and the repository name is {{githubRepo.name}}.