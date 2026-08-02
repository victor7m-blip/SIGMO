import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import './PatrimonioQRCode.css'

export default function PatrimonioQRCode({ item }) {
  const [aberto, setAberto] = useState(false)

  if (!item) {
    return (
      <div className="patrimonio-qrcode">
        <div className="patrimonio-qrcode-placeholder">
          Selecione um patrimônio.
        </div>
      </div>
    )
  }

  const valor =
    item.qr_code ||
    item.patrimonio ||
    item.id?.toString() ||
    ''

  return (
    <section className="patrimonio-qrcode">
      <div className="patrimonio-section-header">
        <div>
          <h3>QR Code</h3>
          <p>Identificação rápida do patrimônio.</p>
        </div>
      </div>

      <button
        type="button"
        className="patrimonio-qrcode-box"
        onClick={() => setAberto(true)}
      >
        <QRCodeSVG value={valor} size={180} includeMargin />

        <div className="patrimonio-qrcode-info">
          <strong>{item.patrimonio}</strong>
          <span>{item.numero_serie || '-'}</span>
          <span>{item.marca || '-'}</span>
          <span>{item.modelo || '-'}</span>
        </div>
      </button>

      {aberto && (
        <div className="patrimonio-qrcode-modal" onClick={() => setAberto(false)}>
          <div className="patrimonio-qrcode-modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="patrimonio-qrcode-modal-close"
              onClick={() => setAberto(false)}
            >
              Fechar
            </button>

            <QRCodeSVG value={valor} size={320} includeMargin />

            <strong>{item.patrimonio}</strong>
            <span>{item.numero_serie || '-'}</span>
          </div>
        </div>
      )}
    </section>
  )
}