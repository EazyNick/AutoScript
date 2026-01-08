@echo off
REM Delete node batch file
REM Usage: delete-node.bat [--name NODE_NAME] [--force] [--keep-config]
REM If no --name provided, deletes default test node (test-node)

setlocal enabledelayedexpansion

REM Find project root directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

REM Find virtual environment Python
call "%SCRIPT_DIR%find-venv-python.bat" "%PROJECT_ROOT%"
if errorlevel 1 (
    echo [ERROR] Virtual environment not found.
    echo [ERROR] One of venv, .venv, env, .env folders must exist in project root.
    echo.
    pause
    exit /b 1
)

REM Check if --name argument is provided
set "HAS_NAME=0"
for %%a in (%*) do (
    if "%%a"=="--name" set "HAS_NAME=1"
)

REM Use default name if not provided
if "%HAS_NAME%"=="0" (
    "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\delete-node.py" --name test-node %*
) else (
    "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\delete-node.py" %*
)

if errorlevel 1 (
    echo [ERROR] Node deletion failed
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Node deletion completed
echo.
pause
endlocal
