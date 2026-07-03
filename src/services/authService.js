export function saveSession(user) {
  localStorage.setItem('sigmo_user', JSON.stringify(user))
}

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem('sigmo_user') || 'null')
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem('sigmo_user')
}