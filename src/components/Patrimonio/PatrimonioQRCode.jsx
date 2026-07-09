import { QRCodeSVG } from 'qrcode.react'
import './PatrimonioQRCode.css'

export default function PatrimonioQRCode({ config, item }) {
  const valor = `${config.modulo || config.tabela}:${item.id}`
  const nomeArquivo = `qrcode-${item.patrimonio || item.id}.svg`

  function baixarQRCode() {
    const svg = document.getElementById('patrimonio-qrcode-svg')
    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = nomeArquivo
    link.click()

    URL.revokeObjectURL(url)
  }

  function imprimirQRCode() {
    const svg = document.getElementById('patrimonio-qrcode-svg')
    const janela = window.open('', '_blank')

    janela.document.write(`
      <html>
        <head>
          <title>QR Code</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: grid;
              place-items: center;
              min-height: 100vh;
              text-align: center;
            }
            svg {
              width: 260px;
              height: 260px;
            }
          </style>
        </head>
        <body>
          <div>
            ${svg.outerHTML}
            <h2>${item.patrimonio || 'Patrimônio'}</h2>
            <p>${valor}</p>
          </div>
          <script>
            window.print()
          </script>
        </body>
      </html>
    `)

    janela.document.close()
  }

  return (
    <section className="patrimonio-section">
      <header>
        <h3>QR Code</h3>
        <p>Identificação única do patrimônio.</p>
      </header>

      <div className="patrimonio-qrcode-box">
        <QRCodeSVG
          id="patrimonio-qrcode-svg"
          value={valor}
          size={180}
          level="H"
        />

        <div className="patrimonio-qrcode-info">
          <strong>{item.patrimonio || item.nome || 'Patrimônio'}</strong>
          <span>{valor}</span>

          <div className="patrimonio-qrcode-actions">
            <button type="button" onClick={baixarQRCode}>
              Baixar QR Code
            </button>

            <button type="button" onClick={imprimirQRCode}>
              Imprimir
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}