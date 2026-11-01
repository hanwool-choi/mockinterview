import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';

document.documentElement.classList.add('js');
createRoot(document.getElementById('root')!).render(<App />);
