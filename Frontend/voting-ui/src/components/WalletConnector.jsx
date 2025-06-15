import React, { useState, useEffect } from 'react';
import { Button, Spinner, Alert } from 'react-bootstrap';
import { FiRefreshCw } from 'react-icons/fi';
import blockchainService from '../services/blockchain';
import { showError, showSuccess } from '../utils/toastUtils';
import api from '../services/api';

const WalletConnector = ({ onConnected, isConnectedCallback }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [address, setAddress] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  
  // Проверяем состояние подключения при загрузке компонента
  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Проверяем, инициализирован ли блокчейн-сервис
        if (!blockchainService.isInitialized()) {
          await blockchainService.initialize();
        }
        
        // Проверяем, подключен ли кошелек
        const accounts = await blockchainService.web3.eth.getAccounts();
        
        if (accounts && accounts.length > 0) {
          setAddress(accounts[0]);
          setIsConnected(true);
          
          // Вызываем колбэк для родительского компонента
          if (onConnected) {
            onConnected(accounts[0]);
          }
          
          // Устанавливаем статус подключения в родительском компоненте
          if (isConnectedCallback) {
            isConnectedCallback(true);
          }
          
          // Добавляем вызов handleVerifySuccess для установки isWalletVerified
          handleVerifySuccess(accounts[0]);
        }
      } catch (err) {
        console.error('Ошибка при проверке подключения кошелька:', err);
      }
    };
    
    checkConnection();
  }, [onConnected, isConnectedCallback]);
  
  // Функция для подключения кошелька
  const connectWallet = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Проверяем, инициализирован ли блокчейн-сервис
      if (!blockchainService.isInitialized()) {
        await blockchainService.initialize();
      }
      
      // Запрашиваем доступ к аккаунтам пользователя
      const accounts = await blockchainService.web3.eth.requestAccounts();
      
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        
        // Вызываем колбэк для родительского компонента
        if (onConnected) {
          onConnected(accounts[0]);
        }
        
        // Устанавливаем статус подключения в родительском компоненте
        if (isConnectedCallback) {
          isConnectedCallback(true);
        }
        
        // Добавляем вызов handleVerifySuccess для установки isWalletVerified
        handleVerifySuccess(accounts[0]);
      } else {
        setError('Не удалось получить адрес кошелька');
      }
    } catch (err) {
      console.error('Ошибка при подключении кошелька:', err);
      
      if (err.code === 4001) {
        setError('Вы отклонили запрос на подключение кошелька');
      } else if (err.message && err.message.includes('already pending')) {
        setError('Запрос на подключение кошелька уже отправлен. Проверьте ваш кошелек.');
      } else {
        setError('Ошибка при подключении кошелька: ' + (err.message || 'Неизвестная ошибка'));
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Функция для обработки успешной верификации кошелька
  const handleVerifySuccess = (walletAddress) => {
    // Создаем объект с данными пользователя
    const userData = {
      address: walletAddress,
      identityHash: `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}`,
      verified: true
    };
    
    // Вызываем handleWalletSuccess в родительском компоненте
    if (window.handleWalletSuccess) {
      window.handleWalletSuccess(userData);
    }
  };

  // Кнопка подключения кошелька с разными состояниями
  return (
    <>
      {error && (
        <Alert variant="danger" className="mb-3">
          {error}
        </Alert>
      )}
      
      {isConnected ? (
        <div className="wallet-info">
          <Alert variant="success" className="d-flex align-items-center">
            <div className="me-2">✓</div>
            <div className="flex-grow-1">
              Кошелек подключен: <strong>{address ? `${address.substring(0, 6)}...${address.substring(address.length - 4)}` : ''}</strong>
            </div>
            <Button 
              variant="outline-primary" 
              size="sm" 
              onClick={() => window.location.reload()} 
              className="ms-2"
            >
              <FiRefreshCw /> Обновить
            </Button>
          </Alert>
        </div>
      ) : (
        <Button 
          variant="primary"
          onClick={connectWallet}
          disabled={isLoading}
          className="btn-wallet-connect"
        >
          {isLoading ? (
            <>
              <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
              Подключение...
            </>
          ) : (
            'Подключить криптокошелек'
          )}
        </Button>
      )}
    </>
  );
};

export default WalletConnector; 