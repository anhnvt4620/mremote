import { render } from 'preact';
import { App } from './App.jsx';
import './styles.css';
import '@xterm/xterm/css/xterm.css';

render(<App />, document.getElementById('root'));
