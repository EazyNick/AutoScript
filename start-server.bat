@echo off
REM Server startup batch file
REM Usage: start-server.bat

REM Enable delayed expansion for variable handling in loops
setlocal enabledelayedexpansion

echo ========================================
echo AutoScript Server Starting
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
    pause
    exit /b 1
)

REM Change to project root
cd /d "%PROJECT_ROOT%"
echo Found project root: %CD%
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo.
    pause
    exit /b 1
)

REM Find Python from virtual environment using shared script
set "PYTHON_CMD="
set "VENV_PATH="

REM Use shared script to find virtual environment Python
call "%~dp0scripts\find-venv-python.bat" "%PROJECT_ROOT%"
if %ERRORLEVEL% EQU 0 (
    echo Found virtual environment: %VENV_PATH%
    echo Python: %PYTHON_CMD%
    echo.
    goto :python_ready
)

REM Virtual environment not found, use system Python
echo [WARNING] Virtual environment not found in project root: %PROJECT_ROOT%
echo Using system Python environment.
echo.

REM Verify system Python is available
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python command not found.
    echo Please ensure Python is installed and in PATH.
    echo.
    pause
    exit /b 1
)

set "PYTHON_CMD=python"

:python_ready
REM Verify Python is available
"%PYTHON_CMD%" --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python command failed: %PYTHON_CMD%
    echo.
    pause
    exit /b 1
)

echo Python version:
"%PYTHON_CMD%" --version
echo Python location:
where "%PYTHON_CMD%" 2>nul || echo %PYTHON_CMD%
echo.

REM Read .env file and set environment variables
REM Default values if .env file doesn't exist or variables are not set
set API_HOST=127.0.0.1
set API_PORT=8001

REM Check if .env file exists
if exist ".env" (
    echo Reading .env file...
    REM Read .env file line by line
    for /f "usebackq eol=# tokens=1,2 delims==" %%a in (".env") do (
        REM eol=# skips lines starting with #
        set "key=%%a"
        set "value=%%b"
        REM Remove leading/trailing spaces from key
        for /f "tokens=*" %%k in ("!key!") do set "key=%%k"
        REM Check if this is API_HOST or API_PORT (case-insensitive)
        if /i "!key!"=="API_HOST" (
            REM Remove quotes and spaces from value
            set "value=!value:"=!"
            for /f "tokens=*" %%v in ("!value!") do set API_HOST=%%v
        )
        if /i "!key!"=="API_PORT" (
            REM Remove quotes and spaces from value
            set "value=!value:"=!"
            for /f "tokens=*" %%v in ("!value!") do set API_PORT=%%v
        )
    )
) else (
    echo [INFO] .env file not found. Using default values.
)

REM Change to server directory
cd server

REM Start server
echo Starting server...
echo Host: %API_HOST%
echo Port: %API_PORT%
echo Auto-reload: Enabled
echo.
echo Press Ctrl+C to stop the server.
echo ========================================
echo.

"%PYTHON_CMD%" -m uvicorn main:app --reload --host %API_HOST% --port %API_PORT%

REM Handle errors
if errorlevel 1 (
    echo.
    echo [ERROR] An error occurred while starting the server.
    echo.
    pause
    exit /b 1
)
