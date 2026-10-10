# Shared Subroutine Versioning Policy

## Goal
A single shared subroutine (library/module) is hosted in its own GitHub repository. Multiple apps depend on this subroutine, and each app must explicitly pin the exact version it depends on (e.g., app1 uses v1.0.0, app2 uses v1.2.0). The agent must never silently upgrade versions in a way that breaks compatibility.

## Repository and Versioning Rules
- Treat the shared subroutine as a standalone library in a dedicated Git repository.
- Use Semantic Versioning (`MAJOR.MINOR.PATCH`).
  - `PATCH`: bug fixes not affecting the public API.
  - `MINOR`: backward-compatible feature additions.
  - `MAJOR`: breaking changes affecting existing apps.
- On release: update library metadata, commit, tag with `vX.Y.Z` and push.

## Dependency Rules for Apps
- Apps must depend on the shared subroutine by **pinned version (tag or commit)**, never moving branches (e.g. `main`).
- **Python**: in `requirements.txt`:
  `shared-subroutine @ git+https://github.com/OWNER/shared-subroutine.git@vX.Y.Z`
- **Node/TypeScript**: in `package.json`:
  `"shared-subroutine": "git+https://github.com/OWNER/shared-subroutine.git#vX.Y.Z"`
- **Git Submodules**: checked out at a specific tag/commit.

## Agent Behavior Requirements
- Never change the version of the shared subroutine automatically.
- Only change the pinned version if explicitly requested.
- Maintain clear version mappings and document pinned versions in app documentation/configuration.
