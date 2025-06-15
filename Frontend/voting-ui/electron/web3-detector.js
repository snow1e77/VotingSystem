/**
 * Этот скрипт внедряется в веб-контент для перехвата запросов к MetaMask и Web3
 */

(function() {
  // Перехватываем запросы к ethereum провайдеру
  if (!window.ethereum) {
    console.log('[Web3Detector] Инжектируем заглушку для ethereum провайдера');
    
    // Создаем заглушку ethereum провайдера
    window.ethereum = {
      isMetaMask: true,
      isConnected: () => false,
      request: async (request) => {
        console.log('[Web3Detector] Перехвачен запрос к ethereum:', request);
        
        // Показываем уведомление
        showRedirectionNotice();
        
        // Открываем текущий сайт в браузере
        try {
          window.electronAPI.openInBrowser(window.location.href);
        } catch (e) {
          console.error('[Web3Detector] Ошибка при открытии в браузере:', e);
        }
        
        throw new Error('Для использования MetaMask откройте сайт в браузере');
      }
    };
  }
  
  // Функция для показа уведомления
  function showRedirectionNotice() {
    // Проверяем, не показано ли уже уведомление
    if (document.getElementById('metamask-redirect-notice')) {
      return;
    }
    
    // Создаем элемент уведомления
    const notice = document.createElement('div');
    notice.id = 'metamask-redirect-notice';
    notice.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 16px 24px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 400px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    
    // Добавляем заголовок
    const title = document.createElement('h3');
    title.style.cssText = `
      margin: 0 0 12px 0;
      color: #212529;
      font-size: 18px;
    `;
    title.textContent = 'Требуется MetaMask';
    notice.appendChild(title);
    
    // Добавляем текст
    const text = document.createElement('p');
    text.style.cssText = `
      margin: 0 0 16px 0;
      color: #495057;
      font-size: 14px;
      text-align: center;
      line-height: 1.5;
    `;
    text.textContent = 'Для взаимодействия с блокчейном требуется MetaMask. Страница открывается в вашем веб-браузере.';
    notice.appendChild(text);
    
    // Добавляем кнопку закрытия
    const closeButton = document.createElement('button');
    closeButton.style.cssText = `
      background-color: #f8f9fa;
      border: none;
      color: #6c757d;
      font-size: 24px;
      position: absolute;
      top: 8px;
      right: 8px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    `;
    closeButton.innerHTML = '&times;';
    closeButton.onclick = function() {
      document.body.removeChild(notice);
    };
    notice.appendChild(closeButton);
    
    // Добавляем уведомление на страницу
    document.body.appendChild(notice);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
      if (document.body.contains(notice)) {
        document.body.removeChild(notice);
      }
    }, 5000);
  }
  
  // Перехватываем Web3
  if (window.Web3) {
    console.log('[Web3Detector] Web3 уже определен, перехватываем');
    const originalWeb3 = window.Web3;
    window.Web3 = function() {
      console.log('[Web3Detector] Вызван конструктор Web3');
      showRedirectionNotice();
      window.electronAPI.openInBrowser(window.location.href);
      // Возвращаем заглушку
      return {
        eth: {
          accounts: [],
          defaultAccount: null,
          getAccounts: () => Promise.resolve([])
        }
      };
    };
    window.Web3.prototype = originalWeb3.prototype;
  }
  
  console.log('[Web3Detector] Скрипт инициализирован');
})(); 