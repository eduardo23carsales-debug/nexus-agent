@echo off
cd /d "C:\dev\agentes de hacer dinero"

echo.
echo ================================
echo   NEXUS — SUBIENDO A RAILWAY
echo ================================
echo.

git add -A
git status

echo.
set /p MSG="Describe el cambio (o Enter para 'update'): "
if "%MSG%"=="" set MSG=update

git commit -m "%MSG%"

echo.
echo Subiendo a GitHub...
git push origin master

echo.
echo Verificando Railway...
curl -s -H "x-dashboard-secret: nexus2024" "https://nexus-agent-production-3ce6.up.railway.app/api/estado"

echo.
echo ================================
echo   LISTO - Railway recibio el codigo
echo ================================
pause
