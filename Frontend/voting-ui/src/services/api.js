import axios from 'axios';

// Explicitly set the base URL to our local dev server
const API_URL = 'http://localhost:5000';

// Создаем инстанс axios с базовыми настройками
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// For debugging
console.log('API URL:', API_URL);

// Перехватчик для обработки ошибок
apiClient.interceptors.response.use(
  response => response,
  error => {
    console.error('API Error:', error);
    console.error('API Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        headers: error.config?.headers
      }
    });
    return Promise.reject(error);
  }
);

// Добавляем авторизационный токен, если он есть
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Debug log to see the full URL
    console.log('Making API request to:', config.baseURL + config.url, {
      method: config.method,
      data: config.data,
      headers: config.headers
    });
    
    return config;
  },
  error => Promise.reject(error)
);

const api = {
  // Test endpoint to check API connectivity
  async testConnection() {
    try {
      const response = await apiClient.get('/');
      console.log('API connection successful:', response.data);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('API connection failed:', error.message);
      return { success: false, error: error.message };
    }
  },
  
  // Elections
  async getAllElections() {
    const response = await apiClient.get('/api/elections');
    return response.data;
  },
  
  async createElection(election) {
    const response = await apiClient.post('/api/elections', election);
    return response.data;
  },
  
  // Add method to delete all elections from database
  async deleteAllElections() {
    const response = await apiClient.delete('/api/elections/all');
    return response.data;
  },
  
  // Add method to reset all elections in blockchain
  async resetBlockchainElections() {
    const response = await apiClient.post('/api/elections/reset-blockchain');
    return response.data;
  },
  
  // Add method to delete all votes
  async deleteAllVotes() {
    const response = await apiClient.delete('/vote/all');
    return response.data;
  },
  
  // Создание голосования без затрат газа
  async createGaslessElection(electionData) {
    try {
      console.log('Sending gasless election data:', electionData);
      const response = await apiClient.post('/api/elections/gasless', electionData);
      console.log('Gasless election created successfully:', response.data);
      
      // Проверяем структуру ответа
      if (response.data) {
        // Если electionId есть в ответе, но это не число - пробуем извлечь число
        if (response.data.electionId !== undefined) {
          if (typeof response.data.electionId !== 'number') {
            // Пробуем преобразовать в число
            const extractedId = parseInt(response.data.electionId, 10);
            if (!isNaN(extractedId)) {
              response.data.electionId = extractedId;
              console.log('Преобразован ID голосования в число:', extractedId);
            }
          }
        } else if (response.data.id !== undefined) {
          // Если вместо electionId прислали id
          response.data.electionId = response.data.id;
          console.log('Использован id как electionId:', response.data.electionId);
        } else if (typeof response.data === 'object' && Object.keys(response.data).length === 0) {
          // Если прислали пустой объект, используем информацию из лога терминала
          // Это хак для обхода проблемы с бэкендом, который не возвращает ID
          const terminalLogs = window.electronAPI?.getTerminalLogs?.() || [];
          const idMatch = terminalLogs.find(log => log.includes('Created election with ID:'));
          
          if (idMatch) {
            const extractedId = parseInt(idMatch.match(/ID: (\d+)/)[1], 10);
            if (!isNaN(extractedId)) {
              response.data.electionId = extractedId;
              console.log('Извлечен ID голосования из терминала:', extractedId);
            }
          }
        }
      }
      
      return response.data;
    } catch (error) {
      console.error('Failed to create gasless election:', error);
      throw error;
    }
  },
  
  async getElection(electionId) {
    if (electionId === undefined || electionId === null) {
      throw new Error('Invalid election ID provided');
    }
    
    // Try to convert to integer or extract number from input
    let electionIdNum;
    if (typeof electionId === 'number') {
      electionIdNum = electionId;
    } else {
      // Try to parse as integer
      electionIdNum = parseInt(electionId, 10);
      
      // If parsing failed, try to extract a number using regexp
      if (isNaN(electionIdNum)) {
        const matches = String(electionId).match(/\d+/);
        if (matches && matches.length > 0) {
          electionIdNum = parseInt(matches[0], 10);
          console.log(`Extracted election ID ${electionIdNum} from parameter ${electionId}`);
        } else {
          throw new Error('Invalid election ID provided: must contain at least one number');
        }
      }
    }
    
    try {
      const response = await apiClient.get(`/api/elections/${electionIdNum}`);
      return response.data;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        throw new Error(`Голосование с ID ${electionIdNum} не найдено`);
      }
      throw error;
    }
  },
  
  // Удаление голосования по ID (только для администраторов)
  async deleteElection(electionId) {
    if (electionId === undefined || electionId === null) {
      throw new Error('Invalid election ID provided');
    }
    
    // Преобразуем ID в число
    let electionIdNum;
    if (typeof electionId === 'number') {
      electionIdNum = electionId;
    } else {
      electionIdNum = parseInt(electionId, 10);
      if (isNaN(electionIdNum)) {
        throw new Error('Invalid election ID provided: must be a number');
      }
    }
    
    console.log(`Отправка запроса на удаление голосования ${electionIdNum}`);
    
    try {
      // Сначала проверяем соединение с API
      console.log('Проверка соединения с API...');
      try {
        const healthCheck = await fetch(`${API_URL}/`, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          mode: 'cors' // Явно указываем CORS режим
        });
        console.log(`Соединение с API: ${healthCheck.status} ${healthCheck.statusText}`);
      } catch (healthError) {
        console.error('Ошибка при проверке соединения с API:', healthError);
        // Продолжаем запрос даже если проверка не удалась
      }
      
      // Используем fetch с явными параметрами для CORS
      const url = `${API_URL}/api/elections/${electionIdNum}`;
      console.log(`DELETE запрос на URL: ${url}`);
      
      // Добавляем подробный лог
      console.log('Отправка DELETE запроса с заголовками:', {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        mode: 'cors', // Явно указываем CORS режим
        credentials: 'same-origin' // Для печенек, если они нужны
      });
      
      console.log(`Ответ сервера: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Ошибка удаления:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      // Важное изменение: проверяем, есть ли тело ответа
      const text = await response.text();
      const data = text ? JSON.parse(text) : { message: 'Голосование успешно удалено' };
      console.log('Успешный ответ:', data);
      return data;
    } catch (error) {
      console.error(`Ошибка при удалении голосования ${electionIdNum}:`, error);
      
      // Если ошибка связана с сетью, даем более подробное сообщение
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error(`Ошибка сети при подключении к API по адресу ${API_URL}. Убедитесь, что сервер запущен и доступен.`);
      }
      
      throw new Error(`Ошибка API при удалении: ${error.message}`);
    }
  },
  
  async getElectionResults(electionId) {
    const response = await apiClient.get(`/api/elections/${electionId}/results`);
    return response.data;
  },
  
  async finalizeElection(electionId) {
    const response = await apiClient.post(`/api/elections/${electionId}/finalize`);
    return response.data;
  },
  
  // Voting
  async castVote(request) {
    const response = await apiClient.post('/vote', request);
    return response.data;
  },
  
  async verifyVote(electionId, secretHash) {
    const response = await apiClient.get(`/vote/verify/${electionId}/${secretHash}`);
    return response.data;
  },
  
  // Blockchain
  async getBlockchainStatus() {
    const response = await apiClient.get('/blockchain/status');
    return response.data;
  },
  
  async getTransactionReceipt(txHash) {
    const response = await apiClient.get(`/blockchain/transaction/${txHash}`);
    return response.data;
  },
  
  async getContractInfo() {
    const response = await apiClient.get(`/blockchain/contract`);
    return response.data;
  },

  // Wallet Authentication
  async getWalletChallenge(walletAddress) {
    try {
      console.log('Getting challenge for wallet:', walletAddress);
      
      // Пробуем старый маршрут
      try {
        const response = await apiClient.get(`/api/wallet/challenge?walletAddress=${walletAddress}`);
        console.log('Challenge response (old route):', response.data);
        return response.data;
      } catch (oldRouteError) {
        console.log('Error with old route:', oldRouteError.message);
        
        // Если старый маршрут не работает, пробуем новый
        try {
          const response = await apiClient.get(`/api/wallet/getWalletChallenge?walletAddress=${walletAddress}`);
          console.log('Challenge response (new route):', response.data);
          return response.data;
        } catch (newRouteError) {
          console.error('Failed to get challenge from both routes:', newRouteError);
          throw newRouteError;
        }
      }
    } catch (error) {
      console.error('Failed to get wallet challenge:', error);
      throw error;
    }
  },

  async verifyWalletSignature(walletAddress, challenge, signature) {
    try {
      console.log('Verifying wallet signature:', { walletAddress, challenge, signature });
      const response = await apiClient.post('/api/wallet/verify', {
        walletAddress,
        challenge,
        signature
      });
      console.log('Verification response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to verify wallet signature:', error);
      throw error;
    }
  },

  // Test endpoint to check API connectivity
  async ping() {
    const response = await apiClient.get('/ping');
    return response.data;
  },
  
  async updateElection(id, data) {
    const response = await apiClient.put(`/elections/${id}`, data);
    return response.data;
  },
  
  // Add method to sync with blockchain
  async syncWithBlockchain() {
    const response = await apiClient.post('/api/blockchain/sync');
    return response.data;
  }
};

export default api; 