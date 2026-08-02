import { useEffect, useMemo, useState } from 'react'

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

function identificarHT(ht) {
  return ht?.patrimonio || ht?.numero_serie || 'HT sem identificação'
}

export default function HTOperacaoModal({
  aberto,
  modo,
  titulo,
  descricao,
  hts = [],
  policiais = [],
  entregas = [],
  salvando = false,
  onClose,
  onConfirm
}) {
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [policialId, setPolicialId] = useState('')
  const [devolucaoPrevista, setDevolucaoPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [acao, setAcao] = useState('ESTENDER')
  const [movimentacaoId, setMovimentacaoId] = useState('')

  useEffect(() => {
    if (!aberto) return
    setBusca('')
    setSelecionados([])
    setPolicialId('')
    setDevolucaoPrevista('')
    setObservacoes('')
    setAcao('ESTENDER')
    setMovimentacaoId('')
  }, [aberto, modo])

  const itens = useMemo(() => {
    const termo = normalizar(busca)
    if (modo === 'DEVOLUCAO' || modo === 'REGULARIZAR') {
      return entregas.filter((mov) => {
        const dados = mov?.dados || mov?.metadata?.dados_engine || {}
        return [dados.patrimonio, dados.numero_serie, dados.policial_nome, mov.recebedor_nome]
          .some((valor) => normalizar(valor).includes(termo))
      })
    }
    return hts.filter((ht) => [ht.patrimonio, ht.numero_serie, ht.marca, ht.modelo, ht.local_atual]
      .some((valor) => normalizar(valor).includes(termo)))
  }, [busca, modo, hts, entregas])

  if (!aberto) return null

  function alternar(id) {
    setSelecionados((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id])
  }

  async function confirmar(event) {
    event.preventDefault()
    const policial = policiais.find((item) => String(item.id) === String(policialId)) || null
    await onConfirm({
      ids: selecionados,
      policial,
      devolucaoPrevista: devolucaoPrevista || null,
      observacoes,
      acao,
      movimentacaoId
    })
  }

  const exigePolicial = modo === 'CARGA' || modo === 'CAUTELA'
  const exigePrazo = modo === 'CAUTELA' || (modo === 'REGULARIZAR' && acao === 'ESTENDER')

  return (
    <div className="ht-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onClose()}>
      <form className="ht-operation-modal" onSubmit={confirmar}>
        <header>
          <div><span>Operação patrimonial</span><h2>{titulo}</h2><p>{descricao}</p></div>
          <button type="button" onClick={onClose} disabled={salvando}>×</button>
        </header>

        <div className="ht-operation-modal-body">
          <label>Pesquisar</label>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Patrimônio, série, responsável ou modelo" autoFocus />

          {(modo === 'CARGA' || modo === 'CAUTELA') && (
            <div className="ht-operation-modal-list">
              {itens.length === 0 ? <div className="ht-transfer-empty">Nenhum HT disponível.</div> : itens.map((ht) => (
                <label className="ht-operation-select-item" key={ht.id}>
                  <input type="checkbox" checked={selecionados.includes(ht.id)} onChange={() => alternar(ht.id)} />
                  <div><strong>{identificarHT(ht)}</strong><span>{[ht.marca, ht.modelo].filter(Boolean).join(' ') || 'Rádio HT'} · {ht.local_atual || '-'}</span></div>
                </label>
              ))}
            </div>
          )}

          {modo === 'DEVOLUCAO' && (
            <div className="ht-operation-modal-list">
              {itens.length === 0 ? <div className="ht-transfer-empty">Nenhuma entrega aguardando devolução.</div> : itens.map((mov) => {
                const dados = mov?.dados || mov?.metadata?.dados_engine || {}
                return (
                  <label className="ht-operation-select-item" key={mov.id}>
                    <input type="checkbox" checked={selecionados.includes(mov.id)} onChange={() => alternar(mov.id)} />
                    <div><strong>{dados.patrimonio || dados.numero_serie || 'HT'}</strong><span>{dados.policial_nome || mov.recebedor_nome || 'Responsável não informado'} · {mov.tipo_movimentacao || mov.tipo}</span></div>
                  </label>
                )
              })}
            </div>
          )}

          {modo === 'REGULARIZAR' && (
            <>
              <label>Cautela</label>
              <select value={movimentacaoId} onChange={(e) => setMovimentacaoId(e.target.value)} required>
                <option value="">Selecione</option>
                {itens.map((mov) => {
                  const dados = mov?.dados || mov?.metadata?.dados_engine || {}
                  const prevista = dados.devolucao_prevista ? new Date(dados.devolucao_prevista).toLocaleString('pt-BR') : 'sem previsão'
                  return <option key={mov.id} value={mov.id}>{dados.patrimonio || dados.numero_serie || 'HT'} — {dados.policial_nome || mov.recebedor_nome || 'Responsável'} — {prevista}</option>
                })}
              </select>
              <label>Providência</label>
              <select value={acao} onChange={(e) => setAcao(e.target.value)}>
                <option value="ESTENDER">Estender prazo</option>
                <option value="SOLICITAR_P4">Solicitar providência ao P4</option>
                <option value="SOLICITAR_COMANDANTE">Solicitar providência ao Comandante</option>
              </select>
            </>
          )}

          {exigePolicial && (
            <><label>Policial recebedor</label><select value={policialId} onChange={(e) => setPolicialId(e.target.value)} required><option value="">Selecione um policial cadastrado</option>{policiais.map((p) => <option key={p.id} value={p.id}>{p.re ? `${p.re} — ` : ''}{p.nome_completo || p.nome}</option>)}</select></>
          )}

          {exigePrazo && (
            <><label>Previsão de devolução</label><input type="datetime-local" value={devolucaoPrevista} onChange={(e) => setDevolucaoPrevista(e.target.value)} required /></>
          )}

          <label>Observações</label>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows="4" placeholder="Registre os detalhes da operação" required={modo === 'REGULARIZAR'} />
        </div>

        <footer>
          <span>{modo === 'REGULARIZAR' ? 'Providência auditável' : `${selecionados.length} selecionado(s)`}</span>
          <button type="button" className="ht-btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="ht-btn-primary" disabled={salvando || (modo !== 'REGULARIZAR' && selecionados.length === 0)}>{salvando ? 'Processando...' : 'Confirmar'}</button>
        </footer>
      </form>
    </div>
  )
}
