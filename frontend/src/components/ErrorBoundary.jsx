import { Component } from 'react';

/**
 * Last line of defence: if a render bug slips through, show a recoverable screen
 * instead of a blank page. (Bad AI output never gets this far — it's stopped by
 * validateDeck — this is for bugs in our own code.)
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[Recall] render crash', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h1>Something broke on our side.</h1>
        <p>Your saved decks are safe. Reload to keep studying.</p>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Recall</button>
      </div>
    );
  }
}
