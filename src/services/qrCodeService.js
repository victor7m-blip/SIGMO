import QRCode from 'qrcode'

export function gerarQrCodeArma() {
  if (globalThis.crypto?.randomUUID) {
    return `SIGMO-ARMA-${globalThis.crypto.randomUUID()}`
  }

  return `SIGMO-ARMA-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function gerarQrCodePolicial() {
  if (globalThis.crypto?.randomUUID) {
    return `SIGMO-POLICIAL-${globalThis.crypto.randomUUID()}`
  }

  return `SIGMO-POLICIAL-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function gerarImagemQrCode(valor) {
  if (!valor) return ''

  return QRCode.toDataURL(valor, {
    width: 220,
    margin: 2,
    errorCorrectionLevel: 'H'
  })
}