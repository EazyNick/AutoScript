@echo off
REM Linting and formatting automation script
REM Runs linting and formatting for both Python (server) and JavaScript (UI)

REM Continue execution even if errors occur
setlocal enabledelayedexpansion

REM Set console window title
title Linting and Formatting Automation

REM Adjust console window size (optional)
mode con: cols=100 lines=40

echo ========================================
echo Starting Linting and Formatting
echo ========================================
echo.

REM Get the directory where this script is located (absolute path)
set "SCRIPT_DIR=%~dp0"
REM Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Save original directory (where script was executed from)
set "ORIGINAL_DIR=%CD%"

REM Find project root directory (where server/ and UI/ folders exist)
REM Start from script directory and go up until we find server/ and UI/
set "PROJECT_ROOT="

REM Try up to 5 levels up from script location
cd /d "%SCRIPT_DIR%"
for /L %%i in (0,1,5) do (
    if exist "server" (
        if exist "UI" (
            set "PROJECT_ROOT=!CD!"
            goto :root_found
        )
    )
    REM Go up one level
    cd /d ".."
)

REM If not found, try from original directory
cd /d "%ORIGINAL_DIR%"
for /L %%i in (0,1,5) do (
    if exist "server" (
        if exist "UI" (
            set "PROJECT_ROOT=!CD!"
            goto :root_found
        )
    )
    REM Go up one level
    cd /d ".."
)

REM Project root not found
echo [ERROR] Cannot find project root directory.
echo Please ensure server/ and UI/ folders exist.
echo Script location: %SCRIPT_DIR%
echo Current location: %ORIGINAL_DIR%
echo.
pause
exit /b 1

:root_found
REM Normalize path (convert to absolute path)
cd /d "%PROJECT_ROOT%"
set "PROJECT_ROOT=%CD%"

REM Verify project root exists
if not exist "%PROJECT_ROOT%\server" (
    echo [ERROR] Cannot find server folder in project root.
    echo Project root: %PROJECT_ROOT%
    echo Current location: %ORIGINAL_DIR%
    echo.
    echo Looking for folders: server/ and UI/
    pause
    exit /b 1
)

if not exist "%PROJECT_ROOT%\UI" (
    echo [ERROR] Cannot find UI folder in project root.
    echo Project root: %PROJECT_ROOT%
    echo Current location: %ORIGINAL_DIR%
    echo.
    echo Looking for folders: server/ and UI/
    pause
    exit /b 1
)

REM Change to project root
cd /d "%PROJECT_ROOT%"
echo Found project root: %CD%
echo.

:found_root
echo Working directory: %CD%
echo.

REM Find and activate Python virtual environment
REM Check common virtual environment names
if exist "venv\Scripts\activate.bat" (
    echo Found virtual environment: venv
    call "venv\Scripts\activate.bat"
    goto :venv_activated
)

if exist ".venv\Scripts\activate.bat" (
    echo Found virtual environment: .venv
    call ".venv\Scripts\activate.bat"
    goto :venv_activated
)

if exist "env\Scripts\activate.bat" (
    echo Found virtual environment: env
    call "env\Scripts\activate.bat"
    goto :venv_activated
)

if exist ".env\Scripts\activate.bat" (
    echo Found virtual environment: .env
    call ".env\Scripts\activate.bat"
    goto :venv_activated
)

if exist "ENV\Scripts\activate.bat" (
    echo Found virtual environment: ENV
    call "ENV\Scripts\activate.bat"
    goto :venv_activated
)

REM Search for any directory with Scripts\activate.bat (any name)
for /d %%d in (*) do (
    if exist "%%d\Scripts\activate.bat" (
        echo Found virtual environment: %%d
        call "%%d\Scripts\activate.bat"
        goto :venv_activated
    )
)

REM Virtual environment not found
echo [WARNING] Virtual environment not found in common locations.
echo Attempting to use system Python or PATH...
echo.

:venv_activated
REM Verify Python is available
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python command not found.
    echo Please ensure Python is installed and in PATH.
    echo.
    goto :check_npm
)

REM Check Python version and location
echo Python version:
python --version
echo Python location:
where python
echo.

REM Check if we're in a virtual environment (VIRTUAL_ENV variable)
if defined VIRTUAL_ENV (
    echo Virtual environment active: %VIRTUAL_ENV%
) else (
    echo [INFO] VIRTUAL_ENV not set. Using system Python or PATH.
)
echo.

REM Try to find ruff in multiple ways
set "RUFF_CMD="

REM Method 1: Check if ruff is in PATH
where ruff >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "RUFF_CMD=ruff"
    goto :ruff_found
)

REM Method 2: Check in common virtual environment locations
if exist "venv\Scripts\ruff.exe" (
    set "RUFF_CMD=venv\Scripts\ruff.exe"
    goto :ruff_found
)
if exist ".venv\Scripts\ruff.exe" (
    set "RUFF_CMD=.venv\Scripts\ruff.exe"
    goto :ruff_found
)
if exist "env\Scripts\ruff.exe" (
    set "RUFF_CMD=env\Scripts\ruff.exe"
    goto :ruff_found
)

REM Method 3: Try python -m ruff
python -m ruff --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "RUFF_CMD=python -m ruff"
    goto :ruff_found
)

REM Ruff not found - provide helpful error message
echo [ERROR] ruff command not found.
echo.
echo Please install ruff in your virtual environment:
echo   pip install ruff
echo.
echo Or install development dependencies:
echo   pip install -r server/requirements-dev.txt
echo.
echo Current Python: 
python --version
echo Current directory: %CD%
echo.
goto :check_npm

:ruff_found
echo Found ruff: %RUFF_CMD%
echo.

REM Python linting and formatting (server)
REM Run from project root (do not change to server folder)
echo [1/5] Python linting check and auto-fix (server)...
%RUFF_CMD% check --fix server/
set PYTHON_LINT_ERROR=%ERRORLEVEL%
if !PYTHON_LINT_ERROR! NEQ 0 (
    echo [WARNING] Python linting check failed. (Error code: !PYTHON_LINT_ERROR!)
) else (
    echo [SUCCESS] Python linting check completed.
)
echo.

echo [2/5] Python formatting (server)...
%RUFF_CMD% format server/
set PYTHON_FORMAT_ERROR=%ERRORLEVEL%
if !PYTHON_FORMAT_ERROR! NEQ 0 (
    echo [WARNING] Python formatting failed. (Error code: !PYTHON_FORMAT_ERROR!)
) else (
    echo [SUCCESS] Python formatting completed.
)
echo.

REM Try to find mypy in multiple ways
set "MYPY_CMD="

REM Method 1: Check if mypy is in PATH
where mypy >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "MYPY_CMD=mypy"
    goto :mypy_found
)

REM Method 2: Check in common virtual environment locations
if exist "venv\Scripts\mypy.exe" (
    set "MYPY_CMD=venv\Scripts\mypy.exe"
    goto :mypy_found
)
if exist ".venv\Scripts\mypy.exe" (
    set "MYPY_CMD=.venv\Scripts\mypy.exe"
    goto :mypy_found
)
if exist "env\Scripts\mypy.exe" (
    set "MYPY_CMD=env\Scripts\mypy.exe"
    goto :mypy_found
)

REM Method 3: Try python -m mypy
python -m mypy --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "MYPY_CMD=python -m mypy"
    goto :mypy_found
)

REM Mypy not found - skip with warning
echo [WARNING] mypy command not found. Skipping type checking.
echo Please install mypy: pip install mypy
echo Or install development dependencies: pip install -r server/requirements-dev.txt
echo.
goto :check_npm

:mypy_found
echo Found mypy: %MYPY_CMD%
echo [3/5] Mypy type checking (server)...
%MYPY_CMD% server/
set MYPY_ERROR=%ERRORLEVEL%
if !MYPY_ERROR! NEQ 0 (
    echo [WARNING] Mypy type checking failed. (Error code: !MYPY_ERROR!)
) else (
    echo [SUCCESS] Mypy type checking completed.
)
echo.

:check_npm
REM JavaScript linting and formatting (UI)
echo [4/5] JavaScript linting check and auto-fix (UI)...

REM Check if npm command exists
where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm command not found.
    echo Please ensure Node.js is installed.
    echo.
    goto :end
)

REM Check if UI folder exists
if not exist "UI" (
    echo [ERROR] UI folder not found.
    echo Current location: %CD%
    echo.
    goto :end
)

cd /d "%PROJECT_ROOT%\UI"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot change to UI folder.
    echo Project root: %PROJECT_ROOT%
    goto :end
)

echo Changed to UI folder: %CD%
call npm run lint:fix
set JS_LINT_ERROR=%ERRORLEVEL%
if !JS_LINT_ERROR! NEQ 0 (
    echo [WARNING] JavaScript linting failed. (Error code: !JS_LINT_ERROR!)
) else (
    echo [SUCCESS] JavaScript linting completed.
)
echo.

echo [5/5] JavaScript formatting (UI)...
call npm run format
set JS_FORMAT_ERROR=%ERRORLEVEL%
if !JS_FORMAT_ERROR! NEQ 0 (
    echo [WARNING] JavaScript formatting failed. (Error code: !JS_FORMAT_ERROR!)
) else (
    echo [SUCCESS] JavaScript formatting completed.
)
echo.

REM Return to original directory (if it still exists)
if exist "%ORIGINAL_DIR%" (
    cd /d "%ORIGINAL_DIR%"
) else (
    echo [INFO] Original directory no longer exists, staying in project root.
)

:end
echo.
echo ========================================
echo All linting and formatting tasks completed!
echo ========================================
echo.
echo Please review the execution results above.
echo.
echo Press any key to close this window...
pause

