@echo off
setlocal

set "SRC_DIR=%~dp0..\..\CEP\com.rbmh.commotiondesigner"
set "DEST_DIR=%APPDATA%\Adobe\CEP\extensions\com.rbmh.commotiondesigner"

if not exist "%APPDATA%\Adobe\CEP\extensions" (
  mkdir "%APPDATA%\Adobe\CEP\extensions"
)

echo Installing Commotion Designer Toolkit...
robocopy "%SRC_DIR%" "%DEST_DIR%" /E >nul
if %ERRORLEVEL% GEQ 8 (
  echo Failed to copy extension files.
  exit /b 1
)

reg add "HKCU\Software\Adobe\CSXS.12" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
if %ERRORLEVEL% NEQ 0 (
  echo Failed to set PlayerDebugMode in registry.
  exit /b 1
)

echo.
echo Installation complete.
echo - Extension path: "%DEST_DIR%"
echo - Registry set: HKCU\Software\Adobe\CSXS.12\PlayerDebugMode=1
echo Restart After Effects to reload CEP extensions.
exit /b 0
