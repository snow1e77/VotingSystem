import blockchainService from './blockchain';

class VerificationService {
  constructor() {
    this.apiBaseUrl = process.env.REACT_APP_API_URL || '/api';
    this.verificationData = null;
    this.loadVerificationFromLocalStorage();
  }
  
  // Загрузка данных верификации из localStorage
  loadVerificationFromLocalStorage() {
    try {
      const storedData = localStorage.getItem('verification_data');
      if (storedData) {
        this.verificationData = JSON.parse(storedData);
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных верификации:', error);
    }
  }
  
  // Сохранение данных верификации в localStorage
  saveVerificationToLocalStorage() {
    if (this.verificationData) {
      localStorage.setItem('verification_data', JSON.stringify(this.verificationData));
    }
  }
  
  // Проверить, верифицирован ли текущий пользователь
  isVerified() {
    return this.verificationData && this.verificationData.verified === true;
  }
  
  // Получить данные верификации
  getVerificationData() {
    return this.verificationData;
  }
  
  // Проверка подключения к бэкенду
  async checkBackendConnection() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      return response.ok;
    } catch (error) {
      console.error('Ошибка при проверке соединения с бэкендом:', error);
      return false;
    }
  }
  
  // Привязка адреса кошелька к верифицированному аккаунту
  async linkWalletToVerifiedUser(walletAddress) {
    if (!this.isVerified()) {
      throw new Error('Пользователь не верифицирован');
    }
    
    try {
      // Отправляем запрос на бэкенд для привязки кошелька
      const response = await fetch(`${this.apiBaseUrl}/verification/link-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          walletAddress, 
          identityHash: this.verificationData.identityHash 
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Ошибка при привязке кошелька');
      }
      
      const data = await response.json();
      
      // Обновляем данные верификации
      this.verificationData.walletAddress = walletAddress;
      this.saveVerificationToLocalStorage();
      
      return data;
    } catch (error) {
      console.error('Ошибка при привязке кошелька:', error);
      throw error;
    }
  }
  
  // Проверка, верифицирован ли адрес кошелька
  async checkWalletVerification(walletAddress) {
    try {
      // Отправляем запрос на бэкенд для проверки
      const response = await fetch(`${this.apiBaseUrl}/verification/check-wallet?walletAddress=${walletAddress}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      
      if (!response.ok) {
        return { verified: false };
      }
      
      return await response.json();
    } catch (error) {
      console.error('Ошибка при проверке верификации кошелька:', error);
      return { verified: false };
    }
  }
  
  // Сброс данных верификации
  clearVerification() {
    this.verificationData = null;
    localStorage.removeItem('verification_data');
  }
  
  // Сохранение данных верификации через кошелек
  saveWalletVerification(userData) {
    this.verificationData = {
      verified: true,
      walletAddress: userData.walletAddress,
      token: userData.token,
      verifiedAt: userData.verifiedAt || new Date().toISOString(),
      verificationType: 'wallet'
    };
    
    this.saveVerificationToLocalStorage();
    return this.verificationData;
  }
  
  // Получение данных верификации из localStorage
  getVerificationFromLocalStorage() {
    try {
      const storedData = localStorage.getItem('verification_data');
      if (storedData) {
        return JSON.parse(storedData);
      }
    } catch (error) {
      console.error('Ошибка при загрузке данных верификации из localStorage:', error);
    }
    
    return null;
  }
}

export default new VerificationService(); 