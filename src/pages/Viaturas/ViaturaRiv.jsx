import { useEffect, useMemo, useState } from 'react'

import {
  alterarStatusOcorrenciaRiv,
  concluirAvariaRiv,
  reabrirAvariaRiv,
  calcularStatusManutencao,
  corrigirQuilometragem,
  ITENS_MANUTENCAO_RIV,
  podeCorrigirQuilometragem,
  obterRivResumo,
  registrarOcorrenciaRiv,
  registrarQuilometragem,
  salvarManutencaoRiv,
  enviarFotosOcorrenciaRiv,
  obterFotosRivPorViatura,
  concluirManutencaoRiv,
  obterHistoricoOcorrenciaRiv,
  podeReabrirManutencaoRiv,
  reabrirManutencaoRiv,
  ORIGENS_NOVIDADE_VTR,
  SEVERIDADES_NOVIDADE_VTR,
  DISPONIBILIDADES_NOVIDADE_VTR,
  RESPONSABILIDADES_NOVIDADE_VTR,
  podeGerenciarAvariasConhecidas,
  definirAvariaConhecidaRiv
} from '../../services/viaturasRivService'

import {
  enviarDocumentoNovidadeVtr
} from '../../services/novidadesVtrService'

const OCORRENCIA_VAZIA = {
  tipo: 'AVARIA',
  titulo: '',
  descricao: '',
  modoAvaria: 'NOVA',
  origemConstatacao: 'DURANTE_SERVICO',
  localAvaria: '',
  componenteAvariado: '',
  severidade: 'BAIXA',
  disponibilidadeVtr: 'NAO_AVALIADA',
  responsabilidadeStatus: 'NAO_DEFINIDA',
  ocorrenciaPaiId: '',
  agravamentoDescricao: '',
  documentoConstatacao: ''
}

function formatarData(valor) {
  if (!valor) return '—'
  return new Date(`${valor}T00:00:00`).toLocaleDateString('pt-BR')
}

function formatarKm(valor) {
  if (valor == null || valor === '') return '—'
  return `${Number(valor).toLocaleString('pt-BR')} km`
}

export default function ViaturaRiv({ user, viatura, onUpdated }) {
  const [dados, setDados] = useState({
    quilometragemAtual: Number(viatura.quilometragem_atual || 0),
    historicoKm: [],
    manutencoes: [],
    ocorrencias: []
  })
  const [km, setKm] = useState(String(viatura.quilometragem_atual || ''))
  const [kmObs, setKmObs] = useState('')
  const [ocorrencia, setOcorrencia] = useState(OCORRENCIA_VAZIA)
  const [editandoItem, setEditandoItem] = useState(null)
  const [formManut, setFormManut] = useState(null)
  const [correcaoKm, setCorrecaoKm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  const [fotosNovaOcorrencia, setFotosNovaOcorrencia] = useState([])
  const [arquivoDocumentoNovaOcorrencia, setArquivoDocumentoNovaOcorrencia] = useState(null)
  const [fotosRiv, setFotosRiv] = useState([])
  const [fotoAmpliada, setFotoAmpliada] = useState(null)
  const [visualizandoRegistro, setVisualizandoRegistro] = useState(null)
  const [historicoRegistro, setHistoricoRegistro] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [reabrindoManutencao, setReabrindoManutencao] = useState(null)
  const [fechandoAvaria, setFechandoAvaria] = useState(null)
  const [reabrindoAvaria, setReabrindoAvaria] = useState(null)
  const [erroFechamentoAvaria, setErroFechamentoAvaria] = useState('')
  const [abaRiv, setAbaRiv] = useState('RESUMO')
  const [formNovaAvariaAberto, setFormNovaAvariaAberto] = useState(false)
  const [formNovaManutencaoAberto, setFormNovaManutencaoAberto] = useState(false)

  async function carregar() {
    try {
      setLoading(true)
      setErro('')
      const [resumo, fotos] = await Promise.all([
        obterRivResumo(viatura.id),
        obterFotosRivPorViatura(viatura.id)
      ])
      setDados(resumo)
      setFotosRiv(fotos)
      setKm(String(resumo.quilometragemAtual || ''))
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar o RIV.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [viatura.id])

  const alertas = useMemo(() => {
    const padroes = ITENS_MANUTENCAO_RIV.map((item) => {
      const registro = dados.manutencoes.find((m) => m.item === item.value)
      return { ...item, registro, status: calcularStatusManutencao(registro, dados.quilometragemAtual) }
    })

    const personalizados = dados.manutencoes
      .filter((m) => m.item_personalizado)
      .map((registro) => ({
        value: registro.item,
        label: registro.nome_item || registro.item,
        margemKmPadrao: registro.margem_alerta_km ?? 1000,
        margemDiasPadrao: registro.margem_alerta_dias ?? 30,
        personalizado: true,
        registro,
        status: calcularStatusManutencao(registro, dados.quilometragemAtual)
      }))

    return [...padroes, ...personalizados]
  }, [dados.manutencoes, dados.quilometragemAtual])

  const avariasAbertas = useMemo(
    () => dados.ocorrencias.filter(
      (item) =>
        item.tipo === 'AVARIA' &&
        !item.resolvida &&
        !item.agravamento &&
        !item.ocorrencia_pai_id
    ),
    [dados.ocorrencias]
  )

  const avariasConhecidas = useMemo(
    () => avariasAbertas.filter((item) => item.exibir_avaria_conhecida === true),
    [avariasAbertas]
  )

  const manutencoesEmAndamento = useMemo(
    () =>
      dados.ocorrencias.filter((item) => {
        const status = String(item.manutencao_status || '').toUpperCase()

        if (item.resolvida || status === 'CONCLUIDA' || status === 'CANCELADA') {
          return false
        }

        if (item.tipo === 'MANUTENCAO') {
          return true
        }

        return item.tipo === 'AVARIA' && item.encaminhada_manutencao === true
      }),
    [dados.ocorrencias]
  )

  const registrosHistoricos = useMemo(
    () =>
      dados.ocorrencias.filter((item) => {
        if (item.tipo === 'AVARIA') {
          // Agravamento é um evento do histórico da avaria original,
          // e não uma nova avaria independente em aberto.
          return Boolean(item.resolvida || item.agravamento || item.ocorrencia_pai_id)
        }

        if (item.tipo === 'MANUTENCAO') {
          const status = String(item.manutencao_status || '').toUpperCase()
          return Boolean(
            item.resolvida ||
            status === 'CONCLUIDA' ||
            status === 'CANCELADA'
          )
        }

        // Observações e demais registros factuais permanecem no histórico.
        return true
      }),
    [dados.ocorrencias]
  )

  const resumoRiv = useMemo(() => ({
    avariasAbertas: avariasAbertas.length,
    manutencoesAbertas: manutencoesEmAndamento.length,
    preventivasVencidas: alertas.filter((item) => item.status.nivel === 'VENCIDO').length,
    preventivasAtencao: alertas.filter((item) => item.status.nivel === 'ATENCAO').length,
    registros: dados.ocorrencias.length
  }), [avariasAbertas.length, manutencoesEmAndamento.length, alertas, dados.ocorrencias.length])

  const podeCorrigirKm = podeCorrigirQuilometragem(user)
  const podeReabrirManutencao = podeReabrirManutencaoRiv(user)
  const podeGerenciarConhecidas = podeGerenciarAvariasConhecidas(user)

  async function alternarAvariaConhecida(item) {
    try {
      setOcupado(true)
      setErro('')
      await definirAvariaConhecidaRiv({
        item,
        exibir: item.exibir_avaria_conhecida !== true,
        user
      })
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível atualizar as avarias conhecidas.')
    } finally {
      setOcupado(false)
    }
  }

  async function salvarKm(event) {
    event.preventDefault()

    try {
      setOcupado(true)
      setErro('')

      await registrarQuilometragem({
        viatura: {
          ...viatura,
          quilometragem_atual: dados.quilometragemAtual
        },
        quilometragem: km,
        observacao: kmObs,
        user
      })

      setKmObs('')
      await carregar()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível registrar a quilometragem.')
    } finally {
      setOcupado(false)
    }
  }

  function abrirManutencao(item) {
    const registro = dados.manutencoes.find((m) => m.item === item.value)

    setEditandoItem(item)
    setFormManut({
      nomeItem: registro?.nome_item || item.label,
      ultimaData: registro?.ultima_data || '',
      ultimaKm: registro?.ultima_km ?? dados.quilometragemAtual ?? '',
      proximaData: registro?.proxima_data || '',
      proximaKm: registro?.proxima_km ?? '',
      margemAlertaKm:
        registro?.margem_alerta_km ?? item.margemKmPadrao,
      margemAlertaDias:
        registro?.margem_alerta_dias ?? item.margemDiasPadrao,
      observacoes: registro?.observacoes || ''
    })
  }


  function novaManutencaoPersonalizada() {
    const codigo = `CUSTOM_${globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`}`
    setEditandoItem({ value: codigo, label: 'Novo item', personalizado: true, novo: true, margemKmPadrao: 1000, margemDiasPadrao: 30 })
    setFormManut({ nomeItem: '', ultimaData: '', ultimaKm: dados.quilometragemAtual ?? '', proximaData: '', proximaKm: '', margemAlertaKm: 1000, margemAlertaDias: 30, observacoes: '' })
  }

  async function salvarCorrecaoKm(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await corrigirQuilometragem({ viaturaId: viatura.id, novaQuilometragem: correcaoKm.quilometragem, justificativa: correcaoKm.justificativa, user })
      setCorrecaoKm(null)
      await carregar()
      await onUpdated?.()
    } catch (error) {
      setErro(error?.message || 'Não foi possível corrigir a quilometragem.')
    } finally {
      setOcupado(false)
    }
  }

  async function salvarManut(event) {
    event.preventDefault()

    try {
      setOcupado(true)
      setErro('')

      await salvarManutencaoRiv({
        viaturaId: viatura.id,
        item: editandoItem.value,
        nomeItem: formManut.nomeItem || editandoItem.label,
        itemPersonalizado: Boolean(editandoItem.personalizado),
        ...formManut,
        user
      })

      setEditandoItem(null)
      setFormManut(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível salvar a manutenção.')
    } finally {
      setOcupado(false)
    }
  }

  async function salvarOcorrencia(event) {
    event.preventDefault()

    try {
      setOcupado(true)
      setErro('')

      const registro = await registrarOcorrenciaRiv({
        viatura: {
          ...viatura,
          quilometragem_atual: dados.quilometragemAtual
        },
        ...ocorrencia,
        agravamento: ocorrencia.tipo === 'AVARIA' && ocorrencia.modoAvaria === 'AGRAVAMENTO',
        ocorrenciaPaiId: ocorrencia.modoAvaria === 'AGRAVAMENTO' ? ocorrencia.ocorrenciaPaiId : null,
        user
      })

      if (arquivoDocumentoNovaOcorrencia) {
        await enviarDocumentoNovidadeVtr({
          viaturaId: viatura.id,
          ocorrenciaId: registro.id,
          etapa: 'CONSTATACAO',
          arquivo: arquivoDocumentoNovaOcorrencia,
          user
        })
      }

      if (fotosNovaOcorrencia.length > 0) {
        await enviarFotosOcorrenciaRiv({
          viaturaId: viatura.id,
          ocorrenciaId: registro.id,
          tipo: ocorrencia.tipo,
          fase: 'ANTES',
          arquivos: fotosNovaOcorrencia,
          user
        })
      }

      setOcorrencia(OCORRENCIA_VAZIA)
      setFotosNovaOcorrencia([])
      setArquivoDocumentoNovaOcorrencia(null)
      setFormNovaAvariaAberto(false)
      setFormNovaManutencaoAberto(false)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível registrar a ocorrência.')
    } finally {
      setOcupado(false)
    }
  }

  async function adicionarFotosRegistro(item, arquivos, fase = 'ANTES') {
    const lista = Array.from(arquivos || [])
    if (!lista.length) return
    try {
      setOcupado(true)
      setErro('')
      await enviarFotosOcorrenciaRiv({
        viaturaId: viatura.id,
        ocorrenciaId: item.id,
        tipo: item.tipo,
        fase,
        arquivos: lista,
        user
      })
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível adicionar as fotos.')
    } finally {
      setOcupado(false)
    }
  }

  async function visualizarRegistro(item) {
    try {
      setVisualizandoRegistro(item)
      setHistoricoRegistro([])
      setCarregandoHistorico(true)
      setErro('')
      setHistoricoRegistro(await obterHistoricoOcorrenciaRiv(item.id))
    } catch (error) {
      setErro(error?.message || 'Não foi possível carregar o histórico do registro.')
    } finally {
      setCarregandoHistorico(false)
    }
  }

  async function concluirManutencao(item) {
    if (!window.confirm('Concluir esta manutenção? Depois de concluída, ela ficará bloqueada para alterações.')) return
    try {
      setOcupado(true)
      setErro('')
      await concluirManutencaoRiv(item, user)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível concluir a manutenção.')
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarReabertura(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await reabrirManutencaoRiv(reabrindoManutencao.item, reabrindoManutencao.justificativa, user)
      setReabrindoManutencao(null)
      setVisualizandoRegistro(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível reabrir a manutenção.')
    } finally {
      setOcupado(false)
    }
  }

  function abrirFechamentoAvaria(item) {
    setErroFechamentoAvaria('')
    setFechandoAvaria({ item, providencia: '', observacoes: '' })
  }

  async function confirmarFechamentoAvaria(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await concluirAvariaRiv({
        item: fechandoAvaria.item,
        providencia: fechandoAvaria.providencia,
        observacoes: fechandoAvaria.observacoes,
        user
      })
      setFechandoAvaria(null)
      await carregar()
    } catch (error) {
      const mensagem = error?.message || 'Não foi possível concluir a avaria.'
      setErro(mensagem)
      setErroFechamentoAvaria(mensagem)
    } finally {
      setOcupado(false)
    }
  }

  async function confirmarReaberturaAvaria(event) {
    event.preventDefault()
    try {
      setOcupado(true)
      setErro('')
      await reabrirAvariaRiv({
        item: reabrindoAvaria.item,
        justificativa: reabrindoAvaria.justificativa,
        user
      })
      setReabrindoAvaria(null)
      setVisualizandoRegistro(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível reabrir a avaria.')
    } finally {
      setOcupado(false)
    }
  }

  if (loading) {
    return <div className="viaturas-vazio">Carregando RIV...</div>
  }

  return (
    <div className="riv">
      {erro && <div className="viaturas-erro">{erro}</div>}

      <nav className="riv__nav" aria-label="Seções do RIV">
        <button type="button" className={abaRiv === 'RESUMO' ? 'is-ativa' : ''} onClick={() => setAbaRiv('RESUMO')}>Visão geral</button>
        <button type="button" className={abaRiv === 'KM' ? 'is-ativa' : ''} onClick={() => setAbaRiv('KM')}>Quilometragem</button>
        <button type="button" className={abaRiv === 'PREVENTIVAS' ? 'is-ativa' : ''} onClick={() => setAbaRiv('PREVENTIVAS')}>Preventivas</button>
        <button type="button" className={abaRiv === 'NOVIDADES' ? 'is-ativa' : ''} onClick={() => setAbaRiv('NOVIDADES')}>
          Avarias
          {resumoRiv.avariasAbertas > 0 && <span>{resumoRiv.avariasAbertas}</span>}
        </button>
        <button type="button" className={abaRiv === 'MANUTENCAO' ? 'is-ativa' : ''} onClick={() => setAbaRiv('MANUTENCAO')}>
          Manutenção
          {resumoRiv.manutencoesAbertas > 0 && <span>{resumoRiv.manutencoesAbertas}</span>}
        </button>
        <button type="button" className={abaRiv === 'HISTORICO' ? 'is-ativa' : ''} onClick={() => setAbaRiv('HISTORICO')}>Histórico</button>
      </nav>

      {abaRiv === 'RESUMO' && (
        <section className="riv__resumo-home">
          <div className="riv__resumo-intro">
            <div>
              <small>VISÃO GERAL DO RIV</small>
              <h3>Situação atual da viatura</h3>
              <p>Escolha uma área acima para consultar ou registrar informações. Aqui ficam apenas os pontos que exigem atenção.</p>
            </div>
          </div>

          <div className="riv__resumo-cards">
            <button type="button" onClick={() => setAbaRiv('KM')}>
              <small>QUILOMETRAGEM ATUAL</small>
              <strong>{formatarKm(dados.quilometragemAtual)}</strong>
              <span>Registrar ou consultar quilometragem →</span>
            </button>
            <button type="button" onClick={() => setAbaRiv('NOVIDADES')} className={resumoRiv.avariasAbertas > 0 ? 'is-atencao' : ''}>
              <small>AVARIAS ABERTAS</small>
              <strong>{resumoRiv.avariasAbertas}</strong>
              <span>{resumoRiv.avariasAbertas > 0 ? 'Ver avarias conhecidas →' : 'Nenhuma avaria aberta'}</span>
            </button>
            <button type="button" onClick={() => setAbaRiv('PREVENTIVAS')} className={resumoRiv.preventivasVencidas > 0 ? 'is-critico' : resumoRiv.preventivasAtencao > 0 ? 'is-atencao' : ''}>
              <small>MANUTENÇÃO PREVENTIVA</small>
              <strong>{resumoRiv.preventivasVencidas > 0 ? `${resumoRiv.preventivasVencidas} vencida(s)` : resumoRiv.preventivasAtencao > 0 ? `${resumoRiv.preventivasAtencao} próxima(s)` : 'Em dia'}</strong>
              <span>Consultar programação →</span>
            </button>
            <button
              type="button"
              onClick={() => setAbaRiv('MANUTENCAO')}
              className={resumoRiv.manutencoesAbertas > 0 ? 'is-atencao' : ''}
            >
              <small>MANUTENÇÃO EM ANDAMENTO</small>
              <strong>{resumoRiv.manutencoesAbertas}</strong>
              <span>
                {resumoRiv.manutencoesAbertas > 0
                  ? 'Acompanhar manutenção →'
                  : 'Nenhuma manutenção aberta'}
              </span>
            </button>
            <button type="button" onClick={() => setAbaRiv('HISTORICO')}>
              <small>REGISTROS NO RIV</small>
              <strong>{resumoRiv.registros}</strong>
              <span>Consultar histórico →</span>
            </button>
          </div>
        </section>
      )}

      {abaRiv === 'KM' && (
      <section className="riv__topo">
        <div>
          <small>QUILOMETRAGEM ATUAL</small>
          <strong>{formatarKm(dados.quilometragemAtual)}</strong>
        </div>

        <form className="riv__km-form" onSubmit={salvarKm}>
          <input
            type="number"
            min={dados.quilometragemAtual}
            value={km}
            onChange={(event) => setKm(event.target.value)}
            placeholder="Quilometragem"
            required
          />
          <input
            value={kmObs}
            onChange={(event) => setKmObs(event.target.value.toUpperCase())}
            placeholder="Observação opcional"
          />
          <button type="submit" disabled={ocupado}>
            Registrar km
          </button>
          {podeCorrigirKm && (
            <button type="button" className="riv__btn-correcao" disabled={ocupado} onClick={() => setCorrecaoKm({ quilometragem: String(dados.quilometragemAtual), justificativa: '' })}>
              Corrigir quilometragem
            </button>
          )}
        </form>
      </section>
      )}

      {abaRiv === 'PREVENTIVAS' && (
      <section className="riv__secao">
        <div className="riv__secao-titulo">
          <div>
            <small>MANUTENÇÃO PREVENTIVA</small>
            <h3>Itens programados</h3>
          </div>
          <button type="button" disabled={ocupado} onClick={novaManutencaoPersonalizada}>
            + Adicionar manutenção preventiva
          </button>
        </div>

        <div className="riv__manut-grid">
          {alertas.map((item) => (
            <article className="riv__manut-card" key={item.value}>
              <div className="riv__manut-card-topo">
                <div>
                  <small>{item.label}</small>
                  <h4>{item.status.label}</h4>
                </div>
                <span
                  className={`riv__alerta riv__alerta--${item.status.nivel.toLowerCase()}`}
                >
                  {item.status.nivel === 'VENCIDO'
                    ? 'VENCIDO'
                    : item.status.nivel === 'ATENCAO'
                    ? 'ATENÇÃO'
                    : item.status.nivel === 'OK'
                    ? 'EM DIA'
                    : 'SEM REGISTRO'}
                </span>
              </div>

              <dl>
                <div>
                  <dt>Última execução</dt>
                  <dd>
                    {formatarData(item.registro?.ultima_data)}
                    {' · '}
                    {formatarKm(item.registro?.ultima_km)}
                  </dd>
                </div>
                <div>
                  <dt>Próxima</dt>
                  <dd>
                    {formatarData(item.registro?.proxima_data)}
                    {' · '}
                    {formatarKm(item.registro?.proxima_km)}
                  </dd>
                </div>
                <div>
                  <dt>Restante</dt>
                  <dd>
                    {item.status.kmRestantes != null
                      ? `${item.status.kmRestantes.toLocaleString('pt-BR')} km`
                      : '—'}
                    {' · '}
                    {item.status.diasRestantes != null
                      ? `${item.status.diasRestantes} dias`
                      : '—'}
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                disabled={ocupado}
                onClick={() => abrirManutencao(item)}
              >
                {item.registro ? 'Atualizar programação' : 'Programar'}
              </button>
            </article>
          ))}
        </div>
      </section>
      )}

      {abaRiv === 'NOVIDADES' && (
      <section className="riv__secao">
        <div className="riv__secao-titulo">
          <div>
            <small>NOVIDADES EM VTR</small>
            <h3>Avarias conhecidas e registros operacionais</h3>
          </div>
        </div>

        <div className="riv__avarias-conhecidas">
          <div className="riv__avarias-conhecidas-topo">
            <div>
              <small>AVARIAS JÁ CONHECIDAS</small>
              <strong>{avariasConhecidas.length} em destaque</strong>
            </div>
            <span>Avarias abertas selecionadas pelo P4/SVDD para permanecerem em evidência.</span>
          </div>

          {avariasConhecidas.length === 0 ? (
            <div className="riv__avarias-vazio">Nenhuma avaria foi selecionada para destaque nesta VTR.</div>
          ) : (
            <div className="riv__avarias-lista">
              {avariasConhecidas.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className="riv__avaria-conhecida"
                  onClick={() => {
                    setOcorrencia((atual) => ({
                      ...atual,
                      tipo: 'AVARIA',
                      modoAvaria: 'AGRAVAMENTO',
                      ocorrenciaPaiId: item.id,
                      titulo: item.titulo || '',
                      localAvaria: item.local_avaria || '',
                      componenteAvariado: item.componente_avariado || ''
                    }))
                    setFormNovaAvariaAberto(true)
                  }}
                >
                  <strong>{item.titulo}</strong>
                  <span>{item.local_avaria || item.componente_avariado || 'LOCAL NÃO INFORMADO'}</span>
                  <small>{item.severidade || 'SEM GRAVIDADE DEFINIDA'} · {formatarKm(item.quilometragem)}</small>
                  <em>Informar agravamento</em>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="riv__avarias-abertas">
          <div className="riv__avarias-abertas-topo">
            <div>
              <small>AVARIAS EM ABERTO</small>
              <h3>{avariasAbertas.length} avaria(s) aguardando solução</h3>
            </div>
            <span>Somente avarias ainda não resolvidas aparecem aqui.</span>
          </div>

          {avariasAbertas.length === 0 ? (
            <div className="riv__avarias-vazio">
              Nenhuma avaria em aberto nesta VTR.
            </div>
          ) : (
            <div className="riv__avarias-abertas-lista">
              {avariasAbertas.map((item) => (
                <article
                  key={item.id}
                  className={[
                    'riv__avaria-aberta-card',
                    item.exibir_avaria_conhecida ? 'is-destaque' : ''
                  ].join(' ')}
                >
                  <div className="riv__avaria-aberta-conteudo">
                    <div className="riv__avaria-aberta-cabecalho">
                      <div>
                        <small>
                          NOVIDADE / AVARIA · {formatarKm(item.quilometragem)}
                        </small>
                        <h4>{item.titulo}</h4>
                      </div>
                      {item.exibir_avaria_conhecida && (
                        <span className="riv__avaria-badge-destaque">★ AVARIA CONHECIDA</span>
                      )}
                    </div>

                    {item.descricao && <p>{item.descricao}</p>}

                    <div className="riv__novidade-meta">
                      {item.origem_constatacao && (
                        <span>ORIGEM: {item.origem_constatacao.replaceAll('_', ' ')}</span>
                      )}
                      {item.local_avaria && <span>LOCAL: {item.local_avaria}</span>}
                      {item.componente_avariado && <span>COMPONENTE: {item.componente_avariado}</span>}
                      {item.severidade && <span>GRAVIDADE: {item.severidade}</span>}
                      {item.responsabilidade_status && (
                        <span>RESP.: {item.responsabilidade_status.replaceAll('_', ' ')}</span>
                      )}
                      {item.agravamento && <span className="is-agravamento">AGRAVAMENTO</span>}
                    </div>

                    <span className="riv__avaria-aberta-data">
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                      {item.criado_por_nome ? ` · ${item.criado_por_nome}` : ''}
                    </span>
                  </div>

                  <div className="riv__registro-fotos">
                    {fotosRiv
                      .filter((foto) => foto.riv_ocorrencia_id === item.id)
                      .map((foto) => (
                        <button
                          type="button"
                          className="riv__foto-thumb"
                          key={foto.id}
                          onClick={() => setFotoAmpliada(foto)}
                        >
                          <img src={foto.url} alt="Registro do RIV" />
                          <span>{foto.fase_riv === 'DEPOIS' ? 'DEPOIS' : 'ANTES'}</span>
                        </button>
                      ))}
                  </div>

                  <div className="riv__registro-acoes riv__avaria-aberta-acoes">
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => visualizarRegistro(item)}
                    >
                      👁 Visualizar
                    </button>

                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => {
                        setOcorrencia((atual) => ({
                          ...atual,
                          tipo: 'AVARIA',
                          modoAvaria: 'AGRAVAMENTO',
                          ocorrenciaPaiId: item.id,
                          titulo: item.titulo || '',
                          localAvaria: item.local_avaria || '',
                          componenteAvariado: item.componente_avariado || ''
                        }))
                        setFormNovaAvariaAberto(true)
                      }}
                    >
                      Informar agravamento
                    </button>

                    <label className="riv__foto-btn">
                      📷 Adicionar foto
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          adicionarFotosRegistro(item, event.target.files, 'ANTES')
                        }
                      />
                    </label>

                    <label className="riv__foto-btn riv__foto-btn--depois">
                      📷 Foto após reparo
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) =>
                          adicionarFotosRegistro(item, event.target.files, 'DEPOIS')
                        }
                      />
                    </label>

                    {podeGerenciarConhecidas && (
                      <button
                        type="button"
                        className={
                          item.exibir_avaria_conhecida
                            ? 'riv__btn-destaque is-ativo'
                            : 'riv__btn-destaque'
                        }
                        disabled={ocupado}
                        onClick={() => alternarAvariaConhecida(item)}
                      >
                        {item.exibir_avaria_conhecida
                          ? '★ Remover de Avarias conhecidas'
                          : '☆ Exibir em Avarias conhecidas'}
                      </button>
                    )}

                    <button
                      type="button"
                      className="riv__btn-concluir"
                      disabled={ocupado}
                      onClick={() => abrirFechamentoAvaria(item)}
                    >
                      ✓ Marcar resolvida
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {!formNovaAvariaAberto && (
          <div className="riv__nova-avaria-rodape">
            <button
              type="button"
              className="riv__btn-nova-avaria"
              onClick={() => {
                setOcorrencia(OCORRENCIA_VAZIA)
                setFotosNovaOcorrencia([])
                setFormNovaAvariaAberto(true)
              }}
            >
              + Registrar nova avaria
            </button>
          </div>
        )}

        {formNovaAvariaAberto && (
          <div className="riv__nova-avaria-painel">
            <div className="riv__nova-avaria-painel-topo">
              <div>
                <small>NOVO REGISTRO</small>
                <h3>
                  {ocorrencia.modoAvaria === 'AGRAVAMENTO'
                    ? 'Informar agravamento'
                    : 'Registrar nova avaria'}
                </h3>
              </div>

              <button
                type="button"
                className="riv__btn-cancelar-nova"
                disabled={ocupado}
                onClick={() => {
                  setOcorrencia(OCORRENCIA_VAZIA)
                  setFotosNovaOcorrencia([])
                  setFormNovaAvariaAberto(false)
                }}
              >
                Cancelar
              </button>
            </div>

        <form className="riv__novidade-form" onSubmit={salvarOcorrencia}>
          <div className="riv__novidade-tipo">
            <label>
              <span>Registro</span>
              <select
                value={ocorrencia.modoAvaria}
                onChange={(event) => setOcorrencia((atual) => ({
                  ...atual,
                  tipo: 'AVARIA',
                  modoAvaria: event.target.value,
                  ocorrenciaPaiId: '',
                  agravamentoDescricao: ''
                }))}
              >
                <option value="NOVA">Nova avaria</option>
                <option value="AGRAVAMENTO">Agravamento de avaria conhecida</option>
              </select>
            </label>
          </div>

          {ocorrencia.tipo === 'AVARIA' && (
            <>
              {ocorrencia.modoAvaria === 'AGRAVAMENTO' && (
                <label className="riv__novidade-full">
                  <span>Avaria conhecida *</span>
                  <select
                    required
                    value={ocorrencia.ocorrenciaPaiId}
                    onChange={(event) => {
                      const conhecida = avariasAbertas.find((item) => item.id === event.target.value)
                      setOcorrencia((atual) => ({
                        ...atual,
                        ocorrenciaPaiId: event.target.value,
                        titulo: conhecida?.titulo || atual.titulo,
                        localAvaria: conhecida?.local_avaria || atual.localAvaria,
                        componenteAvariado: conhecida?.componente_avariado || atual.componenteAvariado
                      }))
                    }}
                  >
                    <option value="">Selecione a avaria existente...</option>
                    {avariasAbertas.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.titulo}{item.local_avaria ? ` — ${item.local_avaria}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="riv__novidade-grid">
                <label>
                  <span>Constatada em *</span>
                  <select
                    required
                    value={ocorrencia.origemConstatacao}
                    onChange={(event) => setOcorrencia((atual) => ({ ...atual, origemConstatacao: event.target.value }))}
                  >
                    {ORIGENS_NOVIDADE_VTR.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>

                <label>
                  <span>Gravidade</span>
                  <select
                    value={ocorrencia.severidade}
                    onChange={(event) => setOcorrencia((atual) => ({ ...atual, severidade: event.target.value }))}
                  >
                    {SEVERIDADES_NOVIDADE_VTR.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>

                <label>
                  <span>Local da avaria</span>
                  <input
                    value={ocorrencia.localAvaria}
                    onChange={(event) => setOcorrencia((atual) => ({ ...atual, localAvaria: event.target.value.toUpperCase() }))}
                    placeholder="Ex.: PORTA DIANTEIRA DIREITA"
                  />
                </label>

                <label>
                  <span>Componente</span>
                  <input
                    value={ocorrencia.componenteAvariado}
                    onChange={(event) => setOcorrencia((atual) => ({ ...atual, componenteAvariado: event.target.value.toUpperCase() }))}
                    placeholder="Ex.: LATARIA / RETROVISOR"
                  />
                </label>

                <label>
                  <span>Condição da VTR</span>
                  <select
                    value={ocorrencia.disponibilidadeVtr}
                    onChange={(event) => setOcorrencia((atual) => ({ ...atual, disponibilidadeVtr: event.target.value }))}
                  >
                    {DISPONIBILIDADES_NOVIDADE_VTR.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>

                <label>
                  <span>Responsabilidade inicial</span>
                  <select
                    value={ocorrencia.responsabilidadeStatus}
                    onChange={(event) => setOcorrencia((atual) => ({ ...atual, responsabilidadeStatus: event.target.value }))}
                  >
                    {RESPONSABILIDADES_NOVIDADE_VTR.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
            </>
          )}

          <div className="riv__novidade-grid riv__novidade-grid--texto">
            <label>
              <span>Título *</span>
              <input
                value={ocorrencia.titulo}
                onChange={(event) => setOcorrencia((atual) => ({ ...atual, titulo: event.target.value.toUpperCase() }))}
                placeholder={ocorrencia.tipo === 'AVARIA' ? 'Ex.: RISCO NA PORTA DIANTEIRA DIREITA' : 'Título'}
                required
              />
            </label>

            <label>
              <span>Descrição</span>
              <textarea
                rows="3"
                value={ocorrencia.descricao}
                onChange={(event) => setOcorrencia((atual) => ({ ...atual, descricao: event.target.value.toUpperCase() }))}
                placeholder="Descreva o que foi constatado."
              />
            </label>
          </div>

          {ocorrencia.tipo === 'AVARIA' && ocorrencia.modoAvaria === 'AGRAVAMENTO' && (
            <label className="riv__novidade-full">
              <span>O que se agravou? *</span>
              <textarea
                rows="3"
                required
                value={ocorrencia.agravamentoDescricao}
                onChange={(event) => setOcorrencia((atual) => ({ ...atual, agravamentoDescricao: event.target.value.toUpperCase() }))}
                placeholder="Ex.: O RISCO EXISTENTE PASSOU A APRESENTAR AMASSAMENTO E DESLOCAMENTO DA PEÇA."
              />
            </label>
          )}


          <div className="riv__novidade-grid riv__novidade-grid--texto">
            <label>
              <span>Nº do documento da constatação <small>(opcional)</small></span>
              <input
                value={ocorrencia.documentoConstatacao || ''}
                onChange={(event) =>
                  setOcorrencia((atual) => ({
                    ...atual,
                    documentoConstatacao: event.target.value.toUpperCase()
                  }))
                }
                placeholder="Ex.: PARTE Nº 123/2026"
              />
            </label>

            <label>
              <span>Anexar documento <small>(PDF ou imagem)</small></span>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(event) =>
                  setArquivoDocumentoNovaOcorrencia(event.target.files?.[0] || null)
                }
              />
              {arquivoDocumentoNovaOcorrencia && (
                <small>{arquivoDocumentoNovaOcorrencia.name}</small>
              )}
            </label>
          </div>

          <div className="riv__novidade-acoes">
            <label className="riv__foto-btn">
              📷 Fotos
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(event) => setFotosNovaOcorrencia(Array.from(event.target.files || []))}
              />
            </label>

            {fotosNovaOcorrencia.length > 0 && (
              <small className="riv__foto-contagem">{fotosNovaOcorrencia.length} foto(s)</small>
            )}

            <button type="submit" disabled={ocupado}>
              {ocorrencia.modoAvaria === 'AGRAVAMENTO'
                ? 'Registrar agravamento'
                : 'Registrar avaria'}
            </button>
          </div>
        </form>
        </div>
        )}

      </section>
      )}

      {abaRiv === 'MANUTENCAO' && (
        <section className="riv__manutencao-atual">
          <div className="riv__secao-titulo">
            <div>
              <small>MANUTENÇÃO DA VTR</small>
              <h3>Manutenções em andamento</h3>
              <p>
                Aqui aparecem as manutenções ainda abertas desta viatura.
                O andamento operacional é tratado pela Central de Manutenção.
              </p>
            </div>
          </div>

          {!formNovaManutencaoAberto && (
            <div className="riv__nova-avaria-rodape">
              <button
                type="button"
                className="riv__btn-nova-avaria"
                onClick={() => {
                  setOcorrencia({
                    ...OCORRENCIA_VAZIA,
                    tipo: 'MANUTENCAO',
                    modoAvaria: 'NOVA'
                  })
                  setFotosNovaOcorrencia([])
                  setFormNovaManutencaoAberto(true)
                }}
              >
                + Registrar manutenção
              </button>
            </div>
          )}

          {formNovaManutencaoAberto && (
            <div className="riv__nova-avaria-painel">
              <div className="riv__nova-avaria-painel-topo">
                <div>
                  <small>NOVO REGISTRO</small>
                  <h3>Registrar manutenção</h3>
                </div>

                <button
                  type="button"
                  className="riv__btn-cancelar-nova"
                  disabled={ocupado}
                  onClick={() => {
                    setOcorrencia(OCORRENCIA_VAZIA)
                    setFotosNovaOcorrencia([])
                    setFormNovaManutencaoAberto(false)
                  }}
                >
                  Cancelar
                </button>
              </div>

              <form className="riv__novidade-form" onSubmit={salvarOcorrencia}>
                <div className="riv__novidade-grid riv__novidade-grid--texto">
                  <label>
                    <span>Título *</span>
                    <input
                      value={ocorrencia.titulo}
                      onChange={(event) =>
                        setOcorrencia((atual) => ({
                          ...atual,
                          tipo: 'MANUTENCAO',
                          titulo: event.target.value.toUpperCase()
                        }))
                      }
                      placeholder="Ex.: PASTILHAS DE FREIO"
                      required
                    />
                  </label>

                  <label>
                    <span>Descrição</span>
                    <textarea
                      rows="3"
                      value={ocorrencia.descricao}
                      onChange={(event) =>
                        setOcorrencia((atual) => ({
                          ...atual,
                          tipo: 'MANUTENCAO',
                          descricao: event.target.value.toUpperCase()
                        }))
                      }
                      placeholder="Descreva a manutenção necessária."
                    />
                  </label>
                </div>


                <div className="riv__novidade-grid riv__novidade-grid--texto">
                  <label>
                    <span>Nº do documento da constatação <small>(opcional)</small></span>
                    <input
                      value={ocorrencia.documentoConstatacao || ''}
                      onChange={(event) =>
                        setOcorrencia((atual) => ({
                          ...atual,
                          tipo: 'MANUTENCAO',
                          documentoConstatacao: event.target.value.toUpperCase()
                        }))
                      }
                      placeholder="Ex.: PARTE Nº 123/2026"
                    />
                  </label>

                  <label>
                    <span>Anexar documento <small>(PDF ou imagem)</small></span>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(event) =>
                        setArquivoDocumentoNovaOcorrencia(event.target.files?.[0] || null)
                      }
                    />
                    {arquivoDocumentoNovaOcorrencia && (
                      <small>{arquivoDocumentoNovaOcorrencia.name}</small>
                    )}
                  </label>
                </div>

                <div className="riv__novidade-acoes">
                  <label className="riv__foto-btn">
                    📷 Fotos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        setFotosNovaOcorrencia(Array.from(event.target.files || []))
                      }
                    />
                  </label>

                  {fotosNovaOcorrencia.length > 0 && (
                    <small className="riv__foto-contagem">
                      {fotosNovaOcorrencia.length} foto(s)
                    </small>
                  )}

                  <button type="submit" disabled={ocupado}>
                    Registrar manutenção
                  </button>
                </div>
              </form>
            </div>
          )}

          {manutencoesEmAndamento.length === 0 ? (
            <div className="viaturas-vazio">
              Nenhuma manutenção em andamento nesta VTR.
            </div>
          ) : (
            <div className="riv__manutencao-atual-lista">
              {manutencoesEmAndamento.map((item) => {
                const status = String(
                  item.manutencao_status || 'AGUARDANDO_PROVIDENCIA'
                ).replaceAll('_', ' ')

                return (
                  <article className="riv__manutencao-atual-card" key={item.id}>
                    <header>
                      <div>
                        <small>
                          {item.tipo === 'AVARIA'
                            ? 'AVARIA ENCAMINHADA PARA MANUTENÇÃO'
                            : 'MANUTENÇÃO CORRETIVA'}
                        </small>
                        <h4>{item.titulo || 'Manutenção registrada'}</h4>
                      </div>
                      <span>{status}</span>
                    </header>

                    {item.descricao && <p>{item.descricao}</p>}

                    <div className="riv__manutencao-atual-grid">
                      <div>
                        <small>Providência atual</small>
                        <strong>{item.providencia_atual || 'AGUARDANDO DEFINIÇÃO'}</strong>
                      </div>
                      <div>
                        <small>Tipo</small>
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
                        <small>KM do registro</small>
                        <strong>{formatarKm(item.quilometragem)}</strong>
                      </div>
                      <div>
                        <small>Registrado em</small>
                        <strong>{new Date(item.created_at).toLocaleString('pt-BR')}</strong>
                      </div>
                    </div>

                    <div className="riv__registro-fotos">
                      {fotosRiv
                        .filter((foto) => foto.riv_ocorrencia_id === item.id)
                        .map((foto) => (
                          <button
                            type="button"
                            className="riv__foto-thumb"
                            key={foto.id}
                            onClick={() => setFotoAmpliada(foto)}
                          >
                            <img src={foto.url} alt="Registro da manutenção" />
                            <span>{foto.fase_riv === 'DEPOIS' ? 'DEPOIS' : 'ANTES'}</span>
                          </button>
                        ))}
                    </div>

                    <div className="riv__registro-acoes">
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => visualizarRegistro(item)}
                      >
                        👁 Visualizar registro
                      </button>

                      <label className="riv__foto-btn">
                        📷 Adicionar foto
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            adicionarFotosRegistro(item, event.target.files, 'ANTES')
                          }
                        />
                      </label>

                      <label className="riv__foto-btn riv__foto-btn--depois">
                        📷 Foto após serviço
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) =>
                            adicionarFotosRegistro(item, event.target.files, 'DEPOIS')
                          }
                        />
                      </label>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {abaRiv === 'HISTORICO' && (
      <section className="riv__secao">
        <div className="riv__secao-titulo">
          <div>
            <small>HISTÓRICO</small>
            <h3>Quilometragem</h3>
          </div>
        </div>

        <div className="riv__km-historico">
          {dados.historicoKm.length === 0 ? (
            <div className="viaturas-vazio">
              Nenhuma quilometragem registrada.
            </div>
          ) : (
            dados.historicoKm.map((item) => (
              <div key={item.id} className={[item.tipo_lancamento === 'CORRECAO' ? 'is-correcao' : '', item.corrigido ? 'is-corrigido' : ''].join(' ')}>
                <div>
                  <strong>{item.tipo_lancamento === 'CORRECAO' ? 'CORREÇÃO: ' : ''}{formatarKm(item.quilometragem)}</strong>
                  {item.corrigido && <small className="riv__km-corrigido">REGISTRO CORRIGIDO</small>}
                  {item.tipo_lancamento === 'CORRECAO' && item.quilometragem_anterior != null && (
                    <small>Anterior: {formatarKm(item.quilometragem_anterior)} · Motivo: {item.justificativa_correcao}</small>
                  )}
                </div>
                <span>{new Date(item.created_at).toLocaleString('pt-BR')}{item.criado_por_nome ? ` · ${item.criado_por_nome}` : ''}</span>
              </div>
            ))
          )}
        </div>

        <div className="riv__historico-divisor">
          <small>REGISTROS DO RIV</small>
          <h3>Registros concluídos e histórico operacional</h3>
          <p>
            Avarias abertas ficam em Novidades / Avarias. Manutenções ainda abertas
            ficam na Central de Manutenção. Agravamentos permanecem aqui como eventos
            vinculados à avaria original.
          </p>
        </div>

        <div className="riv__timeline">
          {registrosHistoricos.length === 0 ? (
            <div className="viaturas-vazio">
              Nenhum registro concluído no histórico.
            </div>
          ) : (
            registrosHistoricos.map((item) => (
              <article
                key={item.id}
                className={[
                  'riv__timeline-item',
                  item.resolvida ? 'is-resolvida' : ''
                ].join(' ')}
              >
                <div>
                  <small>
                    {item.tipo === 'AVARIA' ? 'NOVIDADE / AVARIA' : item.tipo} · {formatarKm(item.quilometragem)}
                  </small>
                  {item.tipo === 'MANUTENCAO' && (
                    <span className={`riv__status-manut ${item.resolvida ? 'is-fechada' : 'is-aberta'}`}>
                      {item.resolvida ? 'CONCLUÍDA 🔒' : 'ABERTA'}
                    </span>
                  )}
                  <h4>{item.titulo}</h4>
                  {item.descricao && <p>{item.descricao}</p>}
                  {item.tipo === 'AVARIA' && (
                    <div className="riv__novidade-meta">
                      {item.origem_constatacao && <span>ORIGEM: {item.origem_constatacao.replaceAll('_', ' ')}</span>}
                      {item.local_avaria && <span>LOCAL: {item.local_avaria}</span>}
                      {item.severidade && <span>GRAVIDADE: {item.severidade}</span>}
                      {item.responsabilidade_status && <span>RESP.: {item.responsabilidade_status.replaceAll('_', ' ')}</span>}
                      {item.agravamento && <span className="is-agravamento">AGRAVAMENTO</span>}
                    </div>
                  )}
                  {item.tipo === 'AVARIA' && item.resolvida && item.providencia_fechamento && (
                    <div className="riv__fechamento-resumo">
                      <strong>FECHAMENTO</strong>
                      <p>{item.providencia_fechamento}</p>
                      {item.observacoes_fechamento && <small>{item.observacoes_fechamento}</small>}
                    </div>
                  )}
                  <span>
                    {new Date(item.created_at).toLocaleString('pt-BR')}
                    {item.criado_por_nome
                      ? ` · ${item.criado_por_nome}`
                      : ''}
                  </span>
                </div>

                <div className="riv__registro-fotos">
                  {fotosRiv.filter((foto) => foto.riv_ocorrencia_id === item.id).map((foto) => (
                    <button type="button" className="riv__foto-thumb" key={foto.id} onClick={() => setFotoAmpliada(foto)}>
                      <img src={foto.url} alt="Registro do RIV" />
                      <span>{foto.fase_riv === 'DEPOIS' ? 'DEPOIS' : 'ANTES'}</span>
                    </button>
                  ))}
                </div>

                <div className="riv__registro-acoes">
                  <button type="button" disabled={ocupado} onClick={() => visualizarRegistro(item)}>
                    👁 Visualizar {item.tipo === 'MANUTENCAO' ? 'manutenção' : 'registro'}
                  </button>

                  {!item.resolvida && (
                    <>
                      <label className="riv__foto-btn">
                        📷 Adicionar foto
                        <input type="file" accept="image/*" multiple onChange={(event) => adicionarFotosRegistro(item, event.target.files, 'ANTES')} />
                      </label>
                      {(item.tipo === 'AVARIA' || item.tipo === 'MANUTENCAO') && (
                        <label className="riv__foto-btn riv__foto-btn--depois">
                          📷 Foto após reparo
                          <input type="file" accept="image/*" multiple onChange={(event) => adicionarFotosRegistro(item, event.target.files, 'DEPOIS')} />
                        </label>
                      )}
                    </>
                  )}

                  {item.tipo === 'MANUTENCAO' && !item.resolvida && (
                    <button type="button" className="riv__btn-concluir" disabled={ocupado} onClick={() => concluirManutencao(item)}>
                      ✓ Concluir manutenção
                    </button>
                  )}

                  {item.tipo === 'MANUTENCAO' && item.resolvida && podeReabrirManutencao && (
                    <button type="button" className="riv__btn-reabrir" disabled={ocupado} onClick={() => setReabrindoManutencao({ item, justificativa: '' })}>
                      Reabrir manutenção
                    </button>
                  )}


                  {item.tipo === 'AVARIA' && item.resolvida && (
                    <button type="button" className="riv__btn-reabrir" disabled={ocupado} onClick={() => setReabrindoAvaria({ item, justificativa: '' })}>
                      Reabrir
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </div>
      </section>
      )}

      {fechandoAvaria && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setFechandoAvaria(null) }}>
          <form className="riv__modal" onSubmit={confirmarFechamentoAvaria}>
            <div className="riv__modal-header">
              <div>
                <small>FECHAMENTO DA AVARIA</small>
                <h3>{fechandoAvaria.item.titulo}</h3>
              </div>
              <button type="button" onClick={() => setFechandoAvaria(null)}>×</button>
            </div>

            <p className="riv__correcao-aviso">
              {fechandoAvaria.item.reaberta_em
                ? 'Esta avaria já foi reaberta. O novo fechamento é exclusivo do Comandante de Cia e ficará registrado no histórico.'
                : 'Registre a providência adotada. Ao confirmar, a avaria será fechada e o evento ficará no histórico.'}
            </p>

            <label className="riv__modal-full">
              <span>Providência / solução adotada *</span>
              <textarea
                rows="4"
                required
                value={fechandoAvaria.providencia}
                onChange={(event) => setFechandoAvaria((atual) => ({ ...atual, providencia: event.target.value.toUpperCase() }))}
              />
            </label>

            <label className="riv__modal-full">
              <span>Observações do fechamento</span>
              <textarea
                rows="3"
                value={fechandoAvaria.observacoes}
                onChange={(event) => setFechandoAvaria((atual) => ({ ...atual, observacoes: event.target.value.toUpperCase() }))}
              />
            </label>

            {erroFechamentoAvaria && (
              <div className="riv__erro-modal">{erroFechamentoAvaria}</div>
            )}

            <div className="riv__modal-actions">
              <button type="button" onClick={() => { setErroFechamentoAvaria(''); setFechandoAvaria(null) }}>Cancelar</button>
              {fechandoAvaria.item.reaberta_em && !podeReabrirManutencao ? (
                <div className="riv__aguardando-cmt">🔒 Aguardando fechamento pelo Cmt de Cia</div>
              ) : (
                <button type="submit" disabled={ocupado}>Finalizar avaria</button>
              )}
            </div>
          </form>
        </div>
      )}

      {reabrindoAvaria && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setReabrindoAvaria(null) }}>
          <form className="riv__modal" onSubmit={confirmarReaberturaAvaria}>
            <div className="riv__modal-header">
              <div><small>REABERTURA DA AVARIA</small><h3>{reabrindoAvaria.item.titulo}</h3></div>
              <button type="button" onClick={() => setReabrindoAvaria(null)}>×</button>
            </div>
            <label className="riv__modal-full">
              <span>Justificativa da reabertura *</span>
              <textarea
                rows="4"
                required
                value={reabrindoAvaria.justificativa}
                onChange={(event) => setReabrindoAvaria((atual) => ({ ...atual, justificativa: event.target.value.toUpperCase() }))}
              />
            </label>
            <div className="riv__modal-actions">
              <button type="button" onClick={() => setReabrindoAvaria(null)}>Cancelar</button>
              <button type="submit" className="riv__btn-reabrir" disabled={ocupado}>Confirmar reabertura</button>
            </div>
          </form>
        </div>
      )}

      {visualizandoRegistro && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setVisualizandoRegistro(null) }}>
          <section className="riv__modal riv__modal--visualizar">
            <div className="riv__modal-header">
              <div>
                <small>{visualizandoRegistro.tipo}</small>
                <h3>{visualizandoRegistro.titulo}</h3>
              </div>
              <button type="button" onClick={() => setVisualizandoRegistro(null)}>×</button>
            </div>

            <div className="riv__visualizar-grid">
              <div><small>SITUAÇÃO</small><strong>{visualizandoRegistro.resolvida ? 'CONCLUÍDA / FECHADA' : 'ABERTA'}</strong></div>
              <div><small>QUILOMETRAGEM</small><strong>{formatarKm(visualizandoRegistro.quilometragem)}</strong></div>
              <div><small>REGISTRADA EM</small><strong>{new Date(visualizandoRegistro.created_at).toLocaleString('pt-BR')}</strong></div>
              <div><small>REGISTRADA POR</small><strong>{visualizandoRegistro.criado_por_nome || '—'}</strong></div>
              {visualizandoRegistro.resolvida_em && <div><small>CONCLUÍDA EM</small><strong>{new Date(visualizandoRegistro.resolvida_em).toLocaleString('pt-BR')}</strong></div>}
              {visualizandoRegistro.encerrada_por_nome && <div><small>CONCLUÍDA POR</small><strong>{visualizandoRegistro.encerrada_por_nome}</strong></div>}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.origem_constatacao && <div><small>ORIGEM DA CONSTATAÇÃO</small><strong>{visualizandoRegistro.origem_constatacao.replaceAll('_', ' ')}</strong></div>}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.local_avaria && <div><small>LOCAL DA AVARIA</small><strong>{visualizandoRegistro.local_avaria}</strong></div>}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.componente_avariado && <div><small>COMPONENTE</small><strong>{visualizandoRegistro.componente_avariado}</strong></div>}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.severidade && <div><small>GRAVIDADE</small><strong>{visualizandoRegistro.severidade}</strong></div>}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.disponibilidade_vtr && <div><small>CONDIÇÃO DA VTR</small><strong>{visualizandoRegistro.disponibilidade_vtr.replaceAll('_', ' ')}</strong></div>}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.responsabilidade_status && <div><small>RESPONSABILIDADE</small><strong>{visualizandoRegistro.responsabilidade_status.replaceAll('_', ' ')}</strong></div>}
            </div>

            {visualizandoRegistro.descricao && (
              <div className="riv__visualizar-descricao">
                <small>DESCRIÇÃO</small>
                <p>{visualizandoRegistro.descricao}</p>
              </div>
            )}

            {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.providencia_fechamento && (
              <div className="riv__visualizar-descricao riv__visualizar-fechamento">
                <small>PROVIDÊNCIA / SOLUÇÃO DO FECHAMENTO</small>
                <p>{visualizandoRegistro.providencia_fechamento}</p>
                {visualizandoRegistro.observacoes_fechamento && (
                  <>
                    <small>OBSERVAÇÕES DO FECHAMENTO</small>
                    <p>{visualizandoRegistro.observacoes_fechamento}</p>
                  </>
                )}
              </div>
            )}

            <div className="riv__visualizar-fotos">
              <small>FOTOS DO REGISTRO</small>
              <div className="riv__registro-fotos">
                {fotosRiv.filter((foto) => foto.riv_ocorrencia_id === visualizandoRegistro.id).map((foto) => (
                  <button type="button" className="riv__foto-thumb" key={foto.id} onClick={() => setFotoAmpliada(foto)}>
                    <img src={foto.url} alt="Registro do RIV" />
                    <span>{foto.fase_riv === 'DEPOIS' ? 'DEPOIS' : 'ANTES'}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="riv__historico-manut">
              <small>HISTÓRICO DO REGISTRO</small>
              {carregandoHistorico ? (
                <div className="viaturas-vazio">Carregando histórico...</div>
              ) : historicoRegistro.length === 0 ? (
                <div className="viaturas-vazio">Nenhuma alteração de fechamento/reabertura registrada ainda.</div>
              ) : (
                historicoRegistro.map((evento) => (
                  <div className="riv__historico-evento" key={evento.id}>
                    <div><strong>{evento.acao}</strong>{evento.descricao && <p>{evento.descricao}</p>}</div>
                    <span>{new Date(evento.created_at).toLocaleString('pt-BR')}{evento.criado_por_nome ? ` · ${evento.criado_por_nome}` : ''}</span>
                  </div>
                ))
              )}
            </div>

            <div className="riv__modal-actions">
              {visualizandoRegistro.tipo === 'MANUTENCAO' && visualizandoRegistro.resolvida && podeReabrirManutencao && (
                <button type="button" className="riv__btn-reabrir" onClick={() => setReabrindoManutencao({ item: visualizandoRegistro, justificativa: '' })}>
                  Reabrir manutenção
                </button>
              )}
              {visualizandoRegistro.tipo === 'AVARIA' && visualizandoRegistro.resolvida && (
                <button type="button" className="riv__btn-reabrir" onClick={() => setReabrindoAvaria({ item: visualizandoRegistro, justificativa: '' })}>
                  Reabrir avaria
                </button>
              )}
              <button type="button" onClick={() => setVisualizandoRegistro(null)}>Fechar</button>
            </div>
          </section>
        </div>
      )}

      {reabrindoManutencao && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setReabrindoManutencao(null) }}>
          <form className="riv__modal" onSubmit={confirmarReabertura}>
            <div className="riv__modal-header">
              <div><small>AUDITORIA DO RIV</small><h3>Reabrir manutenção</h3></div>
              <button type="button" onClick={() => setReabrindoManutencao(null)}>×</button>
            </div>
            <p className="riv__correcao-aviso">A manutenção concluída é um registro bloqueado. A reabertura ficará registrada no histórico e exige justificativa do Comandante de Cia.</p>
            <label className="riv__modal-full">
              <span>Justificativa da reabertura *</span>
              <textarea rows="4" required value={reabrindoManutencao.justificativa} onChange={(event) => setReabrindoManutencao((atual) => ({ ...atual, justificativa: event.target.value.toUpperCase() }))} />
            </label>
            <div className="riv__modal-actions">
              <button type="button" onClick={() => setReabrindoManutencao(null)}>Cancelar</button>
              <button type="submit" className="riv__btn-reabrir" disabled={ocupado}>Confirmar reabertura</button>
            </div>
          </form>
        </div>
      )}

      {fotoAmpliada && (
        <div className="riv__foto-modal" onMouseDown={(event) => { if (event.target === event.currentTarget) setFotoAmpliada(null) }}>
          <button type="button" onClick={() => setFotoAmpliada(null)}>×</button>
          <img src={fotoAmpliada.url} alt="Foto do registro do RIV" />
          <span>{fotoAmpliada.fase_riv === 'DEPOIS' ? 'DEPOIS DO REPARO' : 'REGISTRO / ANTES'}</span>
        </div>
      )}

      {correcaoKm && (
        <div className="riv__modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !ocupado) setCorrecaoKm(null) }}>
          <form className="riv__modal" onSubmit={salvarCorrecaoKm}>
            <div className="riv__modal-header">
              <div><small>AUDITORIA DO RIV</small><h3>Corrigir quilometragem</h3></div>
              <button type="button" onClick={() => setCorrecaoKm(null)}>×</button>
            </div>
            <p className="riv__correcao-aviso">O lançamento anterior não será apagado. A correção ficará registrada permanentemente no histórico.</p>
            <div className="riv__modal-grid">
              <label><span>KM atual</span><input value={dados.quilometragemAtual} disabled /></label>
              <label><span>KM correto</span><input type="number" min="0" required value={correcaoKm.quilometragem} onChange={(event) => setCorrecaoKm((atual) => ({ ...atual, quilometragem: event.target.value }))} /></label>
            </div>
            <label className="riv__modal-full"><span>Motivo da correção *</span><textarea rows="3" required value={correcaoKm.justificativa} onChange={(event) => setCorrecaoKm((atual) => ({ ...atual, justificativa: event.target.value.toUpperCase() }))} placeholder="Ex.: zero digitado a mais" /></label>
            <div className="riv__modal-actions"><button type="button" onClick={() => setCorrecaoKm(null)}>Cancelar</button><button type="submit" disabled={ocupado}>Confirmar correção</button></div>
          </form>
        </div>
      )}

      {editandoItem && formManut && (
        <div
          className="riv__modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !ocupado) {
              setEditandoItem(null)
              setFormManut(null)
            }
          }}
        >
          <form className="riv__modal" onSubmit={salvarManut}>
            <div className="riv__modal-header">
              <div>
                <small>MANUTENÇÃO PREVENTIVA</small>
                <h3>{editandoItem.label}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditandoItem(null)
                  setFormManut(null)
                }}
              >
                ×
              </button>
            </div>

            {editandoItem.personalizado && (
              <label className="riv__modal-full">
                <span>Nome do item</span>
                <input required value={formManut.nomeItem} onChange={(event) => setFormManut((atual) => ({ ...atual, nomeItem: event.target.value.toUpperCase() }))} placeholder="Ex.: Pneus, correia, filtro de combustível" />
              </label>
            )}

            <div className="riv__modal-grid">
              <label>
                <span>Última data</span>
                <input
                  type="date"
                  value={formManut.ultimaData}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      ultimaData: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Última km</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.ultimaKm}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      ultimaKm: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Próxima data</span>
                <input
                  type="date"
                  value={formManut.proximaData}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      proximaData: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Próxima km</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.proximaKm}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      proximaKm: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Alertar faltando km</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.margemAlertaKm}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      margemAlertaKm: event.target.value
                    }))
                  }
                />
              </label>

              <label>
                <span>Alertar faltando dias</span>
                <input
                  type="number"
                  min="0"
                  value={formManut.margemAlertaDias}
                  onChange={(event) =>
                    setFormManut((atual) => ({
                      ...atual,
                      margemAlertaDias: event.target.value
                    }))
                  }
                />
              </label>
            </div>

            <label className="riv__modal-full">
              <span>Observações</span>
              <textarea
                rows="3"
                value={formManut.observacoes}
                onChange={(event) =>
                  setFormManut((atual) => ({
                    ...atual,
                    observacoes: event.target.value.toUpperCase()
                  }))
                }
              />
            </label>

            <div className="riv__modal-actions">
              <button
                type="button"
                onClick={() => {
                  setEditandoItem(null)
                  setFormManut(null)
                }}
              >
                Cancelar
              </button>
              <button type="submit" disabled={ocupado}>
                Salvar programação
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
