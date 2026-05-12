/**
 * Client entry point.
 * This file bootstraps the React application by mounting the top-level `App` component into the DOM. It also sets up routing and authentication context.
 * It wraps the app with routing and the global `AuthProvider` so authentication state is available everywhere.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './index.css';

// Mount the React app into the #root element. `StrictMode` helps highlight
// potential problems during development but does not affect production behavior.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);