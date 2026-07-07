import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import './QrScanner.css'

export default function QrScanner({ open, onRead, onClose }) {
  const scannerRef = useRef(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return

    async function iniciarScanner() {
      try {
        setErro('')

        const scanner = new Html5Qrcode('sigmo-qr-reader')
        scannerRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          async (decodedText) => {
            await pararScanner()
            onRead(decodedText)
          }
        )
      } catch (error) {
        console.error(error)

        setErro(
          typeof error === 'string'
            ? error
            : error?.message || JSON.stringify(error)
        )
      }
    }

    iniciarScanner()

    return () => {
      pararScanner()
    }
  }, [open])

  async function pararScanner() {
    try {
      if (scannerRef.current) {
        const scanner = scannerRef.current
        scannerRef.current = null

        if (scanner.isScanning) {
          await scanner.stop()
        }

        await scanner.clear()
      }
    } catch (error) {
      console.error('Erro ao fechar scanner:', error)
    }
  }

  async function fechar() {
    await pararScanner()
    onClose()
  }

  if (!open) return null

  return (
    <div className="qr-scanner-backdrop">
      <section className="qr-scanner-modal">
        <header className="qr-scanner-header">
          <div>
            <span>SIGMO</span>
            <h2>Ler QR Code</h2>
            <p>Aponte a câmera para a etiqueta.</p>
          </div>

          <button type="button" onClick={fechar}>
            ×
          </button>
        </header>

        <div className="qr-scanner-body">
          <div id="sigmo-qr-reader" className="qr-scanner-reader" />

          {erro && <p className="qr-scanner-error">{erro}</p>}
        </div>

        <footer className="qr-scanner-footer">
          <button type="button" onClick={fechar}>
            Fechar câmera
          </button>
        </footer>
      </section>
    </div>
  )
}