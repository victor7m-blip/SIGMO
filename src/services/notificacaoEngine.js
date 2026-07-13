const listeners = []

export function registrarListener(listener) {
  listeners.push(listener)

  return () => {
    const index =
      listeners.indexOf(listener)

    if (index >= 0) {
      listeners.splice(index, 1)
    }
  }
}

export function emitirNotificacao(evento) {
  listeners.forEach((listener) =>
    listener(evento)
  )
}