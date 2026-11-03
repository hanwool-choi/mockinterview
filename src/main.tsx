import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Gallery } from './avatar/Gallery';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';

document.documentElement.classList.add('js');
createRoot(document.getElementById('root')!).render(new URLSearchParams(location.search).has('avatars') ? <Gallery /> : <App />);
