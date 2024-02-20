import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import packageJson from '../package.json';

console.log(`App version: ${packageJson.version}`);

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
