import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import App from './App.jsx';

// Получаем корневой элемент и рендерим в него приложение
const rootElement = document.getElementById('root');

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  // Если элемент #root не найден, выводим сообщение об ошибке
  document.body.innerHTML = `
    <div style="color: red; margin: 20px;">
      <h1>Ошибка!</h1>
      <p>Элемент с id="root" не найден. React не может загрузиться.</p>
    </div>
  `;
} 