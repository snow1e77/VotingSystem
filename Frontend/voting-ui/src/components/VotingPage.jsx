import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Spinner, Row, Col, Modal } from 'react-bootstrap';
import blockchainService from '../services/blockchain';
import api from '../services/api';
import WalletConnector from './WalletConnector';
import electronService from '../services/ElectronService';
import { formatDate } from '../utils/formatter';
import { FiBarChart2, FiCheckCircle, FiUser, FiClock, FiCopy } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import voteIcon from '../assets/images/vote-icon.svg';

// Используем переменную окружения или значение по умолчанию
const CONTRACT_ADDRESS = process.env.REACT_APP_CONTRACT_ADDRESS || '0x1A0fAb9881D1B51A153039543dC7017eE644c794';

const VotingPage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOption, setSelectedOption] = useState(-1);
  const [voteSuccess, setVoteSuccess] = useState(false);
  const [secretHash, setSecretHash] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isWalletVerified, setIsWalletVerified] = useState(false);
  const [walletUserData, setWalletUserData] = useState(null);
  const [transactionInProgress, setTransactionInProgress] = useState(false);
  const [hasVoted, setHasVoted] = useState(false);
  const [voteTimestamp, setVoteTimestamp] = useState(0);
  const [results, setResults] = useState([]);
  
  // Добавляем обработчик handleWalletSuccess в глобальную область видимости
  useEffect(() => {
    // Создаем глобальный обработчик для вызова из WalletConnector
    window.handleWalletSuccess = (userData) => {
      handleWalletSuccess(userData);
    };
    
    // Очищаем обработчик при размонтировании компонента
    return () => {
      window.handleWalletSuccess = null;
    };
  }, []);
  
  // Инициализация блокчейн-сервиса при монтировании компонента
  useEffect(() => {
    const initializeBlockchain = async () => {
      if (!blockchainService.isInitialized()) {
        try {
          console.log('Инициализация блокчейн-сервиса в VotingPage...');
          await blockchainService.initialize(CONTRACT_ADDRESS);
          console.log('Блокчейн-сервис успешно инициализирован');
        } catch (error) {
          console.error('Ошибка при инициализации блокчейн-сервиса:', error);
          setError('Не удалось инициализировать блокчейн-сервис: ' + error.message);
        }
      }
    };

    initializeBlockchain();
  }, []);
  
  const fetchElection = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Проверяем инициализацию блокчейн-сервиса
      if (!blockchainService.isInitialized()) {
        try {
          await blockchainService.initialize(CONTRACT_ADDRESS);
        } catch (initError) {
          throw new Error('Не удалось инициализировать блокчейн-сервис: ' + initError.message);
        }
      }
      
      // Преобразуем ID в число для совместимости
      let electionIdNum;
      try {
        if (typeof electionId === 'string') {
          electionIdNum = parseInt(electionId.match(/\d+/)[0], 10);
        } else {
          electionIdNum = parseInt(electionId, 10);
        }
      } catch (parseError) {
        throw new Error('Недопустимый формат ID голосования: ' + electionId);
      }
      
      if (isNaN(electionIdNum)) {
        throw new Error('ID голосования не является числом');
      }
      
      console.log('Загрузка голосования с ID:', electionIdNum);
      
      // Получаем данные о голосовании
      const electionData = await blockchainService.getElectionDetails(electionIdNum);
      if (!electionData) {
        throw new Error('Голосование не найдено');
      }
      
      console.log('Получены данные о голосовании:', electionData);
      
      // Форматируем даты
      const startTimeObj = new Date(parseInt(electionData.startTime) * 1000);
      const endTimeObj = new Date(parseInt(electionData.endTime) * 1000);
      
      // Проверяем, голосовал ли текущий пользователь
      let userHasVoted = false;
      try {
        // Получаем адрес кошелька
        const account = await blockchainService.getCurrentAccount();
        if (account) {
          // Проверяем, голосовал ли данный аккаунт
          userHasVoted = await blockchainService.hasVoted(electionIdNum, account);
          console.log('Этот аккаунт уже голосовал?', userHasVoted);
          setHasVoted(userHasVoted);
        }
      } catch (voteCheckError) {
        console.error('Ошибка при проверке голосования:', voteCheckError);
      }
      
      // Получаем изображение или используем стандартное
      let imageUrl = '/assets/images/vote-icon.svg';
      if (electionData.metadata && electionData.metadata.imageUrl) {
        imageUrl = electionData.metadata.imageUrl;
      }
      
      // Обрабатываем варианты ответов
      const optionsData = electionData.options.map((option, index) => {
        return {
          id: index,
          text: option
        };
      });
      
      // Создаем объект с данными о голосовании
      const formattedElection = {
        id: electionIdNum,
        name: electionData.name,
        description: electionData.description || 'Нет описания',
        creator: electionData.creator,
        startTime: startTimeObj,
        endTime: endTimeObj,
        options: optionsData,
        finalized: electionData.finalized || false,
        image: imageUrl
      };
      
      setElection(formattedElection);
      
      // Если голосование финализировано, также получаем результаты
      if (electionData.finalized) {
        try {
          const resultsData = await blockchainService.getElectionResults(electionIdNum);
          
          // Преобразуем результаты для использования в диаграмме
          if (resultsData && resultsData.votes) {
            const processedResults = optionsData.map((option, index) => {
              return {
                option: option.text,
                votes: resultsData.votes[index] || 0
              };
            });
            
            setResults(processedResults);
          }
        } catch (resultsError) {
          console.error('Ошибка при получении результатов голосования:', resultsError);
        }
      }
    } catch (err) {
      console.error('Ошибка при загрузке данных о голосовании:', err);
      setError('Не удалось загрузить детали голосования: ' + (err.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  }, [electionId]);

  useEffect(() => {
    fetchElection();
  }, [fetchElection]);

  const handleVote = async (e) => {
    e.preventDefault();
    
    if (!election || selectedOption < 0 || !isWalletVerified) {
      setError('Пожалуйста, выберите вариант ответа и пройдите верификацию');
      return;
    }
    
    try {
      // Проверяем инициализацию блокчейн-сервиса перед голосованием
      if (!blockchainService.isInitialized()) {
        try {
          await blockchainService.initialize(CONTRACT_ADDRESS);
        } catch (initError) {
          throw new Error('Не удалось инициализировать блокчейн-сервис: ' + initError.message);
        }
      }
      
      // Получаем текущий баланс
      const balance = await blockchainService.getAccountBalance();
      
      // Используем более высокое значение газа для голосования чем раньше
      /* global BigInt */
      const gasPrice = await blockchainService.web3.eth.getGasPrice();
      const adjustedGasPrice = (BigInt(gasPrice) * BigInt(150) / BigInt(100)).toString();
      const gasLimit = 500000; // Значительно увеличенный лимит газа
      
      // Расчет стоимости транзакции
      const costEth = Number(BigInt(adjustedGasPrice) * BigInt(gasLimit)) / 1e18;
      
      // Проверяем, достаточно ли средств
      if (parseFloat(balance.ether) < costEth) {
        throw new Error(`Недостаточно средств на вашем счете. Для голосования требуется примерно ${costEth.toFixed(8)} ETH, а доступно ${balance.formatted}`);
      }
      
      // Показываем подтверждение с указанием стоимости
      const confirmed = window.confirm(
        `Ваш голос будет отправлен в блокчейн.\n\n` +
        `Стоимость операции составит примерно ${costEth.toFixed(8)} ETH.\n\n` +
        `Продолжить?`
      );
      
      if (!confirmed) {
        console.log('Операция отменена пользователем');
        return;
      }
      
      // Начинаем процесс голосования
      setLoading(true);
      setTransactionInProgress(true);
      
      // Создаем случайный секрет для голосования
      const voterSecret = blockchainService.generateSalt();
      
      // Подготавливаем данные для голосования
      const blindedVote = await blockchainService.generateBlindedVote(selectedOption, voterSecret);
      const secretHash = blockchainService.web3.utils.keccak256(voterSecret);
      
      // Преобразуем electionId в число, если это еще не сделано
      let electionIdNum;
      if (typeof electionId === 'string') {
        electionIdNum = parseInt(electionId.match(/\d+/)[0], 10);
      } else {
        electionIdNum = parseInt(electionId, 10);
      }
      
      console.log('Подготовлены данные для голосования:', {
        electionId: electionIdNum,
        selectedOption,
        blindedVote,
        secretHash
      });
        
      // Отправляем голос с помощью блокчейн-сервиса
      const receipt = await blockchainService.vote(electionIdNum, blindedVote, secretHash);
      
      // Получаем хеш транзакции
      const transactionHash = receipt.transactionHash;
      setSecretHash(transactionHash);
      
      console.log('Голос успешно отправлен, хеш транзакции:', transactionHash);
          
      // Записываем результат в API для возможной проверки в будущем
      try {
        await api.castVote({
          electionId: electionIdNum,
          transactionHash,
          secretHash,
          identityHash: walletUserData?.identityHash || secretHash.substring(0, 10)
        });
      } catch (apiError) {
        console.error('Ошибка при записи голоса в API:', apiError);
        // Не прерываем процесс, поскольку транзакция уже отправлена
      }
      
      setVoteSuccess(true);
      setHasVoted(true);
      setVoteTimestamp(Math.floor(Date.now() / 1000));
      
      // Автоматически обновляем данные о голосовании через несколько секунд
      setTimeout(() => {
        fetchElection();
      }, 3000);
    } catch (err) {
      console.error('Ошибка при голосовании:', err);
      
      // Проверка на отмену операции пользователем
      if (err.isCancelled || 
          (err.message && err.message.includes('отменена пользователем')) || 
          (err.code === 4001) || 
          (err.message && err.message.includes('User denied'))) {
        console.log('Пользователь отменил операцию');
        // Не показываем ошибку при сознательной отмене пользователем
        setError(null);
      } else if (err.message && err.message.includes('Тайм-аут транзакции')) {
        // Обработка таймаута транзакции
        setError('Время ожидания ответа от блокчейна истекло. Проверьте статус транзакции в MetaMask и обновите страницу.');
      } else {
        // Обработка специфических ошибок
        if (err.message && err.message.includes('Election does not exist')) {
          setError('Голосование не найдено. Возможно, оно было удалено или еще не создано.');
        } else if (err.message && err.message.includes('Already voted')) {
          setError('Вы уже проголосовали в этом голосовании.');
        } else if (err.message && err.message.includes('Ошибка контракта:')) {
          setError('Ошибка выполнения контракта: ' + err.message);
        } else {
          setError('Не удалось отправить ваш голос: ' + (err.message || 'Неизвестная ошибка'));
        }
      }
    } finally {
      setLoading(false);
      setTransactionInProgress(false);
    }
  };
  
  const handleRevokeVote = async () => {
    try {
      if (!blockchainService.isInitialized()) {
        try {
          await blockchainService.initialize(CONTRACT_ADDRESS);
        } catch (initError) {
          throw new Error('Не удалось инициализировать блокчейн-сервис: ' + initError.message);
        }
      }
      
      // Преобразуем electionId в число, если это еще не сделано
      let electionIdNum;
      if (typeof electionId === 'string') {
        const matches = electionId.match(/\d+/);
        if (matches && matches.length > 0) {
          electionIdNum = parseInt(matches[0], 10);
        } else {
          throw new Error('Неверный формат ID голосования');
        }
      } else {
        electionIdNum = parseInt(electionId, 10);
      }
      
      // Получаем текущее время и проверяем, не закончилось ли голосование
      const now = Math.floor(Date.now() / 1000);
      const endTime = new Date(election.endTime).getTime() / 1000;
      
      if (now > endTime) {
        throw new Error('Голосование уже завершено, отзыв голоса невозможен');
      }
      
      // Расчитываем стоимость транзакции
      const balance = await blockchainService.getAccountBalance();
      const gasPrice = await blockchainService.web3.eth.getGasPrice();
      const gasLimit = 200000;
      const costEth = Number(BigInt(gasPrice) * BigInt(gasLimit)) / 1e18;
      
      // Проверяем, достаточно ли средств
      if (parseFloat(balance.ether) < costEth) {
        throw new Error(`Недостаточно средств на вашем счете. Для отзыва голоса требуется примерно ${costEth.toFixed(8)} ETH, а доступно ${balance.formatted}`);
      }
      
      // Показываем подтверждение
      const confirmed = window.confirm(
        `Вы действительно хотите отозвать свой голос? Это действие нельзя будет отменить. Стоимость операции составит примерно ${costEth.toFixed(8)} ETH.`
      );
      
      if (!confirmed) {
        console.log('Операция отменена пользователем');
        return;
      }
      
      // Начинаем процесс отзыва голоса
      setLoading(true);
      setTransactionInProgress(true);
      
      // Отправляем транзакцию отзыва голоса
      const receipt = await blockchainService.revokeVote(electionIdNum);
      
      console.log('Голос успешно отозван, хеш транзакции:', receipt.transactionHash);
      
      // Обновляем состояние
      setHasVoted(false);
      setVoteTimestamp(0);
      setVoteSuccess(false);
      setError(null);
      
      // Показываем сообщение об успешном отзыве
      alert('Ваш голос был успешно отозван.');
      
    } catch (err) {
      console.error('Ошибка при отзыве голоса:', err);
      
      // Если пользователь отменил операцию, не показываем ошибку
      if (err.isCancelled || 
          (err.message && err.message.includes('отменена пользователем')) || 
          (err.code === 4001) || 
          (err.message && err.message.includes('User denied'))) {
        console.log('Пользователь отменил операцию');
      } else if (err.message && err.message.includes('Тайм-аут транзакции')) {
        // Обработка таймаута транзакции
        setError('Время ожидания ответа от блокчейна истекло. Проверьте статус транзакции отзыва в MetaMask и обновите страницу.');
      } else {
        setError('Не удалось отозвать ваш голос: ' + (err.message || 'Неизвестная ошибка'));
      }
    } finally {
      setLoading(false);
      setTransactionInProgress(false);
    }
  };

  // Обработчик успешной аутентификации через криптокошелек
  const handleWalletSuccess = (userData) => {
    setIsWalletVerified(true);
    setWalletUserData(userData);
    console.log('Пользователь успешно верифицирован через криптокошелек:', userData);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Хеш транзакции скопирован в буфер обмена');
    }).catch(err => {
      console.error('Не удалось скопировать текст: ', err);
    });
  };

  // Эта функция больше не используется для отображения сообщений
  // так как мы используем более точный renderStatus
  const getElectionStatusMessage = () => {
    return null;
  };

  const renderAuthSection = () => {
    if (isWalletConnected) {
      return (
        <div className="mb-4">
          <Alert variant="success" className="d-flex justify-content-between align-items-center">
            <div>
              <FiUser className="me-2" />
              Кошелек: <strong>{walletAddress.substring(0, 8)}...{walletAddress.substring(walletAddress.length - 8)}</strong>
              <Button variant="link" size="sm" className="p-0 ms-2" onClick={() => copyToClipboard(walletAddress)} title="Скопировать адрес">
                <FiCopy />
              </Button>
            </div>
            <div>
              <Button variant="outline-primary" size="sm" onClick={() => window.location.reload()}>
                Обновить
              </Button>
            </div>
          </Alert>
        </div>
      );
    } else {
      return (
        <div className="mb-4 auth-section">
          <Card className="shadow-sm border-0">
            <Card.Body className="p-4">
              <Card.Title>Аутентификация избирателя</Card.Title>
              <Card.Text>
                Для участия в голосовании необходимо подключить криптокошелек. Это обеспечивает безопасность и анонимность вашего голоса через технологию блокчейн.
              </Card.Text>
              
              <div className="my-3">
                <WalletConnector 
                  onConnected={(address) => {
                    setWalletAddress(address);
                    setIsWalletConnected(true);
                    // Не вызываем обновление данных здесь, чтобы избежать циклических вызовов
                  }} 
                  isConnectedCallback={(status) => setIsWalletConnected(status)}
                />
              </div>
            </Card.Body>
          </Card>
        </div>
      );
    }
  };

  const renderStatus = () => {
    const now = Math.floor(Date.now() / 1000);
    const startTime = new Date(election.startTime).getTime() / 1000;
    const endTime = new Date(election.endTime).getTime() / 1000;
    
    console.log('renderStatus - сравнение времени:');
    console.log('Текущее время (unix):', now);
    console.log('Время начала (unix):', startTime);
    console.log('Время окончания (unix):', endTime);
    console.log('now >= startTime:', now >= startTime);
    console.log('now <= endTime:', now <= endTime);
    console.log('election.isActive:', election.isActive);
    
    if (election.finalized) {
      return (
        <Alert variant="info">
          <strong>Голосование финализировано в блокчейне.</strong> Результаты доступны на странице результатов.
        </Alert>
      );
    } else if (now >= startTime && now <= endTime && !election.finalized) {
      return (
        <Alert variant="success">
          Голосование активно. Вы можете проголосовать. 
          (Началось: {formatDate(new Date(election.startTime))})
        </Alert>
      );
    } else if (now < startTime) {
      return (
        <Alert variant="warning">
          <Alert.Heading>Голосование еще не началось</Alert.Heading>
          <p>
            Голосование начнется {formatDate(new Date(election.startTime))}.
            Пожалуйста, вернитесь позже для участия.
          </p>
        </Alert>
      );
    } else if (now > endTime) {
      return (
        <Alert variant="warning">
          <Alert.Heading>Время голосования истекло</Alert.Heading>
          <p>
            Голосование завершилось {formatDate(new Date(election.endTime))}, но администратор еще не финализировал результаты.
            После финализации результаты будут доступны на странице результатов.
          </p>
        </Alert>
      );
    } else {
      return (
        <Alert variant="danger">
          <Alert.Heading>Голосование недоступно</Alert.Heading>
          <p>
            По техническим причинам голосование сейчас недоступно. Пожалуйста, попробуйте позже.
          </p>
        </Alert>
      );
    }
  };

  // Расчет статуса голосования для условного рендеринга
  const getVotingStatus = () => {
    if (!election) return { isActive: false, isCompleted: false };
    
    const now = Math.floor(Date.now() / 1000);
    const startTime = new Date(election.startTime).getTime() / 1000;
    const endTime = new Date(election.endTime).getTime() / 1000;
    
    // Голосование активно, если не завершено и текущее время между началом и концом
    const isActive = !election.finalized && startTime <= now && now <= endTime;
    // Голосование считается завершенным, если finalized 
    // (только если явно финализировано, а не просто по времени)
    const isCompleted = election.finalized;
    
    return { isActive, isCompleted, now, startTime, endTime };
  };
  
  return (
    <Container className="voting-page py-5">
      {loading ? (
        <div className="text-center py-5">
          <Spinner animation="border" role="status" variant="primary">
            <span className="visually-hidden">Загрузка...</span>
          </Spinner>
          <p className="mt-3">Загрузка данных о голосовании...</p>
        </div>
      ) : error ? (
        <Alert variant="danger" className="mb-4">
          <Alert.Heading>Ошибка</Alert.Heading>
          <p>{error}</p>
          <hr />
          <div className="d-flex justify-content-end">
            <Button variant="outline-danger" onClick={fetchElection}>
              Повторить
            </Button>
          </div>
        </Alert>
      ) : election ? (
        <>
          <Row className="mb-4">
            <Col md={{ span: 10, offset: 1 }}>
              <Card className="shadow">
                <Card.Header as="h5" className="bg-primary text-white">
                  {election.name}
                </Card.Header>
                <Card.Body>
                  <Row>
                    <Col md={4} className="mb-3 mb-md-0">
                      <div className="text-center">
                        <img 
                          src={election.image || voteIcon} 
                          alt={election.name}
                          className="img-fluid rounded mb-3"
                          style={{ maxHeight: '200px', width: 'auto' }}
                          onError={(e) => {
                            e.target.src = voteIcon;
                          }}
                        />
                      </div>
                    </Col>
                    <Col md={8}>
                      <Card.Text>
                        {election.description}
                      </Card.Text>
                      <div className="mb-3">
                        <div className="d-flex justify-content-between mb-2">
                          <strong>Начало:</strong> 
                          <span>{formatDate(new Date(election.startTime))}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <strong>Окончание:</strong> 
                          <span>{formatDate(new Date(election.endTime))}</span>
                        </div>
                      </div>
                      <div>
                        {renderStatus()}
                      </div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Проверяем состояние голосования */}
          {election.isCompleted ? (
            // Завершенное голосование - показываем результаты или сообщение
            <Row>
              <Col md={{ span: 10, offset: 1 }}>
                <Card className="shadow">
                  <Card.Header as="h5" className="bg-secondary text-white">
                    <FiBarChart2 className="me-2" />
                    Результаты голосования
                  </Card.Header>
                  <Card.Body>
                    <Alert variant="info">
                      Голосование завершено. Результаты будут доступны после подсчета голосов.
                    </Alert>
                    <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                      <Button 
                        as={Link} 
                        to={`/results/${electionId}`} 
                        variant="primary"
                      >
                        Перейти к результатам
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : hasVoted ? (
            // Пользователь уже проголосовал - показываем информацию о его голосе
            <Row>
              <Col md={{ span: 10, offset: 1 }}>
                <Card className="shadow">
                  <Card.Header as="h5" className="bg-success text-white">
                    <FiCheckCircle className="me-2" />
                    Ваш голос учтен
                  </Card.Header>
                  <Card.Body>
                    <Alert variant="success">
                      <Alert.Heading>Спасибо за участие в голосовании!</Alert.Heading>
                      <p>
                        Ваш голос успешно записан в блокчейн. После завершения голосования вы сможете увидеть результаты.
                      </p>
                      {voteTimestamp && (
                        <p className="mb-0">
                          <strong>Время голосования:</strong> {formatDate(new Date(voteTimestamp * 1000))}
                        </p>
                      )}
                    </Alert>
                    <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                      <Button 
                        variant="outline-primary" 
                        as={Link} 
                        to="/"
                      >
                        Вернуться к списку голосований
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          ) : getVotingStatus().isActive ? (
            // Активное голосование, пользователь еще не голосовал
            <Row>
              <Col md={{ span: 10, offset: 1 }}>
                <Card className="shadow">
                  <Card.Header as="h5" className="bg-primary text-white">
                    <FiUser className="me-2" />
                    Примите участие в голосовании
                  </Card.Header>
                  <Card.Body>
                    <Form onSubmit={handleVote}>
                      <Form.Group className="mb-4">
                        <Form.Label as="h5">Выберите вариант:</Form.Label>
                        {election.options.map((option, index) => (
                          <Form.Check
                            key={index}
                            type="radio"
                            id={`option-${index}`}
                            name="voteOption"
                            label={option.text}
                            className="mb-2 vote-option"
                            onChange={() => setSelectedOption(index)}
                            checked={selectedOption === index}
                          />
                        ))}
                      </Form.Group>
                      
                      {renderAuthSection()}
                      
                      <div className="d-grid gap-2 d-md-flex justify-content-md-end mt-4">
                        <Button 
                          variant="outline-secondary" 
                          as={Link} 
                          to="/"
                          className="me-md-2"
                        >
                          Назад
                        </Button>
                        <Button 
                          type="submit" 
                          variant="primary"
                          disabled={selectedOption < 0 || loading || !isWalletVerified}
                        >
                          {loading ? (
                            <>
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                                className="me-2"
                              />
                              Отправка голоса...
                            </>
                          ) : (
                            'Проголосовать'
                          )}
                        </Button>
                      </div>
                    </Form>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
                    ) : (
            // Голосование не активно (либо не началось, либо завершено)
            <Row>
              <Col md={{ span: 10, offset: 1 }}>
                <Card className="shadow">
                  <Card.Header as="h5" className="bg-warning text-dark">
                    <FiClock className="me-2" />
                    {getVotingStatus().now < getVotingStatus().startTime ? "Голосование еще не началось" : 
                      getVotingStatus().now > getVotingStatus().endTime ? "Время голосования истекло" : "Голосование недоступно"}
                  </Card.Header>
                  <Card.Body>
                    {renderStatus()}
                    <div className="d-grid gap-2 d-md-flex justify-content-md-end">
                      <Button 
                        variant="outline-primary" 
                        as={Link} 
                        to="/"
                      >
                        Вернуться к списку голосований
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}
          
          {/* Показываем модальное окно успешного голосования */}
          <Modal show={voteSuccess} onHide={() => setVoteSuccess(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Голос принят</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <div className="text-center mb-3">
                <FiCheckCircle size={48} className="text-success mb-3" />
                <h4>Ваш голос успешно отправлен!</h4>
                <p>Ваш голос был зашифрован и записан в блокчейн Ethereum.</p>
                
                {secretHash && (
                  <div className="mt-3 mb-3">
                    <p className="mb-1"><strong>Хеш транзакции:</strong></p>
                    <div className="secret-hash-container p-2 border rounded bg-light">
                      <small className="text-break">{secretHash}</small>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="ms-2"
                        onClick={() => copyToClipboard(secretHash)}
                      >
                        <FiCopy />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setVoteSuccess(false)}>
                Закрыть
              </Button>
              <Button variant="primary" as={Link} to="/">
                К списку голосований
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      ) : (
        <Alert variant="warning">
          <Alert.Heading>Информация о голосовании не найдена</Alert.Heading>
          <p>Не удалось загрузить данные о голосовании. Возможно, голосование было удалено или еще не создано.</p>
          <div className="d-grid gap-2 d-md-flex justify-content-md-end">
            <Button 
              variant="outline-primary" 
              as={Link} 
              to="/"
            >
              Вернуться к списку голосований
            </Button>
          </div>
        </Alert>
      )}
    </Container>
  );
};

export default VotingPage; 