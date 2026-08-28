import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelarManutencao,
  concluirManutencao,
  listarManutencoes,
  STATUS_MANUTENCAO
} from '../../services/manutencoesService'
import { encaminharManutencaoAoP4 } from '../../services/manutencaoEncaminhamentoService'
import {
  listarManutencoesExternas,
  retornarManutencaoExterna
} from '../../services/manutencoesExternasService'
import FiltrosManutencao from './components/FiltrosManutencao'
import ManutencaoCard from './components/ManutencaoCard'
import ManutencaoDetalhes from './components/ManutencaoDetalhes'
import HTManutencaoExternaModal from '../HT/components/HTManutencaoExternaModal'
import './Manutencoes.css'

const FILTROS_INICIAIS = {
  pesquisa: '',
  modulo: '',
  status: '',
  dataInicial: '',
  dataFinal: ''
}

function normalizarTexto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function obterSetorManutencao(item) {
  const origemInstitucional =
    normalizarTexto(
      item?.origem_institucional
    )

  if (origemInstitucional === 'P4') {
    return 'P4'
  }

  if (origemInstitucional === 'SVDD') {
    return 'SVDD'
  }

  // Fallback apenas para registros antigos que ainda não tenham sido
  // enriquecidos pelo service.
  const origem = normalizarTexto(
    item?.origem ||
    item?.origem_local ||
    item?.local_origem
  )

  if (origem.includes('P4')) return 'P4'

  if (
    origem.includes('SVDD') ||
    origem.includes('SERVICO DE DIA') ||
    origem.includes('COFRE DO SVDD')
  ) {
    return 'SVDD'
  }

  return null
}

function obterSetorDoUsuario(user) {
  const perfil = normalizarTexto(
    user?.perfil_efetivo ||
    user?.perfil ||
    user?.role ||
    user?.tipo_perfil
  )

  if (perfil.includes('P4')) return 'P4'

  if (
    perfil.includes('SVDD') ||
    perfil.includes('SERVICO DE DIA')
  ) return 'SVDD'

  return null
}

function dentroDoPeriodo(item, dataInicial, dataFinal) {
  const valor = item.registrada_em || item.created_at
  if (!valor) return !dataInicial && !dataFinal

  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return false

  if (dataInicial) {
    const inicio = new Date(`${dataInicial}T00:00:00`)
    if (data < inicio) return false
  }

  if (dataFinal) {
    const fim = new Date(`${dataFinal}T23:59:59.999`)
    if (data > fim) return false
  }

  return true
}

export default function Manutencoes({ user, onVoltar }) {
  const [manutencoes, setManutencoes] = useState([])
  const [manutencoesExternas, setManutencoesExternas] = useState([])
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [selecionada, setSelecionada] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [manutencaoExternaSelecionada, setManutencaoExternaSelecionada] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')

    try {
      const [resposta, respostaExternas] = await Promise.all([
        listarManutencoes({
          modulo: filtros.modulo || null,
          status: filtros.status || null,
          pesquisa: filtros.pesquisa || null,
          limite: 200
        }),
        listarManutencoesExternas({
          modulo: filtros.modulo || null,
          pagina: 1,
          limite: 5000
        }).catch((errorExterna) => {
          console.warn(
            'Não foi possível carregar as manutenções externas para classificação:',
            errorExterna
          )
          return []
        })
      ])

      setManutencoes(resposta.data || [])
      setManutencoesExternas(
        respostaExternas?.data ||
        respostaExternas?.itens ||
        respostaExternas ||
        []
      )
    } catch (error) {
      console.error('Erro ao carregar manutenções:', error)
      setErro(error?.message || 'Não foi possível carregar as manutenções.')
    } finally {
      setLoading(false)
    }
  }, [filtros.modulo, filtros.status, filtros.pesquisa])

  useEffect(() => {
    const timer = window.setTimeout(carregar, 250)
    return () => window.clearTimeout(timer)
  }, [carregar])

  const manutencoesExternasAtivasPorManutencao = useMemo(() => {
    const mapa = new Map()

    for (const externa of manutencoesExternas || []) {
      const status = normalizarTexto(externa?.status)

      if (
        ['CONCLUIDA', 'CANCELADA', 'REPROVADA', 'RETORNADA'].includes(status)
      ) {
        continue
      }

      const itens = [
        externa,
        ...(externa?.itens || []),
        ...(externa?.sigmo_manutencoes_externas_itens || [])
      ]

      for (const item of itens) {
        const manutencaoId =
          item?.manutencao_id ||
          item?.manutencao_interna_id ||
          null

        if (!manutencaoId) continue

        mapa.set(String(manutencaoId), {
          ...externa,
          ...item,
          status_externo: externa?.status || item?.status || null
        })
      }
    }

    return mapa
  }, [manutencoesExternas])

  const listaFiltrada = useMemo(() => {
    const setorUsuario = obterSetorDoUsuario(user)

    return manutencoes
      .map((item) => {
        const externa = manutencoesExternasAtivasPorManutencao.get(
          String(item?.id || '')
        )

        if (!externa) return item

        // Mantém o registro na Central de Manutenções para acompanhamento,
        // mas o classifica explicitamente como manutenção externa.
        return {
          ...item,
          manutencao_externa: true,
          manutencao_externa_status:
            externa?.status_externo ||
            externa?.status ||
            null,
          status_externo:
            externa?.status_externo ||
            externa?.status ||
            null,
          manutencao_externa_id:
            externa?.manutencao_externa_id ||
            externa?.id ||
            null,
          origem_institucional: 'P4'
        }
      })
      .filter((item) => {
        if (!dentroDoPeriodo(item, filtros.dataInicial, filtros.dataFinal)) {
          return false
        }

        // A manutenção externa permanece em acompanhamento do P4.
        if (item?.manutencao_externa === true) {
          return !setorUsuario || setorUsuario === 'P4'
        }

        // As manutenções internas continuam separadas por responsabilidade.
        if (!setorUsuario) return true

        return obterSetorManutencao(item) === setorUsuario
      })
  }, [
    manutencoes,
    manutencoesExternasAtivasPorManutencao,
    filtros.dataInicial,
    filtros.dataFinal,
    user
  ])

  const resumo = useMemo(() => {
    return listaFiltrada.reduce(
      (acc, item) => {
        if (
          item.status === STATUS_MANUTENCAO.EM_MANUTENCAO
        ) {
          acc.abertas += 1
        }
        if (item.status === STATUS_MANUTENCAO.CONCLUIDA) acc.concluidas += 1
        if (item.status === STATUS_MANUTENCAO.CANCELADA) acc.canceladas += 1
        acc.total += 1
        return acc
      },
      { abertas: 0, concluidas: 0, canceladas: 0, total: 0 }
    )
  }, [listaFiltrada])

  async function finalizar(observacoes, contexto = {}) {
    if (!selecionada) return

    const manutencaoExternaId =
      contexto?.manutencaoExternaId ||
      selecionada?.manutencao_externa_id ||
      null

    const externaAtiva =
      Boolean(contexto?.manutencaoExternaAtiva) &&
      Boolean(manutencaoExternaId)

    if (
      externaAtiva &&
      !window.confirm(
        'Confirma o retorno deste HT da manutenção externa? O retorno será registrado no histórico e o HT voltará ao Cofre do P4.'
      )
    ) {
      return
    }

    setSalvando(true)
    setErro('')

    try {
      if (externaAtiva) {
        await retornarManutencaoExterna({
          manutencaoExternaId,
          servicoExecutado: observacoes,
          observacoes
        })
      }

      const atualizada = await concluirManutencao({
        manutencaoId: selecionada.id,
        observacoes,
        user
      })

      setSelecionada(atualizada)
      setMensagem(
        externaAtiva
          ? 'Retorno da manutenção externa registrado. HT devolvido ao Cofre do P4.'
          : 'Manutenção concluída com sucesso.'
      )
      await carregar()
    } catch (error) {
      setErro(
        error?.message ||
        (externaAtiva
          ? 'Não foi possível registrar o retorno da manutenção externa.'
          : 'Não foi possível concluir a manutenção.')
      )
    } finally {
      setSalvando(false)
    }
  }

  function abrirManutencaoExterna() {
    if (!selecionada) return

    setManutencaoExternaSelecionada(selecionada)
    setSelecionada(null)
  }

  async function encaminharAoP4(observacao) {
    if (!selecionada) return

    if (!window.confirm('Confirma o encaminhamento deste HT em manutenção ao P4? A manutenção permanecerá aberta.')) return

    setSalvando(true)
    setErro('')

    try {
      await encaminharManutencaoAoP4({
        manutencao: selecionada,
        user,
        observacao
      })

      setMensagem('Encaminhamento ao P4 criado. O HT permanece em manutenção até o recebimento pelo P4.')
      setSelecionada(null)
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível encaminhar a manutenção ao P4.')
    } finally {
      setSalvando(false)
    }
  }

  async function cancelar(motivo) {
    if (!selecionada) return

    if (!window.confirm('Confirma o cancelamento desta manutenção?')) {
      return
    }

    setSalvando(true)
    setErro('')

    try {
      const atualizada = await cancelarManutencao({
        manutencaoId: selecionada.id,
        motivo,
        user
      })

      setSelecionada(atualizada)
      setMensagem('Manutenção cancelada.')
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível cancelar a manutenção.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <main className="manutencoes-page">
      <section className="manutencoes-hero">
        <div>
          <span>CENTRAL GERAL</span>
          <h1>Manutenções</h1>
          <p>
            Acompanhe materiais recolhidos, responsáveis, prazos e a conclusão
            dos serviços de todos os módulos patrimoniais.
          </p>
        </div>

        <div className="manutencoes-hero-acoes">
          {onVoltar && (
            <button type="button" className="manutencoes-btn-secundario" onClick={onVoltar}>
              Voltar
            </button>
          )}
          <button type="button" className="manutencoes-btn-primario" onClick={carregar} disabled={loading}>
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </section>

      {erro && <div className="manutencoes-alerta manutencoes-alerta-erro">{erro}</div>}
      {mensagem && (
        <button type="button" className="manutencoes-alerta manutencoes-alerta-sucesso" onClick={() => setMensagem('')}>
          {mensagem}
        </button>
      )}

      <section className="manutencoes-resumo">
        <article><span>Em manutenção</span><strong>{resumo.abertas}</strong><small>Serviços ativos</small></article>
        <article><span>Concluídas</span><strong>{resumo.concluidas}</strong><small>Serviços finalizados</small></article>
        <article><span>Canceladas</span><strong>{resumo.canceladas}</strong><small>Registros cancelados</small></article>
        <article><span>Total filtrado</span><strong>{resumo.total}</strong><small>Registros encontrados</small></article>
      </section>

      <FiltrosManutencao
        filtros={filtros}
        onChange={setFiltros}
        onLimpar={() => setFiltros(FILTROS_INICIAIS)}
        loading={loading}
      />

      <section className="manutencoes-lista-cabecalho">
        <div>
          <span>REGISTROS</span>
          <h2>Materiais em acompanhamento</h2>
        </div>
        <strong>{listaFiltrada.length}</strong>
      </section>

      {loading ? (
        <div className="manutencoes-estado">Carregando manutenções...</div>
      ) : listaFiltrada.length === 0 ? (
        <div className="manutencoes-estado">
          Nenhuma manutenção encontrada com os filtros selecionados.
        </div>
      ) : (
        <section className="manutencoes-grade">
          {listaFiltrada.map((item) => (
            <ManutencaoCard
              key={item.id}
              manutencao={item}
              onAbrir={setSelecionada}
            />
          ))}
        </section>
      )}

      <ManutencaoDetalhes
        manutencao={selecionada}
        onFechar={() => setSelecionada(null)}
        onConcluir={finalizar}
        onCancelar={cancelar}
        onEncaminharP4={encaminharAoP4}
        onEnviarManutencaoExterna={abrirManutencaoExterna}
        user={user}
        salvando={salvando}
      />

      {manutencaoExternaSelecionada && (
        <HTManutencaoExternaModal
          user={user}
          manutencaoInicial={manutencaoExternaSelecionada}
          onClose={() => setManutencaoExternaSelecionada(null)}
          onCreated={async (solicitacao) => {
            setMensagem(
              `Solicitação ${solicitacao?.protocolo || ''} enviada para aprovação do Cmt de Cia.`
            )
            setManutencaoExternaSelecionada(null)
            await carregar()
          }}
        />
      )}
    </main>
  )
}
