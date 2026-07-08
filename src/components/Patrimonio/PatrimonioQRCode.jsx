import './PatrimonioQRCode.css'

export default function PatrimonioQRCode({ config, item }) {
  const valor = `${config.modulo || config.tabela}:${item.id}`

  return (
    <section className="patrimonio-section">
      <header>
        <h3>QR Code</h3>
        <p>Identificação única do patrimônio.</p>
      </header>

      <div className="patrimonio-qrcode-box">
        <span>{valor}</span>
      </div>
    </section>
  )
}