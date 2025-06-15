import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Container, Button, Card, Row, Col, Badge, Alert, Spinner, Modal } from 'react-bootstrap';
import { FiPlusCircle, FiClock, FiUsers, FiBarChart2, FiRefreshCw, FiTrash, FiPlus, FiCheckCircle } from 'react-icons/fi';
import { FaPlus, FaVoteYea, FaChartBar } from 'react-icons/fa';
import blockchainService from '../services/blockchain';
import { showError, showInfo, showWarning } from '../utils/toastUtils';
import api from '../services/api';
import voteIcon from '../assets/images/vote-icon.svg';
import WalletConnector from './WalletConnector';
import moment from 'moment';

// Используем переменную окружения или значение по умолчанию
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x1A0fAb9881D1B51A153039543dC7017eE644c794';

const HomePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeElections, setActiveElections] = useState([]);
  const [pastElections, setPastElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDesktopApp, setIsDesktopApp] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [blockchainInitialized, setBlockchainInitialized] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [electionToDelete, setElectionToDelete] = useState(null);
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  // Инициализация блокчейн-сервиса при загрузке компонента
  useEffect(() => {
    const initializeBlockchain = async () => {
      try {
        if (!blockchainService.isInitialized()) {
          console.log('Инициализация блокчейн-сервиса...');
          await blockchainService.initialize(CONTRACT_ADDRESS);
          console.log('Блокчейн-сервис успешно инициализирован');
          setBlockchainInitialized(true);
          
          // Проверяем, является ли пользователь администратором
          const adminStatus = await blockchainService.isAdmin();
          setIsAdmin(adminStatus);
          
          // Получаем баланс после успешной инициализации
          fetchAccountBalance();
        } else {
          console.log('Блокчейн-сервис уже инициализирован');
          setBlockchainInitialized(true);
          
          // Проверяем, является ли пользователь администратором
          const adminStatus = await blockchainService.isAdmin();
          setIsAdmin(adminStatus);
        }
      } catch (error) {
        console.error('Ошибка при инициализации блокчейн-сервиса:', error);
        // Устанавливаем состояние, даже если инициализация не удалась, 
        // чтобы компонент знал, что мы пытались инициализировать сервис
        setBlockchainInitialized(false);
        setError('Не удалось инициализировать блокчейн-сервис: ' + error.message);
      }
    };

    initializeBlockchain();
  }, []);

  // Получение баланса аккаунта
  const fetchAccountBalance = useCallback(async () => {
    if (!blockchainService.isInitialized()) return;
    
    try {
      const balance = await blockchainService.getAccountBalance();
      setWalletBalance(balance);
    } catch (error) {
      console.error('Ошибка при получении баланса:', error);
    }
  }, []);

  // Функция для получения информации о голосовании по его ID
  const fetchElectionInfo = async (electionId) => {
    try {
      // Получаем данные о голосовании
      const electionData = await blockchainService.getElectionInfo(electionId);
      
      if (!electionData) {
        console.error(`Не удалось получить данные голосования ${electionId}`);
        return null;
      }
      
      let name = electionData.name || '';
      let description = electionData.description || '';
      let metadataImage = null;
      
      // Проверяем, если описание содержит разделитель и метаданные
      if (description && description.includes('|metadata:')) {
        const parts = description.split('|metadata:');
        description = parts[0].trim();
        
        // Пытаемся разобрать метаданные
        try {
          const metadataStr = parts[1];
          const metadata = JSON.parse(metadataStr);
          if (metadata && metadata.imageUrl) {
            metadataImage = metadata.imageUrl;
            console.log(`Найдено изображение в метаданных: ${metadataImage}`);
          }
        } catch (e) {
          console.warn('Ошибка при парсинге метаданных из описания:', e);
        }
      }
      
      // Если не удалось извлечь изображение из метаданных в описании
      let image = metadataImage;
      
      // Если изображение всё еще не определено, проверяем метаданные
      if (!image && electionData.metadata && electionData.metadata !== null) {
        try {
          // Возможно, метаданные уже являются объектом
          const metadata = typeof electionData.metadata === 'string' 
            ? JSON.parse(electionData.metadata) 
            : electionData.metadata;
            
          if (metadata && metadata.imageUrl) {
            image = metadata.imageUrl;
            console.log(`Найдено изображение в объекте метаданных: ${image}`);
          }
        } catch (e) {
          console.warn('Ошибка при парсинге отдельных метаданных:', e);
        }
      }
      
      // Если изображение не указано в метаданных, используем изображение по умолчанию
      if (!image) {
        console.log('Используем изображение по умолчанию');
        image = voteIcon;
      } else {
        // Проверяем доступность изображения перед использованием
        try {
          // Создаем временное изображение для проверки
          const img = new Image();
          img.src = image;
          
          // Устанавливаем обработчик ошибки на случай недоступности изображения
          img.onerror = () => {
            console.warn(`Изображение недоступно: ${image}, используем запасное`);
            image = voteIcon; // Используем запасное изображение
          };
          
          // Таймаут для обработки изображения
          setTimeout(() => {
            if (!img.complete || img.naturalWidth === 0) {
              console.warn(`Тайм-аут загрузки изображения: ${image}, используем запасное`);
              image = voteIcon;
            }
          }, 3000);
        } catch (e) {
          console.error('Ошибка при проверке изображения:', e);
          image = voteIcon;
        }
      }
      
      // Обработка ID, чтобы убедиться, что это число
      let parsedId;
      try {
        parsedId = typeof electionId === 'number' ? electionId : parseInt(electionId, 10);
        if (isNaN(parsedId)) {
          console.warn(`ID голосования '${electionId}' не удалось преобразовать в число`);
          parsedId = null;
        }
      } catch (e) {
        console.error('Ошибка при обработке ID голосования:', e);
        parsedId = null;
      }
      
      // Fix for 1970 date issue - handle timestamps correctly
      const startTime = normalizeTimestamp(electionData.startTime);
      const endTime = normalizeTimestamp(electionData.endTime);
      
      console.log(`Голосование ${electionId}: startTime=${startTime}, endTime=${endTime}`);
      
      // Преобразуем данные для отображения
      return {
        id: parsedId,
        blockchainId: electionId, // Сохраняем исходный ID как резервный
        name: name,
        description: description || 'Нет описания',
        creator: electionData.creator,
        startTime: startTime,
        endTime: endTime,
        options: electionData.options,
        finalized: electionData.finalized || false,
        totalVotes: electionData.totalVotes || 0,
        image: image
      };
    } catch (error) {
      console.error(`Ошибка при получении информации о голосовании ${electionId}:`, error);
      return null;
    }
  };

  // Fix for 1970 date issue - handle timestamps correctly
  const normalizeTimestamp = useCallback((timestamp) => {
    if (!timestamp) return new Date();
    
    // If timestamp is already a Date object, return it
    if (timestamp instanceof Date) return timestamp;
    
    // Convert to number
    let ts = Number(timestamp);
    
    // Check if it's a valid number
    if (isNaN(ts)) {
      console.warn(`Некорректный timestamp: ${timestamp}, пробуем обработать как строку`);
      // Пробуем обработать как строковую дату
      const dateFromString = new Date(timestamp);
      if (!isNaN(dateFromString.getTime())) {
        return dateFromString;
      }
      return new Date(); // Если не удалось, возвращаем текущую дату
    }
    
    // If timestamp is a number smaller than typical JavaScript timestamps
    // (which are in milliseconds), it's likely a Unix timestamp in seconds
    if (ts < 10000000000) {
      ts = ts * 1000; // Convert seconds to milliseconds
    }
    
    const date = new Date(ts);
    
    // Проверяем только на невалидную дату, но не ограничиваем год верхней границей
    if (isNaN(date.getTime())) {
      console.warn(`Некорректная дата: ${timestamp}, используем текущую дату`);
      return new Date();
    }
    
    return date;
  }, []);

  // Обработка голосований, полученных через API
  const processElectionsFromApi = useCallback((elections, deletedElections = []) => {
    try {
      if (!Array.isArray(elections)) {
        console.error('Некорректные данные о голосованиях:', elections);
        showError('Ошибка при обработке данных о голосованиях');
        setLoading(false);
        return;
      }
      
      const now = new Date();
      const active = [];
      const past = [];
      
      // Фильтруем удаленные голосования
      const filteredElections = elections.filter(election => !deletedElections.includes(election.id));
      
      for (const election of filteredElections) {
        try {
          // Нормализуем timestamps для начала и окончания
          const startTimeObj = normalizeTimestamp(election.startTime);
          const endTimeObj = normalizeTimestamp(election.endTime);
          
          // Сохраняем корректные даты в объекте голосования
          election.startTime = startTimeObj;
          election.endTime = endTimeObj;
          
          // Разделяем на активные и прошедшие только по флагу finalized
          if (election.finalized === true) {
            past.push(election);
          } else {
            active.push(election);
          }
        } catch (error) {
          console.error(`Ошибка при обработке голосования ${election.id}:`, error);
        }
      }
      
      // Сортировка: активные - по времени окончания, прошедшие - по времени начала (в обратном порядке)
      active.sort((a, b) => a.endTime - b.endTime);
      past.sort((a, b) => b.startTime - a.startTime);
      
      setActiveElections(active);
      setPastElections(past);
      setLoading(false);
    } catch (error) {
      console.error('Ошибка при обработке данных голосований:', error);
      setLoading(false);
    }
  }, [normalizeTimestamp]);

  // Обернем fetchElections в useCallback, чтобы избежать бесконечного цикла
  const fetchElections = useCallback(async (showToast = false) => {
    setLoading(true);
    setError(null); // Clear any previous errors
    
    try {
      if (showToast) {
        setRefreshing(true);
        showInfo('Синхронизация с блокчейном...');
      }
      
      // Получаем список удаленных голосований из localStorage
      const deletedElections = JSON.parse(localStorage.getItem('deletedElections') || '[]');
      
      // Проверяем инициализацию блокчейн-сервиса
      if (!blockchainService.isInitialized()) {
        try {
          await blockchainService.initialize(CONTRACT_ADDRESS);
          // Получаем баланс после успешной инициализации
          fetchAccountBalance();
        } catch (err) {
          console.log('Ошибка инициализации блокчейн-сервиса:', err);
          setError('Не удалось подключиться к блокчейну. Пожалуйста, проверьте подключение к сети и настройки MetaMask.');
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }
      
      try {
        // Полная синхронизация с блокчейном
        const syncedElections = await blockchainService.syncWithBlockchain();
        
        if (!syncedElections || syncedElections.length === 0) {
          console.log('Нет голосований в блокчейне');
          setActiveElections([]);
          setPastElections([]);
          setLoading(false);
          setRefreshing(false);
          
          if (showToast) {
            showInfo('Нет доступных голосований в блокчейне');
          }
          return;
        }
        
        // Обрабатываем полученные данные
        const processedElections = syncedElections
          // Фильтруем удаленные голосования
          .filter(election => !deletedElections.includes(election.id))
          .map(election => {
            // Конвертируем Unix timestamp в JavaScript Date объекты
            const startTimeObj = new Date(election.startTime * 1000);
            const endTimeObj = new Date(election.endTime * 1000);
            
            // Определяем изображение из метаданных или используем стандартное
            let imageUrl = voteIcon;
            if (election.metadata && election.metadata.imageUrl) {
              imageUrl = election.metadata.imageUrl;
            }
            
            return {
              id: election.id,
              blockchainId: election.id,
              name: election.name,
              description: election.description || 'Нет описания',
              startTime: startTimeObj,
              endTime: endTimeObj,
              options: election.options,
              finalized: election.finalized,
              image: imageUrl
            };
          });
        
        // Разделяем голосования на активные и прошедшие на основе данных из блокчейна
        // Голосование считается завершенным ТОЛЬКО если оно помечено как finalized в блокчейне
        const active = processedElections.filter(election => 
          election.finalized === false
        );
        
        const past = processedElections.filter(election => 
          election.finalized === true
        );
        
        setActiveElections(active);
        setPastElections(past);
        
        if (showToast) {
          showInfo('Синхронизация с блокчейном успешно завершена');
        }
      } catch (syncError) {
        console.error('Ошибка при синхронизации с блокчейном:', syncError);
        setError('Ошибка при синхронизации с блокчейном. Пожалуйста, попробуйте обновить страницу.');
        
        // Пробуем использовать локальные данные из API, если синхронизация не удалась
        try {
          const apiElections = await api.getAllElections();
          if (apiElections && apiElections.length > 0) {
            processElectionsFromApi(apiElections, deletedElections);
          }
        } catch (apiError) {
          console.error('Не удалось получить данные с API:', apiError);
          // Если все методы не сработали, показываем пустой список
          setActiveElections([]);
          setPastElections([]);
        }
        
        if (showToast) {
          showError('Ошибка при синхронизации с блокчейном');
        }
      }
    } catch (err) {
      console.error('Критическая ошибка при загрузке голосований:', err);
      setActiveElections([]);
      setPastElections([]); 
      setError('Произошла ошибка при загрузке данных');
      
      if (showToast) {
        showError('Произошла ошибка при загрузке данных');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchAccountBalance, processElectionsFromApi]);

  // Обработчик ручного обновления списка голосований
  const handleRefresh = () => {
    fetchElections(true);
  };

  // Сброс списка удаленных голосований (только для администратора)
  const resetDeletedElections = () => {
    if (window.confirm('Вы действительно хотите восстановить все скрытые голосования? Они снова появятся в списке.')) {
      localStorage.removeItem('deletedElections');
      showInfo('Список удаленных голосований сброшен');
      fetchElections(true); // Перезагружаем список голосований
    }
  };
  
  // Эффект для загрузки голосований при монтировании компонента
  useEffect(() => {
    // Просто загружаем голосования при монтировании компонента
    fetchElections(false);
  }, [fetchElections]);

  // Отдельный эффект для обработки параметров маршрута
  useEffect(() => {
    const shouldRefresh = location.state?.refresh;
    const newElectionId = location.state?.newElectionId;
    
    // Только если пришли со страницы создания голосования с флагом обновления
    if (shouldRefresh) {
      // Очищаем state, чтобы избежать повторного обновления
      window.history.replaceState({}, document.title);
      
      // Обновляем список голосований с показом уведомления
      fetchElections(true);
      
      // Если есть ID нового голосования, перенаправляем на страницу этого голосования
      if (newElectionId !== undefined && newElectionId !== null) {
        // Убеждаемся, что ID является числом
        const electionIdNum = parseInt(newElectionId, 10);
        
        if (!isNaN(electionIdNum)) {
          console.log('Перенаправление на страницу голосования с ID:', electionIdNum);
          setTimeout(() => {
            navigate(`/vote/${electionIdNum}`);
          }, 1000);
        } else {
          console.error('Неверный формат ID голосования:', newElectionId);
          showError('Не удалось перейти на страницу голосования: неверный формат ID');
        }
      }
    }
  }, [location, fetchElections, navigate]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  // Форматирование даты в читаемый вид
  const formatDate = (date) => {
    if (!date) return '';
    
    try {
      // Проверка на валидность даты
      if (!(date instanceof Date)) {
        date = new Date(date);
      }
      
      if (isNaN(date.getTime())) {
        return '';
      }
      
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      return date.toLocaleDateString('ru-RU', options);
    } catch (error) {
      console.error('Ошибка форматирования даты:', error);
      return '';
    }
  };

  // Получение статуса голосования - теперь только по флагу finalized из блокчейна
  const getElectionStatus = (election) => {
    // Определяем статус только на основе флага finalized из блокчейна
    if (election.finalized === true) {
        return { label: 'Завершено', className: 'status-ended' };
      } else {
      return { label: 'Активно', className: 'status-active' };
    }
  };

  // Обработчик для удаления голосования
  const handleDeleteElection = (election) => {
    setElectionToDelete(election);
    setShowDeleteModal(true);
  };

  // Подтверждение удаления голосования
  const confirmDeleteElection = async () => {
    try {
      if (!electionToDelete) return;
      
      setShowDeleteModal(false);
      showInfo(`Удаление голосования "${electionToDelete.name}"...`);
      
      // Сохраняем ID удаленного голосования в localStorage
      const deletedElections = JSON.parse(localStorage.getItem('deletedElections') || '[]');
      if (!deletedElections.includes(electionToDelete.id)) {
        deletedElections.push(electionToDelete.id);
        localStorage.setItem('deletedElections', JSON.stringify(deletedElections));
      }
      
      // Удаляем голосование из локального состояния без обращения к API
      setActiveElections(prevElections => prevElections.filter(e => e.id !== electionToDelete.id));
      setPastElections(prevElections => prevElections.filter(e => e.id !== electionToDelete.id));
      
      showInfo(`Голосование "${electionToDelete.name}" успешно удалено из интерфейса`);
      
      // Показываем сообщение о том, что голосование невозможно удалить из блокчейна
      showWarning('Голосования хранятся в блокчейне и не могут быть полностью удалены, они только скрываются из интерфейса');
      
      setElectionToDelete(null);
    } catch (error) {
      console.error('Ошибка при удалении голосования:', error);
      showError(`Ошибка при удалении голосования: ${error.message}`);
      setShowDeleteModal(false);
    }
  };

  // Отмена удаления голосования
  const cancelDeleteElection = () => {
    setShowDeleteModal(false);
    setElectionToDelete(null);
  };

  // Обработчик финализации голосования
  const handleFinalizeElection = async (election) => {
    if (!window.confirm(`Вы действительно хотите финализировать голосование "${election.name}"?\n\nПосле финализации результаты станут окончательными и нельзя будет их изменить.`)) {
      return;
    }
    
    try {
      setRefreshing(true);
      showInfo('Финализация голосования...');
      
      // Вызываем API для финализации
      const response = await api.finalizeElection(election.id);
      
      if (response && response.transactionHash) {
        showInfo(`Голосование успешно финализировано! Хеш транзакции: ${response.transactionHash}`);
        
        // Обновляем список голосований через несколько секунд
        setTimeout(() => {
          fetchElections(true);
        }, 3000);
      } else {
        showWarning('Голосование финализировано, но не получен хеш транзакции');
        fetchElections(true);
      }
    } catch (error) {
      console.error('Ошибка при финализации голосования:', error);
      
      // Более информативные сообщения об ошибках
      if (error.message.includes('not ended')) {
        showError('Голосование еще не завершено');
      } else if (error.message.includes('already finalized')) {
        showError('Голосование уже финализировано');
      } else if (error.message.includes('not found')) {
        showError('Голосование не найдено');
      } else {
        showError(`Ошибка при финализации: ${error.message}`);
      }
    } finally {
      setRefreshing(false);
    }
  };

  // Рендеринг карточки голосования
  const renderElectionCard = (election, status) => {
    // Безопасная проверка дат
    const hasValidDates = election.startTime instanceof Date && 
                         !isNaN(election.startTime) && 
                         election.endTime instanceof Date && 
                         !isNaN(election.endTime);
                         
    return (
      <Col key={election.id} xs={12} md={6} lg={6} className="mb-2">
        <Card className="h-100 election-card shadow-sm">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-start mb-2">
              <Badge bg={election.finalized ? 'secondary' : 'success'} className="px-2 py-1">
                {election.finalized ? 'Финализировано' : 'Активно'}
              </Badge>
              
              {isAdmin && (
                <div className="d-flex gap-1">
                  {/* Кнопка финализации для завершенных но не финализированных голосований */}
                  {!election.finalized && new Date() > election.endTime && (
                    <Button 
                      variant="outline-warning" 
                      size="sm" 
                      onClick={() => handleFinalizeElection(election)}
                      title="Финализировать голосование"
                      className="p-1"
                    >
                      <FiCheckCircle size={14} />
                    </Button>
                  )}
                  
                  <Button 
                    variant="outline-danger" 
                    size="sm" 
                    onClick={() => handleDeleteElection(election)}
                    title="Удалить голосование"
                    className="p-1"
                  >
                    <FiTrash size={14} />
                  </Button>
                </div>
              )}
            </div>
            
            <Card.Title className="mb-2">{election.name}</Card.Title>
            
            <Card.Text className="small mb-2">
              {election.description && election.description.length > 80 
                ? `${election.description.substring(0, 80)}...` 
                : election.description}
            </Card.Text>
            
            <div className="election-meta mb-2">
              <div className="d-flex align-items-center mb-1">
                <FiClock className="me-1 text-muted" size={14} />
                <small>
                  {hasValidDates 
                    ? `${formatDate(election.startTime)} - ${formatDate(election.endTime)}`
                    : "Дата не определена"}
                </small>
              </div>
              
              <div className="d-flex align-items-center">
                <FiUsers className="me-1 text-muted" size={14} />
                <small>{election.totalVotes || 0} голосов</small>
              </div>
            </div>
          </Card.Body>
          
          <Card.Footer className="bg-white">
            <div className="d-grid gap-2">
              {!election.finalized ? (
                <Button 
                  as={Link} 
                  to={`/vote/${election.id}`} 
                  variant="primary"
                  className="d-flex align-items-center justify-content-center py-1"
                  size="sm"
                >
                  <FaVoteYea className="me-1" size={14} /> Голосовать
                </Button>
              ) : (
                <Button 
                  as={Link} 
                  to={`/results/${election.id}`} 
                  variant="outline-primary"
                  className="d-flex align-items-center justify-content-center py-1"
                  size="sm"
                >
                  <FaChartBar className="me-1" size={14} /> Результаты
                </Button>
              )}
            </div>
          </Card.Footer>
        </Card>
      </Col>
    );
  };

  return (
    <Container className="my-4">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center mb-3">Блокчейн-голосования</h1>
          <p className="text-center text-muted">
            Защищенная система голосований на основе блокчейна
          </p>
        </Col>
      </Row>

      {/* Добавляем компонент WalletConnector вверху страницы */}
      <Row className="mb-4">
        <Col md={{ span: 6, offset: 3 }}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title>Подключение кошелька</Card.Title>
              <Card.Text>
                Подключите криптокошелек для участия в голосованиях и просмотра всех доступных функций.
              </Card.Text>
              <WalletConnector 
                onConnected={(address) => {
                  setIsWalletConnected(true);
                  // Не обновляем список голосований здесь, чтобы избежать циклов обновлений
                  // fetchElections(true);
                }} 
                isConnectedCallback={(status) => setIsWalletConnected(status)}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Отображаем кнопки действий только если нет ошибки подключения */}
      {!error && (
        <Row className="mb-4 d-flex justify-content-center">
          <Col xs={12} md="auto" className="mb-2 mb-md-0">
            {isAdmin ? (
              <Button 
                variant="primary" 
                className="ms-auto"
                onClick={() => navigate('/create-election')}
              >
                <FiPlus className="me-2" />
                Создать голосование
              </Button>
            ) : (
              <Alert variant="info" className="mt-3">
                <Alert.Heading>Права администратора</Alert.Heading>
                <p>
                  Для создания голосований требуются права администратора. 
                  Обратитесь к администратору системы для получения доступа.
                </p>
              </Alert>
            )}
          </Col>
          <Col xs={12} md="auto" className="mb-2 mb-md-0">
            <Button variant="secondary" onClick={handleRefresh} disabled={refreshing} className="btn-lg w-100" 
              title="Полная синхронизация с блокчейном обновляет все данные о голосованиях непосредственно из смарт-контракта">
              {refreshing ? (
                <>
                  <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" className="me-2" />
                  Синхронизация...
                </>
              ) : (
                <>
                  <FiRefreshCw className="icon-left" /> Обновить список
                </>
              )}
            </Button>
            <div className="small text-center mt-1 text-muted">
              Синхронизация с блокчейном
            </div>
          </Col>
        </Row>
      )}

      {/* Отображаем сообщение об ошибке, если есть проблема с подключением */}
      {error && (
        <Row className="mb-4">
          <Col>
            <Alert variant="warning" className="d-flex align-items-center">
              <FiClock className="me-2" size={24} />
              <div>
                <strong>Ожидание подключения к блокчейну</strong>
                <p className="mb-0 small">Пожалуйста, убедитесь, что MetaMask установлен и подключен к сети Ethereum (Sepolia или Goerli).</p>
              </div>
              <Button variant="outline-secondary" onClick={handleRefresh} className="ms-auto">
                Повторить
              </Button>
            </Alert>
          </Col>
        </Row>
      )}
      
      {/* Информация о кошельке */}
      {walletBalance && (
        <Row className="mb-4">
          <Col>
            <Card className="shadow-sm">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <Card.Title>Ваш баланс</Card.Title>
                  <Card.Text>{walletBalance.formatted}</Card.Text>
                </div>
                <Button variant="outline-primary" onClick={fetchAccountBalance}>
                  <FiRefreshCw /> Обновить
                </Button>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Активные голосования */}
      <Row className="mb-4">
        <Col>
          <h2 className="section-title">
            <FaVoteYea className="icon-left" /> Активные голосования
          </h2>
          
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status" variant="primary">
                <span className="visually-hidden">Загрузка...</span>
              </Spinner>
              <p className="mt-3">Загрузка голосований из блокчейна...</p>
            </div>
          ) : activeElections.length > 0 ? (
            <Row className="g-2">
              {activeElections.map(election => (
                renderElectionCard(election, 'active'))
              )}
            </Row>
          ) : (
            <Card className="text-center py-5" bg="light">
              <Card.Body>
                <FiClock size={48} className="text-muted mb-3" />
                <Card.Title>Нет активных голосований</Card.Title>
                <Card.Text>
                  В данный момент нет активных голосований. Только администратор сайта может создавать новые голосования.
                </Card.Text>
                {isAdmin && (
                  <Link to="/create-election" className="btn btn-primary">
                    <FaPlus className="icon-left" /> Создать голосование
                  </Link>
                )}
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Завершенные голосования */}
      <Row>
        <Col>
          <h2 className="section-title">
            <FaChartBar className="icon-left" /> Завершенные голосования
          </h2>
          
          {loading ? (
            <div className="text-center my-5">
              <Spinner animation="border" role="status" variant="primary">
                <span className="visually-hidden">Загрузка...</span>
              </Spinner>
            </div>
          ) : pastElections.length > 0 ? (
            <Row className="g-2">
              {pastElections.map(election => (
                renderElectionCard(election, 'past'))
              )}
            </Row>
          ) : (
            <Card className="text-center py-5" bg="light">
              <Card.Body>
                <FiBarChart2 size={48} className="text-muted mb-3" />
                <Card.Title>Нет завершенных голосований</Card.Title>
                <Card.Text>
                  В данный момент нет завершенных голосований. После завершения голосований, результаты появятся здесь.
                </Card.Text>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>

      {/* Модальное окно подтверждения удаления */}
      <Modal show={showDeleteModal} onHide={cancelDeleteElection}>
        <Modal.Header closeButton>
          <Modal.Title>Подтверждение удаления</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {electionToDelete && (
            <p>Вы уверены, что хотите удалить голосование "{electionToDelete.name}"?</p>
          )}
          <p className="text-danger mb-0">Это действие нельзя отменить.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cancelDeleteElection}>
            Отмена
          </Button>
          <Button variant="danger" onClick={confirmDeleteElection}>
            Удалить
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default HomePage;
