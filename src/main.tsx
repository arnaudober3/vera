import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { notificationService } from './services/notifications.ts'

notificationService.bootstrap();

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App/>
    </StrictMode>,
)
