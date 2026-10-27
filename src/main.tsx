import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/barlow-condensed/700.css';
import '@fontsource/barlow-condensed/800.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/dm-mono/400.css';
import App from './App';
import './styles.css';

class ErrorBoundary extends React.Component<React.PropsWithChildren, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return <main className="error-page"><h1>A little trouble on the pitch.</h1><p>Your saved results are still here. Reload to get back in the game.</p><button className="primary-button" onClick={() => location.reload()}>Reload Futbol</button></main>;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>);
