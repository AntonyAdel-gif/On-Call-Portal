// ============================================================================
// MAIN
// ----------------------------------------------------------------------------
// This is the very first JS file that runs (see index.html's <script> tag).
// Its only job is to find the empty <div id="root"> in index.html and tell
// React to render our <App /> component tree inside it.
// ============================================================================

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css'; // global styles + brand design tokens

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode> runs extra checks in development only (e.g. calling
  // some functions twice) to help catch bugs early. It has no effect on the
  // production build.
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
