const STORAGE_KEY = 'sigmo_user'
const SESSION_VERSION = 2

const INACTIVITY_LIMIT = 15 * 60 * 1000 // 15 minutos
const SESSION_LIMIT = 2 * 60 * 60 * 1000 // 2 horas

let inactivityTimer = null
let sessionTimer = null
let listeners = []

function now() {
  return Date.now()
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw)

    // Sessões antigas guardavam apenas o objeto do usuário.
    // Por segurança, elas não são mais aceitas.
    if (
      !parsed ||
      parsed.version !== SESSION_VERSION ||
      !parsed.user ||
      !Number.isFinite(parsed.createdAt) ||
      !Number.isFinite(parsed.expiresAt) ||
      !Number.isFinite(parsed.lastActivityAt)
    ) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }

    return parsed
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

function isSessionValid(session) {
  if (!session) return false

  const currentTime = now()

  if (currentTime >= session.expiresAt) {
    return false
  }

  if (currentTime - session.lastActivityAt >= INACTIVITY_LIMIT) {
    return false
  }

  return true
}

function updateLastActivity() {
  const session = readStoredSession()

  if (!isSessionValid(session)) {
    clearSession()
    return false
  }

  session.lastActivityAt = now()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))

  return true
}

export function saveSession(user) {
  const createdAt = now()

  const session = {
    version: SESSION_VERSION,
    user,
    createdAt,
    expiresAt: createdAt + SESSION_LIMIT,
    lastActivityAt: createdAt
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function loadSession() {
  const session = readStoredSession()

  if (!isSessionValid(session)) {
    clearSession()
    return null
  }

  return session.user
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export function startSessionMonitor({ onLogout }) {
  stopSessionMonitor()

  function logout(reason) {
    stopSessionMonitor()
    clearSession()

    if (typeof onLogout === 'function') {
      onLogout(reason)
    }
  }

  function scheduleTimers() {
    clearTimeout(inactivityTimer)
    clearTimeout(sessionTimer)

    const session = readStoredSession()

    if (!session) {
      logout('SESSION_TIMEOUT')
      return
    }

    const currentTime = now()
    const sessionRemaining = session.expiresAt - currentTime
    const inactivityRemaining =
      INACTIVITY_LIMIT - (currentTime - session.lastActivityAt)

    if (sessionRemaining <= 0) {
      logout('SESSION_TIMEOUT')
      return
    }

    if (inactivityRemaining <= 0) {
      logout('INACTIVITY')
      return
    }

    sessionTimer = setTimeout(() => {
      logout('SESSION_TIMEOUT')
    }, sessionRemaining)

    inactivityTimer = setTimeout(() => {
      logout('INACTIVITY')
    }, inactivityRemaining)
  }

  function registerActivity() {
    if (!updateLastActivity()) {
      logout('SESSION_TIMEOUT')
      return
    }

    scheduleTimers()
  }

  const events = [
    'mousemove',
    'mousedown',
    'keydown',
    'click',
    'scroll',
    'touchstart'
  ]

  listeners = events.map((eventName) => {
    const handler = () => registerActivity()

    window.addEventListener(eventName, handler, true)

    return {
      eventName,
      handler
    }
  })

  scheduleTimers()

  return stopSessionMonitor
}

export function stopSessionMonitor() {
  clearTimeout(inactivityTimer)
  clearTimeout(sessionTimer)

  inactivityTimer = null
  sessionTimer = null

  listeners.forEach(({ eventName, handler }) => {
    window.removeEventListener(eventName, handler, true)
  })

  listeners = []
}
