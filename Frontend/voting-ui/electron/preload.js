// Все API Node.js доступны в процессе preload.
// Имеет те же ограничения, что и Chrome-расширение.
const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

// Полный список разрешенных IPC каналов
const VALID_CHANNELS = [
  'ethereum-transaction', 
  'save-vote-receipt', 
  'open-external-auth',
  'open-in-browser',
  'copy-to-clipboard'
];

// Безопасный вызов IPC с проверками и обработкой ошибок
const safeIpcInvoke = async (channel, data) => {
  try {
    // Проверяем, что канал входит в список разрешенных
    if (!VALID_CHANNELS.includes(channel)) {
      throw new Error(`Неразрешенный IPC канал: ${channel}`);
    }
    
    // Проверка валидности входных данных
    if (data !== undefined && (data === null || typeof data !== 'object' && typeof data !== 'string' && typeof data !== 'number')) {
      throw new Error(`Недопустимый тип данных для канала ${channel}`);
    }
    
    // Отправляем запрос в основной процесс
    return await ipcRenderer.invoke(channel, data);
  } catch (error) {
    console.error(`Ошибка IPC в канале ${channel}:`, error);
    return { 
      status: 'error', 
      message: `Ошибка при обработке запроса: ${error.message}` 
    };
  }
};

// Безопасная подписка на события
const safeIpcOn = (channel, callback) => {
  if (!VALID_CHANNELS.includes(channel)) {
    console.error(`Подписка на неразрешенный IPC канал: ${channel}`);
    return () => {};
  }
  
  if (typeof callback !== 'function') {
    console.error('Callback должен быть функцией');
    return () => {};
  }
  
  const wrappedCallback = (_, data) => {
    try {
      callback(data);
    } catch (error) {
      console.error(`Ошибка в обработчике события ${channel}:`, error);
    }
  };
  
  ipcRenderer.on(channel, wrappedCallback);
  return () => {
    ipcRenderer.removeListener(channel, wrappedCallback);
  };
};

// Простая функция для получения информации о системе
function getSystemInfo() {
  try {
    return {
      platform: process.platform,
      osVersion: os.release(),
      versions: process.versions,
      isElectron: true
    };
  } catch (error) {
    console.error('Ошибка при получении информации о системе:', error);
    return { isElectron: true, error: true };
  }
}

// Экспортируем API для безопасного использования в рендерер-процессе
contextBridge.exposeInMainWorld('electronAPI', {
  // Методы для взаимодействия с блокчейном Ethereum
  sendTransaction: (transactionData) => {
    // Проверяем корректность аргументов
    if (!transactionData || typeof transactionData !== 'object') {
      console.error('Некорректные данные транзакции');
      return Promise.resolve({ 
        status: 'error', 
        message: 'Некорректные данные транзакции' 
      });
    }
    return safeIpcInvoke('ethereum-transaction', transactionData);
  },
  
  // Методы для работы с файловой системой
  saveVoteReceipt: (receiptData) => {
    // Проверяем корректность аргументов
    if (!receiptData || typeof receiptData !== 'object') {
      console.error('Некорректные данные чека');
      return Promise.resolve({ 
        status: 'error', 
        message: 'Некорректные данные чека' 
      });
    }
    return safeIpcInvoke('save-vote-receipt', receiptData);
  },
  
  // Основная информация
  getSystemInfo: () => getSystemInfo(),
  
  // Версия приложения
  getAppVersion: () => process.env.npm_package_version || 'unknown',
  
  // Открытие браузера для внешней авторизации
  openExternalAuth: (authUrl) => {
    // Проверяем корректность аргументов
    if (!authUrl || typeof authUrl !== 'string') {
      console.error('Некорректный URL авторизации');
      return Promise.resolve({ 
        status: 'error', 
        message: 'Некорректный URL авторизации' 
      });
    }
    
    // Проверяем, что URL начинается с https:// для безопасности
    if (!authUrl.startsWith('https://')) {
      console.error('URL авторизации должен использовать HTTPS');
      return Promise.resolve({ 
        status: 'error', 
        message: 'URL авторизации должен использовать HTTPS' 
      });
    }
    
    return safeIpcInvoke('open-external-auth', authUrl);
  },
  
  // Подписка на события из основного процесса
  onTransactionComplete: (callback) => {
    return safeIpcOn('transaction-complete', callback);
  },
  
  // Подписка на события авторизации (callback из браузера)
  onAuthCallback: (callback) => {
    return safeIpcOn('auth-callback', callback);
  },
  
  // Подписка на события навигации из меню приложения
  onNavigate: (callback) => {
    return safeIpcOn('navigate', callback);
  },
  
  // Вспомогательные функции для отладки
  ping: () => "pong",
  
  // Функция для логирования
  log: (message) => {
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }
    console.log(`[Electron App Log]: ${message}`);
  },
  
  // Открытие ссылки в браузере
  openInBrowser: (url) => {
    if (!url || typeof url !== 'string') {
      console.error('Некорректный URL');
      return Promise.resolve({ 
        status: 'error', 
        message: 'Некорректный URL' 
      });
    }
    
    return safeIpcInvoke('open-in-browser', url);
  },
  
  // Копирование в буфер обмена
  copyToClipboard: (text) => {
    if (typeof text !== 'string') {
      console.error('Текст для копирования должен быть строкой');
      return Promise.resolve({ 
        status: 'error', 
        message: 'Текст для копирования должен быть строкой' 
      });
    }
    
    return safeIpcInvoke('copy-to-clipboard', text);
  },
  
  // Проверка, запущено ли приложение в Electron
  isElectron: () => true,
  
  // Обработка действий MetaMask и Web3 - перенаправление в браузер
  handleWeb3Action: async (action, data) => {
    // Проверка валидности входных данных
    if (!action || typeof action !== 'string') {
      console.error('Некорректное действие Web3');
      return { 
        status: 'error', 
        message: 'Некорректное действие Web3' 
      };
    }
    
    // В этой версии все Web3-действия просто открывают сайт в браузере
    console.log(`Web3 действие ${action} требует браузера:`, data);
    const url = window.location.href;
    await safeIpcInvoke('open-in-browser', url);
    return { redirected: true, message: 'Действие требует MetaMask. Открыто в браузере.' };
  }
}); 