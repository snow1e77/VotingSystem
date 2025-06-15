/**
 * Этот скрипт запускается после упаковки приложения
 * electron-builder вызывает его автоматически
 */

const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  
  console.log(`AfterPack: Постобработка для платформы ${electronPlatformName}`);
  console.log(`AfterPack: Директория сборки ${appOutDir}`);
  
  try {
    // Создаем дополнительную информацию о сборке для отладки
    const buildInfo = {
      buildTime: new Date().toISOString(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      platform: electronPlatformName,
      arch: process.arch,
      appVersion: packager.appInfo.version,
      productName: packager.appInfo.productName
    };

    // Сохраняем информацию о сборке в файл
    const buildInfoPath = path.join(appOutDir, 'resources', 'build-info.json');
    const buildInfoDir = path.dirname(buildInfoPath);
    
    // Создаем директорию resources, если она не существует
    if (!fs.existsSync(buildInfoDir)) {
      fs.mkdirSync(buildInfoDir, { recursive: true });
    }
    
    fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
    console.log(`AfterPack: Информация о сборке сохранена в ${buildInfoPath}`);
    
    // Для Windows и Linux создаем директорию для чеков голосования
    if (electronPlatformName === 'win32' || electronPlatformName === 'linux') {
      const receiptsDir = path.join(appOutDir, 'resources', 'receipts');
      if (!fs.existsSync(receiptsDir)) {
        fs.mkdirSync(receiptsDir, { recursive: true });
      }
      console.log(`AfterPack: Создана директория для чеков ${receiptsDir}`);
      
      // Создаем README-файл внутри директории
      const readmePath = path.join(receiptsDir, 'README.txt');
      fs.writeFileSync(readmePath, 'Эта директория используется для хранения чеков о голосовании.\nНе удаляйте этот файл.');
    }
    
    console.log('AfterPack: Постобработка успешно завершена');
    return true;
  } catch (error) {
    console.error('AfterPack: Ошибка постобработки:', error);
    return false;
  }
}; 