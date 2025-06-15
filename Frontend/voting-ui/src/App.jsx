import React, { useState, useEffect, Component } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/custom.css';

// Компоненты страниц
import Layout from './components/Layout';
import HomePage from './components/HomePage';
import VotingPage from './components/VotingPage';
import ResultsPage from './components/ResultsPage';
import CreateElectionPage from './components/CreateElectionPage';
import blockchainService from './services/blockchain';

// ErrorBoundary для отлова ошибок
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Ошибка в компоненте:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container mt-5">
          <div className="alert alert-danger">
            <h2>Произошла ошибка в приложении</h2>
            <p>Попробуйте обновить страницу или вернуться позже.</p>
            <details style={{ whiteSpace: 'pre-wrap' }}>
              <summary>Подробности ошибки</summary>
              {this.state.error && this.state.error.toString()}
              <br />
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </details>
            <div className="mt-3">
              <button 
                className="btn btn-primary" 
                onClick={() => window.location.reload()}
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Защищенный маршрут для администраторов
const ProtectedAdminRoute = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Проверяем инициализацию блокчейн-сервиса
        if (!blockchainService.isInitialized()) {
          try {
            await blockchainService.initialize('0x1A0fAb9881D1B51A153039543dC7017eE644c794');
          } catch (error) {
            console.error('Ошибка инициализации блокчейн-сервиса:', error);
            setIsLoading(false);
            return;
          }
        }
        
        // Проверяем, является ли пользователь администратором
        const adminStatus = await blockchainService.isAdmin();
        setIsAdmin(adminStatus);
      } catch (error) {
        console.error('Ошибка при проверке статуса администратора:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAdminStatus();
  }, []);
  
  if (isLoading) {
    return <div>Проверка прав доступа...</div>;
  }
  
  return isAdmin ? children : <Navigate to="/" replace />;
};

const App = () => {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route 
            path="create-election" 
            element={
              <ProtectedAdminRoute>
                <CreateElectionPage />
              </ProtectedAdminRoute>
            } 
          />
          <Route 
            path="create" 
            element={
              <ProtectedAdminRoute>
                <CreateElectionPage />
              </ProtectedAdminRoute>
            } 
          />
          <Route path="vote/:electionId" element={<VotingPage />} />
          <Route path="results/:electionId" element={<ResultsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
};

export default App; 