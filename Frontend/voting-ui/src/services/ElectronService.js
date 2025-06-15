/**
 * Сервис для взаимодействия с Electron API
 */
class ElectronService {
  constructor() {
    this.isElectron = window.electron !== undefined || window.electronAPI !== undefined;
    this.terminalLogs = [];
    this.lastCreatedElectionId = null;
    
    // Инициализация прослушивания логов, если доступно Electron API
    if (this.isElectron && window.electronAPI && window.electronAPI.onTerminalOutput) {
      console.log('Electron API detected - initializing log listener');
      
      window.electronAPI.onTerminalOutput((event, log) => {
        // Сохраняем логи терминала
        this.terminalLogs.push(log);
        
        // Ограничиваем количество сохраняемых логов
        if (this.terminalLogs.length > 1000) {
          this.terminalLogs.shift();
        }
        
        // Если лог содержит информацию о созданном голосовании, сохраняем ID
        if (log && typeof log === 'string') {
          // Ищем созданное голосование
          if (log.includes('Created election with ID:')) {
            try {
              const match = log.match(/ID: (\d+)/);
              if (match && match[1]) {
                const electionId = parseInt(match[1], 10);
                if (!isNaN(electionId)) {
                  console.log('Detected election creation in terminal:', electionId);
                  this.lastCreatedElectionId = electionId;
                  
                  // Для отладки
                  window.lastCreatedElectionId = electionId;
                }
              }
            } catch (err) {
              console.error('Error parsing election ID from terminal log:', err);
            }
          }
          
          // Ищем информацию о созданном gasless голосовании
          if (log.includes('Received gasless election request:') && log.includes('Created election with ID:')) {
            try {
              const match = log.match(/Created election with ID: (\d+)/);
              if (match && match[1]) {
                const electionId = parseInt(match[1], 10);
                if (!isNaN(electionId)) {
                  console.log('Detected gasless election creation in terminal:', electionId);
                  this.lastCreatedElectionId = electionId;
                  
                  // Для отладки
                  window.lastCreatedElectionId = electionId;
                }
              }
            } catch (err) {
              console.error('Error parsing gasless election ID from terminal log:', err);
            }
          }
        }
      });
    }
  }

  /**
   * Проверяет, запущено ли приложение в Electron
   * @returns {boolean} true если приложение запущено в Electron
   */
  isDesktopApp() {
    return this.isElectron;
  }

  /**
   * Получает информацию о системе
   * @returns {Object|null} Информация о системе или null, если не Electron
   */
  getSystemInfo() {
    if (!this.isElectron || !window.electronAPI) {
      return null;
    }
    return window.electronAPI.getSystemInfo();
  }

  /**
   * Открывает текущую страницу в браузере по умолчанию
   * @param {string} url URL для открытия (опционально)
   * @returns {Promise<Object>} Результат операции
   */
  async openInBrowser(url) {
    if (!this.isElectron || !window.electronAPI) {
      console.warn('Невозможно открыть в браузере: приложение не запущено в Electron');
      return { success: false };
    }
    return window.electronAPI.openInBrowser(url);
  }

  /**
   * Копирует текст в буфер обмена
   * @param {string} text Текст для копирования
   * @returns {Promise<Object>} Результат операции
   */
  async copyToClipboard(text) {
    if (!this.isElectron || !window.electronAPI) {
      // Используем веб API, если приложение не в Electron
      try {
        await navigator.clipboard.writeText(text);
        return { success: true };
      } catch (error) {
        console.error('Ошибка при копировании в буфер обмена:', error);
        return { success: false, error: error.message };
      }
    }
    return window.electronAPI.copyToClipboard(text);
  }

  /**
   * Обрабатывает Web3 действия (для Ethereum/блокчейн операций)
   * @param {string} action Тип действия
   * @param {Object} data Данные для действия
   * @returns {Promise<Object>} Результат операции
   */
  async handleWeb3Action(action, data) {
    if (!this.isElectron || !window.electronAPI) {
      // В веб-версии используем обычный вызов, ничего не делаем
      return { success: true, redirect: false };
    }
    
    // В Electron перенаправляем в браузер для выполнения Web3 действий
    return window.electronAPI.handleWeb3Action(action, data);
  }

  /**
   * Логирует сообщение
   * @param {string} message Сообщение для логирования
   */
  log(message) {
    if (this.isElectron) {
      console.log(`[Electron]: ${message}`);
    } else {
      console.log(`[Web]: ${message}`);
    }
  }

  /**
   * Отправляет запрос в бэкенд Electron
   * @param {string} endpoint Эндпоинт API
   * @param {Object} data Данные для отправки
   * @returns {Promise<Object>} Результат операции
   */
  async sendBackend(endpoint, data) {
    if (!this.isElectron || !window.electronAPI) {
      console.error('Electron API not available');
      return { error: 'Electron API not available' };
    }
    
    try {
      const response = await window.electronAPI.sendToBackend(endpoint, data);
      return response;
    } catch (error) {
      console.error('Error sending to backend:', error);
      return { error: error.message || 'Unknown error' };
    }
  }
  
  /**
   * Получает логи терминала
   * @returns {Array<string>} Массив строк логов
   */
  getTerminalLogs() {
    return this.terminalLogs;
  }
  
  /**
   * Получает ID последнего созданного голосования из логов терминала
   * @returns {number|null} ID голосования или null
   */
  getLastCreatedElectionId() {
    return this.lastCreatedElectionId;
  }
}

// Создаем синглтон сервиса
const electronService = new ElectronService();
export default electronService; 