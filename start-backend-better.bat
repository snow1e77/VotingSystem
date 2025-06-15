@echo off
echo ==================================================
echo      ЗАПУСК BACKEND API ДЛЯ СИСТЕМЫ ГОЛОСОВАНИЯ
echo ==================================================
echo.

cd Backend\VotingAPI

echo Настройка переменных окружения...
set CONTRACT_ADDRESS=0x1A0fAb9881D1B51A153039543dC7017eE644c794
set RPC_URL=https://sepolia.infura.io/v3/72ea578fc2dd47549a039528687c8a7a
set ADMIN_PRIVATE_KEY=5a856867eb81d1f531d9dc32bf52a7238e43e8af3cd67885b2d693a31cc0e371

echo.
echo Используемые параметры:
echo CONTRACT_ADDRESS=%CONTRACT_ADDRESS%
echo RPC_URL=%RPC_URL%
echo ADMIN_PRIVATE_KEY=***********
echo.

echo Сборка проекта...
dotnet build
if errorlevel 1 (
    echo Ошибка при сборке проекта!
    pause
    exit /b 1
)

echo.
echo Запуск backend API...
echo Swagger UI будет доступен по адресу: http://localhost:5000/swagger
echo.
dotnet run

pause 