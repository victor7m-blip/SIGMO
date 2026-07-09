import './PatrimonioQRCode.css'

export default function PatrimonioQRCode({ item, qrCode }) {
  return (
    <div className="patrimonio-qrcode">
      <div className="patrimonio-section-header">
        <div>
          <h3>QR Code</h3>
          <p>Identificação rápida do item patrimonial.</p>
        </div>
      </div>

      <div className="patrimonio-qrcode-box">
        {qrCode ? (
          <img src={qrCode} alt="QR Code do patrimônio" />
        ) : (
          <div className="patrimonio-qrcode-placeholder">
            QR Code será gerado após selecionar ou salvar o item.
          </div>
        )}

        <div>
          <strong>{item?.patrimonio || item?.nome || 'Item não selecionado'}</strong>
          <span>{item?.numero_serie || item?.local || 'Sem dados complementares'}</span>
        </div>
      </div>
    </div>
  )
}