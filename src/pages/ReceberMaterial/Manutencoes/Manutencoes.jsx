import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  cancelarManutencao,
  concluirManutencao,
  listarManutencoes,
  STATUS_MANUTENCAO
} from '../../services/manutencoesService'
import FiltrosManutencao from './components/FiltrosManutencao'
import ManutencaoCard from './components/ManutencaoCard'
import ManutencaoDetalhes from './components/ManutencaoDetalhes'
import './Manutencoes.css'

const FILTROS_INICIAIS = {
  pesquisa: '',
  modulo: '',
  status: '',
  dataInicial: '',
  dataFinal: ''
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
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS)
  const [selecionada, setSelecionada] = useState(null)
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro('')

    try {
      const resposta = await listarManutencoes({
        modulo: filtros.modulo || null,
        status: filtros.status || null,
        pesquisa: filtros.pesquisa || null,
        limite: 200
      })

      setManutencoes(resposta.data || [])
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

  const listaFiltrada = useMemo(
    () => manutencoes.filter((item) =>
      dentroDoPeriodo(item, filtros.dataInicial, filtros.dataFinal)
    ),
    [manutencoes, filtros.dataInicial, filtros.dataFinal]
  )

  const resumo = useMemo(() => {
    return listaFiltrada.reduce(
      (acc, item) => {
        if (item.status === STATUS_MANUTENCAO.EM_MANUTENCAO) acc.abertas += 1
        if (item.status === STATUS_MANUTENCAO.CONCLUIDA) acc.concluidas += 1
        if (item.status === STATUS_MANUTENCAO.CANCELADA) acc.canceladas += 1
        acc.total += 1
        return acc
      },
      { abertas: 0, concluidas: 0, canceladas: 0, total: 0 }
    )
  }, [listaFiltrada])

  async function finalizar(observacoes) {
    if (!selecionada) return
    setSalvando(true)
    setErro('')

    try {
      const atualizada = await concluirManutencao({
        manutencaoId: selecionada.id,
        observacoes,
        user
      })

      setSelecionada(atualizada)
      setMensagem('Manutenção concluída com sucesso.')
      await carregar()
    } catch (error) {
      setErro(error?.message || 'Não foi possível concluir a manutenção.')
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
        salvando={salvando}
      />
    </main>
  )
}
