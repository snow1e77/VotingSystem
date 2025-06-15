import React, { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Navbar, Nav, Container, Button, Badge, Tooltip, OverlayTrigger, Alert } from 'react-bootstrap';
import { ToastContainer, toast } from '../utils/toastUtils';
import 'react-toastify/dist/ReactToastify.css';
import { FiExternalLink } from 'react-icons/fi';
import { FaPlus, FaLock } from 'react-icons/fa';
import blockchainService from '../services/blockchain';

const CONTRACT_ADDRESS = '0x1A0fAb9881D1B51A153039543dC7017eE644c794'; // Адрес контракта из appsettings.json

const Layout = () => {
  const location = useLocation();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState('');
  const [blockchainError, setBlockchainError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [network, setNetwork] = useState(null);
  const [isMetaMaskInstalled, setIsMetaMaskInstalled] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Сокращенный адрес кошелька для отображения
  const shortenAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Инициализация блокчейн-сервиса
  const initializeBlockchain = useCallback(async (silent = false) => {
    setConnecting(true);
    
    try {
      await blockchainService.initialize(CONTRACT_ADDRESS);
      const account = await blockchainService.getCurrentAccount();
      if (account) {
        setWalletConnected(true);
        setWalletAddress(account);
        setBlockchainError(null);
        
        // Проверяем, является ли пользователь администратором
        const adminStatus = await blockchainService.isAdmin();
        setIsAdmin(adminStatus);
        
        if (!silent) {
          toast.success('Подключено к блокчейну');
        }
      }
    } catch (error) {
      console.error('Ошибка инициализации блокчейна:', error);
      setBlockchainError(error.message);
      setWalletConnected(false);
      
      if (!silent) {
        if (error.message.includes('User rejected') || 
            error.message.includes('User denied')) {
          toast.error('Вы отклонили запрос на подключение кошелька');
        } else {
          toast.error(`Ошибка подключения: ${error.message}`);
        }
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  // Проверка статуса администратора
  const checkAdminStatus = useCallback(async () => {
    try {
      if (blockchainService.isInitialized() && walletConnected) {
        const adminStatus = await blockchainService.isAdmin();
        setIsAdmin(adminStatus);
        console.log('Статус администратора:', adminStatus);
      }
    } catch (error) {
      console.error('Ошибка при проверке статуса администратора:', error);
      setIsAdmin(false);
    }
  }, [walletConnected]);

  // Обновляем информацию о сети
  const updateNetworkInfo = useCallback((chainId) => {
    let networkName = 'Неизвестная сеть';
    let isTestnet = false;
    
    switch(chainId) {
      case '0x1': 
        networkName = 'Ethereum Mainnet';
        break;
      case '0x5': 
        networkName = 'Goerli Testnet';
        isTestnet = true;
        break;
      case '0xaa36a7': 
        networkName = 'Sepolia Testnet';
        isTestnet = true;
        break;
      case '0x89': 
        networkName = 'Polygon';
        break;
      default:
        networkName = `Другая сеть (${chainId})`;
    }
    
    setNetwork({ name: networkName, chainId, isTestnet });
  }, []);

  // Проверяем, есть ли уже соединение с кошельком при загрузке
  const checkExistingConnection = useCallback(async () => {
    try {
      // Проверяем, доступен ли Ethereum провайдер
      if (window.ethereum) {
        // Проверяем, есть ли уже разрешенные аккаунты (активное соединение)
        const accounts = await window.ethereum.request({ 
          method: 'eth_accounts' // Получаем только уже авторизованные аккаунты
        });
        
        if (accounts && accounts.length > 0) {
          // Кошелек уже подключен - инициализируем сервис
          await initializeBlockchain(true);
          
          // Получаем информацию о сети
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          updateNetworkInfo(chainId);
          
          // Проверяем, является ли пользователь администратором
          checkAdminStatus();
        } else {
          // Кошелек есть, но не авторизован для нашего приложения
          console.log('Кошелек найден, но не авторизован для этого приложения');
        }
      }
    } catch (error) {
      console.error('Ошибка при проверке существующего соединения:', error);
    }
  }, [initializeBlockchain, updateNetworkInfo, checkAdminStatus]);

  useEffect(() => {
    // Проверяем наличие MetaMask при монтировании
    const checkMetaMaskInstallation = () => {
      const isProviderAvailable = Boolean(window.ethereum) || Boolean(window.web3);
      const isMetaMask = window.ethereum?.isMetaMask || window.web3?.currentProvider?.isMetaMask;
      setIsMetaMaskInstalled(isProviderAvailable && isMetaMask);
    };
    
    checkMetaMaskInstallation();
    checkExistingConnection();
    
    // Регистрируем обработчик изменения сети
    if (window.ethereum) {
      window.ethereum.on('chainChanged', (chainId) => {
        toast.info('Сеть блокчейна изменилась. Обновление...');
        updateNetworkInfo(chainId);
        // При изменении сети проверяем подключение заново
        checkExistingConnection();
      });
      
      // Улучшенная обработка смены аккаунта
      window.ethereum.on('accountsChanged', (accounts) => {
        console.log('Событие смены аккаунта:', accounts);
        if (accounts.length === 0) {
          setWalletConnected(false);
          setWalletAddress('');
          toast.warning('Кошелек отключен');
        } else {
          const newAddress = accounts[0];
          setWalletAddress(newAddress);
          setWalletConnected(true);
          // Добавляем проверку, изменился ли реально адрес
          if (walletAddress && walletAddress.toLowerCase() !== newAddress.toLowerCase()) {
            toast.success('Адрес кошелька изменен на: ' + shortenAddress(newAddress));
          } else if (!walletAddress) {
            toast.success('Кошелек подключен: ' + shortenAddress(newAddress));
          }
          
          // Переинициализируем blockchain сервис с новым аккаунтом
          blockchainService.initialize(CONTRACT_ADDRESS, true).catch(console.error);
        }
      });
    }
    
    // Создаем интервал для периодической проверки текущего аккаунта (каждые 5 секунд)
    const accountCheckInterval = setInterval(async () => {
      if (window.ethereum && walletConnected) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0 && accounts[0].toLowerCase() !== walletAddress.toLowerCase()) {
            console.log('Обнаружен новый аккаунт:', accounts[0]);
            setWalletAddress(accounts[0]);
            toast.info('Обновлен адрес кошелька: ' + shortenAddress(accounts[0]));
          }
        } catch (error) {
          console.error('Ошибка при проверке аккаунта:', error);
        }
      }
    }, 5000);
    
    return () => {
      // Отключаем слушатели при размонтировании
      if (window.ethereum) {
        window.ethereum.removeAllListeners('chainChanged');
        window.ethereum.removeAllListeners('accountsChanged');
      }
      clearInterval(accountCheckInterval);
    };
  }, [walletAddress, walletConnected, checkExistingConnection, updateNetworkInfo]);

  const connectWallet = useCallback(async () => {
    // Проверяем наличие MetaMask или другого Ethereum провайдера
    if (!window.ethereum) {
      toast.error('Кошелек Ethereum не найден. Установите MetaMask или совместимый кошелек.');
      window.open('https://metamask.io/download.html', '_blank');
      return;
    }
    
    await initializeBlockchain();
  }, [initializeBlockchain]);
  
  // Рендерим содержимое подсказки для адреса кошелька
  const renderWalletTooltip = (props) => (
    <Tooltip id="wallet-tooltip" {...props}>
      Ваш адрес: {walletAddress}
      <br />
      Сеть: {network?.name || 'Неизвестно'}
      <br />
      Нажмите для просмотра на Etherscan
    </Tooltip>
  );

  // Отображаем кнопку установки MetaMask
  const renderMetaMaskButton = () => {
    if (!isMetaMaskInstalled) {
      return (
        <Button 
          variant="warning" 
          onClick={() => window.open('https://metamask.io/download.html', '_blank')}
          className="me-2"
        >
          Установить MetaMask
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="d-flex flex-column min-vh-100">
      <ToastContainer position="top-right" autoClose={5000} />
      
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-4 shadow">
        <Container>
          <Navbar.Brand as={Link} to="/">
            Система голосования
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={Link} to="/" active={location.pathname === '/'}>
                Главная
              </Nav.Link>
              
              {/* Показываем ссылку на создание голосования только администраторам */}
              {isAdmin && (
                <Nav.Link as={Link} to="/create-election" active={location.pathname === '/create-election'}>
                  <FaPlus className="me-1" /> Создать голосование
                </Nav.Link>
              )}
              
              {/* Добавляем информацию о правах администратора */}
              {!isAdmin && (
                <Nav.Item>
                  <OverlayTrigger
                    placement="bottom"
                    overlay={
                      <Tooltip id="admin-tooltip">
                        Только администратор сайта может создавать голосования
                      </Tooltip>
                    }
                  >
                    <span className="nav-link text-muted" style={{cursor: 'help'}}>
                      <FaLock className="me-1" /> Создание голосований
                    </span>
                  </OverlayTrigger>
                </Nav.Item>
              )}
            </Nav>
            
            {/* Существующий код для подключения кошелька */}
            <div className="d-flex align-items-center">
              {walletConnected ? (
                <div className="d-flex align-items-center text-white">
                  <OverlayTrigger
                    placement="bottom"
                    overlay={renderWalletTooltip}
                  >
                    <Badge 
                      bg={network?.isTestnet ? "warning" : "success"} 
                      className="me-2 d-flex align-items-center" 
                      style={{cursor: 'pointer'}}
                      onClick={() => window.open(`https://sepolia.etherscan.io/address/${walletAddress}`, '_blank')}
                    >
                      {network?.name && <small className="me-1">{network.name}:</small>}
                      {shortenAddress(walletAddress)} <FiExternalLink className="ms-1" size={14} />
                    </Badge>
                  </OverlayTrigger>
                  
                  {isAdmin && (
                    <Badge bg="danger" className="me-2">
                      Администратор
                    </Badge>
                  )}
                </div>
              ) : (
                <>
                  {renderMetaMaskButton()}
                  <Button 
                    variant="primary" 
                    onClick={connectWallet} 
                    className="me-2"
                  >
                    Подключить кошелек
                  </Button>
                </>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <div className="flex-grow-1">
        <Container>
          {blockchainError && !walletConnected && (
            <Alert variant="warning" className="mb-4">
              {blockchainError}
            </Alert>
          )}
          <Outlet />
        </Container>
      </div>

      <footer className="mt-auto py-3 bg-dark text-white">
        <Container className="text-center">
          <small>&copy; {new Date().getFullYear()} Система голосования на блокчейне</small>
        </Container>
      </footer>
    </div>
  );
};

export default Layout; 