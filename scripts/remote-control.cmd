@echo off
REM Ouvre une session Claude Code pilotable depuis le telephone.
REM Double-cliquable depuis l explorateur Windows : le dossier de travail
REM est deduit de l emplacement du fichier, jamais du repertoire courant.
REM Details : SESSION-WINDOWS.md
setlocal
cd /d "%~dp0.."
node scripts\remote-control.mjs %*
set CODE=%ERRORLEVEL%
if not "%CODE%"=="0" (
  echo.
  echo La session ne s est pas ouverte ^(code %CODE%^). Lis le message ci-dessus.
  pause
)
exit /b %CODE%
