const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const os = require('os');

// Базовый URL сайта - в реальном приложении это будет URL вашего развернутого сайта
const BASE_SITE_URL = 'http://localhost:3000';

// Сохраняем глобальную ссылку на объект окна
let mainWindow;

// Путь к директории для сохранения настроек
const userDataPath = path.join(app.getPath('userData'), 'settings');

// Создание пользовательского меню
function createCustomMenu() {
  const template = [
    {
      label: 'БлокчейнГолос',
      submenu: [
        {
          label: 'О приложении',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'О приложении',
              message: 'БлокчейнГолос v' + app.getVersion(),
              detail: 'Безопасная и прозрачная система голосования на блокчейне Ethereum.\n\n©️ 2025 БлокчейнГолос. Все права защищены.',
              buttons: ['OK']
            });
          }
        },
        { type: 'separator' },
        {
          label: 'Выход',
          click: () => {
            app.quit();
          },
          accelerator: 'CmdOrCtrl+Q'
        }
      ]
    },
    {
      label: 'Навигация',
      submenu: [
        {
          label: 'Главная',
          click: () => {
            if (mainWindow) mainWindow.loadURL(BASE_SITE_URL);
          }
        },
        {
          label: 'Вернуться',
          click: () => {
            if (mainWindow && mainWindow.webContents.canGoBack()) {
              mainWindow.webContents.goBack();
            }
          }
        },
        {
          label: 'Вперед',
          click: () => {
            if (mainWindow && mainWindow.webContents.canGoForward()) {
              mainWindow.webContents.goForward();
            }
          }
        },
        {
          label: 'Обновить',
          click: () => {
            if (mainWindow) mainWindow.reload();
          },
          accelerator: 'F5'
        }
      ]
    },
    {
      label: 'Инструменты',
      submenu: [
        {
          label: 'Открыть в браузере',
          click: () => {
            if (mainWindow) {
              const currentURL = mainWindow.webContents.getURL();
              shell.openExternal(currentURL);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Консоль разработчика',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
          accelerator: 'F12'
        }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });
  }

  return Menu.buildFromTemplate(template);
}

function createWindow() {
  try {
    // Создаем директорию для сохранения настроек, если она не существует
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    // Создаем окно браузера
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      icon: path.join(__dirname, '../public/logo512.png'),
      show: false // Скрываем окно до полной загрузки
    });

    // Показываем окно только после полной загрузки страницы
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
    });

    // Устанавливаем пользовательское меню
    const customMenu = createCustomMenu();
    Menu.setApplicationMenu(customMenu);

    // Загружаем сайт
    mainWindow.loadURL(BASE_SITE_URL);

    // Открываем внешние ссылки и ссылки на MetaMask в браузере
    mainWindow.webContents.setWindowOpenHandler(({ url: urlString }) => {
      const parsedUrl = new URL(urlString);
      
      // Проверяем, требуется ли перенаправление в браузер
      const needsExternalBrowser = 
        parsedUrl.hostname.includes('metamask.io') || 
        parsedUrl.hostname.includes('metamask.app') ||
        urlString.includes('metamask') ||
        urlString.includes('ethereum') ||
        urlString.includes('web3') || 
        urlString.includes('connect') ||
        urlString.includes('wallet');
        
      if (needsExternalBrowser || parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        shell.openExternal(urlString);
        return { action: 'deny' };
      }
      
      // Для всех других URL, позволяем открывать их в приложении
      return { action: 'allow' };
    });

    // Обрабатываем клики по ссылкам
    mainWindow.webContents.on('will-navigate', (e, navUrl) => {
      const parsedUrl = new URL(navUrl);
      
      // Перехватываем ссылки, которые должны открываться в браузере
      if (navUrl.includes('metamask') || 
          navUrl.includes('ethereum') || 
          navUrl.includes('wallet') ||
          navUrl.includes('connect')) {
        e.preventDefault();
        shell.openExternal(navUrl);
      }
    });

    // Отслеживаем ошибки загрузки
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Ошибка загрузки:', errorCode, errorDescription);
      
      // Показываем пользователю сообщение об ошибке
      dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Ошибка загрузки',
        message: 'Не удалось загрузить сайт',
        detail: `Код ошибки: ${errorCode}\n${errorDescription}`,
        buttons: ['Перезагрузить', 'Отмена'],
        defaultId: 0
      }).then(result => {
        if (result.response === 0) {
          mainWindow.reload();
        }
      });
    });

    // Когда окно закрыто, освобождаем объект окна
    mainWindow.on('closed', function () {
      mainWindow = null;
    });

  } catch (error) {
    console.error('Ошибка при создании окна:', error);
    dialog.showErrorBox('Ошибка запуска', `Не удалось запустить приложение: ${error.message}`);
    app.quit();
  }
}

// Инициализация приложения
app.whenReady().then(() => {
  createWindow();
});

// Выходим, когда все окна закрыты
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
  if (mainWindow === null) createWindow();
});

// Обработка открытия сайта в браузере
ipcMain.handle('open-in-browser', async (event, url) => {
  try {
    await shell.openExternal(url || mainWindow.webContents.getURL());
    return { success: true };
  } catch (error) {
    console.error('Ошибка при открытии в браузере:', error);
    return { success: false, error: error.message };
  }
});

// Обработка запроса на копирование в буфер обмена
ipcMain.handle('copy-to-clipboard', async (event, text) => {
  try {
    require('electron').clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    console.error('Ошибка при копировании в буфер обмена:', error);
    return { success: false, error: error.message };
  }
}); 