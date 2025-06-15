import Web3 from 'web3';
import VotingABI from '../contracts/VotingABI.json';

class BlockchainService {
  constructor() {
    this.web3 = null;
    this.contract = null;
    this.contractAddress = null;
    this.initialized = false;
    this.initializationAttempted = false;
  }

  async initialize(contractAddress, silent = false) {
    try {
      this.initializationAttempted = true;
      
      // Проверяем, доступен ли провайдер Web3 (MetaMask или другие совместимые с EIP-1193)
      if (window.ethereum) {
        console.log('Найден провайдер Ethereum');
        // Web3 v4: создаем экземпляр с провайдером window.ethereum
        this.web3 = new Web3(window.ethereum);
        try {
          // Запрашиваем разрешение на доступ к аккаунтам пользователя
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          console.log('Подключенные аккаунты:', accounts);
          
          // Проверяем подключенную сеть
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          console.log('Подключенная сеть (chainId):', chainId);
          
          // Проверяем, что это тестовая сеть Sepolia (chainId: 0xaa36a7) или Goerli (chainId: 0x5)
          if (chainId !== '0xaa36a7' && chainId !== '0x5') {
            console.warn('Вы подключены не к тестовой сети Ethereum (Sepolia или Goerli)');
            if (!silent) {
              alert('Для работы с приложением подключитесь к тестовой сети Sepolia или Goerli в MetaMask');
            }
          }
        } catch (error) {
          console.error('Пользователь отклонил доступ к аккаунтам:', error);
          throw new Error('Пожалуйста, предоставьте доступ к вашему кошельку для использования блокчейн-голосования');
        }
      } 
      // Пробуем использовать удаленный провайдер, если локальный не доступен
      else {
        console.log('Провайдер Ethereum не найден, использую публичный RPC');
        const provider = new Web3.providers.HttpProvider('https://sepolia.infura.io/v3/72ea578fc2dd47549a039528687c8a7a');
        this.web3 = new Web3(provider);
        console.warn('Используется удаленный Web3 провайдер. Некоторые функции могут быть недоступны.');
      }

      // Убедимся, что мы подключены
      const accounts = await this.web3.eth.getAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error('Не удалось получить доступ к аккаунтам. Убедитесь, что вы разрешили доступ к кошельку.');
      }

      this.contractAddress = contractAddress;
      // Web3 v4: создаем контракт с новым синтаксисом
      this.contract = new this.web3.eth.Contract(VotingABI, contractAddress);
      this.initialized = true;
      
      // Устанавливаем слушатель событий на изменение аккаунта
      if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
          console.log('Аккаунт изменен на:', accounts[0]);
          // Можно выполнить нужные действия при смене аккаунта
        });
      }
      
      return true;
    } catch (error) {
      console.error('Ошибка инициализации Web3:', error);
      this.initialized = false;
      throw error;
    }
  }

  isInitialized() {
    return this.initialized;
  }

  wasInitializationAttempted() {
    return this.initializationAttempted;
  }

  async getCurrentAccount() {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    const accounts = await this.web3.eth.getAccounts();
    return accounts[0];
  }

  // Извлечение метаданных из строки описания
  extractMetadataFromDescription(description) {
    try {
      // Проверяем, содержит ли описание маркер метаданных
      if (description && description.includes('|metadata:')) {
        const [actualDescription, metadataStr] = description.split('|metadata:');
        const metadata = JSON.parse(metadataStr);
        return {
          description: actualDescription.trim(),
          metadata: metadata
        };
      }
      return {
        description: description,
        metadata: null
      };
    } catch (error) {
      console.error('Ошибка при извлечении метаданных из описания:', error);
      return {
        description: description,
        metadata: null
      };
    }
  }

  async getElectionInfo(electionId) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    if (electionId === undefined || electionId === null) {
      throw new Error('Invalid election ID: undefined');
    }
    
    // Более надежная обработка ID голосования
    let electionIdNum;
    if (typeof electionId === 'number') {
      electionIdNum = electionId;
    } else {
      // Пытаемся получить число из строки
      electionIdNum = parseInt(electionId, 10);
      
      // Если не получилось, пробуем найти любые числа в строке
      if (isNaN(electionIdNum)) {
        const matches = String(electionId).match(/\d+/);
        if (matches && matches.length > 0) {
          electionIdNum = parseInt(matches[0], 10);
          console.log(`Извлечен ID голосования ${electionIdNum} из параметра ${electionId}`);
        } else {
          throw new Error(`Invalid election ID: ${electionId} is not a number`);
        }
      }
    }
    
    try {
      // Get total elections count to validate ID
      const totalElections = await this.contract.methods.electionCount().call();
      
      if (electionIdNum >= totalElections) {
        throw new Error(`Election with ID ${electionIdNum} does not exist. Total elections: ${totalElections}`);
      }
      
      // Get election data using getElectionInfo instead of getElection
      const electionData = await this.contract.methods.getElectionInfo(electionIdNum).call();
      
      // Check if returned data is valid
      if (!electionData || !electionData.name) {
        throw new Error(`Failed to retrieve election data for ID ${electionIdNum}`);
      }
      
      const name = electionData.name;
      const description = electionData.description || '';
      const startTime = parseInt(electionData.startTime);
      const endTime = parseInt(electionData.endTime);
      const options = electionData.options || [];
      const resultsCalculated = electionData.resultsCalculated || false;
      
      // Extract metadata (image URL, etc.) if present
      const metadata = this.extractMetadataFromDescription(description);
      
      return {
        id: electionIdNum,
        name,
        description: metadata.description,
        metadata: metadata.metadata,
        startTime,
        endTime,
        options,
        resultsCalculated
      };
    } catch (error) {
      console.error(`Ошибка при получении информации о голосовании ${electionId}:`, error);
      throw new Error(`Не удалось загрузить детали голосования: ${error.message}`);
    }
  }

  // Добавляем метод getElectionDetails как алиас для getElectionInfo для обеспечения совместимости
  async getElectionDetails(electionId) {
    console.log('Вызов getElectionDetails для ID:', electionId);
    try {
      return await this.getElectionInfo(electionId);
    } catch (error) {
      console.error('Ошибка в getElectionDetails:', error);
      throw error;
    }
  }

  async vote(electionId, blindedVote, secretHash) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      const account = await this.getCurrentAccount();
      console.log(`Отправка голоса с аккаунта ${account} для голосования ${electionId}`);
      console.log(`Параметры: blindedVote=${blindedVote.substring(0, 10)}..., secretHash=${secretHash.substring(0, 10)}...`);
      
      // Проверяем, что голосование существует
      try {
        const electionInfo = await this.getElectionInfo(electionId);
        console.log('Информация о голосовании получена:', electionInfo);
        
        // Проверяем активность голосования
        const now = Date.now();
        if (now < electionInfo.startTime * 1000) {
          throw new Error(`Голосование еще не началось. Начало: ${new Date(electionInfo.startTime * 1000)}`);
        }
        if (now > electionInfo.endTime * 1000) {
          throw new Error(`Голосование уже завершено. Окончание: ${new Date(electionInfo.endTime * 1000)}`);
        }
      } catch (error) {
        console.error('Ошибка при получении информации о голосовании:', error);
        throw new Error(`Голосование с ID ${electionId} не найдено или недоступно: ${error.message}`);
      }
      
      // Убираем проверку регистрации - контракт сам выполняет автоматическую регистрацию при голосовании
      console.log('Пропускаем проверку регистрации - контракт выполнит автоматическую регистрацию при голосовании');

      // Проверяем, не голосовал ли пользователь уже
      try {
        const hasVoted = await this.contract.methods.hasVoted(electionId, account).call();
        if (hasVoted) {
          throw new Error('Вы уже проголосовали в этом голосовании');
        }
      } catch (error) {
        if (error.message.includes('Вы уже проголосовали')) {
          throw error;
        }
        console.warn('Ошибка при проверке статуса голосования:', error);
        // Продолжаем, даже если не удалось проверить - контракт всё равно отклонит повторное голосование
      }
      
      // Web3 v4: Получаем текущую цену газа с новым API
      const gasPrice = await this.web3.eth.getGasPrice();
      
      // Используем 101% от текущей цены газа для гарантии успешной транзакции
      const adjustedGasPrice = Math.floor(Number(gasPrice) * 1.01).toString();
      
      console.log(`Использую цену газа: ${adjustedGasPrice}`);
      
      // Даем больше времени для завершения транзакции
      const transactionPromise = new Promise((resolve, reject) => {
        let isCompleted = false;
        let transactionHash = null;
        
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            isCompleted = true;
            if (transactionHash) {
              console.log('Транзакция была отправлена, но превысила время ожидания подтверждения:', transactionHash);
              reject(new Error('Время ожидания ответа от блокчейна истекло. Проверьте статус транзакции в MetaMask и обновите страницу.'));
            } else {
              reject(new Error('Тайм-аут транзакции. Проверьте статус в MetaMask.'));
            }
          }
        }, 180000); // 3 минуты
        
        try {
          // Попытка оценить газ перед отправкой транзакции
          this.contract.methods.vote(electionId, blindedVote, secretHash).estimateGas({
            from: account,
          }).then(estimatedGas => {
                          console.log(`Расчетный расход газа: ${estimatedGas}. Устанавливаем лимит с запасом.`);
              // Добавляем 5% к расчетному газу
            let safeGasLimit = Math.floor(Number(estimatedGas) * 1.05).toString();
            
            // Отправляем транзакцию с расчетным газом плюс запас
            this.contract.methods.vote(electionId, blindedVote, secretHash).send({
              from: account,
              gas: Math.max(Number(safeGasLimit), Number(safeGasLimit)), // Используем большее из двух значений
              gasPrice: adjustedGasPrice
            })
            .on('transactionHash', (hash) => {
              console.log('Транзакция отправлена, хеш:', hash);
              transactionHash = hash;
            })
            .on('receipt', (receipt) => {
              console.log('Транзакция подтверждена, результат:', receipt);
              if (!isCompleted) {
                clearTimeout(timeout);
                isCompleted = true;
                resolve(receipt);
              }
            })
            .on('error', (error) => {
              console.error('Ошибка транзакции:', error);
              console.error('Полная ошибка:', JSON.stringify(error, null, 2));
              
              // Обработка специфических ошибок Metamask
              let errorMessage = error.message || 'Неизвестная ошибка транзакции';
              
              if (errorMessage.includes('User denied transaction signature')) {
                errorMessage = 'Вы отклонили подпись транзакции в кошельке';
              } else if (errorMessage.includes('insufficient funds')) {
                errorMessage = 'Недостаточно средств на вашем кошельке для оплаты комиссии';
              } else if (errorMessage.includes('already voted') || errorMessage.includes('Voter has already voted')) {
                errorMessage = 'Вы уже проголосовали в этом голосовании';
              } else if (errorMessage.includes('election not active') || errorMessage.includes('Election has not started') || errorMessage.includes('Election has ended')) {
                errorMessage = 'Голосование неактивно в данный момент';
              } else if (errorMessage.includes('execution reverted')) {
                // Пытаемся извлечь причину из revert
                const revertReason = errorMessage.match(/execution reverted: (.+)/);
                if (revertReason && revertReason[1]) {
                  errorMessage = `Ошибка контракта: ${revertReason[1]}`;
                } else {
                  errorMessage = 'Ошибка выполнения контракта';
                }
              }
              
              if (!isCompleted) {
                clearTimeout(timeout);
                isCompleted = true;
                reject(new Error(errorMessage));
              }
            });
          }).catch(error => {
            console.error('Ошибка при оценке газа:', error);
            console.error('Полная ошибка оценки газа:', JSON.stringify(error, null, 2));
            
            let errorMessage = error.message || 'Ошибка при оценке газа';
            if (errorMessage.includes('already voted') || errorMessage.includes('Voter has already voted')) {
              errorMessage = 'Вы уже проголосовали в этом голосовании';
            } else if (errorMessage.includes('election not active') || errorMessage.includes('Election has not started') || errorMessage.includes('Election has ended')) {
              errorMessage = 'Голосование неактивно в данный момент';
            } else if (errorMessage.includes('execution reverted')) {
              // Пытаемся извлечь причину из revert
              const revertReason = errorMessage.match(/execution reverted: (.+)/);
              if (revertReason && revertReason[1]) {
                errorMessage = `Ошибка контракта: ${revertReason[1]}`;
              } else {
                errorMessage = 'Ошибка выполнения контракта при оценке газа';
              }
            }
            
            if (!isCompleted) {
              clearTimeout(timeout);
              isCompleted = true;
              reject(new Error(errorMessage));
            }
          });
        } catch (error) {
          console.error('Ошибка при отправке транзакции:', error);
          if (!isCompleted) {
            clearTimeout(timeout);
            isCompleted = true;
            reject(error);
          }
        }
      });
      
      return await transactionPromise;
    } catch (error) {
      console.error('Ошибка при голосовании:', error);
      throw error;
    }
  }

  async revokeVote(electionId) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      const account = await this.getCurrentAccount();
      console.log(`Отзыв голоса с аккаунта ${account} для голосования ${electionId}`);
      
      // Проверяем, что пользователь уже проголосовал
      const hasVoted = await this.contract.methods.verifyVote(electionId, account).call();
      if (!hasVoted) {
        throw new Error('Вы еще не голосовали в этом голосовании');
      }
      
      // Проверяем, что голосование еще активно
      const electionInfo = await this.getElectionInfo(electionId);
      const now = Math.floor(Date.now() / 1000);
      if (now > electionInfo.endTime) {
        throw new Error('Голосование уже завершено, отзыв голоса невозможен');
      }
      
      // Получаем газ
      const gasPrice = await this.web3.eth.getGasPrice();
      // Используем 101% от текущей цены газа для успешной транзакции
      const adjustedGasPrice = Math.floor(Number(gasPrice) * 1.01).toString();
      
      console.log(`Использую цену газа: ${adjustedGasPrice}`);
      
      // Создаем промис с таймаутом для предотвращения зависания
      const transactionPromise = new Promise((resolve, reject) => {
        let isCompleted = false;
        
        // Устанавливаем таймаут в 2 минуты
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            isCompleted = true;
            reject(new Error('Тайм-аут транзакции. Проверьте статус в MetaMask.'));
          }
        }, 120000); // 2 минуты

        // Оцениваем газ перед отправкой транзакции
        this.contract.methods.revokeVote(electionId).estimateGas({
          from: account
                                      }).then(estimatedGas => {
              // Добавляем 5% запас к расчетному газу
            let safeGasLimit = Math.floor(Number(estimatedGas) * 1.05).toString();
          
          console.log(`Оценка газа для отзыва голоса: ${estimatedGas}, используем: ${safeGasLimit}`);

          // Отправляем транзакцию
          this.contract.methods.revokeVote(electionId).send({
            from: account,
            gas: safeGasLimit,
            gasPrice: adjustedGasPrice
          })
          .on('transactionHash', (hash) => {
            console.log('Транзакция отзыва отправлена, хеш:', hash);
          })
          .on('receipt', (receipt) => {
            console.log('Транзакция отзыва подтверждена, результат:', receipt);
            if (!isCompleted) {
              clearTimeout(timeout);
              isCompleted = true;
              resolve(receipt);
            }
          })
          .on('error', (error) => {
            console.error('Ошибка при отзыве голоса:', error);
            if (!isCompleted) {
              clearTimeout(timeout);
              isCompleted = true;
              
              if (error.code === 4001 || 
                  (error.message && error.message.includes('User denied transaction')) ||
                  (error.reason && error.reason.includes('User rejected'))) {
                const cancelError = new Error('Операция отменена пользователем');
                cancelError.isCancelled = true;
                reject(cancelError);
              } else {
                reject(error);
              }
            }
          });
        }).catch(error => {
          console.error('Ошибка при оценке газа для отзыва голоса:', error);
          if (!isCompleted) {
            clearTimeout(timeout);
            isCompleted = true;
            reject(error);
          }
        });
      });
      
      return await transactionPromise;
    } catch (error) {
      console.error('Ошибка при отзыве голоса:', error);
      
      // Если это отмена пользователем, пробрасываем ошибку специального типа
      if (error.isCancelled) {
        throw error;
      }
      
      // Преобразуем сложные ошибки в более понятные сообщения
      if (error.message) {
        if (error.message.includes('insufficient funds')) {
          throw new Error('Недостаточно средств в вашем кошельке для проведения транзакции');
        } else if (error.message.includes('gas')) {
          throw new Error('Ошибка с газом в транзакции. Попробуйте увеличить лимит газа');
        } else if (error.message.includes('nonce')) {
          throw new Error('Ошибка с nonce транзакции. Попробуйте сбросить MetaMask');
        } else if (error.message.includes('underpriced')) {
          throw new Error('Цена газа слишком низкая. Увеличьте цену газа в MetaMask');
        } else if (error.message.includes('timeout')) {
          throw new Error('Истекло время ожидания ответа от блокчейна. Проверьте ваш кошелек');
        }
      }
      
      throw error;
    }
  }
  
  async getVoteTimestamp(electionId, voterAddress) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      // Если адрес не указан, используем текущий аккаунт
      const address = voterAddress || await this.getCurrentAccount();
      
      // Проверяем, голосовал ли этот адрес
      const hasVoted = await this.contract.methods.verifyVote(electionId, address).call();
      if (!hasVoted) {
        return 0; // Пользователь не голосовал
      }
      
      // Получаем время голосования
      return this.contract.methods.getVoteTimestamp(electionId, address).call();
    } catch (error) {
      console.error('Ошибка при получении времени голосования:', error);
      return 0;
    }
  }

  async getElectionResults(electionId) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    return this.contract.methods.getElectionResults(electionId).call();
  }

  async verifyVote(electionId, voterAddress) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    return this.contract.methods.verifyVote(electionId, voterAddress).call();
  }

  async createElection(name, description, startTime, endTime, options, customOptions = {}) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    console.log('Параметры создания голосования:', {
      name,
      description,
      startTime,
      endTime,
      options,
      customOptions
    });
    
    // Проверка на пустой массив опций или слишком мало опций
    if (!options || options.length < 2) {
      throw new Error('Требуется как минимум 2 варианта ответа');
    }
    
    // Проверка на пустые строки в опциях
    for (const option of options) {
      if (!option || option.trim() === '') {
        throw new Error('Варианты ответа не могут быть пустыми');
      }
    }
    
    // Правильная обработка дат (timestamp)
    let startTimeUnix, endTimeUnix;
    
    // Получаем текущее время в Unix формате (секунды)
    const currentTimeUnix = Math.floor(Date.now() / 1000);
    
    // Преобразуем startTime в UNIX timestamp
    if (startTime instanceof Date) {
      startTimeUnix = Math.floor(startTime.getTime() / 1000);
    } else if (typeof startTime === 'number') {
      // Если это уже unix timestamp в секундах, используем как есть
      if (startTime < 10000000000) {
        startTimeUnix = Math.floor(startTime); // Используем Math.floor для преобразования в число
      } else {
        // Если это timestamp в миллисекундах, конвертируем в секунды
        startTimeUnix = Math.floor(startTime / 1000);
      }
    } else if (typeof startTime === 'string') {
      // Пробуем преобразовать строку в дату и получить timestamp
      const startDate = new Date(startTime);
      if (isNaN(startDate.getTime())) {
        throw new Error('Некорректный формат даты начала голосования');
      }
      startTimeUnix = Math.floor(startDate.getTime() / 1000);
    } else {
      throw new Error('Некорректный формат даты начала голосования');
    }
    
    // Преобразуем endTime в UNIX timestamp
    if (endTime instanceof Date) {
      endTimeUnix = Math.floor(endTime.getTime() / 1000);
    } else if (typeof endTime === 'number') {
      // Если это уже unix timestamp в секундах, используем как есть
      if (endTime < 10000000000) {
        endTimeUnix = Math.floor(endTime); // Используем Math.floor для преобразования в число
      } else {
        // Если это timestamp в миллисекундах, конвертируем в секунды
        endTimeUnix = Math.floor(endTime / 1000);
      }
    } else if (typeof endTime === 'string') {
      // Пробуем преобразовать строку в дату и получить timestamp
      const endDate = new Date(endTime);
      if (isNaN(endDate.getTime())) {
        throw new Error('Некорректный формат даты окончания голосования');
      }
      endTimeUnix = Math.floor(endDate.getTime() / 1000);
    } else {
      throw new Error('Некорректный формат даты окончания голосования');
    }
    
    // Обязательные проверки дат для соответствия требованиям смарт-контракта
    if (startTimeUnix <= currentTimeUnix) {
      throw new Error(`Дата начала голосования должна быть в будущем. Текущее время: ${new Date(currentTimeUnix * 1000).toLocaleString()}, указанное время: ${new Date(startTimeUnix * 1000).toLocaleString()}`);
    }
    
    if (endTimeUnix <= startTimeUnix) {
      throw new Error(`Дата окончания голосования должна быть позже даты начала. Начало: ${new Date(startTimeUnix * 1000).toLocaleString()}, окончание: ${new Date(endTimeUnix * 1000).toLocaleString()}`);
    }
    
    // Проверяем даты
    console.log(`Время: текущее ${new Date(currentTimeUnix * 1000).toISOString()}, начало ${new Date(startTimeUnix * 1000).toISOString()}, окончание ${new Date(endTimeUnix * 1000).toISOString()}`);
    
    try {
      const account = await this.getCurrentAccount();
      
      // Проверяем, что пользователь является администратором
      let isAdmin = await this.isAdmin(account);
      
      if (!isAdmin) {
        throw new Error('Только администраторы могут создавать голосования');
      }
      
      // Настройки транзакции по умолчанию
      const transactionOptions = {
        from: account,
        ...customOptions
      };
      
      // Получаем динамическую оценку газа
      let gasEstimate;
      try {
        gasEstimate = await this.contract.methods.createElection(
          String(name), 
          String(description), 
          String(startTimeUnix), 
          String(endTimeUnix), 
          options.map(option => String(option))
        ).estimateGas({ from: account });
        
                                      // Добавляем 5% запас к оценке газа
          const gasLimit = Math.floor(gasEstimate * 1.05);
        transactionOptions.gas = gasLimit;
        console.log(`Оценка газа: ${gasEstimate}, используемый лимит: ${gasLimit}`);
      } catch (estimateError) {
        console.warn('Не удалось получить оценку газа:', estimateError);
      }
      
      console.log('Создание голосования с параметрами:', {
        name,
        description,
        startTime: startTimeUnix,
        endTime: endTimeUnix,
        options,
        account,
        transactionOptions
      });
      
      // Отправляем транзакцию
      // Преобразуем числа в строки при отправке в смарт-контракт, чтобы избежать ошибок с BigInt
      const receipt = await this.contract.methods
        .createElection(
          String(name), 
          String(description), 
          String(startTimeUnix), 
          String(endTimeUnix), 
          options.map(option => String(option))
        )
        .send(transactionOptions)
        .catch(error => {
          console.error('Ошибка при отправке транзакции:', error);
          
          // Логируем детали ошибки для отладки
          if (error.receipt) {
            console.error('Детали отмененной транзакции:', JSON.stringify(error.receipt, null, 2));
          }
          
          // Анализируем ошибку для более понятного сообщения
          if (error.message.includes('revert')) {
            if (error.message.includes('Only admin')) {
              throw new Error('Доступ запрещен: только администратор может создавать голосования');
            } else if (error.message.includes('Start time must be in the future')) {
              throw new Error('Время начала голосования должно быть в будущем');
            } else if (error.message.includes('End time must be after start time')) {
              throw new Error('Время окончания голосования должно быть позже времени начала');
            } else if (error.message.includes('At least 2 options required')) {
              throw new Error('Необходимо указать минимум 2 варианта ответа');
            } else {
              throw new Error(`Смарт-контракт отклонил транзакцию: ${error.message}`);
            }
          }
          
          throw error;
        });
      
      console.log('Результат создания голосования:', receipt);
      return receipt;
    } catch (error) {
      console.error('Ошибка при создании голосования:', error);
      
      // Создаем более понятное сообщение об ошибке
      if (error.message.includes('Transaction has been reverted')) {
        throw new Error('Транзакция отменена блокчейном. Проверьте правильность дат и прав доступа.');
      }
      
      throw error;
    }
  }

  // Вспомогательные методы
  async generateBlindedVote(optionIndex, salt) {
    if (!this.web3) throw new Error('Web3 не инициализирован');
    
    // Создаем уникальный хеш на основе выбранного варианта и соли для обеспечения анонимности
    const voteData = this.web3.utils.soliditySha3(
      { t: 'uint', v: optionIndex },
      { t: 'bytes32', v: salt }
    );
    
    return voteData;
  }

  generateSalt() {
    const randomBytes = new Uint8Array(32);
    window.crypto.getRandomValues(randomBytes);
    return '0x' + Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Получение приватного ключа для подписи голоса
  async getPrivateKey() {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      // Получаем текущий аккаунт
      const account = await this.getCurrentAccount();
      
      // Запрашиваем подпись сообщения (это безопаснее, чем запрашивать сам приватный ключ)
      const message = `Авторизация для голосования ${new Date().toISOString()}`;
      const messageHash = this.web3.utils.sha3(message);
      
      // Подписываем сообщение и получаем подпись
      const signature = await this.web3.eth.personal.sign(messageHash, account, '');
      
      // Используем подпись как ключ для шифрования голоса
      // Это не настоящий приватный ключ, а безопасная альтернатива
      return this.web3.utils.sha3(signature);
    } catch (error) {
      console.error('Ошибка при получении подписи:', error);
      throw new Error('Не удалось получить подпись от кошелька. Убедитесь, что вы подтвердили операцию подписи.');
    }
  }
  
  // Получение списка всех доступных голосований
  async getAllElections() {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      // Получаем количество голосований из контракта
      const electionCount = await this.contract.methods.electionCount().call();
      console.log(`Всего голосований: ${electionCount}`);
      
      // Получаем информацию о каждом голосовании
      const elections = [];
      for (let i = 0; i < electionCount; i++) {
        try {
          const electionInfo = await this.getElectionInfo(i);
          elections.push({
            id: i,
            ...electionInfo
          });
        } catch (error) {
          console.error(`Ошибка при получении информации о голосовании ${i}:`, error);
        }
      }
      
      return elections;
    } catch (error) {
      console.error('Ошибка при получении списка голосований:', error);
      throw error;
    }
  }
  
  // Проверка, верифицирован ли пользователь в блокчейне
  async isVoterVerified(address) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      if (!address) {
        address = await this.getCurrentAccount();
      }
      
      const isVerified = await this.contract.methods.isVoterVerified(address).call();
      return isVerified;
    } catch (error) {
      console.error('Ошибка при проверке верификации избирателя:', error);
      return false;
    }
  }
  
  // Получение баланса аккаунта
  async getAccountBalance(address) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      const account = address || await this.getCurrentAccount();
      const balance = await this.web3.eth.getBalance(account);
      
      const etherBalance = this.web3.utils.fromWei(balance, 'ether');
      return {
        wei: balance,
        ether: etherBalance,
        formatted: parseFloat(etherBalance).toFixed(4) + ' ETH'
      };
    } catch (error) {
      console.error('Ошибка при получении баланса:', error);
      throw error;
    }
  }

  // Проверка, является ли адрес администратором
  async isAdmin(address) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      // Получаем текущий аккаунт пользователя
      const account = address || await this.getCurrentAccount();
      console.log('Проверка прав администратора для адреса:', account);
      
      // Сначала проверяем, совпадает ли адрес с адресом, указанным в контракте
      try {
        // Проверяем, есть ли в контракте метод admin, который возвращает адрес администратора
        const adminMethod = this.contract.methods.admin;
        if (adminMethod) {
          try {
            const contractAdmin = await this.contract.methods.admin().call();
            console.log('Администратор контракта:', contractAdmin);
            
            // Если адрес пользователя совпадает с адресом администратора контракта
            if (account.toLowerCase() === contractAdmin.toLowerCase()) {
              console.log('Пользователь является администратором по контракту');
              return true;
            }
          } catch (adminCallError) {
            console.warn('Ошибка при вызове метода admin():', adminCallError);
          }
        } else {
          console.log('Метод admin не найден в контракте');
        }
      } catch (contractError) {
        console.log('Ошибка при проверке метода admin в контракте:', contractError);
      }
      
      // Список известных адресов администраторов (для тестирования и совместимости)
      const adminAddresses = [
        '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4', // Ganache default
        '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2', // Ganache default
        '0x18bd3281e0c937b7066a2C11E69B5432a3771ad6', // Custom address
        '0x4B20993Bc481177ec7E8f571ceCaE8A9e22C02db', // Hardhat default
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', // Hardhat default
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906', // Hardhat default
        '0xACa94ef8bd5ffEE41947b4585a84BdA5a3d3DA6E', // Hardhat default
        '0x91Eb99E728B12511124b36a4501fD08F218e6174'  // Пользовательский адрес
      ];
      
      // Проверка точного соответствия адреса (с сохранением регистра)
      if (adminAddresses.includes(account)) {
        console.log('Найдено точное соответствие адреса в списке администраторов (с регистром)');
        return true;
      }
      
      // Проверяем наличие адреса в списке администраторов (без учета регистра)
      const isAdmin = adminAddresses.map(addr => addr.toLowerCase()).includes(account.toLowerCase());
      console.log('Результат проверки прав администратора по списку (без учета регистра):', isAdmin);
      return isAdmin;
    } catch (error) {
      console.error('Ошибка при проверке статуса администратора:', error);
      
      return false;
    }
  }

  async signMessage(message) {
    if (!this.isInitialized()) {
      throw new Error('BlockchainService не инициализирован');
    }
    
    try {
      // Get current account
      const account = await this.getCurrentAccount();
      
      // Sign the message
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [message, account]
      });
      
      return signature;
    } catch (error) {
      console.error('Ошибка при подписи сообщения:', error);
      
      // Specially handle user rejection of signature request
      if (error.code === 4001 || error.message.includes('User denied')) {
        const cancelError = new Error('Подпись отменена пользователем');
        cancelError.isCancelled = true;
        cancelError.code = 4001;
        throw cancelError;
      }
      
      throw new Error('Не удалось подписать сообщение. Убедитесь, что вы подтвердили операцию в MetaMask.');
    }
  }

  // Метод для оценки расхода газа при выполнении различных операций
  async estimateGas(functionName, params = [], options = {}) {
    if (!this.isInitialized()) {
      throw new Error('BlockchainService не инициализирован');
    }

    try {
      if (!this.contract.methods[functionName]) {
        throw new Error(`Функция ${functionName} не найдена в контракте`);
      }

      const account = await this.getCurrentAccount();
      const defaultOptions = { from: account };
      const mergedOptions = { ...defaultOptions, ...options };

      // Вызываем метод контракта с переданными параметрами
      const method = this.contract.methods[functionName](...params);
      
      // Делаем реальную оценку газа
      try {
        const gasEstimate = await method.estimateGas(mergedOptions);
        console.log(`Оценка газа для ${functionName}: ${gasEstimate}`);
        
                                      // Добавляем 5% запас для надежности
          return Math.floor(gasEstimate * 1.05);
      } catch (estimateError) {
        console.warn(`Не удалось оценить газ для ${functionName}:`, estimateError);
        
        // Если не удалось оценить, используем значения по умолчанию
        const defaultGasValues = {
          'vote': 100000,
          'createElection': 300000,
          'revokeVote': 100000,
          'revealVote': 100000
        };
        
        return defaultGasValues[functionName] || 200000;
      }
    } catch (error) {
      console.error(`Ошибка при оценке газа для ${functionName}:`, error);
      
      // Возвращаем значение по умолчанию в случае ошибки
      const defaultGasValues = {
        'vote': 100000,
        'createElection': 300000,
        'revokeVote': 100000,
        'revealVote': 100000
      };
      
      return defaultGasValues[functionName] || 200000;
    }
  }

  // Метод для полной синхронизации с блокчейном
  async syncWithBlockchain() {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      console.log('Начало полной синхронизации с блокчейном...');
      
      // Получаем количество голосований из контракта
      const electionCount = await this.contract.methods.electionCount().call();
      console.log(`Всего голосований в блокчейне: ${electionCount}`);
      
      // Массив для хранения актуальных голосований
      const syncedElections = [];
      
      // Получаем информацию о каждом голосовании
      for (let i = 0; i < electionCount; i++) {
        try {
          // Используем правильный метод getElectionInfo вместо getElection
          const rawElectionData = await this.contract.methods.getElectionInfo(i).call();
          
          if (!rawElectionData || !rawElectionData.name) {
            console.warn(`Пропуск голосования ${i}: недостаточно данных`);
            continue;
          }
          
          // Обработка данных из блокчейна
          const name = rawElectionData.name;
          const description = rawElectionData.description || '';
          
          // Обработка временных меток для корректного отображения
          let startTime = parseInt(rawElectionData.startTime);
          let endTime = parseInt(rawElectionData.endTime);
          
          // Проверка и исправление временных меток
          const now = Math.floor(Date.now() / 1000); // Текущее время в секундах
          
          // Обработка ошибочных дат (голосование в будущем 2025 год или позже)
          if (startTime > now) {
            console.log(`Голосование ${i} имеет дату начала в будущем: ${new Date(startTime * 1000)}`);
          }
          
          // Обработка дат завершения
          if (endTime <= startTime) {
            console.warn(`Голосование ${i} имеет некорректную дату завершения. Устанавливаем дату завершения на 7 дней после начала.`);
            endTime = startTime + 7 * 24 * 60 * 60; // +7 дней в секундах
          }
          
          const options = rawElectionData.options || [];
          const finalized = rawElectionData.finalized || false;
          
          // Извлекаем метаданные из описания, если они есть
          let metadata = {};
          if (description.includes('|metadata:')) {
            const parts = description.split('|metadata:');
            const metadataStr = parts[1];
            try {
              metadata = JSON.parse(metadataStr);
            } catch (e) {
              console.warn(`Ошибка парсинга метаданных для голосования ${i}:`, e);
            }
          }
          
          // Формируем объект голосования с обработанными данными
          const election = {
            id: i,
            name,
            description: description.split('|metadata:')[0].trim(),
            startTime,
            endTime,
            options,
            finalized,
            metadata
          };
          
          syncedElections.push(election);
          console.log(`Голосование ${i} успешно синхронизировано`);
        } catch (error) {
          console.error(`Ошибка при синхронизации голосования ${i}:`, error);
        }
      }
      
      // Сохраняем голосования в localStorage для кэширования
      try {
        localStorage.setItem('cachedElections', JSON.stringify(syncedElections));
        localStorage.setItem('lastSyncTime', Date.now().toString());
      } catch (storageError) {
        console.warn('Не удалось сохранить данные в localStorage:', storageError);
      }
      
      console.log('Полная синхронизация с блокчейном завершена');
      return syncedElections;
    } catch (error) {
      console.error('Критическая ошибка при синхронизации с блокчейном:', error);
      
      // Пробуем восстановить данные из кэша в случае ошибки
      try {
        const cachedData = localStorage.getItem('cachedElections');
        if (cachedData) {
          const elections = JSON.parse(cachedData);
          console.log('Восстановлены данные из кэша, найдено голосований:', elections.length);
          return elections;
        }
      } catch (cacheError) {
        console.error('Ошибка при восстановлении из кэша:', cacheError);
      }
      
      throw new Error(`Ошибка синхронизации с блокчейном: ${error.message}`);
    }
  }

  // Fix for 1970 date issue - handle timestamps correctly
  normalizeTimestamp(timestamp) {
    // Убедимся, что timestamp - число
    let ts = Number(timestamp);
    
    // Проверяем, не равен ли timestamp нулю или не является NaN
    if (ts === 0 || isNaN(ts)) {
      console.warn(`Получен некорректный timestamp: ${timestamp}, возвращаем текущую дату`);
      return new Date(); // Возвращаем текущую дату как запасной вариант
    }
    
    // Проверяем, не слишком ли маленький timestamp (до 1980 года - это точно ошибка)
    // Timestamp для 1980-01-01 в секундах: 315532800
    if (ts < 315532800) {
      console.warn(`Подозрительно низкое значение timestamp: ${ts}, предполагаем, что это не Unix timestamp`);
      
      // Может быть, это какое-то другое числовое значение - используем текущую дату
      return new Date();
    }
    
    // Проверяем формат timestamp (секунды или миллисекунды)
    if (ts > 10000000000) { // Если больше 10^10, то вероятно миллисекунды
      console.log(`Преобразуем timestamp из миллисекунд в секунды: ${ts} -> ${Math.floor(ts / 1000)}`);
      ts = Math.floor(ts / 1000);
    }
    
    // Теперь создаем дату из timestamp в секундах
    const date = new Date(ts * 1000);
    
    // Проверяем разумность полученной даты (должна быть между 1980 и 2030)
    if (date.getFullYear() < 1980 || date.getFullYear() > 2030) {
      console.warn(`Проверка года для даты ${date.toISOString()}, год: ${date.getFullYear()}`);
      
      // Если год больше 2030, это, вероятно, ошибка в формате
      if (date.getFullYear() > 2030) {
        console.warn(`Слишком далекая дата в будущем: ${date.toISOString()}, возможно ошибка формата`);
        // Вместо текущей даты, попробуем использовать дату, рассчитав её другим способом
        const newDate = new Date(ts * 1000); // попробуем еще раз как есть
        if (newDate.getFullYear() >= 1980 && newDate.getFullYear() <= 2030) {
          console.log(`Успешно исправлена дата: ${newDate.toISOString()}`);
          return newDate;
        }
      }
    }
    
    return date;
  }

  // Метод для проверки статуса голосования
  async hasVoted(electionId, voterAddress) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    try {
      const hasVoted = await this.contract.methods.hasVoted(electionId, voterAddress).call();
      return hasVoted;
    } catch (error) {
      console.error('Ошибка при проверке статуса голосования:', error);
      return false;
    }
  }

  // Метод для мониторинга статуса транзакции
  async waitForTransactionConfirmation(txHash, maxWaitTime = 300000) {
    if (!this.isInitialized()) throw new Error('BlockchainService не инициализирован');
    
    return new Promise(async (resolve, reject) => {
      const startTime = Date.now();
      
      const checkTransaction = async () => {
        try {
          const receipt = await this.web3.eth.getTransactionReceipt(txHash);
          
          if (receipt) {
            if (receipt.status) {
              console.log('Транзакция подтверждена:', receipt);
              resolve(receipt);
            } else {
              console.log('Транзакция отклонена:', receipt);
              reject(new Error('Транзакция была отклонена сетью'));
            }
            return;
          }
          
          // Проверяем, не превысили ли максимальное время ожидания
          if (Date.now() - startTime > maxWaitTime) {
            reject(new Error('Превышено время ожидания подтверждения транзакции'));
            return;
          }
          
          // Ждем 5 секунд перед следующей проверкой
          setTimeout(checkTransaction, 5000);
        } catch (error) {
          console.error('Ошибка при проверке статуса транзакции:', error);
          setTimeout(checkTransaction, 5000);
        }
      };
      
      // Начинаем проверку сразу
      checkTransaction();
    });
  }
}

// Создаем и экспортируем синглтон сервиса
const blockchainService = new BlockchainService();
export default blockchainService;
