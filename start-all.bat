@echo off
echo Запуск системы блокчейн-голосования...
echo.

echo Запуск бэкенда в отдельном окне...
start cmd /k "title Backend && call start-backend-better.bat"

echo Запуск фронтенда в отдельном окне...
start cmd /k "title Frontend && call start-frontend.bat"

echo.
echo Все компоненты запущены! Система готова к работе.
echo Бэкенд: http://localhost:5000
echo Фронтенд: http://localhost:3000
echo.
echo Нажмите любую клавишу, чтобы закрыть это окно...
pause > nul 