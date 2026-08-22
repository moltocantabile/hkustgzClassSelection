import { App } from './ui/app';

const rootEl = document.getElementById('root');
if (rootEl){
  ReactDOM.createRoot(rootEl).render(<App />);
}
