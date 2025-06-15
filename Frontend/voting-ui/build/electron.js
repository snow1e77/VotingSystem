// Адаптер для запуска основного процесса Electron
const path = require('path');
const { app } = require('electron');

// Обработка ошибок 
process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  
  // В production окружении показываем диалог с ошибкой
  if (process.env.NODE_ENV !== 'development') {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Ошибка приложения',
      `Произошла неожиданная ошибка: ${error.message}\n\nПриложение будет закрыто.`
    );
  }
  
  // Выходим с кодом ошибки
  process.exit(1);
});

// Логирование информации о запуске
console.log(`Запуск БлокчейнГолос v${app.getVersion()}`);
console.log(`Платформа: ${process.platform}, Архитектура: ${process.arch}`);
console.log(`Node.js версия: ${process.versions.node}`);
console.log(`Electron версия: ${process.versions.electron}`);

try {
  // Проверяем существование файла main.js
  const mainPath = path.join(app.getAppPath(), 'electron', 'main.js');
  const fs = require('fs');
  
  if (!fs.existsSync(mainPath)) {
    throw new Error(`Файл main.js не найден по пути: ${mainPath}`);
  }
  
  // Импортируем и запускаем основной файл
  console.log(`Загрузка main.js из: ${mainPath}`);
  require(mainPath);
} catch (error) {
  console.error('Ошибка при запуске приложения:', error);
  
  // В production окружении показываем диалог с ошибкой
  if (process.env.NODE_ENV !== 'development') {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Ошибка запуска',
      `Не удалось запустить приложение: ${error.message}`
    );
  }
  
  process.exit(1);
} 