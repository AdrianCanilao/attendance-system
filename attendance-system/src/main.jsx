import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

/*
 * Global SweetAlert2 replacement for the browser's default alert().
 * Existing system alerts automatically use the same modern UI without
 * requiring every page to implement its own alert component.
 */
const showAlert = (message) => {
  const text = String(message ?? '')

  if (window.Swal) {
    const lower = text.toLowerCase()
    const isError =
      lower.includes('failed') ||
      lower.includes('error') ||
      lower.includes('unable') ||
      lower.includes('invalid') ||
      lower.includes('required') ||
      lower.includes('not found') ||
      lower.includes('cannot') ||
      lower.includes('must ') ||
      lower.includes('please ')

    return window.Swal.fire({
      icon: isError ? 'error' : 'success',
      title: isError ? 'Please check' : 'Success',
      text,
      confirmButtonText: 'OK',
      confirmButtonColor: '#f97316',
      customClass: {
        popup: 'cibo-swal-popup',
        title: 'cibo-swal-title',
        confirmButton: 'cibo-swal-confirm',
      },
      buttonsStyling: true,
    })
  }

  // Fallback if the CDN has not loaded yet.
  return window.__nativeAlert?.(text)
}

window.__nativeAlert = window.alert.bind(window)
window.alert = showAlert

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
