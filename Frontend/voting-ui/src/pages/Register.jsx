import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Alert, Button, Form, Spinner } from 'react-bootstrap';
import { FiCheckCircle, FiAlertTriangle, FiInfo, FiLink } from 'react-icons/fi';
import Layout from '../components/Layout';
import WalletAuth from '../components/WalletAuth';
import blockchainService from '../services/blockchain';
import verificationService from '../services/verificationService';
import { Link, useNavigate } from 'react-router-dom';
import { Formik, Form as FormikForm, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import CryptoJS from 'crypto-js';
import { showError, showSuccess, toast } from '../utils/toastUtils';

const Register = () => {
  const [walletAddress, setWalletAddress] = useState('');
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isCheckingVerification, setIsCheckingVerification] = useState(true);
  const [isInitializingBlockchain, setIsInitializingBlockchain] = useState(false);

  // Check if user is already verified
  useEffect(() => {
    const checkVerification = async () => {
      try {
        const userData = verificationService.getVerificationFromLocalStorage();
        if (userData && userData.verified) {
          setIsVerified(true);
          setVerificationData(userData);
        }
      } catch (error) {
        console.error('Error checking verification status:', error);
      } finally {
        setIsCheckingVerification(false);
      }
    };

    checkVerification();
  }, []);

  // Обработка успешной верификации через кошелек
  const handleWalletVerificationSuccess = (userData) => {
    setIsVerified(true);
    setVerificationData(userData);
    setWalletAddress(userData.walletAddress);
    setIsWalletConnected(true);
    
    // Сохраняем данные верификации в localStorage
    verificationService.saveWalletVerification(userData);
    
    toast.success('Верификация через криптокошелек успешно завершена!');
  };

  return (
    <Layout>
      <div className="py-5">
        <Row className="justify-content-center">
          <Col md={8} lg={6}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <h4 className="mb-4 text-center">Регистрация для участия в голосовании</h4>
                
                {isCheckingVerification ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-3">Проверка статуса верификации...</p>
                  </div>
                ) : isVerified ? (
                  <Alert variant="success">
                    <FiCheckCircle className="me-2" size={20} />
                    <span>Вы успешно верифицированы и можете принять участие в голосовании.</span>
                  </Alert>
                ) : (
                  <>
                    <Alert variant="info">
                      <FiInfo className="me-2" size={20} />
                      <span>Для участия в голосовании необходимо пройти верификацию с помощью криптокошелька.</span>
                    </Alert>
                    
                    <WalletAuth onSuccess={handleWalletVerificationSuccess} />
                  </>
                )}
                
                {isVerified && verificationData && (
                  <div className="mt-4">
                    <h5>Информация о верификации</h5>
                    <p className="mb-1">
                      Метод верификации: <strong>Криптокошелек</strong>
                    </p>
                    <p className="mb-1">
                      Адрес кошелька: <strong>{verificationData.walletAddress.substr(0, 6)}...{verificationData.walletAddress.substr(-4)}</strong>
                    </p>
                    <p className="mb-1">
                      Дата верификации: <strong>{new Date(verificationData.verifiedAt).toLocaleString()}</strong>
                    </p>
                  </div>
                )}
              </Card.Body>
            </Card>
            
            <div className="text-center">
              <Button variant="outline-primary" href="/">Вернуться на главную</Button>
            </div>
          </Col>
        </Row>
      </div>
    </Layout>
  );
};

export default Register; 