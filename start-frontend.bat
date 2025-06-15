@echo off
echo Настройка React приложения для Blockchain Voting System...

cd Frontend\voting-ui

echo Создание .env файла с настройками контракта...
echo REACT_APP_CONTRACT_ADDRESS=0x1A0fAb9881D1B51A153039543dC7017eE644c794 > .env

echo Установка зависимостей проекта...
call npm install

echo Запуск React приложения...
call npm start

pause 