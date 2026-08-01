// Must come first: the hooks in hooks/* initialise their singletons at import
// time, so the one-shot local-data sweep has to run before anything reads
// localStorage.
import './storage/cleanup.ts'
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App/>
    </StrictMode>,
)
