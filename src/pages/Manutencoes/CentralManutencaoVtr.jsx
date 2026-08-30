import { useEffect, useMemo, useState } from 'react'
import {
  listarCentralManutencaoVtr,
  encaminharNovidadeManutencaoVtr,
  atualizarStatusManutencaoVtr,
  marcarNovidadeApuracaoVtr,
  salvarTriagemNovidadeVtr,
  formatarStatusManutencaoVtr
} from '../../services/centralManutencaoVtrService'
import './CentralManutencaoVtr.css'

const STATUS_FLUXO = [
  'ENCAMINHADA',
  'EM_MANUTENCAO',
  'AGUARDANDO_RETORNO',
  'CONCLUIDA'
]

const ROTULOS_CONDICAO = {
  NAO_AVALIADA: 'Ainda não avaliada',
  DISPONIVEL: 'Pode rodar',
  DISPONIVEL_COM_RESTRICAO: 'Pode rodar com restrição',
  INDISPONIVEL: 'Não pode rodar'
}

const ROTULOS_RESPONSABILIDADE = {
  NAO_DEFINIDA: 'Não definida',
  A_APURAR: 'A apurar',
  NAO_SE_APLICA: 'Não se aplica',
  INFORMADA_PELO_MOTORISTA: 'Informada pelo motorista',
  ASSUMIDA: 'Assumida',
  APURADA: 'Apurada'
}

function usuarioId(user) {
  return user?.id || user?.usuario_id || null
}

function usuarioNome(user) {
  return user?.nome || user?.name || user?.nome_completo || user?.re || 'USUÁRIO'
}

function statusAtual(item) {
  return String(item?.manutencao_status || 'AGUARDANDO_PROVIDENCIA').toUpperCase()
}

function proximaAcao(item) {
  const status = statusAtual(item)

  if (status === 'ENCAMINHADA') {
    return { status: 'EM_MANUTENCAO', rotulo: 'Iniciar manutenção' }
  }

  if (status === 'EM_MANUTENCAO') {
    return { status: 'AGUARDANDO_RETORNO', rotulo: 'Finalizar manutenção' }
  }

  if (status === 'AGUARDANDO_RETORNO') {
    return { status: 'CONCLUIDA', rotulo: 'Confirmar retorno / liberar VTR' }
  }

  return null
}

function etapaAtual(status) {
  const indice = STATUS_FLUXO.indexOf(String(status || '').toUpperCase())
  return indice < 0 ? -1 : indice
}

export default function CentralManutencaoVtr({ user, onAbrirRiv }) {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [detalhesAbertos, setDetalhesAbertos] = useState({})

  const [modal, setModal] = useState(null)
  const [formTriagem, setFormTriagem] = useState({
    disponibilidadeVtr: 'NAO_AVALIADA',
    responsabilidadeStatus: 'NAO_DEFINIDA',
    providencia: '',
    observacaoCondicao: ''
  })
  const [formEncaminhamento, setFormEncaminhamento] = useState({
    tipo: 'INTERNA',
    local: '',
    oficina: '',
    os: '',
    providencia: ''
  })
  const [formApuracao, setFormApuracao] = useState({
    documento: '',
    observacoes: ''
  })
  const [formAndamento, setFormAndamento] = useState({
    observacao: ''
  })

  async function carregar() {
    try {
      setLoading(true)
      setErro('')
      setItens(await listarCentralManutencaoVtr())
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar a Central de Manutenção de VTR.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return itens

    return itens.filter((item) =>
      [
        item.prefixo,
        item.placa,
        item.modelo,
        item.titulo,
        item.descricao,
        item.local_avaria,
        item.componente_avariado,
        item.manutencao_status,
        item.providencia_atual
      ].some((valor) => String(valor || '').toLowerCase().includes(termo))
    )
  }, [itens, busca])

  function abrirTriagem(item) {
    setFormTriagem({
      disponibilidadeVtr: item.disponibilidade_vtr || 'NAO_AVALIADA',
      responsabilidadeStatus:
        item.tipo_registro === 'MANUTENCAO'
          ? 'NAO_SE_APLICA'
          : (item.responsabilidade_status || 'NAO_DEFINIDA'),
      providencia:
        statusAtual(item) === 'AGUARDANDO_ENCAMINHAMENTO'
          ? 'ENCAMINHAR_MANUTENCAO'
          : '',
      observacaoCondicao: item.observacao_condicao_vtr || ''
    })
    setModal({ tipo: 'TRIAGEM', item })
  }

  function abrirEncaminhamento(item) {
    setFormEncaminhamento({
      tipo: item.manutencao_tipo || 'INTERNA',
      local: item.manutencao_local || '',
      oficina: item.manutencao_oficina || '',
      os: item.manutencao_os || '',
      providencia: item.providencia_atual || ''
    })
    setModal({ tipo: 'ENCAMINHAMENTO', item })
  }

  function abrirApuracao(item) {
    setFormApuracao({
      documento: item.apuracao_documento || '',
      observacoes: ''
    })
    setModal({ tipo: 'APURACAO', item })
  }

  function fecharModal() {
    if (!salvando) setModal(null)
  }

  function abrirAndamento(item) {
    const proxima = proximaAcao(item)
    if (!proxima) return

    setFormAndamento({ observacao: '' })
    setModal({
      tipo: 'ANDAMENTO',
      item,
      proxima
    })
  }

  async function confirmarTriagem() {
    if (!modal?.item) return

    if (formTriagem.disponibilidadeVtr === 'NAO_AVALIADA') {
      setErro('Na triagem, informe se a VTR pode ou não continuar rodando.')
      return
    }

    if (!formTriagem.providencia) {
      setErro('Selecione a providência atual para esta novidade.')
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await salvarTriagemNovidadeVtr({
        ocorrenciaId: modal.item.ocorrencia_id,
        disponibilidadeVtr: formTriagem.disponibilidadeVtr,
        responsabilidadeStatus: formTriagem.responsabilidadeStatus,
        providencia: formTriagem.providencia,
        observacaoCondicao: formTriagem.observacaoCondicao.trim(),
        usuarioId: usuarioId(user),
        usuarioNome: usuarioNome(user)
      })

      setModal(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar a triagem.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarEncaminhamento() {
    if (!modal?.item) return

    if (formEncaminhamento.tipo === 'INTERNA' && !formEncaminhamento.local.trim()) {
      setErro('Informe onde a VTR ficará para a manutenção interna.')
      return
    }

    if (formEncaminhamento.tipo === 'EXTERNA' && !formEncaminhamento.oficina.trim()) {
      setErro('Informe a oficina ou prestador da manutenção externa.')
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await encaminharNovidadeManutencaoVtr({
        ocorrenciaId: modal.item.ocorrencia_id,
        tipo: formEncaminhamento.tipo,
        local: formEncaminhamento.tipo === 'INTERNA' ? formEncaminhamento.local.trim() : '',
        oficina: formEncaminhamento.tipo === 'EXTERNA' ? formEncaminhamento.oficina.trim() : '',
        os: formEncaminhamento.os.trim(),
        providencia:
          formEncaminhamento.providencia.trim() ||
          `ENCAMINHADA PARA MANUTENÇÃO ${formEncaminhamento.tipo}`,
        usuarioId: usuarioId(user),
        usuarioNome: usuarioNome(user)
      })

      setModal(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível encaminhar a manutenção.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarApuracao() {
    if (!modal?.item) return

    try {
      setSalvando(true)
      setErro('')

      await marcarNovidadeApuracaoVtr({
        ocorrenciaId: modal.item.ocorrencia_id,
        documento: formApuracao.documento.trim(),
        observacoes: formApuracao.observacoes.trim(),
        usuarioId: usuarioId(user),
        usuarioNome: usuarioNome(user)
      })

      setModal(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar a apuração.')
    } finally {
      setSalvando(false)
    }
  }

  async function confirmarAndamento() {
    if (!modal?.item || !modal?.proxima) return

    const observacao = formAndamento.observacao.trim()
    const exigeObservacao =
      modal.proxima.status === 'AGUARDANDO_RETORNO' ||
      modal.proxima.status === 'CONCLUIDA'

    if (exigeObservacao && !observacao) {
      setErro(
        modal.proxima.status === 'AGUARDANDO_RETORNO'
          ? 'Informe o serviço executado ou a observação de finalização.'
          : 'Informe a observação de retorno/liberação da VTR.'
      )
      return
    }

    try {
      setSalvando(true)
      setErro('')

      await atualizarStatusManutencaoVtr({
        ocorrenciaId: modal.item.ocorrencia_id,
        status: modal.proxima.status,
        observacao: observacao || modal.proxima.rotulo,
        usuarioId: usuarioId(user),
        usuarioNome: usuarioNome(user)
      })

      setModal(null)
      setFormAndamento({ observacao: '' })
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar a manutenção.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section className="cmvtr">
      <div className="cmvtr-topo">
        <div>
          <span>VIATURAS</span>
          <h2>Central de Manutenção de VTR</h2>
          <p>
            A novidade entra em triagem, recebe uma providência e, quando necessário,
            segue para manutenção. A apuração administrativa permanece separada.
          </p>
        </div>

        <div className="cmvtr-topo-acoes">
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar prefixo, placa, avaria..."
          />
          <button type="button" onClick={carregar} disabled={loading || salvando}>
            Atualizar
          </button>
        </div>
      </div>

      {erro && <div className="cmvtr-erro">{erro}</div>}

      {loading ? (
        <div className="cmvtr-vazio">Carregando...</div>
      ) : lista.length === 0 ? (
        <div className="cmvtr-vazio">Nenhuma novidade de viatura em acompanhamento.</div>
      ) : (
        <div className="cmvtr-grade">
          {lista.map((item) => {
            const status = statusAtual(item)
            const triagemFeita =
              item.disponibilidade_vtr &&
              item.disponibilidade_vtr !== 'NAO_AVALIADA' &&
              Boolean(item.providencia_atual)
            const precisaEncaminhar = status === 'AGUARDANDO_ENCAMINHAMENTO'
            const proxima = proximaAcao(item)
            const detalhesVisiveis = detalhesAbertos[item.ocorrencia_id] === true
            const atual = etapaAtual(status)

            return (
              <article className="cmvtr-card" key={item.ocorrencia_id}>
                <header>
                  <div>
                    <span>{item.prefixo || 'VTR'}</span>
                    <h3>
                      {item.modelo || 'Viatura'}
                      {item.placa ? ` • ${item.placa}` : ''}
                    </h3>
                    <small className="cmvtr-situacao-vtr">
                      {String(item.situacao_viatura || 'SITUAÇÃO NÃO INFORMADA').replaceAll('_', ' ')}
                    </small>
                  </div>

                  <b>{formatarStatusManutencaoVtr(status)}</b>
                </header>

                <div className="cmvtr-novidade">
                  <small>
                    {item.tipo_registro === 'MANUTENCAO'
                      ? 'MANUTENÇÃO CORRETIVA'
                      : 'NOVIDADE / AVARIA'}
                  </small>
                  <h4>{item.titulo || (item.tipo_registro === 'MANUTENCAO' ? 'Manutenção registrada' : 'Novidade registrada')}</h4>
                  <p>{item.descricao || 'Sem descrição.'}</p>
                </div>

                <div className="cmvtr-resumo">
                  <div>
                    <small>
                      {item.tipo_registro === 'MANUTENCAO' ? 'Registro' : 'Local / componente'}
                    </small>
                    <strong>
                      {item.tipo_registro === 'MANUTENCAO'
                        ? 'MANUTENÇÃO REGISTRADA NO RIV'
                        : ([item.local_avaria, item.componente_avariado].filter(Boolean).join(' • ') || '—')}
                    </strong>
                  </div>
                  <div>
                    <small>Severidade</small>
                    <strong>{item.severidade || '—'}</strong>
                  </div>
                  <div>
                    <small>KM na constatação</small>
                    <strong>{item.km_constatacao ?? '—'}</strong>
                  </div>
                  <div className="cmvtr-resumo-providencia">
                    <small>Providência atual</small>
                    <strong>{item.providencia_atual || 'AGUARDANDO DEFINIÇÃO'}</strong>
                  </div>
                </div>

                <div className="cmvtr-triagem-resumo">
                  <div>
                    <small>Condição da VTR</small>
                    <strong>{ROTULOS_CONDICAO[item.disponibilidade_vtr] || 'Ainda não avaliada'}</strong>
                    {item.observacao_condicao_vtr && (
                      <span style={{ display: 'block', marginTop: 6, fontWeight: 700 }}>
                        Observação: {item.observacao_condicao_vtr}
                      </span>
                    )}
                  </div>
                  <div>
                    <small>Responsabilidade</small>
                    <strong>
                      {item.tipo_registro === 'MANUTENCAO'
                        ? 'Não se aplica ao registro técnico'
                        : (ROTULOS_RESPONSABILIDADE[item.responsabilidade_status] || 'Não definida')}
                    </strong>
                  </div>
                </div>

                {status !== 'AGUARDANDO_PROVIDENCIA' &&
                  status !== 'AGUARDANDO_ENCAMINHAMENTO' &&
                  status !== 'CANCELADA' && (
                    <div className="cmvtr-fluxo" aria-label="Andamento da manutenção">
                      {['Encaminhada', 'Em manutenção', 'Aguardando retorno', 'Concluída'].map((rotulo, indice) => (
                        <div
                          key={rotulo}
                          className={[
                            'cmvtr-etapa',
                            indice < atual ? 'is-concluida' : '',
                            indice === atual ? 'is-atual' : ''
                          ].filter(Boolean).join(' ')}
                        >
                          <span>{indice < atual || status === 'CONCLUIDA' ? '✓' : indice === atual ? '●' : '○'}</span>
                          <strong>{rotulo}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                {detalhesVisiveis && (
                  <div className="cmvtr-detalhes">
                    <div>
                      <small>Origem da constatação</small>
                      <strong>{String(item.origem_constatacao || '—').replaceAll('_', ' ')}</strong>
                    </div>
                    <div>
                      <small>Constatada por</small>
                      <strong>
                        {item.constatada_por_nome || '—'}
                        {item.constatada_por_re ? ` • RE ${item.constatada_por_re}` : ''}
                      </strong>
                    </div>
                    <div>
                      <small>Tipo de manutenção</small>
                      <strong>{String(item.manutencao_tipo || '—').replaceAll('_', ' ')}</strong>
                    </div>
                    <div>
                      <small>Local / oficina</small>
                      <strong>{item.manutencao_oficina || item.manutencao_local || '—'}</strong>
                    </div>
                    <div>
                      <small>OS / documento</small>
                      <strong>{item.manutencao_os || '—'}</strong>
                    </div>
                    <div>
                      <small>Data da constatação</small>
                      <strong>
                        {item.constatada_em
                          ? new Date(item.constatada_em).toLocaleString('pt-BR')
                          : '—'}
                      </strong>
                    </div>
                  </div>
                )}

                {item.requer_apuracao && (
                  <div className="cmvtr-apuracao">
                    <strong>Apuração administrativa</strong>
                    <span>
                      {item.apuracao_documento || 'Referência ainda não informada'}.
                      A apuração não bloqueia a manutenção.
                    </span>
                  </div>
                )}

                <footer>
                  {!triagemFeita && status !== 'CONCLUIDA' && (
                    <button className="cmvtr-primario" onClick={() => abrirTriagem(item)}>
                      Definir providência
                    </button>
                  )}

                  {triagemFeita &&
                    (status === 'AGUARDANDO_PROVIDENCIA' || status === 'AGUARDANDO_ENCAMINHAMENTO') && (
                      <button className="cmvtr-secundario" onClick={() => abrirTriagem(item)}>
                        Alterar triagem
                      </button>
                    )}

                  {precisaEncaminhar && (
                    <button className="cmvtr-primario" onClick={() => abrirEncaminhamento(item)}>
                      Encaminhar manutenção
                    </button>
                  )}

                  {proxima && (
                    <button className="cmvtr-primario" onClick={() => abrirAndamento(item)}>
                      {proxima.rotulo}
                    </button>
                  )}

                  {onAbrirRiv && (
                    <button className="cmvtr-riv" onClick={() => onAbrirRiv(item.viatura_id)}>
                      Abrir RIV
                    </button>
                  )}

                  <button
                    className="cmvtr-secundario"
                    onClick={() =>
                      setDetalhesAbertos((atualDetalhes) => ({
                        ...atualDetalhes,
                        [item.ocorrencia_id]: !detalhesVisiveis
                      }))
                    }
                  >
                    {detalhesVisiveis ? 'Ocultar detalhes' : 'Ver detalhes'}
                  </button>

                  {item.tipo_registro !== 'MANUTENCAO' && (
                    <button className="cmvtr-secundario" onClick={() => abrirApuracao(item)}>
                      {item.requer_apuracao ? 'Atualizar apuração' : 'Apuração'}
                    </button>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      )}

      {modal?.tipo === 'TRIAGEM' && (
        <div className="cmvtr-modal-backdrop" onMouseDown={fecharModal}>
          <section className="cmvtr-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>ETAPA 1</small>
                <h3>Triagem e providência</h3>
                <p>
                  Defina a condição operacional da VTR e o que será feito com esta novidade.
                </p>
              </div>
              <button type="button" onClick={fecharModal} disabled={salvando}>×</button>
            </header>

            <div className="cmvtr-modal-corpo">
              <fieldset className="cmvtr-opcoes">
                <legend>1. A VTR pode continuar rodando?</legend>
                {[
                  ['DISPONIVEL', 'Pode rodar'],
                  ['DISPONIVEL_COM_RESTRICAO', 'Pode rodar com restrição'],
                  ['INDISPONIVEL', 'Não pode rodar']
                ].map(([valor, rotulo]) => (
                  <button
                    type="button"
                    key={valor}
                    className={formTriagem.disponibilidadeVtr === valor ? 'is-selecionado' : ''}
                    onClick={() => setFormTriagem((atualForm) => ({
                      ...atualForm,
                      disponibilidadeVtr: valor
                    }))}
                  >
                    {rotulo}
                  </button>
                ))}
              </fieldset>

              <label>
                <span>
                  Observação da condição / restrição <small>(opcional)</small>
                </span>
                <textarea
                  rows={3}
                  value={formTriagem.observacaoCondicao}
                  onChange={(event) =>
                    setFormTriagem((atualForm) => ({
                      ...atualForm,
                      observacaoCondicao: event.target.value.toUpperCase()
                    }))
                  }
                  placeholder="Ex.: NÃO DESLIGAR A VTR DURANTE O SERVIÇO"
                />
              </label>

              <fieldset className="cmvtr-opcoes">
                <legend>2. Qual é a providência?</legend>
                {[
                  ['ACOMPANHAR', 'Acompanhar'],
                  ['ENCAMINHAR_MANUTENCAO', 'Encaminhar para manutenção'],
                  ['SEM_MANUTENCAO_NO_MOMENTO', 'Sem manutenção neste momento']
                ].map(([valor, rotulo]) => (
                  <button
                    type="button"
                    key={valor}
                    className={formTriagem.providencia === valor ? 'is-selecionado' : ''}
                    onClick={() => setFormTriagem((atualForm) => ({
                      ...atualForm,
                      providencia: valor
                    }))}
                  >
                    {rotulo}
                  </button>
                ))}
              </fieldset>

              {modal?.item?.tipo_registro !== 'MANUTENCAO' && (
                <fieldset className="cmvtr-opcoes">
                  <legend>3. Responsabilidade neste momento</legend>
                  {[
                    ['NAO_DEFINIDA', 'Não definida'],
                    ['A_APURAR', 'A apurar'],
                    ['NAO_SE_APLICA', 'Não se aplica']
                  ].map(([valor, rotulo]) => (
                    <button
                      type="button"
                      key={valor}
                      className={formTriagem.responsabilidadeStatus === valor ? 'is-selecionado' : ''}
                      onClick={() => setFormTriagem((atualForm) => ({
                        ...atualForm,
                        responsabilidadeStatus: valor
                      }))}
                    >
                      {rotulo}
                    </button>
                  ))}
                </fieldset>
              )}
            </div>

            <footer>
              <button type="button" className="cmvtr-secundario" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="cmvtr-primario" onClick={confirmarTriagem} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar triagem'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {modal?.tipo === 'ENCAMINHAMENTO' && (
        <div className="cmvtr-modal-backdrop" onMouseDown={fecharModal}>
          <section className="cmvtr-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>ETAPA 2</small>
                <h3>Encaminhar manutenção</h3>
                <p>Agora informe somente os dados necessários para o encaminhamento.</p>
              </div>
              <button type="button" onClick={fecharModal} disabled={salvando}>×</button>
            </header>

            <div className="cmvtr-modal-corpo">
              <fieldset className="cmvtr-opcoes cmvtr-opcoes-duas">
                <legend>Tipo de manutenção</legend>
                <button
                  type="button"
                  className={formEncaminhamento.tipo === 'INTERNA' ? 'is-selecionado' : ''}
                  onClick={() => setFormEncaminhamento((atualForm) => ({ ...atualForm, tipo: 'INTERNA' }))}
                >
                  Manutenção interna
                </button>
                <button
                  type="button"
                  className={formEncaminhamento.tipo === 'EXTERNA' ? 'is-selecionado' : ''}
                  onClick={() => setFormEncaminhamento((atualForm) => ({ ...atualForm, tipo: 'EXTERNA' }))}
                >
                  Manutenção externa
                </button>
              </fieldset>

              {formEncaminhamento.tipo === 'INTERNA' ? (
                <label>
                  <span>Onde a VTR ficará?</span>
                  <input
                    value={formEncaminhamento.local}
                    onChange={(event) => setFormEncaminhamento((atualForm) => ({
                      ...atualForm,
                      local: event.target.value.toUpperCase()
                    }))}
                    placeholder="Ex.: PÁTIO / OFICINA DA UNIDADE"
                  />
                </label>
              ) : (
                <label>
                  <span>Oficina / prestador</span>
                  <input
                    value={formEncaminhamento.oficina}
                    onChange={(event) => setFormEncaminhamento((atualForm) => ({
                      ...atualForm,
                      oficina: event.target.value.toUpperCase()
                    }))}
                    placeholder="Informe a oficina ou prestador"
                  />
                </label>
              )}

              <label>
                <span>OS / documento <small>(opcional)</small></span>
                <input
                  value={formEncaminhamento.os}
                  onChange={(event) => setFormEncaminhamento((atualForm) => ({
                    ...atualForm,
                    os: event.target.value.toUpperCase()
                  }))}
                  placeholder="Ordem de serviço, memorando..."
                />
              </label>

              <label>
                <span>Observação do encaminhamento <small>(opcional)</small></span>
                <textarea
                  rows={3}
                  value={formEncaminhamento.providencia}
                  onChange={(event) => setFormEncaminhamento((atualForm) => ({
                    ...atualForm,
                    providencia: event.target.value.toUpperCase()
                  }))}
                  placeholder="Observação adicional"
                />
              </label>
            </div>

            <footer>
              <button type="button" className="cmvtr-secundario" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="cmvtr-primario" onClick={confirmarEncaminhamento} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Confirmar encaminhamento'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {modal?.tipo === 'ANDAMENTO' && (
        <div className="cmvtr-modal-backdrop" onMouseDown={fecharModal}>
          <section className="cmvtr-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>ANDAMENTO DA MANUTENÇÃO</small>
                <h3>{modal.proxima?.rotulo}</h3>
                <p>
                  Registre a observação desta etapa antes de continuar.
                  {modal.proxima?.status === 'EM_MANUTENCAO'
                    ? ' Para o início da manutenção, a observação é opcional.'
                    : ' Nesta etapa a observação é obrigatória.'}
                </p>
              </div>
              <button type="button" onClick={fecharModal} disabled={salvando}>×</button>
            </header>

            <div className="cmvtr-modal-corpo">
              <div>
                <small>VTR</small>
                <strong style={{ display: 'block', marginTop: 4 }}>
                  {modal.item?.prefixo || 'VTR'}
                  {modal.item?.placa ? ` • ${modal.item.placa}` : ''}
                </strong>
              </div>

              <label>
                <span>
                  {modal.proxima?.status === 'AGUARDANDO_RETORNO'
                    ? 'Serviço executado / observações'
                    : modal.proxima?.status === 'CONCLUIDA'
                    ? 'Observação de retorno / liberação'
                    : 'Observação do início'}
                  {modal.proxima?.status === 'EM_MANUTENCAO' && <small> (opcional)</small>}
                </span>
                <textarea
                  rows={4}
                  value={formAndamento.observacao}
                  onChange={(event) =>
                    setFormAndamento({
                      observacao: event.target.value.toUpperCase()
                    })
                  }
                  placeholder={
                    modal.proxima?.status === 'AGUARDANDO_RETORNO'
                      ? 'Descreva o serviço executado e o estado da VTR após a manutenção.'
                      : modal.proxima?.status === 'CONCLUIDA'
                      ? 'Informe as condições do retorno e da liberação da VTR.'
                      : 'Observação sobre o início da manutenção.'
                  }
                />
              </label>
            </div>

            <footer>
              <button type="button" className="cmvtr-secundario" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="cmvtr-primario" onClick={confirmarAndamento} disabled={salvando}>
                {salvando ? 'Salvando...' : `Confirmar — ${modal.proxima?.rotulo}`}
              </button>
            </footer>
          </section>
        </div>
      )}

      {modal?.tipo === 'APURACAO' && (
        <div className="cmvtr-modal-backdrop" onMouseDown={fecharModal}>
          <section className="cmvtr-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>TRILHA SEPARADA</small>
                <h3>Apuração administrativa</h3>
                <p>A apuração não impede o andamento da manutenção.</p>
              </div>
              <button type="button" onClick={fecharModal} disabled={salvando}>×</button>
            </header>

            <div className="cmvtr-modal-corpo">
              <label>
                <span>Documento / referência</span>
                <input
                  value={formApuracao.documento}
                  onChange={(event) => setFormApuracao((atualForm) => ({
                    ...atualForm,
                    documento: event.target.value.toUpperCase()
                  }))}
                  placeholder="Ex.: PARTE, MEMORANDO, SINDICÂNCIA..."
                />
              </label>

              <label>
                <span>Observações</span>
                <textarea
                  rows={4}
                  value={formApuracao.observacoes}
                  onChange={(event) => setFormApuracao((atualForm) => ({
                    ...atualForm,
                    observacoes: event.target.value.toUpperCase()
                  }))}
                  placeholder="Observações da apuração"
                />
              </label>
            </div>

            <footer>
              <button type="button" className="cmvtr-secundario" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </button>
              <button type="button" className="cmvtr-primario" onClick={confirmarApuracao} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar apuração'}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  )
}
