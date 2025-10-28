# Tools & Utilities

This directory contains utility scripts and tools for working with the Deckworthy project.

## Scripts

### cleanup-server.sh / cleanup-server.cmd

Cleanup scripts to kill any processes running on port 3000 (the default Deckworthy server port).

**Usage (Unix/Mac/Git Bash):**
```bash
./tools/cleanup-server.sh
```

**Usage (Windows CMD):**
```cmd
tools\cleanup-server.cmd
```

**When to use:**
- When the dev server doesn't shut down cleanly
- When you get "EADDRINUSE" errors
- Before starting a fresh server instance

## Related Directories

- `../bruno/` - Bruno API collection for testing the Deckworthy API endpoints
