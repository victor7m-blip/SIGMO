import { useEffect, useMemo, useState } from 'react'
import '../styles/TaserBaixaModal.css'

const MOTIVOS = ['IRRECUPERÁVEL', 'EXTRAVIO', 'FURTO/ROUBO', 'ALIENAÇÃO', 'DEVOLUÇÃO AO ÓRGÃO DE ORIGEM', 'OUTRO']

export default function TaserBaixaModal({ aberto, tasers = [], salvando = false, onClose, onConfirm }) {
  const [taserId, setTaserId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])

  useEffect(() => {
    if (!aberto) return
    setTaserId(''); setMotivo(''); setObservacoes(''); setFotos([])
  }, [aberto])

  const taser = useMemo(() => tasers.find((item) => item.id === taserId) || null, [tasers, taserId])
  if (!aberto) return null

  function enviar(event) {
    event.preventDefault()
    onConfirm({ taser, motivo, observacoes, fotos })
  }

  return (
    <div className="taser-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onClose()}>
      <form className="taser-baixa-modal" onSubmit={enviar}>
        <header><div><span>Baixa patrimonial</span><h2>Solicitar baixa de Taser</h2><p>A baixa só será efetivada após aprovação do Comandante da Cia.</p></div><button type="button" onClick={onClose} disabled={salvando}>×</button></header>
        <div className="taser-baixa-body">
          <label>Equipamento<select value={taserId} onChange={(e) => setTaserId(e.target.value)} required><option value="">Selecione um Taser do P4</option>{tasers.map((item) => <option key={item.id} value={item.id}>{item.patrimonio || item.numero_serie} — {item.marca || ''} {item.modelo || ''}</option>)}</select></label>
          {taser && <div className="taser-baixa-resumo"><strong>{taser.patrimonio || taser.numero_serie}</strong><span>{taser.local_atual || 'Local não informado'} · {taser.status_operacional}</span></div>}
          <label>Motivo<select value={motivo} onChange={(e) => setMotivo(e.target.value)} required><option value="">Selecione</option>{MOTIVOS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Observações<textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={5} required placeholder="Descreva o motivo, as condições do equipamento e demais informações para análise." /></label>
          <label>Fotos obrigatórias<input type="file" accept="image/*" multiple onChange={(e) => setFotos(Array.from(e.target.files || []))} required /></label>
          <small>{fotos.length} foto(s) selecionada(s). Data e hora serão registradas automaticamente.</small>
        </div>
        <footer><button type="button" className="taser-btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button><button type="submit" className="taser-btn-primary" disabled={salvando || !taser}>{salvando ? 'Enviando...' : 'Solicitar baixa'}</button></footer>
      </form>
    </div>
  )
}
