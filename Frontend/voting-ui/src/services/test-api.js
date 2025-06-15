// Простой скрипт для тестирования соединения с API

async function testApiConnection(baseUrl = 'http://localhost:5000') {
  try {
    console.log('Testing API connection to:', baseUrl);
    
    // Проверка основного URL
    const rootResponse = await fetch(`${baseUrl}/`, { method: 'GET' });
    console.log('Root endpoint response:', rootResponse.status, rootResponse.statusText);
    
    if (rootResponse.ok) {
      const data = await rootResponse.json();
      console.log('Root endpoint data:', data);
    }
    
    // Проверка endpoint для тестирования
    const testResponse = await fetch(`${baseUrl}/test-delete/1`, { method: 'GET' });
    console.log('Test endpoint response:', testResponse.status, testResponse.statusText);
    
    if (testResponse.ok) {
      const testData = await testResponse.json();
      console.log('Test endpoint data:', testData);
    }
    
    // Проверка списка голосований
    const electionsResponse = await fetch(`${baseUrl}/api/elections`, { method: 'GET' });
    console.log('Elections endpoint response:', electionsResponse.status, electionsResponse.statusText);
    
    if (electionsResponse.ok) {
      const electionsData = await electionsResponse.json();
      console.log('Elections data:', electionsData);
    }
    
    // Тест OPTIONS запроса, который используется для CORS preflight
    const optionsResponse = await fetch(`${baseUrl}/api/elections/1`, { 
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    console.log('OPTIONS request response:', optionsResponse.status, optionsResponse.statusText);
    console.log('OPTIONS response headers:', {
      'Access-Control-Allow-Origin': optionsResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': optionsResponse.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': optionsResponse.headers.get('Access-Control-Allow-Headers')
    });
    
    return true;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
}

// Экспортируем функцию для использования
export { testApiConnection };

// Если скрипт запущен напрямую
if (typeof window !== 'undefined') {
  window.testApiConnection = testApiConnection;
  console.log('testApiConnection function is available in the global scope. Run it with:');
  console.log('testApiConnection()');
} 