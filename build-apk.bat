@echo off
echo Сборка APK файла для мобильного приложения системы голосования...

cd Mobile

echo Установка зависимостей...
call npm install

echo Запуск сборки APK через Expo Application Services (EAS)...
call eas build -p android --profile preview

echo.
echo ============================================================
echo APK файл будет доступен по ссылке, которая появится в консоли
echo После завершения сборки скачайте APK файл по этой ссылке
echo ============================================================
echo.

pause 