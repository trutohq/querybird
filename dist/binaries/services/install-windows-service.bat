@echo off
REM QueryBird Windows Service Installation
REM Requires NSSM (Non-Sucking Service Manager)

set SERVICE_NAME=QueryBird
set BINARY_PATH=C:\Program Files\QueryBird\querybird.exe
set CONFIG_DIR=C:\ProgramData\QueryBird\configs

REM Install service using NSSM
nssm install %SERVICE_NAME% "%BINARY_PATH%"
nssm set %SERVICE_NAME% AppParameters "start --config-dir %CONFIG_DIR% --log-level info"
nssm set %SERVICE_NAME% AppDirectory "C:\ProgramData\QueryBird"
nssm set %SERVICE_NAME% Description "QueryBird Job Scheduler"
nssm set %SERVICE_NAME% Start SERVICE_AUTO_START

echo QueryBird service installed successfully!
echo Start with: nssm start %SERVICE_NAME%
echo Stop with: nssm stop %SERVICE_NAME%
echo Remove with: nssm remove %SERVICE_NAME% confirm
