@echo off
REM Find Python executable from virtual environment
REM Usage: call find-venv-python.bat [PROJECT_ROOT]
REM Sets PYTHON_CMD and VENV_PATH variables
REM Returns with errorlevel 0 if found, 1 if not found

REM Get project root from parameter or use current directory
set "SEARCH_ROOT=%~1"
if "%SEARCH_ROOT%"=="" set "SEARCH_ROOT=%CD%"

REM Change to search root
cd /d "%SEARCH_ROOT%" 2>nul
if errorlevel 1 (
    echo [ERROR] Cannot access directory: %SEARCH_ROOT%
    set "PYTHON_CMD="
    set "VENV_PATH="
    exit /b 1
)

REM Check common virtual environment names
if exist "venv\Scripts\python.exe" (
    set "PYTHON_CMD=%SEARCH_ROOT%\venv\Scripts\python.exe"
    set "VENV_PATH=%SEARCH_ROOT%\venv"
    exit /b 0
)

if exist ".venv\Scripts\python.exe" (
    set "PYTHON_CMD=%SEARCH_ROOT%\.venv\Scripts\python.exe"
    set "VENV_PATH=%SEARCH_ROOT%\.venv"
    exit /b 0
)

if exist "env\Scripts\python.exe" (
    set "PYTHON_CMD=%SEARCH_ROOT%\env\Scripts\python.exe"
    set "VENV_PATH=%SEARCH_ROOT%\env"
    exit /b 0
)

if exist ".env\Scripts\python.exe" (
    set "PYTHON_CMD=%SEARCH_ROOT%\.env\Scripts\python.exe"
    set "VENV_PATH=%SEARCH_ROOT%\.env"
    exit /b 0
)

if exist "ENV\Scripts\python.exe" (
    set "PYTHON_CMD=%SEARCH_ROOT%\ENV\Scripts\python.exe"
    set "VENV_PATH=%SEARCH_ROOT%\ENV"
    exit /b 0
)

REM Search for any directory with Scripts\python.exe
for /d %%d in (*) do (
    if exist "%%d\Scripts\python.exe" (
        set "PYTHON_CMD=%SEARCH_ROOT%\%%d\Scripts\python.exe"
        set "VENV_PATH=%SEARCH_ROOT%\%%d"
        exit /b 0
    )
)

REM Not found
set "PYTHON_CMD="
set "VENV_PATH="
exit /b 1

