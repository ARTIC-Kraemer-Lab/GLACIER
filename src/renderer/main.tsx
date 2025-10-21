import React from 'react';
import ReactDOM from 'react-dom/client';

const App = React.lazy(() => import('./App'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense
      fallback={
        <iframe src="loading.html" style={{ border: 'none', width: '100%', height: '100%' }} />
      }
    >
      <App />
    </React.Suspense>
  </React.StrictMode>
);
