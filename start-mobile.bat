@echo off
echo Запуск мобильного приложения системы голосования...

cd Mobile

echo Установка зависимостей...
call npm install

echo Запуск приложения...
call npm start

pause 