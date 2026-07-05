import { useEffect, useState } from 'react'
import { supabase } from '../../../services/supabaseClient'
import { gerarImagemQrCode } from '../../../services/qrCodeService'
import './ArmaDetails.css'

export default function ArmaDetails({ arma }) {
  const [fotos, setFotos] = useState([])
  const [loadingFotos, setLoadingFotos] = useState(false)
  const [qrImagem, setQrImagem] = useState('')

  useEffect(() => {
    if (arma?.id) carregarFotos()
  }, [arma?.id])

  useEffect(() => {
    async function carregarQrCode() {
      if (!arma?.qr_code) {
        setQrImagem('')
        return
      }

      try {
        const imagem = await gerarImagemQrCode(arma.qr_code)
        setQrImagem(imagem)
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error)
        setQrImagem('')
      }
    }

    carregarQrCode()
  }, [arma?.qr_code])

  async function carregarFotos() {
    setLoadingFotos(true)

    const { data, error } = await supabase
      .from('sigmo_armas_fotos')
      .select('*')
      .eq('arma_id', arma.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar fotos:', error)
      setFotos([])
    } else {
      setFotos(data || [])
    }

    setLoadingFotos(false)
  }

  if (!arma) return null

  function Campo(label, valor, full = false) {
    return (
      <div className={`arma-detail-card ${full ? 'full' : ''}`}>
        <span>{label}</span>
        <strong>{valor || '-'}</strong>
      </div>
    )
  }

  return (
    <div className="arma-details">
      {Campo('Patrimônio', arma.patrimonio)}
      {Campo('Espécie', arma.especie)}
      {Campo('Marca', arma.marca)}
      {Campo('Modelo', arma.modelo)}
      {Campo('Calibre', arma.calibre)}
      {Campo('Número de Série', arma.numero_serie)}
      {Campo('Status', arma.status)}
      {Campo('Unidade', arma.unidade)}
      {Campo('Carga', arma.carga)}
      {Campo('Origem', arma.origem)}
      {Campo('Tombamento', arma.numero_tombamento, true)}
      {Campo('QR Code', arma.qr_code, true)}

      {qrImagem && (
        <div className="arma-detail-card full">
          <span>Etiqueta QR Code</span>

          <div className="arma-detail-qrcode">
            <img src={qrImagem} alt="QR Code da arma" />
          </div>
        </div>
      )}

      {Campo('Observações', arma.observacoes, true)}

      <div className="arma-detail-card full">
        <span>Fotos</span>

        {loadingFotos && <strong>Carregando fotos...</strong>}

        {!loadingFotos && fotos.length === 0 && (
          <strong>Nenhuma foto cadastrada.</strong>
        )}

        {!loadingFotos && fotos.length > 0 && (
          <div className="arma-detail-fotos">
            {fotos.map((foto) => (
              <a
                key={foto.id}
                href={foto.url}
                target="_blank"
                rel="noreferrer"
                className="arma-detail-foto"
              >
                <img src={foto.url} alt="Foto da arma" />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}