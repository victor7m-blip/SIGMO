import { useEffect, useState } from 'react'
import DetailsModal from '../../../components/DetailsModal/DetailsModal'
import { supabase } from '../../../services/supabaseClient'
import { gerarImagemQrCode } from '../../../services/qrCodeService'

export default function PolicialViewModal({ policial, onClose }) {
  const [fotos, setFotos] = useState([])
  const [loadingFotos, setLoadingFotos] = useState(false)
  const [qrImagem, setQrImagem] = useState('')

  useEffect(() => {
    if (policial?.id) carregarFotos()
  }, [policial?.id])

  useEffect(() => {
    async function carregarQrCode() {
      if (!policial?.qr_code) {
        setQrImagem('')
        return
      }

      try {
        const imagem = await gerarImagemQrCode(policial.qr_code)
        setQrImagem(imagem)
      } catch (error) {
        console.error('Erro ao gerar QR Code:', error)
        setQrImagem('')
      }
    }

    carregarQrCode()
  }, [policial?.qr_code])

  async function carregarFotos() {
    setLoadingFotos(true)

    const { data, error } = await supabase
      .from('sigmo_policiais_fotos')
      .select('*')
      .eq('policial_id', policial.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao carregar fotos:', error)
      setFotos([])
    } else {
      setFotos(data || [])
    }

    setLoadingFotos(false)
  }

  if (!policial) return null

  function Campo(label, valor, full = false) {
    return (
      <div className={`policial-detail-card ${full ? 'full' : ''}`}>
        <span>{label}</span>
        <strong>{valor || '-'}</strong>
      </div>
    )
  }

  return (
    <DetailsModal
      isOpen={!!policial}
      title="Detalhes do Policial"
      subtitle={`${policial.posto_graduacao || ''} ${policial.nome_guerra || ''}`}
      onClose={onClose}
    >
      <div className="policial-details">
        {Campo('Nome completo', policial.nome, true)}
        {Campo('Nome de guerra', policial.nome_guerra)}
        {Campo('RE', policial.re)}
        {Campo('Posto/Graduação', policial.posto_graduacao)}
        {Campo('Companhia', policial.companhia)}
        {Campo('Pelotão', policial.pelotao)}
        {Campo('Equipe', policial.equipe)}
        {Campo('Função', policial.funcao)}
        {Campo('Telefone', policial.telefone)}
        {Campo('E-mail', policial.email)}
        {Campo('CPF', policial.cpf)}
        {Campo('RG', policial.rg)}
        {Campo('Perfil', policial.perfil)}
        {Campo('Situação', policial.situacao)}
        {Campo('QR Code', policial.qr_code, true)}

        {qrImagem && (
          <div className="policial-detail-card full">
            <span>Etiqueta QR Code</span>

            <div className="policial-detail-qrcode">
              <img src={qrImagem} alt="QR Code do policial" />
            </div>
          </div>
        )}

        {Campo('Observações', policial.observacoes, true)}

        <div className="policial-detail-card full">
          <span>Fotos</span>

          {loadingFotos && <strong>Carregando fotos...</strong>}

          {!loadingFotos && fotos.length === 0 && (
            <strong>Nenhuma foto cadastrada.</strong>
          )}

          {!loadingFotos && fotos.length > 0 && (
            <div className="policial-detail-fotos">
              {fotos.map((foto) => (
                <a
                  key={foto.id}
                  href={foto.url}
                  target="_blank"
                  rel="noreferrer"
                  className="policial-detail-foto"
                >
                  <img src={foto.url} alt="Foto do policial" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </DetailsModal>
  )
}