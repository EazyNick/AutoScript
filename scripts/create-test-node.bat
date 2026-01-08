@echo off
REM Create test node batch file
REM Usage: create-test-node.bat [--name NODE_NAME] [--category CATEGORY] [--description "DESCRIPTION"]
REM If no arguments provided, creates a default test node

setlocal enabledelayedexpansion

REM Find project root directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%.."

REM Find virtual environment Python
call "%SCRIPT_DIR%find-venv-python.bat" "%PROJECT_ROOT%"
if errorlevel 1 (
    echo [ERROR] Virtual environment not found.
    echo [ERROR] One of venv, .venv, env, .env folders must exist in project root.
    pause
    exit /b 1
)

REM Check if arguments are provided
set "HAS_NAME=0"
set "HAS_CATEGORY=0"
set "HAS_DESCRIPTION=0"

for %%a in (%*) do (
    if "%%a"=="--name" set "HAS_NAME=1"
    if "%%a"=="--category" set "HAS_CATEGORY=1"
    if "%%a"=="--description" set "HAS_DESCRIPTION=1"
)

REM Build command arguments - use default values if not provided
if "%HAS_NAME%"=="0" (
    if "%HAS_CATEGORY%"=="0" (
        if "%HAS_DESCRIPTION%"=="0" (
            REM No arguments provided, use all defaults
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" --name test-node --category action --description "Test node"
        ) else (
            REM Only description provided
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" --name test-node --category action %*
        )
    ) else (
        if "%HAS_DESCRIPTION%"=="0" (
            REM Only category provided
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" --name test-node %* --description "Test node"
        ) else (
            REM Name missing, category and description provided
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" --name test-node %*
        )
    )
) else (
    if "%HAS_CATEGORY%"=="0" (
        if "%HAS_DESCRIPTION%"=="0" (
            REM Only name provided
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" %* --category action --description "Test node"
        ) else (
            REM Name and description provided, category missing
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" %* --category action
        )
    ) else (
        if "%HAS_DESCRIPTION%"=="0" (
            REM Name and category provided, description missing
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" %* --description "Test node"
        ) else (
            REM All arguments provided
            "%PYTHON_CMD%" "%SCRIPT_DIR%nodes\create-node.py" %*
        )
    )
)

if errorlevel 1 (
    echo [ERROR] Node creation failed
    echo.
    pause
    exit /b 1
)

echo [SUCCESS] Node creation completed
echo.
pause
endlocal
