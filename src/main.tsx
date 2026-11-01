import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import '@fontsource/nanum-pen-script/korean-400.css';
import '@fontsource/nanum-pen-script/latin-400.css';
import './styles.css';

document.documentElement.classList.add('js');
createRoot(document.getElementById('root')!).render(<App />);
