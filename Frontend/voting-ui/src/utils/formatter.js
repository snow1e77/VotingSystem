/**
 * Функции форматирования для отображения данных в пользовательском интерфейсе
 */

/**
 * Сокращает адрес Ethereum для отображения
 * @param {string} address - Полный Ethereum адрес
 * @returns {string} Сокращенный адрес (например, 0x1234...5678)
 */
export const shortenAddress = (address) => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Форматирует дату в читаемый вид
 * @param {Date|string|number} date - Дата для форматирования
 * @returns {string} Отформатированная дата
 */
export const formatDate = (date) => {
  if (!date) return '';
  
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    
    // Проверка на валидность даты
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return dateObj.toLocaleDateString('ru-RU', options);
  } catch (error) {
    console.error('Ошибка форматирования даты:', error);
    return '';
  }
};

/**
 * Форматирует время в читаемый вид
 * @param {Date|string|number} time - Время для форматирования
 * @returns {string} Отформатированное время
 */
export const formatTime = (time) => {
  if (!time) return '';
  
  try {
    const dateObj = time instanceof Date ? time : new Date(time);
    
    // Проверка на валидность даты
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const options = { hour: '2-digit', minute: '2-digit' };
    return dateObj.toLocaleTimeString('ru-RU', options);
  } catch (error) {
    console.error('Ошибка форматирования времени:', error);
    return '';
  }
};

/**
 * Форматирует дату и время в читаемый вид
 * @param {Date|string|number} dateTime - Дата и время для форматирования
 * @returns {string} Отформатированная дата и время
 */
export const formatDateTime = (dateTime) => {
  if (!dateTime) return '';
  
  try {
    const dateObj = dateTime instanceof Date ? dateTime : new Date(dateTime);
    
    // Проверка на валидность даты
    if (isNaN(dateObj.getTime())) {
      return '';
    }
    
    const options = { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit'
    };
    return dateObj.toLocaleString('ru-RU', options);
  } catch (error) {
    console.error('Ошибка форматирования даты и времени:', error);
    return '';
  }
};

/**
 * Форматирует число с разделителями тысяч
 * @param {number} number - Число для форматирования
 * @returns {string} Отформатированное число
 */
export const formatNumber = (number) => {
  if (number === undefined || number === null) return '';
  return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}; 