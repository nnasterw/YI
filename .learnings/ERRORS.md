## [ERR-20260429-001] exec_command python alias missing

**Logged**: 2026-04-29T00:00:00Z
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
The `python` command is unavailable in this workspace shell; use `python3` for ad hoc scripts.

### Error
```text
zsh:1: command not found: python
```

### Context
- Command attempted: inline README scraping script via `python`
- Environment detail: `python3 --version` returned `Python 3.13.2`

### Suggested Fix
Default to `python3` in future shell scripts unless the workspace explicitly provides a `python` shim.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md

---

## [ERR-20260429-002] git status outside repository

**Logged**: 2026-04-29T00:00:00Z
**Priority**: low
**Status**: pending
**Area**: infra

### Summary
OpenSpec verification commands that assume a Git repository fail in this workspace because Git has not been initialized yet.

### Error
```text
fatal: not a git repository (or any of the parent directories): .git
```

### Context
- Command attempted: `git status`
- Trigger: end-of-implementation verification step

### Suggested Fix
If versioned history is desired for future OpenSpec archive steps, initialize Git before relying on `git status` or diff-based review commands.

### Metadata
- Reproducible: yes
- Related Files: .learnings/ERRORS.md

---
