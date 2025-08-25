@echo off
REM QueryBird Windows Setup Script

set CONFIG_DIR=C:\ProgramData\QueryBird
set SECRETS_DIR=C:\ProgramData\QueryBird\secrets

echo 🔧 Setting up QueryBird configuration...

REM Create directories
if not exist "%CONFIG_DIR%" mkdir "%CONFIG_DIR%"
if not exist "%CONFIG_DIR%\configs" mkdir "%CONFIG_DIR%\configs"
if not exist "%CONFIG_DIR%\secrets" mkdir "%CONFIG_DIR%\secrets"
if not exist "%CONFIG_DIR%\watermarks" mkdir "%CONFIG_DIR%\watermarks"
if not exist "%CONFIG_DIR%\outputs" mkdir "%CONFIG_DIR%\outputs"
if not exist "%CONFIG_DIR%\logs" mkdir "%CONFIG_DIR%\logs"

REM Run init-postgres command
echo 📊 Initializing PostgreSQL configuration...
querybird.exe init-postgres --config-dir "%CONFIG_DIR%\configs" --secrets-dir "%CONFIG_DIR%\secrets"

echo ✅ Setup complete!
echo Next steps:
echo 1. Edit configuration files in %CONFIG_DIR%\configs
echo 2. Start the service: querybird.exe start --config-dir %CONFIG_DIR%\configs
echo 3. Or install as Windows service: install-windows-service.bat
