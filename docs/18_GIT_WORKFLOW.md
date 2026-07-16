# Git Workflow

Every implementation must follow this workflow.

1. Claude completes one logical change.
2. Developer manually verifies the game.
3. TypeScript compilation must pass.
4. Git Commit.
5. Git Push.
6. Wait for approval.

Rules

- One commit = one logical change.
- Never mix unrelated changes.
- Never implement multiple architecture steps in one commit.
- The game must always remain playable.
- Main branch must always remain stable.
- Development happens only on the develop branch.