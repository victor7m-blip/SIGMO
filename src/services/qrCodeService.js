import QRCode from 'qrcode'

export function gerarQrCodeArma() {
  if (crypto?.randomUUID) {
    return `SIGMO-ARMA-${crypto.randomUUID()}`
  }

  return `SIGMO-ARMA-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function gerarQrCodePolicial() {
  if (crypto?.randomUUID) {
    return `SIGMO-POLICIAL-${crypto.randomUUID()}`
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