// Обертка для react-toastify, чтобы избежать проблем с импортом ESM
import { toast } from 'react-toastify';
import { ToastContainer as OriginalToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import React from 'react';

// Экспортируем основные функции toast
export const showSuccess = (message, options = {}) => {
  return toast.success(message, options);
};

export const showError = (message, options = {}) => {
  return toast.error(message, options);
};

export const showInfo = (message, options = {}) => {
  return toast.info(message, options);
};

export const showWarning = (message, options = {}) => {
  return toast.warning(message, options);
};

// Экспортируем сам toast для более сложных случаев
export { toast };

// Наша обёртка для ToastContainer с параметрами по умолчанию
export const ToastContainer = ({
  position = "top-right",
  autoClose = 5000,
  hideProgressBar = false,
  newestOnTop = false,
  closeOnClick = true,
  rtl = false,
  pauseOnFocusLoss = true,
  draggable = true,
  pauseOnHover = true,
  theme = "light",
  ...props
}) => {
  return (
    <OriginalToastContainer
      position={position}
      autoClose={autoClose}
      hideProgressBar={hideProgressBar}
      newestOnTop={newestOnTop}
      closeOnClick={closeOnClick}
      rtl={rtl}
      pauseOnFocusLoss={pauseOnFocusLoss}
      draggable={draggable}
      pauseOnHover={pauseOnHover}
      theme={theme}
      {...props}
    />
  );
}; 