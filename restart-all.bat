@echo off
echo Перезапуск всех сервисов с новым адресом контракта: 0x1A0fAb9881D1B51A153039543dC7017eE644c794
echo.

echo Останавливаем процессы...
taskkill /f /im node.exe /t >nul 2>&1
taskkill /f /im dotnet.exe /t >nul 2>&1
taskkill /f /im npm.exe /t >nul 2>&1

echo Ждем 3 секунды...
timeout /t 3 /nobreak >nul

echo.
echo Запускаем все сервисы...
start-all.bat

echo.
echo Готово! Все сервисы перезапущены с новым адресом контракта.
echo Проверьте что голосование работает без ошибки "Voter is not registered"
pause 