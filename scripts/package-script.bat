@echo off
REM Script packaging batch file
REM Usage: package-script.bat [SCRIPT_ID] [OUTPUT_DIR]

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

REM Check script ID - if not provided, show list
if "%~1"=="" (
    echo [INFO] No script ID provided. Showing script list...
    echo.
    "%PYTHON_CMD%" "%SCRIPT_DIR%package\package-script.py" --list
    echo.
    pause
    exit /b 0
)

set "SCRIPT_ID=%~1"
set "OUTPUT_DIR=%~2"

REM Execute Python script
if "%OUTPUT_DIR%"=="" (
    "%PYTHON_CMD%" "%SCRIPT_DIR%package\package-script.py" %SCRIPT_ID%
) else (
    "%PYTHON_CMD%" "%SCRIPT_DIR%package\package-script.py" %SCRIPT_ID% -o "%OUTPUT_DIR%"
)

if errorlevel 1 (
    echo [ERROR] Packaging failed
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Packaging completed
echo.
pause
endlocal
