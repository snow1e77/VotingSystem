import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Card, Form, Button, Container, Spinner, InputGroup, Row, Col } from 'react-bootstrap';
import blockchainService from '../services/blockchain';
import api from '../services/api';
import { showError, showSuccess, toast } from '../utils/toastUtils';

const CreateElectionPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [accountBalance, setAccountBalance] = useState(null);
  const [verifyingFunds, setVerifyingFunds] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  // Проверка, является ли пользователь администратором
  useEffect(() => {
    const checkAdminStatus = async () => {
      setIsCheckingAdmin(true);
      try {
        // Проверяем инициализацию блокчейн-сервиса
        if (!blockchainService.isInitialized()) {
          try {
            await blockchainService.initialize('0x1A0fAb9881D1B51A153039543dC7017eE644c794');
          } catch (error) {
            console.error('Ошибка инициализации блокчейн-сервиса:', error);
            setError('Не удалось подключиться к блокчейну. Пожалуйста, проверьте подключение кошелька.');
            setIsCheckingAdmin(false);
            return;
          }
        }
        
        // Получаем текущий аккаунт для отладки
        const account = await blockchainService.getCurrentAccount();
        console.log('Текущий аккаунт пользователя:', account);
        
        // Проверяем, является ли пользователь администратором
        const adminStatus = await blockchainService.isAdmin();
        console.log('Результат проверки админ-статуса:', adminStatus);
        setIsAdmin(adminStatus);
        
        if (!adminStatus) {
          setError('У вас нет прав администратора для создания голосования.');
          // Перенаправляем на главную страницу через 3 секунды
          setTimeout(() => {
            navigate('/');
          }, 3000);
        }
        
        // Получаем баланс аккаунта
        const balance = await blockchainService.getAccountBalance();
        setAccountBalance(balance);
      } catch (err) {
        console.error('Ошибка при проверке статуса администратора:', err);
        setError('Не удалось проверить права доступа.');
      } finally {
        setIsCheckingAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [navigate]);

  // Добавляем глобальный таймаут для предотвращения бесконечной загрузки
  useEffect(() => {
    const globalTimeout = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('Истекло время ожидания операции. Проверьте статус транзакции в MetaMask и обновите страницу.');
        toast.error('Истекло время ожидания, но транзакция могла быть отправлена. Проверьте MetaMask и обновите страницу.');
      }
    }, 120000); // 2 минуты максимального времени загрузки
    
    return () => clearTimeout(globalTimeout);
  }, [loading]);

  // Установка начальных значений для дат
  useEffect(() => {
    // Устанавливаем начальные значения для дат (текущую дату + 1 день и текущую + 7 дней)
    const now = new Date();
    
    // Дата начала (завтра)
    const startDateObj = new Date(now);
    startDateObj.setDate(now.getDate() + 1);
    startDateObj.setHours(0, 0, 0, 0);
    
    // Дата окончания (через неделю)
    const endDateObj = new Date(now);
    endDateObj.setDate(now.getDate() + 7);
    endDateObj.setHours(23, 59, 0, 0);
    
    // Форматируем даты для input[type="datetime-local"]
    setStartDate(formatDateForInput(startDateObj));
    setEndDate(formatDateForInput(endDateObj));
  }, []);

  // Форматирование даты для поля ввода datetime-local
  const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const addOption = () => {
    setOptions([...options, '']);
  };

  const removeOption = (index) => {
    if (options.length <= 2) {
      setError('Необходимо минимум 2 варианта ответа');
      return;
    }
    const newOptions = [...options];
    newOptions.splice(index, 1);
    setOptions(newOptions);
  };

  const verifyFunds = async () => {
    setVerifyingFunds(true);
    try {
      // Получаем текущий баланс
      const balance = await blockchainService.getAccountBalance();
      setAccountBalance(balance);
      
      // Получаем параметры для аккаунта
      const account = await blockchainService.getCurrentAccount();
      
      // Сначала попытаемся получить оценку газа от контракта
      const start = new Date(startDate);
      const end = new Date(endDate);
      const startTimeUnix = Math.floor(start.getTime() / 1000);
      const endTimeUnix = Math.floor(end.getTime() / 1000);
      
      // Добавляем метаданные с URL изображения в описание
      const metadataStr = JSON.stringify({ imageUrl });
      const descriptionWithMetadata = `${description}|metadata:${metadataStr}`;
      
      // Фильтруем пустые варианты
      const filteredOptions = options.filter(option => option.trim() !== '');
      
      // Блок try/catch для оценки газа
      let estimatedGas;
      try {
        console.log("Запрос оценки газа для создания голосования...");
        estimatedGas = await blockchainService.contract.methods.createElection(
          name,
          descriptionWithMetadata,
          startTimeUnix,
          endTimeUnix,
          filteredOptions
        ).estimateGas({ from: account });
        
        console.log(`Оценка газа успешно получена: ${estimatedGas} единиц газа`);
      } catch (estimateError) {
        console.warn("Не удалось получить точную оценку газа:", estimateError);
        // Используем значение по умолчанию, если оценка не удалась
        estimatedGas = 1000000; // Меньшее значение по умолчанию
        console.log(`Используем значение по умолчанию: ${estimatedGas} единиц газа`);
      }
      
      // Добавляем разумный запас к оценке (50%)
      const safeGasLimit = Math.floor(estimatedGas * 1.5);
      console.log(`Рекомендуемый лимит газа с запасом: ${safeGasLimit} единиц газа`);
      
      // Получаем оптимальную цену газа
      const gasPrice = await blockchainService.web3.eth.getGasPrice();
      const adjustedGasPrice = Math.floor(Number(gasPrice) * 1.5); // Используем 150% от текущей цены
      
      // Расчет стоимости транзакции с более точной оценкой газа
      const costEth = (adjustedGasPrice * safeGasLimit) / 1e18;
      
      // Проверяем, достаточно ли средств
      if (parseFloat(balance.ether) < costEth) {
        throw new Error(`Недостаточно средств на вашем счете. Для создания голосования требуется примерно ${costEth.toFixed(8)} ETH, а доступно ${balance.formatted}`);
      }
      
      // Показываем детальное подтверждение с точной оценкой газа
      const confirmed = window.confirm(
        `Вы собираетесь создать голосование "${name}".\n\n` +
        `Стоимость операции составит примерно ${costEth.toFixed(8)} ETH.\n\n` +
        `Продолжить?`
      );
      
      if (!confirmed) {
        console.log('Операция отменена пользователем');
        setLoading(false);
        return false;
      }
      
      // Сохраняем рекомендуемый лимит газа для использования в handleSubmit
      window.recommendedGasLimit = safeGasLimit;
      window.estimatedGasBasic = estimatedGas;
      
      return true;
    } catch (err) {
      console.error('Ошибка при проверке средств:', err);
      setError(err.message || 'Не удалось проверить наличие средств');
      return false;
    } finally {
      setVerifyingFunds(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    setError(null);
    setLoading(true);
    
    try {
      // Проверка на пустые поля
      if (!name.trim() || !description.trim() || !startDate || !endDate) {
        throw new Error('Заполните все обязательные поля');
      }
      
      // Проверка опций
      const filteredOptions = options.filter(o => o.trim() !== '');
      if (filteredOptions.length < 2) {
        throw new Error('Добавьте как минимум два варианта ответа');
      }
      
      // Повторная проверка наличия средств перед отправкой транзакции
      const fundsVerified = await verifyFunds();
      if (!fundsVerified) {
        setLoading(false);
        return;
      }
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      console.log('Отправляем данные для создания голосования:', {
        name,
        description,
        startDate: start,
        endDate: end,
        options: filteredOptions,
        imageUrl
      });
      
      // Добавляем метаданные с URL изображения в описание
      const metadataStr = JSON.stringify({ imageUrl });
      const descriptionWithMetadata = imageUrl ? `${description}|metadata:${metadataStr}` : description;
      
      // Создаем максимальный таймаут для операции
      let timeoutId = setTimeout(() => {
        setLoading(false);
        setError('Операция заняла слишком много времени. Проверьте MetaMask и статус транзакции.');
      }, 90000); // 1.5 минуты максимум
      
      // Отправляем транзакцию в блокчейн
      try {
        const receipt = await blockchainService.createElection(
          name, 
          descriptionWithMetadata, 
          start, 
          end, 
          filteredOptions
        );
        
        clearTimeout(timeoutId);
        
        console.log('Транзакция успешно выполнена:', receipt);
        setTransactionHash(receipt.transactionHash);
        
        try {
          // Сохраняем голосование в БД через API для индексирования и отображения результатов
          const apiRequest = {
            blockchainId: -1, // Будет установлен правильный ID после синхронизации
            name: name,
            description: description,
            startTime: start,
            endTime: end,
            options: filteredOptions,
            creatorAddress: await blockchainService.getCurrentAccount(),
            transactionHash: receipt.transactionHash,
            imageUrl: imageUrl || null,
            createdGaslessly: false
          };
          
          console.log('Сохраняем голосование в БД:', apiRequest);
          
          const response = await api.post('/api/election', apiRequest);
          console.log('API ответ:', response.data);
          
          showSuccess('Голосование успешно создано!');
          
          // Редирект на главную страницу через 2 секунды
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } catch (apiError) {
          console.error('Ошибка сохранения в БД:', apiError);
          toast.warning('Голосование создано в блокчейне, но не удалось сохранить детали в базе данных.');
          setTimeout(() => {
            navigate('/');
          }, 3000);
        }
      } catch (txError) {
        clearTimeout(timeoutId);
        console.error('Ошибка создания голосования:', txError);
        
        // Более удобные сообщения об ошибках
        if (txError.message.includes('User denied')) {
          throw new Error('Вы отменили транзакцию в MetaMask');
        } else if (txError.message.includes('insufficient funds')) {
          throw new Error('Недостаточно средств на вашем аккаунте для оплаты транзакции');
        } else {
          throw txError;
        }
      }
    } catch (err) {
      console.error('Ошибка:', err);
      setError(err.message || 'Произошла ошибка при создании голосования');
      showError(err.message || 'Произошла ошибка при создании голосования');
    } finally {
      setLoading(false);
    }
  };

  // Если проверяем права администратора, показываем спиннер
  if (isCheckingAdmin) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3">Проверка прав доступа...</p>
        </div>
      </Container>
    );
  }

  // Если пользователь не администратор, показываем сообщение об ошибке
  if (!isAdmin) {
    return (
      <Container className="py-4">
        <Alert variant="danger">
          <Alert.Heading>Доступ запрещен</Alert.Heading>
          <p>У вас нет прав администратора для создания голосования.</p>
          <p>Вы будете перенаправлены на главную страницу через несколько секунд...</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h1 className="mb-4">Создание нового голосования</h1>
      
      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      
      {transactionHash ? (
        <Alert variant="success" className="mb-4">
          <Alert.Heading>Голосование успешно создано!</Alert.Heading>
          <p>Ваша транзакция обрабатывается в блокчейне.</p>
          <hr />
          <p className="mb-0">
            Хеш транзакции: <code>{transactionHash}</code>
          </p>
          <p className="mt-3">
            Вы будете перенаправлены на главную страницу через несколько секунд...
          </p>
        </Alert>
      ) : (
        <Card className="shadow-sm">
          <Card.Body>
            <Form onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }}>
              <Form.Group className="mb-3">
                <Form.Label>Название голосования*</Form.Label>
                <Form.Control
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Введите название голосования"
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>Описание*</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите суть голосования"
                  required
                />
              </Form.Group>
              
              <Form.Group className="mb-3">
                <Form.Label>URL изображения (опционально)</Form.Label>
                <Form.Control
                  type="text"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                <Form.Text className="text-muted">
                  Ссылка на изображение, которое будет отображаться в карточке голосования
                </Form.Text>
              </Form.Group>
              
              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Дата начала*</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Дата окончания*</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                    />
                  </Form.Group>
                </Col>
              </Row>
              
              <Form.Group className="mb-4">
                <Form.Label>Варианты ответа*</Form.Label>
                {options.map((option, index) => (
                  <InputGroup key={index} className="mb-2">
                    <Form.Control
                      type="text"
                      value={option}
                      onChange={(e) => handleOptionChange(index, e.target.value)}
                      placeholder={`Вариант ${index + 1}`}
                      required
                    />
                    {options.length > 2 && (
                      <Button 
                        variant="outline-danger" 
                        onClick={() => removeOption(index)}
                      >
                        Удалить
                      </Button>
                    )}
                  </InputGroup>
                ))}
                <Button
                  variant="outline-secondary"
                  onClick={addOption}
                  className="mt-2"
                >
                  Добавить вариант
                </Button>
              </Form.Group>
              
              {accountBalance && (
                <Alert variant="info" className="mb-4">
                  <small>
                    Баланс вашего кошелька: <strong>{accountBalance.formatted}</strong>
                  </small>
                </Alert>
              )}
              
              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || verifyingFunds}
                  className="py-2"
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
                      Создание голосования...
                    </>
                  ) : verifyingFunds ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                        className="me-2"
                      />
                      Проверка средств...
                    </>
                  ) : (
                    'Создать голосование'
                  )}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default CreateElectionPage; 