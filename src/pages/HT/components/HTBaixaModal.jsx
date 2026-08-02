import { useEffect, useMemo, useState } from 'react'
import '../styles/HTBaixaModal.css'

const MOTIVOS = ['IRRECUPERÁVEL', 'EXTRAVIO', 'FURTO/ROUBO', 'ALIENAÇÃO', 'DEVOLUÇÃO AO ÓRGÃO DE ORIGEM', 'OUTRO']

export default function HTBaixaModal({ aberto, hts = [], salvando = false, onClose, onConfirm }) {
  const [htId, setHtId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState([])

  useEffect(() => {
    if (!aberto) return
    setHtId(''); setMotivo(''); setObservacoes(''); setFotos([])
  }, [aberto])

  const ht = useMemo(() => hts.find((item) => item.id === htId) || null, [hts, htId])
  if (!aberto) return null

  function enviar(event) {
    event.preventDefault()
    onConfirm({ ht, motivo, observacoes, fotos })
  }

  return (
    <div className="ht-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onClose()}>
      <form className="ht-baixa-modal" onSubmit={enviar}>
        <header><div><span>Baixa patrimonial</span><h2>Solicitar baixa de HT</h2><p>A baixa só será efetivada após aprovação do Comandante da Cia.</p></div><button type="button" onClick={onClose} disabled={salvando}>×</button></header>
        <div className="ht-baixa-body">
          <label>Equipamento<select value={htId} onChange={(e) => setHtId(e.target.value)} required><option value="">Selecione um HT do P4</option>{hts.map((item) => <option key={item.id} value={item.id}>{item.patrimonio || item.numero_serie} — {item.marca || ''} {item.modelo || ''}</option>)}</select></label>
          {ht && <div className="ht-baixa-resumo"><strong>{ht.patrimonio || ht.numero_serie}</strong><span>{ht.local_atual || 'Local não informado'} · {ht.status_operacional}</span></div>}
          <label>Motivo<select value={motivo} onChange={(e) => setMotivo(e.target.value)} required><option value="">Selecione</option>{MOTIVOS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Observações<textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={5} required placeholder="Descreva o motivo, as condições do equipamento e demais informações para análise." /></label>
          <label>Fotos obrigatórias<input type="file" accept="image/*" multiple onChange={(e) => setFotos(Array.from(e.target.files || []))} required /></label>
          <small>{fotos.length} foto(s) selecionada(s). Data e hora serão registradas automaticamente.</small>
        </div>
        <footer><button type="button" className="ht-btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button><button type="submit" className="ht-btn-primary" disabled={salvando || !ht}>{salvando ? 'Enviando...' : 'Solicitar baixa'}</button></footer>
      </form>
    </div>
  )
}
