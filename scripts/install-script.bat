@echo off
REM Script installation batch file
REM Usage: install-script.bat [ZIP_FILE] [-f FOLDER] [--no-skip-duplicate]

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

REM Execute Python script (pass all arguments)
"%PYTHON_CMD%" "%SCRIPT_DIR%package\install-script.py" %*

if errorlevel 1 (
    echo [ERROR] Installation failed
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Installation completed
echo.
pause
endlocal
