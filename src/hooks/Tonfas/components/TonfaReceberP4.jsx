import { useEffect, useMemo, useState } from 'react'

import {
  aceitarTransferencia,
  listarTransferenciasPendentes,
  recusarTransferencia
} from '../../../services/patrimonioTransferenciaService'

import '../styles/TonfaReceberP4.css'

function normalizarTexto(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function obterNomeOperador(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function formatarDataHora(valor) {
  if (!valor) return '—'

  const data = new Date(valor)

  if (Number.isNaN(data.getTime())) {
    return String(valor)
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data)
}

function obterDescricaoMaterial(item) {
  const categoria = normalizarTexto(item?.categoria)

  if (categoria === 'CASSETETE') {
    return 'CASSETETE'
  }

  if (categoria === 'TONFA') {
    return 'TONFA'
  }

  return categoria || 'PATRIMÔNIO'
}

export default function TonfaReceberP4({
  user,
  modo = 'RECEBER_P4',
  onVoltar,
  onConcluido
}) {
  const [transferencias, setTransferencias] = useState([])
  const [selecionadoId, setSelecionadoId] = useState('')
  const [busca, setBusca] = useState('')
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [acaoAtiva, setAcaoAtiva] = useState('')
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const devolucao = modo === 'RECEBER_DEVOLUCAO_P4'

  const destinoCodigo = devolucao ? 'P4' : 'SVDD'

  const titulo = devolucao
    ? 'Receber devolução do SVDD'
    : 'Receber do P4'

  async function carregar() {
    try {
      setCarregando(true)
      setErro('')

      const resultado = await listarTransferenciasPendentes({
  destinoCodigo,
  limite: 500
})

      const pendentes = Array.isArray(resultado)
        ? resultado
        : []

      setTransferencias(pendentes)

      if (
        selecionadoId &&
        !pendentes.some(
          (item) => String(item.id) === String(selecionadoId)
        )
      ) {
        setSelecionadoId('')
        setMotivoRecusa('')
        setAcaoAtiva('')
      }
    } catch (error) {
      console.error(
        'Erro ao carregar transferências pendentes:',
        error
      )

      setTransferencias([])
      setErro(
        error?.message ||
          devolucao
          ? 'Não foi possível carregar as devoluções pendentes para o P4.'
          : 'Não foi possível carregar as transferências pendentes do P4.'
      )
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [modo])

  const transferenciasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca)

    if (!termo) return transferencias

    return transferencias.filter((item) =>
      [
        item?.protocolo,
        item?.categoria,
        item?.origem_codigo,
        item?.origem_nome,
        item?.destino_codigo,
        item?.destino_nome,
        item?.enviado_por_nome,
        item?.enviado_por_re,
        item?.observacoes,
        item?.motivo
      ].some((valor) =>
        normalizarTexto(valor).includes(termo)
      )
    )
  }, [busca, transferencias])

  const selecionado = useMemo(
    () =>
      transferencias.find(
        (item) => String(item.id) === String(selecionadoId)
      ) || null,
    [transferencias, selecionadoId]
  )

  function selecionar(item) {
    setSelecionadoId(item.id)
    setMotivoRecusa('')
    setAcaoAtiva('')
    setErro('')
    setMensagem('')
  }

  async function aceitar() {
    if (!selecionado) {
      setErro('Selecione uma transferência pendente.')
      return
    }

    const confirmarAceite = window.confirm(
  devolucao
    ? `Confirmar o recebimento desta devolução pelo P4?`
    : `Confirmar o recebimento de ${selecionado.quantidade} unidade(s) de ${obterDescricaoMaterial(
        selecionado
      )} no Cofre do SVDD?`
)

    if (!confirmarAceite) return

    try {
      setSalvando(true)
      setAcaoAtiva('ACEITAR')
      setErro('')
      setMensagem('')

      const resultado = await aceitarTransferencia({
        transferenciaId: selecionado.id,
        user
      })

      const quantidade = Number(selecionado.quantidade || 0)
      const protocolo = selecionado.protocolo || 'sem protocolo'

      await carregar()

      setMensagem(
  devolucao
    ? `Transferência ${protocolo} aceita. Material devolvido ao P4.`
    : `Transferência ${protocolo} aceita. ${quantidade} unidade(s) recebida(s) no Cofre do SVDD.`
)

      onConcluido?.({
        ...resultado,
        total: quantidade,
        acao: 'ACEITA',
        mensagem:
          devolucao
            ? `Transferência ${protocolo} aceita e material recebido pelo P4.`
            : `Transferência ${protocolo} aceita e material recebido pelo SVDD.`
      })
    } catch (error) {
      console.error('Erro ao aceitar transferência:', error)
      setErro(
        error?.message ||
          'Não foi possível aceitar a transferência.'
      )
    } finally {
      setSalvando(false)
      setAcaoAtiva('')
    }
  }

  async function recusar() {
    if (!selecionado) {
      setErro('Selecione uma transferência pendente.')
      return
    }

    const motivo = motivoRecusa.trim()

    if (!motivo) {
      setErro('Informe o motivo da recusa.')
      return
    }

    const confirmarRecusa = window.confirm(
      `Recusar a transferência ${selecionado.protocolo || ''}?`
    )

    if (!confirmarRecusa) return

    try {
      setSalvando(true)
      setAcaoAtiva('RECUSAR')
      setErro('')
      setMensagem('')

      const resultado = await recusarTransferencia({
        transferenciaId: selecionado.id,
        motivoRecusa: motivo,
        user
      })

      const protocolo = selecionado.protocolo || 'sem protocolo'

      await carregar()

      setMensagem(
        devolucao
          ? `Transferência ${protocolo} recusada. O SVDD foi notificado.`
          : `Transferência ${protocolo} recusada. O P4 foi notificado.`
      )

      onConcluido?.({
        transferencia: resultado,
        total: 0,
        acao: 'RECUSADA',
        mensagem:
          devolucao
            ? `Transferência ${protocolo} recusada pelo P4.`
            : `Transferência ${protocolo} recusada pelo SVDD.`
      })
    } catch (error) {
      console.error('Erro ao recusar transferência:', error)
      setErro(
        error?.message ||
          'Não foi possível recusar a transferência.'
      )
    } finally {
      setSalvando(false)
      setAcaoAtiva('')
    }
  }

  return (
    <main className="tonfa-p4-page">
      <header className="tonfa-p4-header">
        <div>
          <span>SIGMO • MOVIMENTAÇÃO PATRIMONIAL</span>
          <h1>{titulo}</h1>
          <p>
  {devolucao
    ? 'Consulte as devoluções enviadas pelo SVDD e aceite ou recuse o retorno ao P4.'
    : 'Consulte as transferências enviadas pelo P4 e aceite ou recuse o recebimento no Cofre do SVDD.'}
</p>
        </div>

        <div className="tonfa-p4-operador">
          <span>Operador responsável</span>
          <strong>{obterNomeOperador(user)}</strong>
        </div>
      </header>

      <div className="tonfa-p4-top-actions">
        <button
          type="button"
          onClick={onVoltar}
          disabled={salvando}
        >
          Voltar
        </button>

        <button
          type="button"
          onClick={carregar}
          disabled={carregando || salvando}
        >
          {carregando ? 'Atualizando...' : 'Atualizar pendências'}
        </button>
      </div>

      {erro && (
        <div className="tonfa-p4-feedback tonfa-p4-feedback-error">
          {erro}
        </div>
      )}

      {mensagem && (
        <div className="tonfa-p4-feedback tonfa-p4-feedback-success">
          {mensagem}
        </div>
      )}

      <section className="tonfa-p4-layout">
        <div className="tonfa-p4-card tonfa-p4-lista">
          <div className="tonfa-p4-card-title">
            <div>
              <span>ETAPA 1</span>
              <h2>Transferências pendentes</h2>
            </div>

            <strong>
              {transferenciasFiltradas.length} pendência(s)
            </strong>
          </div>

          <input
            className="tonfa-p4-search"
            type="text"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="PESQUISAR PROTOCOLO, MATERIAL, ORIGEM OU RESPONSÁVEL"
          />

          <div className="tonfa-p4-table-wrap">
            <table className="tonfa-p4-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Material</th>
                  <th>Quantidade</th>
                  <th>Enviado por</th>
                  <th>Data</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {carregando && (
                  <tr>
                    <td colSpan={6} className="tonfa-p4-empty">
                      Carregando transferências pendentes...
                    </td>
                  </tr>
                )}

                {!carregando &&
                  transferenciasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="tonfa-p4-empty">
                        {devolucao
                          ? 'Nenhuma devolução pendente para o P4.'
                          : 'Nenhuma transferência pendente para o SVDD.'}
                      </td>
                    </tr>
                  )}

                {!carregando &&
                  transferenciasFiltradas.map((item) => {
                    const ativo =
                      String(item.id) === String(selecionadoId)

                    return (
                      <tr
                        key={item.id}
                        className={ativo ? 'is-selected' : ''}
                      >
                        <td>
                          <strong>{item.protocolo || '—'}</strong>
                          <small>
                            {item.origem_codigo || 'P4'} →{' '}
                            {item.destino_codigo || 'SVDD'}
                          </small>
                        </td>

                        <td>
                          <strong>{obterDescricaoMaterial(item)}</strong>
                          <small>{item.observacoes || 'SEM OBSERVAÇÕES'}</small>
                        </td>

                        <td>{Number(item.quantidade || 0)}</td>

                        <td>
                          {item.enviado_por_nome || '—'}
                          {item.enviado_por_re && (
                            <small>RE {item.enviado_por_re}</small>
                          )}
                        </td>

                        <td>{formatarDataHora(item.enviado_em)}</td>

                        <td>
                          <button
                            type="button"
                            onClick={() => selecionar(item)}
                            disabled={salvando}
                          >
                            {ativo ? 'Selecionado' : 'Selecionar'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="tonfa-p4-card tonfa-p4-resumo">
          <div className="tonfa-p4-card-title">
            <div>
              <span>ETAPA 2</span>
              <h2>Analisar transferência</h2>
            </div>
          </div>

          <div className="tonfa-p4-summary-data">
            <div>
              <span>Protocolo</span>
              <strong>{selecionado?.protocolo || 'NÃO SELECIONADO'}</strong>
            </div>

            <div>
              <span>Material</span>
              <strong>
                {selecionado
                  ? obterDescricaoMaterial(selecionado)
                  : '—'}
              </strong>
            </div>

            <div>
              <span>Quantidade</span>
              <strong>{Number(selecionado?.quantidade || 0)}</strong>
            </div>

            <div>
              <span>Origem</span>
              <strong>
                {selecionado?.origem_nome ||
                  selecionado?.origem_codigo ||
                  'P4'}
              </strong>
            </div>

            <div>
              <span>Destino</span>
              <strong>
                {selecionado?.destino_nome || 'COFRE DO SVDD'}
              </strong>
            </div>

            <div>
              <span>Enviado em</span>
              <strong>{formatarDataHora(selecionado?.enviado_em)}</strong>
            </div>
          </div>

          {selecionado?.observacoes && (
            <label>
              {devolucao ? 'Observações do SVDD' : 'Observações do P4'}
              <textarea
                value={selecionado.observacoes}
                readOnly
              />
            </label>
          )}

          <button
            type="button"
            className="tonfa-p4-confirm"
            onClick={aceitar}
            disabled={!selecionado || salvando}
          >
           {devolucao
  ? 'Aceitar devolução ao P4'
  : 'Aceitar e receber no SVDD'}
          </button>

          <label>
            Motivo da recusa
            <textarea
              value={motivoRecusa}
              onChange={(event) =>
                setMotivoRecusa(event.target.value)
              }
              placeholder="OBRIGATÓRIO PARA RECUSAR A TRANSFERÊNCIA"
              disabled={!selecionado || salvando}
            />
          </label>

          <button
            type="button"
            className="tonfa-p4-confirm tonfa-p4-reject"
            onClick={recusar}
            disabled={!selecionado || salvando}
          >
            {salvando && acaoAtiva === 'RECUSAR'
              ? 'Registrando recusa...'
              : 'Recusar transferência'}
          </button>
        </aside>
      </section>
    </main>
  )
}
