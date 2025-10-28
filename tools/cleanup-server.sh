#!/usr/bin/env bash
# Cleanup script for Deckworthy server (Unix/Git Bash)
# Kills any processes running on port 3000

echo "Cleaning up server processes on port 3000..."

if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # Windows (Git Bash)
    netstat -ano | grep :3000 | awk '{print $5}' | sort -u | while read pid; do
        if [ ! -z "$pid" ]; then
            echo "Killing process $pid"
            taskkill //PID $pid //F 2>/dev/null || true
        fi
    done
else
    # Unix/Linux/Mac
    lsof -ti:3000 | while read pid; do
        if [ ! -z "$pid" ]; then
            echo "Killing process $pid"
            kill -9 $pid 2>/dev/null || true
        fi
    done
fi

echo "Done!"
