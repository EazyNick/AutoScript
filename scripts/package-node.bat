@echo off
REM Node packaging batch file
REM Usage: package-node.bat [NODE_TYPE] [OUTPUT_DIR]

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

REM Check node type - if not provided, show list
if "%~1"=="" (
    echo [INFO] No node type provided. Showing node list...
    echo.
    "%PYTHON_CMD%" "%SCRIPT_DIR%package\package-node.py" --list
    echo.
    pause
    exit /b 0
)

set "NODE_TYPE=%~1"
set "OUTPUT_DIR=%~2"

REM Execute Python script
if "%OUTPUT_DIR%"=="" (
    "%PYTHON_CMD%" "%SCRIPT_DIR%package\package-node.py" %NODE_TYPE%
) else (
    "%PYTHON_CMD%" "%SCRIPT_DIR%package\package-node.py" %NODE_TYPE% -o "%OUTPUT_DIR%"
)

if errorlevel 1 (
    echo [ERROR] Node packaging failed
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Node packaging completed
echo.
pause
endlocal
