@echo off
REM Cleanup script for Deckworthy server (Windows)
REM Kills any processes running on port 3000

echo Cleaning up server processes on port 3000...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Killing process %%a
    taskkill /PID %%a /F 2>nul
)

echo Done!
