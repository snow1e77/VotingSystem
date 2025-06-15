import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Button, Card, Badge, Alert, Spinner, Row, Col } from 'react-bootstrap';
import { Pie, Bar } from 'react-chartjs-2';
import blockchainService from '../services/blockchain';
import { formatDate } from '../utils/formatter';

// Используем переменную окружения или значение по умолчанию
const CONTRACT_ADDRESS = '0x1A0fAb9881D1B51A153039543dC7017eE644c794';

// Define chart colors
const chartColors = [
  'rgba(54, 162, 235, 0.8)',  // Blue
  'rgba(75, 192, 192, 0.8)',  // Green
  'rgba(255, 99, 132, 0.8)',  // Red
  'rgba(255, 159, 64, 0.8)',  // Orange
  'rgba(153, 102, 255, 0.8)', // Purple
  'rgba(255, 205, 86, 0.8)',  // Yellow
  'rgba(201, 203, 207, 0.8)'  // Grey
];

const ResultsPage = () => {
  const { electionId } = useParams();
  const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartType, setChartType] = useState('pie'); // 'pie' or 'bar'
  
  // Инициализация блокчейн-сервиса при монтировании компонента
  useEffect(() => {
    const initializeBlockchain = async () => {
      if (!blockchainService.isInitialized()) {
        try {
          console.log('Инициализация блокчейн-сервиса в ResultsPage...');
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
  
  useEffect(() => {
    const fetchElectionAndResults = async () => {
      if (!electionId) return;
      
      try {
        setLoading(true);
        
        // Проверяем инициализацию блокчейн-сервиса перед запросом данных
        if (!blockchainService.isInitialized()) {
          try {
            await blockchainService.initialize(CONTRACT_ADDRESS);
          } catch (initError) {
            throw new Error('Не удалось инициализировать блокчейн-сервис: ' + initError.message);
          }
        }
        
        // Получаем информацию о голосовании
        const election = await blockchainService.getElectionInfo(electionId);
        
        // Получаем результаты голосования
        const results = await blockchainService.getElectionResults(electionId);
        
        // Форматируем результаты для отображения
        const formattedResults = election.options.map((option, index) => ({
          option: option,
          votes: index < results.length ? parseInt(results[index]) : 0
        }));
        
        setElection({
          ...election,
          totalVoters: formattedResults.reduce((sum, item) => sum + item.votes, 0),
          finalized: election.finalized || false
        });
        setResults(formattedResults);
        
        console.log('Данные о голосовании получены:', election);
        console.log('Результаты получены:', formattedResults);
      } catch (err) {
        console.error('Ошибка при загрузке результатов голосования:', err);
        setError('Не удалось загрузить результаты голосования: ' + (err.message || 'Неизвестная ошибка'));
      } finally {
        setLoading(false);
      }
    };

    fetchElectionAndResults();
  }, [electionId]);
  
  // Prepare data for charts
  const prepareChartData = () => {
    if (!results || results.length === 0) return null;
    
    // Labels are the option names
    const labels = results.map(result => result.option);
    
    // Data points are the votes
    const data = results.map(result => result.votes);
    
    // Create color arrays based on number of options
    const backgroundColors = chartColors.slice(0, results.length);
    const borderColors = backgroundColors.map(color => color.replace('0.8', '1'));
    
    return {
      labels,
      datasets: [
        {
          label: 'Количество голосов',
          data,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Chart options
  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          padding: 20,
          usePointStyle: true,
          font: {
            size: 14
          }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.raw || 0;
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${label}: ${value} голосов (${percentage}%)`;
          }
        }
      }
    }
  };
  
  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.raw || 0;
            const total = context.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
            const percentage = Math.round((value / total) * 100);
            return `${value} голосов (${percentage}%)`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  if (loading) {
    return (
      <Container className="text-center my-5">
        <Spinner animation="border" variant="primary" />
        <div className="mt-3">Загрузка результатов голосования...</div>
      </Container>
    );
  }

  if (error && !election) {
    return (
      <Container className="my-4">
        <Alert variant="danger">{error}</Alert>
        <div className="text-center mt-3">
          <Button variant="primary" onClick={() => navigate('/')}>
            Вернуться на главную
          </Button>
        </div>
      </Container>
    );
  }

  if (!election) {
    return (
      <Container className="my-4">
        <Alert variant="warning">Голосование не найдено</Alert>
        <div className="text-center mt-3">
          <Button variant="primary" onClick={() => navigate('/')}>
            Вернуться на главную
          </Button>
        </div>
      </Container>
    );
  }

  // Расчет общего количества голосов и процентов
  const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);
  
  // Find the winning option
  const getWinningOption = () => {
    if (!results || results.length === 0) return null;
    
    // Sort results by votes in descending order
    const sortedResults = [...results].sort((a, b) => b.votes - a.votes);
    
    // If the top two have the same number of votes, it's a tie
    if (sortedResults.length > 1 && sortedResults[0].votes === sortedResults[1].votes) {
      return { isTie: true, options: sortedResults.filter(r => r.votes === sortedResults[0].votes) };
    }
    
    // Otherwise return the top result
    return { isTie: false, winner: sortedResults[0] };
  };
  
  const winningResult = getWinningOption();
  
  return (
    <Container className="results-page fade-in">
      <Card className="mb-4">
        <Card.Header as="h5" className="d-flex justify-content-between align-items-center">
          {election.name}
          <Badge bg="success" pill>{election.finalized ? 'Финализировано' : 'Завершено по времени'}</Badge>
        </Card.Header>
        <Card.Body>
          <Card.Text>{election.description}</Card.Text>
          <div className="election-meta mb-3">
            <p><strong>Период голосования:</strong> {formatDate(election.startTime)} - {formatDate(election.endTime)}</p>
            <p><strong>Всего голосов:</strong> {totalVotes} из {election.totalVoters} избирателей ({Math.round((totalVotes / election.totalVoters) * 100)}% явка)</p>
            <p><strong>Статус в блокчейне:</strong> {election.finalized ? 'Финализировано (данные являются окончательными)' : 'Не финализировано (данные являются предварительными)'}</p>
          </div>
        </Card.Body>
      </Card>
      
      {winningResult && (
        <Card className="winner-card mb-4">
          <Card.Body className="text-center py-4">
            {winningResult.isTie ? (
              <>
                <h3 className="mb-3">Ничья между вариантами:</h3>
                <div className="d-flex justify-content-center flex-wrap gap-2 mb-3">
                  {winningResult.options.map((option, idx) => (
                    <Badge key={idx} bg="primary" className="tied-option fs-5 px-3 py-2">
                      {option.option}
                    </Badge>
                  ))}
                </div>
                <p className="mb-0 text-muted">Каждый из вариантов получил {winningResult.options[0].votes} голосов.</p>
              </>
            ) : (
              <>
                <h3 className="mb-3">Победивший вариант:</h3>
                <div className="winner-option-container mb-3">
                  <Badge bg="success" className="winning-option fs-5 px-3 py-2">{winningResult.winner.option}</Badge>
                </div>
                <p className="mb-0 text-muted">
                  Получил {winningResult.winner.votes} голосов 
                  ({totalVotes > 0 ? Math.round((winningResult.winner.votes / totalVotes) * 100) : 0}% от общего числа голосов)
                </p>
              </>
            )}
          </Card.Body>
        </Card>
      )}
      
      <Card className="results-container mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h3 className="mb-0">Итоговые результаты</h3>
          <div className="chart-controls">
            <Button 
              variant={chartType === 'pie' ? 'primary' : 'outline-primary'} 
              size="sm"
              className="me-2"
              onClick={() => setChartType('pie')}
            >
              Круговая диаграмма
            </Button>
            <Button 
              variant={chartType === 'bar' ? 'primary' : 'outline-primary'} 
              size="sm"
              onClick={() => setChartType('bar')}
            >
              Столбчатая диаграмма
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={7}>
              <div className="chart-container mb-4" style={{ height: results.length > 4 ? '500px' : '400px' }}>
                {chartType === 'pie' ? (
                  <Pie data={prepareChartData()} options={pieOptions} />
                ) : (
                  <Bar data={prepareChartData()} options={barOptions} />
                )}
              </div>
            </Col>
            <Col md={5}>
              <div className="vote-details">
                <h4 className="mb-3">Детальные результаты</h4>
                {results.map((result, index) => {
                  const percentage = totalVotes > 0 ? (result.votes / totalVotes) * 100 : 0;
                  const barColor = chartColors[index % chartColors.length];
                  
                  return (
                    <div className="result-item mb-4" key={index}>
                      <div className="result-header">
                        <span className="option-name fw-bold d-flex align-items-center">
                          <div className="color-indicator me-2" style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            backgroundColor: barColor.replace('0.8', '1')
                          }}></div>
                          {result.option}
                        </span>
                        <span className="vote-stats">
                          <span className="vote-count">{result.votes} голосов</span>
                          <span className="vote-percentage ms-2">({percentage.toFixed(1)}%)</span>
                        </span>
                      </div>
                      
                      <div className="progress-bar-container mt-2">
                        <div 
                          className="progress-bar"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: barColor
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      <Card className="verification-section mb-4">
        <Card.Header>
          <h3 className="mb-0">Проверка результатов</h3>
        </Card.Header>
        <Card.Body>
          <p>
            Все голоса записаны в блокчейн Ethereum, что обеспечивает полную прозрачность,
            сохраняя при этом анонимность избирателей. Вы можете проверить эти результаты,
            обратившись к блокчейну напрямую.
          </p>
          
          <div className="verification-details">
            <div className="row">
              <div className="col-md-6">
                <p><strong>Адрес смарт-контракта:</strong></p>
                <code>{CONTRACT_ADDRESS}</code>
              </div>
              <div className="col-md-6">
                <p><strong>Хеш блока с результатами:</strong></p>
                <code>{election.blockHash}</code>
              </div>
            </div>
            <div className="mt-3">
              <p><strong>Обозреватель блокчейна:</strong></p>
              <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-box-arrow-up-right me-1" viewBox="0 0 16 16">
                  <path fillRule="evenodd" d="M8.636 3.5a.5.5 0 0 0-.5-.5H1.5A1.5 1.5 0 0 0 0 4.5v10A1.5 1.5 0 0 0 1.5 16h10a1.5 1.5 0 0 0 1.5-1.5V7.864a.5.5 0 0 0-1 0V14.5a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h6.636a.5.5 0 0 0 .5-.5z"/>
                  <path fillRule="evenodd" d="M16 .5a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0 0 1h3.793L6.146 9.146a.5.5 0 1 0 .708.708L15 1.707V5.5a.5.5 0 0 0 1 0v-5z"/>
                </svg>
                Просмотр на Etherscan
              </a>
            </div>
          </div>
        </Card.Body>
      </Card>
      
      <div className="actions text-center mb-5">
        <Button 
          variant="primary"
          onClick={() => navigate('/')}
          className="me-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-house me-1" viewBox="0 0 16 16">
            <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.707 1.5ZM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5 5 5Z"/>
          </svg>
          Вернуться на главную
        </Button>
      </div>
    </Container>
  );
};

export default ResultsPage; 