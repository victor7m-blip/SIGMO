import { useEffect, useMemo, useState } from 'react'

function normalizar(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()
}

function identificarTaser(taser) {
  return taser?.patrimonio || taser?.numero_serie || 'Taser sem identificação'
}

export default function TaserOperacaoModal({
  aberto,
  modo,
  titulo,
  descricao,
  tasers = [],
  policiais = [],
  entregas = [],
  salvando = false,
  onClose,
  onConfirm
}) {
  const [busca, setBusca] = useState('')
  const [selecionados, setSelecionados] = useState([])
  const [policialId, setPolicialId] = useState('')
  const [rePolicial, setRePolicial] = useState('')
  const [erroPolicial, setErroPolicial] = useState('')
  const [devolucaoPrevista, setDevolucaoPrevista] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [acao, setAcao] = useState('ESTENDER')
  const [movimentacaoId, setMovimentacaoId] = useState('')

  useEffect(() => {
    if (!aberto) return
    setBusca('')
    setSelecionados([])
    setPolicialId('')
    setRePolicial('')
    setErroPolicial('')
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
    return tasers.filter((taser) => [taser.patrimonio, taser.numero_serie, taser.marca, taser.modelo, taser.local_atual]
      .some((valor) => normalizar(valor).includes(termo)))
  }, [busca, modo, tasers, entregas])

  if (!aberto) return null

  function alternar(id) {
    setSelecionados((atuais) => atuais.includes(id) ? atuais.filter((item) => item !== id) : [...atuais, id])
  }

  function formatarRE(valor) {
    return String(valor || '')
      .replace(/\D/g, '')
      .slice(0, 6)
  }

  function normalizarRE(valor) {
    return String(valor || '')
      .replace(/\D/g, '')
      .slice(0, 6)
  }

  function localizarPolicial() {
    const alvo = normalizarRE(rePolicial)

    if (!alvo) {
      setPolicialId('')
      setErroPolicial('Informe o RE do policial.')
      return
    }

    if (alvo.length !== 6) {
      setPolicialId('')
      setErroPolicial('Informe os 6 dígitos do RE.')
      return
    }

    const encontrado =
      policiais.find(
        (item) =>
          normalizarRE(item?.re) === alvo
      ) || null

    if (!encontrado) {
      setPolicialId('')
      setErroPolicial('Policial não localizado para este RE.')
      return
    }

    setPolicialId(encontrado.id)
    setErroPolicial('')
  }

  const policialSelecionado =
    policiais.find(
      (item) =>
        String(item.id) ===
        String(policialId)
    ) || null

  async function confirmar(event) {
    event.preventDefault()

    const policialOriginal =
      policiais.find(
        (item) =>
          String(item.id) ===
          String(policialId)
      ) || null

    const policial =
      policialOriginal
        ? {
            ...policialOriginal,
            re: normalizarRE(
              policialOriginal.re ||
              rePolicial
            )
          }
        : null

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
    <div className="taser-modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && !salvando && onClose()}>
      <form className="taser-operation-modal" onSubmit={confirmar}>
        <header>
          <div><span>Operação patrimonial</span><h2>{titulo}</h2><p>{descricao}</p></div>
          <button type="button" onClick={onClose} disabled={salvando}>×</button>
        </header>

        <div className="taser-operation-modal-body">
          <label>Pesquisar</label>
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Patrimônio, série, responsável ou modelo" autoFocus />

          {(modo === 'CARGA' || modo === 'CAUTELA') && (
            <div className="taser-operation-modal-list">
              {itens.length === 0 ? <div className="taser-transfer-empty">Nenhum Taser disponível.</div> : itens.map((taser) => (
                <label className="taser-operation-select-item" key={taser.id}>
                  <input type="checkbox" checked={selecionados.includes(taser.id)} onChange={() => alternar(taser.id)} />
                  <div><strong>{identificarTaser(taser)}</strong><span>{[taser.marca, taser.modelo].filter(Boolean).join(' ') || 'Dispositivo Taser'} · {taser.local_atual || '-'}</span></div>
                </label>
              ))}
            </div>
          )}

          {modo === 'DEVOLUCAO' && (
            <div className="taser-operation-modal-list">
              {itens.length === 0 ? <div className="taser-transfer-empty">Nenhuma entrega aguardando devolução.</div> : itens.map((mov) => {
                const dados = mov?.dados || mov?.metadata?.dados_engine || {}
                return (
                  <label className="taser-operation-select-item" key={mov.id}>
                    <input type="checkbox" checked={selecionados.includes(mov.id)} onChange={() => alternar(mov.id)} />
                    <div><strong>{dados.patrimonio || dados.numero_serie || 'TASER'}</strong><span>{dados.policial_nome || mov.recebedor_nome || 'Responsável não informado'} · {mov.tipo_movimentacao || mov.tipo}</span></div>
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
                  return <option key={mov.id} value={mov.id}>{dados.patrimonio || dados.numero_serie || 'TASER'} — {dados.policial_nome || mov.recebedor_nome || 'Responsável'} — {prevista}</option>
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
            <>
              <label>Policial recebedor</label>

              <div className="taser-transfer-receiver-search">
                <input
                  type="text"
                  value={rePolicial}
                  onChange={(e) => {
                    setRePolicial(
                      formatarRE(e.target.value)
                    )
                    setPolicialId('')
                    setErroPolicial('')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      localizarPolicial()
                    }
                  }}
                  placeholder="Ex: 123456"
                  maxLength={6}
                  autoComplete="off"
                />

                <button
                  type="button"
                  className="taser-btn-secondary"
                  onClick={localizarPolicial}
                >
                  Localizar
                </button>
              </div>

              {policialSelecionado && (
                <div className="taser-transfer-receiver-found">
                  <strong>
                    {policialSelecionado.nome_guerra ||
                      policialSelecionado.nome_completo ||
                      policialSelecionado.nome ||
                      'Policial'}
                  </strong>

                  <span>
                    RE {normalizarRE(policialSelecionado.re || rePolicial)}
                  </span>
                </div>
              )}

              {erroPolicial && (
                <small className="taser-transfer-receiver-error">
                  {erroPolicial}
                </small>
              )}
            </>
          )}

          {exigePrazo && (
            <><label>Previsão de devolução</label><input type="datetime-local" value={devolucaoPrevista} onChange={(e) => setDevolucaoPrevista(e.target.value)} required /></>
          )}

          <label>Observações</label>
          <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows="4" placeholder="Registre os detalhes da operação" required={modo === 'REGULARIZAR'} />
        </div>

        <footer>
          <span>{modo === 'REGULARIZAR' ? 'Providência auditável' : `${selecionados.length} selecionado(s)`}</span>
          <button type="button" className="taser-btn-secondary" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button
            type="submit"
            className="taser-btn-primary"
            disabled={
              salvando ||
              (modo !== 'REGULARIZAR' && selecionados.length === 0) ||
              (exigePolicial && !policialId)
            }
          >
            {salvando ? 'Processando...' : 'Confirmar'}
          </button>
        </footer>
      </form>
    </div>
  )
}
