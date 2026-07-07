const STORAGE_KEY = 'sigmo_user'

const INACTIVITY_LIMIT = 15 * 60 * 1000 // 15 minutos
const SESSION_LIMIT = 2 * 60 * 60 * 1000 // 2 horas

let inactivityTimer = null
let sessionTimer = null
let listeners = []

export function saveSession(user) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export function startSessionMonitor({ onLogout }) {
  stopSessionMonitor()

  function logout(reason) {
    stopSessionMonitor()

    if (typeof onLogout === 'function') {
      onLogout(reason)
    }
  }

  function restartInactivityTimer() {
    clearTimeout(inactivityTimer)

    inactivityTimer = setTimeout(() => {
      logout('INACTIVITY')
    }, INACTIVITY_LIMIT)
  }

  sessionTimer = setTimeout(() => {
    logout('SESSION_TIMEOUT')
  }, SESSION_LIMIT)

  const events = [
    'mousemove',
    'mousedown',
    'keydown',
    'click',
    'scroll',
    'touchstart'
  ]

  listeners = events.map((eventName) => {
    const handler = () => restartInactivityTimer()

    window.addEventListener(eventName, handler, true)

    return {
      eventName,
      handler
    }
  })

  restartInactivityTimer()

  return stopSessionMonitor
}

export function stopSessionMonitor() {
  clearTimeout(inactivityTimer)
  clearTimeout(sessionTimer)

  listeners.forEach(({ eventName, handler }) => {
    window.removeEventListener(eventName, handler, true)
  })

  listeners = []
}