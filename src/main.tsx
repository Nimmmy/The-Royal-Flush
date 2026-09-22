import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import './styles.css';
import App from './App';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main className="fatal-error"><img src="/favicon.svg" width="52" height="52" alt="" /><h1>The Royal Flush</h1><p>Something went wrong loading the map.</p><button className="primary-button" onClick={() => window.location.reload()}>Try again</button></main> : this.props.children; }
}
ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
