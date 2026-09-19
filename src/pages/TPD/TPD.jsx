import { useCallback, useEffect, useMemo, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

import {
  STATUS_TPD,
  TIPOS_TPD
} from '../../constants/tpds'

import {
  UNIDADES_27_BPMM
} from '../../constants/unidades'

import TPDForm from './components/TPDForm'
import TPDTable from './components/TPDTable'
import TPDDetalhesModal from './components/TPDDetalhesModal'

import {
  excluirTPD,
  listarTPDs,
  obterResumoTPDs
} from '../../services/tpdsService'

import {
  listarFotosTPD
} from '../../services/tpdsFotosService'

import {
  aceitarTransferencia,
  cancelarTransferencia,
  criarTransferenciaPendente,
  listarTransferenciasPendentes,
  recusarTransferencia
} from '../../services/patrimonioTransferenciaService'

import "./styles/TPD.css";

const LIMITE = 20
const statusOptions = STATUS_TPD
const tipoOptions = TIPOS_TPD

function normalizarOperacao(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

function obterPerfilOperacional(user) {
  return normalizarOperacao(
    user?.perfil_temporario_ativo
      ? (user?.perfil_temporario || user?.perfil)
      : user?.perfil
  )
}

function localEhP4(local) {
  const valor = normalizarOperacao(local)

  return (
    valor === 'COFRE P4' ||
    valor === 'COFRE DO P4' ||
    valor === 'GUARDA DO P4' ||
    valor === 'P4'
  )
}

function localEhSvdd(local) {
  const valor = normalizarOperacao(local)

  return (
    valor === 'COFRE DO SVDD' ||
    valor === 'COFRE SVDD' ||
    valor === 'SVDD'
  )
}

function identificacaoTPD(tpd) {
  return (
    tpd?.patrimonio ||
    tpd?.numero_serie ||
    tpd?.qr_code ||
    tpd?.id ||
    'TPD'
  )
}

export default function TPD({ user }) {
  const [tpds, setTPDs] = useState([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const [tpdsOperacionais, setTPDsOperacionais] = useState([])
  const [transferenciasPendentes, setTransferenciasPendentes] = useState([])
  const [destinoTransferenciaAberto, setDestinoTransferenciaAberto] = useState(false)
  const [transferenciaModalAberta, setTransferenciaModalAberta] = useState(false)
  const [recebimentoModalAberta, setRecebimentoModalAberta] = useState(false)
  const [cancelamentoModalAberto, setCancelamentoModalAberto] = useState(false)
  const [transferenciasCancelaveis, setTransferenciasCancelaveis] = useState([])
  const [carregandoCancelaveis, setCarregandoCancelaveis] = useState(false)
  const [cancelandoTransferenciaId, setCancelandoTransferenciaId] = useState(null)
  const [pesquisaTransferencia, setPesquisaTransferencia] = useState('')
  const [tpdsSelecionados, setTPDsSelecionados] = useState([])
  const [transferenciasSelecionadas, setTransferenciasSelecionadas] = useState([])
  const [enviandoLote, setEnviandoLote] = useState(false)
  const [processandoRecebimentoEmLote, setProcessandoRecebimentoEmLote] = useState(false)
  const [loadingOperacoes, setLoadingOperacoes] = useState(false)
  const [processandoTransferenciaId, setProcessandoTransferenciaId] = useState(null)
  const [mensagemOperacao, setMensagemOperacao] = useState('')
  const [erroOperacao, setErroOperacao] = useState('')

  const [resumo, setResumo] = useState({
    total: 0,
    cofreP4: 0,
    cofreSvdd: 0,
    cargaPermanente: 0,
    cautelasAtivas: 0,
    manutencao: 0,
    outrasCias: 0,
    batalhao: 0,
    recolhidos: 0,
    baixados: 0,
    outros: 0
  })

  const [formAberto, setFormAberto] = useState(false)
  const [tpdEditando, setTPDEditando] = useState(null)
  const [tpdVisualizando, setTPDVisualizando] = useState(null)

  const [fotosVisualizacao, setFotosVisualizacao] = useState([])
  const [carregandoFotos, setCarregandoFotos] = useState(false)
  const [erroFotos, setErroFotos] = useState('')

  const [sortBy, setSortBy] = useState('criado_em')
  const [sortDirection, setSortDirection] = useState('desc')

  const [filtros, setFiltros] = useState({
    pesquisa: '',
    tipo_equipamento: '',
    marca: '',
    modelo: '',
    status_operacional: '',
    unidade: ''
  })

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(total / LIMITE)),
    [total]
  )

  const perfilOperacional = useMemo(
    () => obterPerfilOperacional(user),
    [user]
  )

  const visaoSvdd =
    perfilOperacional === 'ENCARREGADO DO SVDD' ||
    perfilOperacional === 'AUXILIAR DO SVDD' ||
    perfilOperacional === 'AUXILIAR SVDD'

  const visaoP4 =
    perfilOperacional === 'P4' ||
    perfilOperacional === 'ADMINISTRADOR'

  const podeOperarTransferencias =
    visaoP4 || visaoSvdd

  const origemTransferencia =
    visaoSvdd ? 'SVDD' : 'P4'

  const destinoTransferencia =
    origemTransferencia === 'P4'
      ? 'SVDD'
      : 'P4'

  const nomeOrigemTransferencia =
    origemTransferencia === 'P4'
      ? 'COFRE P4'
      : 'COFRE DO SVDD'

  const nomeDestinoTransferencia =
    destinoTransferencia === 'P4'
      ? 'COFRE P4'
      : 'COFRE DO SVDD'

  const carregarResumo = useCallback(async () => {
    try {
      const dados =
        await obterResumoTPDs()

      setResumo(
        dados || {
          total: 0,
          cofreP4: 0,
          cofreSvdd: 0,
          cargaPermanente: 0,
          cautelasAtivas: 0,
          manutencao: 0,
          outrasCias: 0,
          batalhao: 0,
          recolhidos: 0,
          baixados: 0,
          outros: 0
        }
      )
    } catch (error) {
      console.error(
        'Erro ao carregar resumo dos TPDs:',
        error
      )
    }
  }, [])

  const carregarTPDs = useCallback(async () => {
    try {
      setLoading(true)
      setErro('')

      const resultado = await listarTPDs({
        filtros: {
          pesquisa: filtros.pesquisa.trim(),
          tipo_equipamento: filtros.tipo_equipamento,
          marca: filtros.marca,
          modelo: filtros.modelo,
          status_operacional: filtros.status_operacional,
          unidade: filtros.unidade
        },
        pagina,
        limite: LIMITE,
        sortBy,
        sortDirection
      })

      setTPDs(resultado.data || [])
      setTotal(resultado.total || 0)
    } catch (error) {
      console.error(error)

      setErro(
        error.message ||
        'Erro ao carregar os TPDs.'
      )
    } finally {
      setLoading(false)
    }
  }, [
    filtros,
    pagina,
    sortBy,
    sortDirection
  ])

  const carregarOperacoes = useCallback(async () => {
    if (!podeOperarTransferencias) {
      setTPDsOperacionais([])
      setTransferenciasPendentes([])
      return
    }

    try {
      setLoadingOperacoes(true)
      setErroOperacao('')

      const [tpdsResultado, pendentesDestino, pendentesOutroDestino] =
        await Promise.all([
          listarTPDs({
            filtros: { ativo: true },
            pagina: 1,
            limite: 5000,
            sortBy: 'patrimonio',
            sortDirection: 'asc'
          }),
          listarTransferenciasPendentes({
            destinoCodigo: origemTransferencia,
            categoria: 'TPD',
            limite: 500
          }),
          listarTransferenciasPendentes({
            destinoCodigo: destinoTransferencia,
            categoria: 'TPD',
            limite: 500
          })
        ])

      const todosTPDs = tpdsResultado?.data || []
      const todasPendencias = [
        ...(pendentesDestino || []),
        ...(pendentesOutroDestino || [])
      ]

      const idsPendentes = new Set(
        todasPendencias
          .map((item) =>
            String(
              item?.metadata?.tpd_id ||
              ''
            )
          )
          .filter(Boolean)
      )

      const elegiveis = todosTPDs.filter((tpd) => {
        if (tpd?.ativo === false) return false
        if (normalizarOperacao(tpd?.status_operacional) !== 'RESERVA') {
          return false
        }

        const estaNaOrigem =
          origemTransferencia === 'P4'
            ? localEhP4(tpd?.local_atual)
            : localEhSvdd(tpd?.local_atual)

        return (
          estaNaOrigem &&
          !idsPendentes.has(String(tpd?.id || ''))
        )
      })

      setTPDsOperacionais(elegiveis)
      setTransferenciasPendentes(pendentesDestino || [])
    } catch (error) {
      console.error('Erro ao carregar operações do TPD:', error)
      setErroOperacao(
        error?.message ||
        'Não foi possível carregar as transferências de TPD.'
      )
    } finally {
      setLoadingOperacoes(false)
    }
  }, [
    podeOperarTransferencias,
    destinoTransferencia,
    origemTransferencia
  ])

  useEffect(() => {
    carregarTPDs()
  }, [carregarTPDs])

  useEffect(() => {
    carregarResumo()
  }, [carregarResumo])

  useEffect(() => {
    carregarOperacoes()
  }, [carregarOperacoes])

  async function atualizarTelaAposOperacao() {
    await Promise.all([
      carregarOperacoes(),
      carregarTPDs(),
      carregarResumo()
    ])
  }

  const tpdsDisponiveisTransferencia = useMemo(() => {
    const termo = normalizarOperacao(pesquisaTransferencia)

    return tpdsOperacionais.filter((tpd) => {
      if (!termo) return true

      const alvo = normalizarOperacao([
        tpd?.patrimonio,
        tpd?.numero_serie,
        tpd?.marca,
        tpd?.modelo,
        tpd?.tipo_equipamento
      ].filter(Boolean).join(' '))

      return alvo.includes(termo)
    })
  }, [tpdsOperacionais, pesquisaTransferencia])

  async function abrirCancelamentoTransferenciaTPD() {
    try {
      setCarregandoCancelaveis(true)
      setErroOperacao('')
      setMensagemOperacao('')

      const pendentes = await listarTransferenciasPendentes({
        destinoCodigo: destinoTransferencia,
        categoria: 'TPD',
        limite: 500
      })

      const daOrigemAtual = (Array.isArray(pendentes) ? pendentes : [])
        .filter(
          (item) =>
            normalizarOperacao(item?.origem_codigo) ===
            normalizarOperacao(origemTransferencia)
        )

      setTransferenciasCancelaveis(daOrigemAtual)
      setCancelamentoModalAberto(true)
    } catch (error) {
      console.error('Erro ao carregar transferências canceláveis de TPD:', error)
      setErroOperacao(
        error?.message ||
        'Não foi possível carregar as transferências pendentes para cancelamento.'
      )
    } finally {
      setCarregandoCancelaveis(false)
    }
  }

  async function handleCancelarTransferenciaTPD(transferencia) {
    if (!transferencia?.id) return

    const identificacao =
      transferencia?.metadata?.patrimonio ||
      transferencia?.metadata?.numero_serie ||
      transferencia?.metadata?.descricao_tpd ||
      transferencia?.protocolo ||
      'TPD'

    const motivo = window.prompt(
      `Informe o motivo do cancelamento da transferência do TPD ${identificacao}:`,
      'Cancelamento solicitado pelo setor de origem.'
    )

    if (motivo === null) return

    try {
      setCancelandoTransferenciaId(transferencia.id)
      setErroOperacao('')
      setMensagemOperacao('')

      await cancelarTransferencia({
        transferenciaId: transferencia.id,
        motivoCancelamento: motivo,
        user
      })

      const atualizadas = transferenciasCancelaveis.filter(
        (item) => String(item.id) !== String(transferencia.id)
      )

      setTransferenciasCancelaveis(atualizadas)
      setMensagemOperacao(
        `Transferência ${transferencia.protocolo || ''} cancelada com sucesso.`.trim()
      )

      await atualizarTelaAposOperacao()
    } catch (error) {
      console.error('Erro ao cancelar transferência de TPD:', error)
      setErroOperacao(
        error?.message ||
        'Não foi possível cancelar a transferência do TPD.'
      )
    } finally {
      setCancelandoTransferenciaId(null)
    }
  }

  function abrirTransferenciaTPD() {
    setPesquisaTransferencia('')
    setTPDsSelecionados([])
    setErroOperacao('')
    setMensagemOperacao('')

    if (origemTransferencia === 'P4') {
      setDestinoTransferenciaAberto(true)
      return
    }

    setTransferenciaModalAberta(true)
  }

  function selecionarDestinoTransferenciaTPD(destino) {
    if (destino !== 'SVDD') {
      return
    }

    setDestinoTransferenciaAberto(false)
    setTransferenciaModalAberta(true)
  }

  function alternarTPDSelecionado(tpdId) {
    setTPDsSelecionados((atuais) =>
      atuais.includes(tpdId)
        ? atuais.filter((id) => id !== tpdId)
        : [...atuais, tpdId]
    )
  }

  function selecionarTodosTPDsVisiveis() {
    const ids = tpdsDisponiveisTransferencia.map((tpd) => tpd.id)
    const todosSelecionados =
      ids.length > 0 &&
      ids.every((id) => tpdsSelecionados.includes(id))

    setTPDsSelecionados((atuais) => {
      if (todosSelecionados) {
        return atuais.filter((id) => !ids.includes(id))
      }

      return Array.from(new Set([...atuais, ...ids]))
    })
  }

  async function confirmarTransferenciaTPDs() {
    const selecionados = tpdsOperacionais.filter((tpd) =>
      tpdsSelecionados.includes(tpd.id)
    )

    if (selecionados.length === 0) {
      setErroOperacao('Selecione ao menos um TPD para transferir.')
      return
    }

    const confirmou = window.confirm(
      `${origemTransferencia === 'P4' ? 'Enviar' : 'Devolver'} ${selecionados.length} ${
        selecionados.length === 1 ? 'TPD' : 'TPDs'
      } de ${nomeOrigemTransferencia} para ${nomeDestinoTransferencia}?\n\n` +
      `Cada TPD ficará pendente até o aceite do ${destinoTransferencia}.`
    )

    if (!confirmou) return

    try {
      setEnviandoLote(true)
      setErroOperacao('')
      setMensagemOperacao('')

      const resultados = []

      for (const tpd of selecionados) {
        const transferencia = await criarTransferenciaPendente({
          tpdId: tpd.id,
          patrimonioId: tpd.patrimonio_id || null,
          categoria: 'TPD',
          quantidade: 1,
          origemTipo: 'SETOR',
          origemCodigo: origemTransferencia,
          origemNome: nomeOrigemTransferencia,
          destinoTipo: 'SETOR',
          destinoCodigo: destinoTransferencia,
          destinoNome: nomeDestinoTransferencia,
          motivo:
            origemTransferencia === 'P4'
              ? 'DISTRIBUICAO_OPERACIONAL'
              : 'DEVOLUCAO_AO_P4',
          observacoes:
            `${origemTransferencia === 'P4' ? 'Envio' : 'Devolução'} do TPD ${identificacaoTPD(tpd)} de ${nomeOrigemTransferencia} para ${nomeDestinoTransferencia}.`,
          metadata: {
            tpd_id: tpd.id,
            patrimonio: tpd.patrimonio || null,
            numero_serie: tpd.numero_serie || null,
            marca: tpd.marca || null,
            modelo: tpd.modelo || null,
            tipo_equipamento: tpd.tipo_equipamento || null,
            lote_operacional: true
          },
          user
        })

        resultados.push(transferencia)
      }

      setTransferenciaModalAberta(false)
      setTPDsSelecionados([])
      setMensagemOperacao(
        `${resultados.length} ${resultados.length === 1 ? 'TPD movimentado' : 'TPDs movimentados'} para o ${destinoTransferencia}. Aguardando recebimento.`
      )

      await atualizarTelaAposOperacao()
    } catch (error) {
      console.error('Erro ao transferir TPD:', error)
      setErroOperacao(
        error?.message ||
        'Não foi possível concluir a transferência dos TPDs.'
      )
    } finally {
      setEnviandoLote(false)
    }
  }

  async function handleAceitarTransferenciaTPD(transferencia) {
    const identificacao =
      transferencia?.metadata?.patrimonio ||
      transferencia?.metadata?.numero_serie ||
      transferencia?.protocolo ||
      'TPD'

    const confirmou = window.confirm(
      `Confirmar o recebimento do TPD ${identificacao} no ${nomeOrigemTransferencia}?`
    )

    if (!confirmou) return

    try {
      setProcessandoTransferenciaId(transferencia.id)
      setErroOperacao('')
      setMensagemOperacao('')

      await aceitarTransferencia({
        transferenciaId: transferencia.id,
        user
      })

      setMensagemOperacao(
        `TPD ${identificacao} recebido no ${nomeOrigemTransferencia}.`
      )

      await atualizarTelaAposOperacao()
    } catch (error) {
      console.error('Erro ao receber TPD:', error)
      setErroOperacao(
        error?.message ||
        'Não foi possível confirmar o recebimento do TPD.'
      )
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  async function handleRecusarTransferenciaTPD(transferencia) {
    const motivo = window.prompt(
      `Informe o motivo da recusa da transferência ${transferencia?.protocolo || ''}:`
    )

    if (motivo === null) return

    if (!String(motivo).trim()) {
      setErroOperacao('Informe o motivo da recusa.')
      return
    }

    try {
      setProcessandoTransferenciaId(transferencia.id)
      setErroOperacao('')
      setMensagemOperacao('')

      await recusarTransferencia({
        transferenciaId: transferencia.id,
        motivoRecusa: motivo,
        user
      })

      setMensagemOperacao(
        `Transferência ${transferencia?.protocolo || ''} recusada.`
      )

      await atualizarTelaAposOperacao()
    } catch (error) {
      console.error('Erro ao recusar TPD:', error)
      setErroOperacao(
        error?.message ||
        'Não foi possível recusar a transferência do TPD.'
      )
    } finally {
      setProcessandoTransferenciaId(null)
    }
  }

  function alternarTransferenciaSelecionada(transferenciaId) {
    setTransferenciasSelecionadas((atuais) =>
      atuais.includes(transferenciaId)
        ? atuais.filter((id) => id !== transferenciaId)
        : [...atuais, transferenciaId]
    )
  }

  function selecionarTodasTransferenciasPendentes() {
    const ids = transferenciasPendentes.map(
      (transferencia) => transferencia.id
    )

    const todasSelecionadas =
      ids.length > 0 &&
      ids.every((id) => transferenciasSelecionadas.includes(id))

    setTransferenciasSelecionadas(
      todasSelecionadas ? [] : ids
    )
  }

  async function handleReceberTransferenciasSelecionadas() {
    const selecionadas = transferenciasPendentes.filter(
      (transferencia) =>
        transferenciasSelecionadas.includes(transferencia.id)
    )

    if (selecionadas.length === 0) {
      setErroOperacao('Selecione ao menos um TPD para receber.')
      return
    }

    const confirmou = window.confirm(
      `Confirmar o recebimento de ${selecionadas.length} ${
        selecionadas.length === 1 ? 'TPD' : 'TPDs'
      } no ${nomeOrigemTransferencia}?`
    )

    if (!confirmou) return

    try {
      setProcessandoRecebimentoEmLote(true)
      setErroOperacao('')
      setMensagemOperacao('')

      const falhas = []

      for (const transferencia of selecionadas) {
        try {
          await aceitarTransferencia({
            transferenciaId: transferencia.id,
            user
          })
        } catch (error) {
          falhas.push({ transferencia, error })
        }
      }

      setTransferenciasSelecionadas([])

      await atualizarTelaAposOperacao()

      if (falhas.length > 0) {
        setErroOperacao(
          `${selecionadas.length - falhas.length} recebida(s) e ${falhas.length} com erro. ` +
          (falhas[0]?.error?.message || 'Confira as pendências restantes.')
        )
      } else {
        setMensagemOperacao(
          `${selecionadas.length} ${
            selecionadas.length === 1 ? 'TPD recebido' : 'TPDs recebidos'
          } com sucesso no ${nomeOrigemTransferencia}.`
        )
      }
    } finally {
      setProcessandoRecebimentoEmLote(false)
    }
  }

  function handleFiltroChange(event) {
    const { name, value } = event.target

    setFiltros((prev) => ({
      ...prev,
      [name]: value
    }))

    setPagina(1)
  }

  function limparFiltros() {
    setFiltros({
      pesquisa: '',
      tipo_equipamento: '',
      marca: '',
      modelo: '',
      status_operacional: '',
      unidade: ''
    })

    setPagina(1)
  }

  function rolarParaFormulario() {
    requestAnimationFrame(() => {
      document
        .querySelector('.tpd-form-area')
        ?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        })
    })
  }

  function limparVisualizacao() {
    setTPDVisualizando(null)
    setFotosVisualizacao([])
    setCarregandoFotos(false)
    setErroFotos('')
  }

  function abrirNovoCadastro() {
    setTPDEditando(null)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  function abrirEdicao(tpd) {
    setTPDEditando(tpd)
    limparVisualizacao()
    setFormAberto(true)
    rolarParaFormulario()
  }

  async function abrirVisualizacao(tpd) {
    setTPDVisualizando(tpd)
    setFotosVisualizacao([])
    setErroFotos('')
    setCarregandoFotos(true)

    try {
      const fotos = await listarFotosTPD(tpd.id)

      setFotosVisualizacao(
        Array.isArray(fotos)
          ? fotos
          : []
      )
    } catch (error) {
      console.error(
        'Erro ao carregar fotos do TPD:',
        error
      )

      setErroFotos(
        error.message ||
        'Não foi possível carregar as fotos do TPD.'
      )
    } finally {
      setCarregandoFotos(false)
    }
  }

  function fecharVisualizacao() {
    limparVisualizacao()
  }

  function fecharFormulario() {
    setFormAberto(false)
    setTPDEditando(null)
  }

  async function handleSaved() {
    fecharFormulario()
    await Promise.all([
      carregarTPDs(),
      carregarResumo()
    ])
  }

  async function handleExcluir(tpd) {
    const identificacao =
      tpd.patrimonio ||
      tpd.numero_serie ||
      'TPD'

    const confirmou = window.confirm(
      `Deseja realmente excluir o TPD "${identificacao}"?`
    )

    if (!confirmou) return

    try {
      await excluirTPD(tpd.id, user)
      await Promise.all([
        carregarTPDs(),
        carregarResumo()
      ])
    } catch (error) {
      window.alert(
        error.message ||
        'Erro ao excluir o TPD.'
      )
    }
  }

  function ordenar(campo) {
    if (sortBy === campo) {
      setSortDirection((prev) =>
        prev === 'asc'
          ? 'desc'
          : 'asc'
      )

      return
    }

    setSortBy(campo)
    setSortDirection('asc')
  }

  function obterValorOpcao(option) {
    return typeof option === 'string'
      ? option
      : option.value
  }

  function obterLabelOpcao(option) {
    return typeof option === 'string'
      ? option
      : option.label
  }

  const distribuicao = [
    ...(!visaoSvdd
      ? [{
          chave: 'cofreP4',
          label: 'Cofre do P4',
          valor: Number(resumo.cofreP4 || 0),
          classe: 'verde'
        }]
      : []),
    {
      chave: 'cofreSvdd',
      label: 'Cofre do SVDD',
      valor: Number(resumo.cofreSvdd || 0),
      classe: 'azul'
    },
    ...(!visaoSvdd
      ? [{
          chave: 'cargaPermanente',
          label: 'Carga permanente',
          valor: Number(resumo.cargaPermanente || 0),
          classe: 'amarelo'
        }]
      : []),
    {
      chave: 'cautelasAtivas',
      label: 'Cautelas ativas',
      valor: Number(resumo.cautelasAtivas || 0),
      classe: 'roxo'
    },
    {
      chave: 'manutencao',
      label: 'Manutenção',
      valor: Number(resumo.manutencao || 0),
      classe: 'vermelho'
    },
    ...(!visaoSvdd
      ? [{
          chave: 'outrasCias',
          label: 'Outras Cias',
          valor: Number(resumo.outrasCias || 0),
          classe: 'azul'
        },
        {
          chave: 'batalhao',
          label: 'Batalhão',
          valor: Number(resumo.batalhao || 0),
          classe: 'azul'
        }]
      : []),
    {
      chave: 'baixados',
      label: 'Baixados',
      valor: Number(resumo.baixados || 0),
      classe: 'azul'
    },
    ...(!visaoSvdd
      ? [{
          chave: 'outros',
          label: 'Outros',
          valor: Number(resumo.outros || 0),
          classe: 'cinza'
        }]
      : [])
  ]

  const totalDistribuicao =
    distribuicao.reduce(
      (soma, item) =>
        soma + Number(item.valor || 0),
      0
    )

  const totalControladoExibido =
    visaoSvdd
      ? totalDistribuicao
      : Number(resumo.total || 0)

  const totalGrafico =
    Math.max(
      1,
      totalControladoExibido
    )

  let acumuladoGrafico = 0

  const coresGrafico = {
    verde: '#2f9e6f',
    azul: '#1677d2',
    amarelo: '#d18a14',
    laranja: '#e47c15',
    vermelho: '#d74444',
    roxo: '#7450c8',
    cinza: '#8796a8'
  }

  const gradienteRosca =
    distribuicao
      .filter(
        (item) =>
          Number(item.valor || 0) > 0
      )
      .map((item) => {
        const inicio =
          acumuladoGrafico

        acumuladoGrafico +=
          (
            Number(item.valor || 0) /
            totalGrafico
          ) * 100

        return `${coresGrafico[item.classe]} ${inicio}% ${acumuladoGrafico}%`
      })
      .join(', ') ||
    '#d8e3ef 0% 100%'

  function filtrarPorResumo(chave) {
    setPagina(1)

    if (chave === 'cofreP4') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'RESERVA',
        pesquisa: 'COFRE P4'
      }))
      return
    }

    if (chave === 'cofreSvdd') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'RESERVA',
        pesquisa: 'COFRE DO SVDD'
      }))
      return
    }

    if (chave === 'cautelasAtivas') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'EM_SERVICO',
        pesquisa: ''
      }))
      return
    }

    if (chave === 'manutencao') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'MANUTENCAO',
        pesquisa: ''
      }))
      return
    }

    if (chave === 'recolhidos') {
      setFiltros((prev) => ({
        ...prev,
        status_operacional: 'RECOLHIDO',
        pesquisa: ''
      }))
      return
    }

    setFiltros((prev) => ({
      ...prev,
      status_operacional: '',
      pesquisa: ''
    }))
  }

  return (
    <main className="tpd-page">
      <header className="tpd-header">
        <div>
          <span className="tpd-kicker">
            Gestão Patrimonial
          </span>

          <h1>TPD</h1>

          <p>
            Cadastro, consulta e controle dos
            Terminais Portáteis de Dados.
          </p>
        </div>

        <button
          type="button"
          className="tpd-btn-primary"
          onClick={abrirNovoCadastro}
        >
          Novo TPD
        </button>
      </header>

      <section className="tpd-resumo-grid">
        <article className="tpd-resumo-card tpd-resumo-total">
          <small>TOTAL CONTROLADO</small>
          <strong>{totalControladoExibido}</strong>
          <span>{visaoSvdd ? 'Sob responsabilidade do SVDD' : 'Cofre P4 + Cofre SVDD + cautelas'}</span>
        </article>

        {!visaoSvdd && (
          <article className="tpd-resumo-card tpd-resumo-p4">
            <small>COFRE DO P4</small>
            <strong>{Number(resumo.cofreP4 || 0)}</strong>
            <span>TPDs sob guarda do P4</span>
          </article>
        )}

        <article className="tpd-resumo-card tpd-resumo-svdd">
          <small>COFRE DO SVDD</small>
          <strong>{Number(resumo.cofreSvdd || 0)}</strong>
          <span>TPDs disponíveis no Serviço de Dia</span>
        </article>

        {!visaoSvdd && (
          <article className="tpd-resumo-card tpd-resumo-carga">
            <small>CARGA PERMANENTE</small>
            <strong>{Number(resumo.cargaPermanente || 0)}</strong>
            <span>TPDs em carga permanente</span>
          </article>
        )}

        <article className="tpd-resumo-card tpd-resumo-cautela">
          <small>CAUTELAS ATIVAS</small>
          <strong>{Number(resumo.cautelasAtivas || 0)}</strong>
          <span>TPDs com policiais</span>
        </article>

        <article className="tpd-resumo-card tpd-resumo-manutencao">
          <small>MANUTENÇÃO</small>
          <strong>{Number(resumo.manutencao || 0)}</strong>
          <span>Material indisponível</span>
        </article>

        {!visaoSvdd && (
          <article className="tpd-resumo-card tpd-resumo-outras">
            <small>OUTRAS CIAS</small>
            <strong>{Number(resumo.outrasCias || 0)}</strong>
            <span>Outras companhias</span>
          </article>
        )}

        {!visaoSvdd && (
          <article className="tpd-resumo-card tpd-resumo-batalhao">
            <small>BATALHÃO</small>
            <strong>{Number(resumo.batalhao || 0)}</strong>
            <span>Carga do batalhão</span>
          </article>
        )}

        <article className="tpd-resumo-card tpd-resumo-baixados">
          <small>BAIXADOS</small>
          <strong>{Number(resumo.baixados || 0)}</strong>
          <span>Baixas registradas</span>
        </article>

        {!visaoSvdd && (
          <article className="tpd-resumo-card tpd-resumo-outros">
            <small>OUTROS</small>
            <strong>{Number(resumo.outros || 0)}</strong>
            <span>Outra unidade ou destino</span>
          </article>
        )}
      </section>

      <section className="tpd-graficos-grid">
        <article className="tpd-grafico-card">
          <div className="tpd-grafico-titulo">
            <span>DISTRIBUIÇÃO</span>
            <h3>TPDs por situação</h3>
          </div>

          <div className="tpd-rosca-layout">
            <div
              className="tpd-rosca"
              style={{
                background:
                  `conic-gradient(${gradienteRosca})`
              }}
            >
              <div>
                <strong>{totalControladoExibido}</strong>
                <small>TOTAL</small>
              </div>
            </div>

            <div className="tpd-legenda">
              {distribuicao.map((item) => {
                const percentual =
                  totalControladoExibido > 0
                    ? (
                        Number(item.valor || 0) /
                        totalControladoExibido
                      ) * 100
                    : 0

                return (
                  <div
                    key={item.chave}
                    className="tpd-legenda-linha"
                  >
                    <i
                      className={`tpd-cor tpd-cor-${item.classe}`}
                    />
                    <span>{item.label}</span>
                    <b>{item.valor}</b>
                    <small>
                      {percentual.toLocaleString(
                        'pt-BR',
                        {
                          maximumFractionDigits: 1
                        }
                      )}%
                    </small>
                  </div>
                )
              })}
            </div>
          </div>
        </article>

        <article className="tpd-grafico-card">
          <div className="tpd-grafico-titulo">
            <span>COMPARATIVO</span>
            <h3>TPDs por local</h3>
          </div>

          <div className="tpd-barras">
            {distribuicao.map((item) => {
              const percentual =
                totalControladoExibido > 0
                  ? (
                      Number(item.valor || 0) /
                      totalControladoExibido
                    ) * 100
                  : 0

              return (
                <div
                  key={item.chave}
                  className="tpd-barra-linha"
                >
                  <span>{item.label}</span>

                  <div className="tpd-barra-trilho">
                    <i
                      className={`tpd-barra-preenchimento tpd-barra-${item.classe}`}
                      style={{
                        width:
                          `${percentual}%`
                      }}
                    />
                  </div>

                  <b>{item.valor}</b>
                </div>
              )
            })}
          </div>
        </article>
      </section>

      {podeOperarTransferencias && (
        <section className="tpd-operacoes-section">
          <div className="tpd-section-title">
            <div>
              <span>OPERAÇÕES PERMITIDAS</span>
              <h2>Movimentações de TPDs</h2>
            </div>
          </div>

          {erroOperacao && (
            <div className="tpd-alert-error">
              {erroOperacao}
            </div>
          )}

          {mensagemOperacao && (
            <div
              style={{
                marginBottom: '14px',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid #9fd5b7',
                background: '#effaf3',
                color: '#17643a',
                fontSize: '0.86rem',
                fontWeight: 700
              }}
            >
              {mensagemOperacao}
            </div>
          )}

          <div className="tpd-movement-groups">
            <div className="tpd-movement-group">
              <div className="tpd-movement-group-header">
                <div
                  className="tpd-movement-group-icon"
                  aria-hidden="true"
                >
                  📦
                </div>

                <div>
                  <h3>Saídas e movimentações</h3>
                  <p>Distribuição e movimentação de TPDs.</p>
                </div>
              </div>

              <div className="tpd-action-grid">
                <button
                  type="button"
                  onClick={abrirTransferenciaTPD}
                  disabled={
                    loadingOperacoes ||
                    enviandoLote
                  }
                >
                  <strong>
                    {origemTransferencia === 'P4'
                      ? 'Transferir TPD'
                      : 'Devolver ao P4'}
                  </strong>

                  <span>
                    {origemTransferencia === 'P4'
                      ? 'Selecionar um ou vários TPDs e enviar ao Cofre do SVDD'
                      : 'Selecionar um ou vários TPDs e devolver ao Cofre do P4'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={abrirCancelamentoTransferenciaTPD}
                  disabled={
                    loadingOperacoes ||
                    carregandoCancelaveis ||
                    Boolean(cancelandoTransferenciaId)
                  }
                >
                  <strong>Cancelar movimentação</strong>
                  <span>Cancelar uma transferência que ainda não foi recebida</span>
                </button>
              </div>
            </div>

            <div className="tpd-movement-group">
              <div className="tpd-movement-group-header">
                <div
                  className="tpd-movement-group-icon"
                  aria-hidden="true"
                >
                  🛠️
                </div>

                <div>
                  <h3>Condição do material</h3>
                  <p>Manutenção, recolhimento e baixa de TPDs.</p>
                </div>
              </div>

              <div className="tpd-action-grid">
                <button
                  type="button"
                  disabled
                >
                  <strong>Enviar para manutenção</strong>
                  <span>Registrar TPD avariado ou indisponível e encaminhar para reparo</span>
                </button>

                <button
                  type="button"
                  disabled
                >
                  <strong>Recolher TPD</strong>
                  <span>Retirar o equipamento de uso e registrar seu recolhimento</span>
                </button>

                <button
                  type="button"
                  disabled
                >
                  <strong>Baixa</strong>
                  <span>Encerrar definitivamente o controle patrimonial do TPD</span>
                </button>
              </div>
            </div>

            <div className="tpd-movement-group">
              <div className="tpd-movement-group-header">
                <div
                  className="tpd-movement-group-icon"
                  aria-hidden="true"
                >
                  📥
                </div>

                <div>
                  <h3>Entradas e recebimentos</h3>
                  <p>Entrada, devolução e retorno de TPDs.</p>
                </div>
              </div>

              <div className="tpd-action-grid">
                {visaoP4 && (
                  <button
                    type="button"
                    onClick={abrirNovoCadastro}
                  >
                    <strong>Receber material novo</strong>
                    <span>Cadastrar novo TPD recebido pelo P4</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled
                >
                  <strong>Receber devolução</strong>
                  <span>Encerrar cautela e receber novamente o TPD</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTransferenciasSelecionadas([])
                    setErroOperacao('')
                    setMensagemOperacao('')
                    setRecebimentoModalAberta(true)
                    carregarOperacoes()
                  }}
                  disabled={
                    loadingOperacoes ||
                    processandoRecebimentoEmLote
                  }
                >
                  <strong>
                    {origemTransferencia === 'P4'
                      ? 'Receber do SVDD'
                      : 'Receber do P4'}
                  </strong>

                  <span>
                    {transferenciasPendentes.length > 0
                      ? `${transferenciasPendentes.length} pendência(s) aguardando recebimento`
                      : origemTransferencia === 'P4'
                        ? 'Confirmar TPD devolvido pelo SVDD'
                        : 'Confirmar TPD enviado ao Cofre do SVDD'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled
                >
                  <strong>Receber manutenção</strong>
                  <span>Registrar o retorno do TPD após reparo</span>
                </button>
              </div>
            </div>

            <div className="tpd-movement-group">
              <div className="tpd-movement-group-header">
                <div
                  className="tpd-movement-group-icon"
                  aria-hidden="true"
                >
                  🗂️
                </div>

                <div>
                  <h3>Gestão e rastreabilidade</h3>
                  <p>Controle interno, histórico e acompanhamento dos TPDs.</p>
                </div>
              </div>

              <div className="tpd-action-grid">
                <button
                  type="button"
                  onClick={() =>
                    document
                      .querySelector('.tpd-list-card')
                      ?.scrollIntoView({
                        behavior: 'smooth'
                      })
                  }
                >
                  <strong>Consultar patrimônio</strong>
                  <span>Visualizar TPDs cadastrados e a situação atual de cada equipamento</span>
                </button>

                <button
                  type="button"
                  disabled
                >
                  <strong>Histórico de movimentações</strong>
                  <span>Consultar transferências, recebimentos e alterações do TPD</span>
                </button>

                <button
                  type="button"
                  disabled
                >
                  <strong>Acompanhar manutenção</strong>
                  <span>Consultar TPDs em manutenção e acompanhar o retorno</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {erro && (
        <div className="tpd-alert-error">
          {erro}
        </div>
      )}

      <section className="tpd-toolbar">
        <div className="tpd-search">
          <label htmlFor="pesquisa">
            Pesquisar
          </label>

          <input
            id="pesquisa"
            name="pesquisa"
            type="search"
            value={filtros.pesquisa}
            onChange={handleFiltroChange}
            placeholder="Patrimônio, série, marca, modelo, equipe ou viatura"
          />
        </div>

        <div className="tpd-filter">
          <label htmlFor="tipo_equipamento">
            Tipo
          </label>

          <select
            id="tipo_equipamento"
            name="tipo_equipamento"
            value={filtros.tipo_equipamento}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {tipoOptions.map((option) => {
              const valor =
                obterValorOpcao(option)

              return (
                <option
                  key={valor}
                  value={valor}
                >
                  {obterLabelOpcao(option)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="tpd-filter">
          <label htmlFor="marca">
            Marca
          </label>

          <input
            id="marca"
            name="marca"
            value={filtros.marca}
            onChange={handleFiltroChange}
            placeholder="Ex.: Motorola"
          />
        </div>

        <div className="tpd-filter">
          <label htmlFor="modelo">
            Modelo
          </label>

          <input
            id="modelo"
            name="modelo"
            value={filtros.modelo}
            onChange={handleFiltroChange}
            placeholder="Ex.: G56"
          />
        </div>

        <div className="tpd-filter">
          <label htmlFor="status_operacional">
            Status
          </label>

          <select
            id="status_operacional"
            name="status_operacional"
            value={filtros.status_operacional}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todos
            </option>

            {statusOptions.map((option) => {
              const valor =
                obterValorOpcao(option)

              return (
                <option
                  key={valor}
                  value={valor}
                >
                  {obterLabelOpcao(option)}
                </option>
              )
            })}
          </select>
        </div>

        <div className="tpd-filter">
          <label htmlFor="unidade">
            Unidade
          </label>

          <select
            id="unidade"
            name="unidade"
            value={filtros.unidade}
            onChange={handleFiltroChange}
          >
            <option value="">
              Todas
            </option>

            {UNIDADES_27_BPMM.map(
              (unidade) => (
                <option
                  key={unidade}
                  value={unidade}
                >
                  {unidade}
                </option>
              )
            )}
          </select>
        </div>

        <button
          type="button"
          className="tpd-btn-secondary tpd-toolbar-clear"
          onClick={limparFiltros}
        >
          Limpar
        </button>
      </section>

      {formAberto && (
        <section className="tpd-form-area">
          <TPDForm
            user={user}
            tpdEditando={tpdEditando}
            onCancel={fecharFormulario}
            onSaved={handleSaved}
          />
        </section>
      )}

      <section className="tpd-list-card">
        <div className="tpd-list-header">
          <div>
            <h2>
              TPDs cadastrados
            </h2>

            <p>
              {total}{' '}
              {total === 1
                ? 'registro encontrado'
                : 'registros encontrados'}
            </p>
          </div>
        </div>

        <TPDTable
          tpds={tpds}
          loading={loading}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={ordenar}
          onView={abrirVisualizacao}
          onEdit={abrirEdicao}
          onDelete={handleExcluir}
        />

        <footer className="tpd-pagination">
          <button
            type="button"
            disabled={
              pagina <= 1 ||
              loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.max(
                  1,
                  prev - 1
                )
              )
            }
          >
            Anterior
          </button>

          <span>
            Página {pagina} de{' '}
            {totalPaginas}
          </span>

          <button
            type="button"
            disabled={
              pagina >= totalPaginas ||
              loading
            }
            onClick={() =>
              setPagina((prev) =>
                Math.min(
                  totalPaginas,
                  prev + 1
                )
              )
            }
          >
            Próxima
          </button>
        </footer>
      </section>

               

      {cancelamentoModalAberto && (
        <div
          className="tpd-transferencia-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !cancelandoTransferenciaId
            ) {
              setCancelamentoModalAberto(false)
            }
          }}
        >
          <section
            className="tpd-transferencia-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Cancelar transferência de TPD"
          >
            <header>
              <div>
                <span>Transferência patrimonial</span>
                <h2>Cancelar movimentação</h2>
                <p>
                  Selecione uma transferência pendente criada por {nomeOrigemTransferencia}.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                disabled={Boolean(cancelandoTransferenciaId)}
                onClick={() => setCancelamentoModalAberto(false)}
              >
                ×
              </button>
            </header>

            <div className="tpd-transferencia-lista">
              {carregandoCancelaveis ? (
                <div className="tpd-empty-operacao">
                  Carregando transferências pendentes...
                </div>
              ) : transferenciasCancelaveis.length === 0 ? (
                <div className="tpd-empty-operacao">
                  Nenhuma transferência pendente disponível para cancelamento.
                </div>
              ) : (
                transferenciasCancelaveis.map((transferencia) => {
                  const identificacao =
                    transferencia?.metadata?.patrimonio ||
                    transferencia?.metadata?.numero_serie ||
                    transferencia?.metadata?.descricao_tpd ||
                    transferencia?.protocolo ||
                    'TPD'

                  const cancelando =
                    cancelandoTransferenciaId === transferencia.id

                  return (
                    <div
                      key={transferencia.id}
                      className="tpd-transferencia-item tpd-recebimento-item"
                    >
                      <div>
                        <strong>{identificacao}</strong>
                        <span>
                          Protocolo: {transferencia.protocolo || '-'}
                        </span>
                        <span>
                          {transferencia.origem_nome || '-'} → {transferencia.destino_nome || '-'}
                        </span>
                      </div>

                      <button
                        type="button"
                        className="tpd-btn-secondary"
                        disabled={Boolean(cancelandoTransferenciaId)}
                        onClick={() =>
                          handleCancelarTransferenciaTPD(transferencia)
                        }
                      >
                        {cancelando ? 'Cancelando...' : 'Cancelar transferência'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            <footer>
              <button
                type="button"
                className="tpd-btn-secondary"
                disabled={Boolean(cancelandoTransferenciaId)}
                onClick={() => setCancelamentoModalAberto(false)}
              >
                Fechar
              </button>
            </footer>
          </section>
        </div>
      )}

      {destinoTransferenciaAberto && (
        <div
          className="tpd-transferencia-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDestinoTransferenciaAberto(false)
            }
          }}
        >
          <section
            className="tpd-transferencia-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Transferir TPD"
          >
            <header>
              <div>
                <span>SIGMO • TPD</span>
                <h2>Transferir TPD</h2>
                <p>Escolha o destino da movimentação.</p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setDestinoTransferenciaAberto(false)}
              >
                ×
              </button>
            </header>

            <div className="tpd-transferencia-lista">
              <div className="tpd-action-grid">
                <button
                  type="button"
                  onClick={() => selecionarDestinoTransferenciaTPD('SVDD')}
                >
                  <strong>SVDD</strong>
                  <span>Transferir TPDs para o Serviço de Dia.</span>
                </button>

                <button type="button" disabled>
                  <strong>Carga permanente</strong>
                  <span>Destinar TPD para carga permanente.</span>
                </button>

                <button type="button" disabled>
                  <strong>Outras Cias</strong>
                  <span>Transferir TPD para outra Companhia.</span>
                </button>

                <button type="button" disabled>
                  <strong>Batalhão</strong>
                  <span>Transferir TPD para carga do Batalhão.</span>
                </button>

                <button type="button" disabled>
                  <strong>Outra unidade / Outros</strong>
                  <span>Registrar transferência para outro destino ou unidade.</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {transferenciaModalAberta && (
        <div
          className="tpd-transferencia-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !enviandoLote
            ) {
              setTransferenciaModalAberta(false)
            }
          }}
        >
          <section
            className="tpd-transferencia-modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              origemTransferencia === 'P4'
                ? 'Transferir TPDs para o SVDD'
                : 'Devolver TPDs ao P4'
            }
          >
            <header>
              <div>
                <span>Transferência patrimonial</span>
                <h2>
                  {nomeOrigemTransferencia} → {nomeDestinoTransferencia}
                </h2>
                <p>
                  Selecione um ou vários TPDs. O local só será alterado após o recebimento pelo destino.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                disabled={enviandoLote}
                onClick={() => setTransferenciaModalAberta(false)}
              >
                ×
              </button>
            </header>

            <div className="tpd-transferencia-toolbar">
              <input
                type="search"
                value={pesquisaTransferencia}
                onChange={(event) =>
                  setPesquisaTransferencia(event.target.value)
                }
                placeholder="Pesquisar patrimônio, série, marca ou modelo"
              />

              <button
                type="button"
                onClick={selecionarTodosTPDsVisiveis}
                disabled={enviandoLote}
              >
                Selecionar visíveis
              </button>
            </div>

            <div className="tpd-transferencia-contador">
              <strong>{tpdsSelecionados.length}</strong>
              <span>
                {tpdsSelecionados.length === 1
                  ? 'TPD selecionado'
                  : 'TPDs selecionados'}
              </span>
            </div>

            <div className="tpd-transferencia-lista">
              {loadingOperacoes ? (
                <div className="tpd-empty-operacao">
                  Atualizando TPDs...
                </div>
              ) : tpdsDisponiveisTransferencia.length === 0 ? (
                <div className="tpd-empty-operacao">
                  Nenhum TPD disponível em {nomeOrigemTransferencia}.
                </div>
              ) : (
                tpdsDisponiveisTransferencia.map((tpd) => (
                  <label
                    key={tpd.id}
                    className="tpd-transferencia-item"
                  >
                    <input
                      type="checkbox"
                      checked={tpdsSelecionados.includes(tpd.id)}
                      disabled={enviandoLote}
                      onChange={() => alternarTPDSelecionado(tpd.id)}
                    />

                    <div>
                      <strong>{identificacaoTPD(tpd)}</strong>
                      <span>
                        {[tpd.tipo_equipamento, tpd.marca, tpd.modelo]
                          .filter(Boolean)
                          .join(' • ') || 'Dados não informados'}
                      </span>

                      {tpd.numero_serie && (
                        <span>Série: {tpd.numero_serie}</span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>

            <footer>
              <button
                type="button"
                className="tpd-btn-secondary"
                disabled={enviandoLote}
                onClick={() => setTransferenciaModalAberta(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="tpd-btn-primary"
                disabled={
                  enviandoLote ||
                  tpdsSelecionados.length === 0
                }
                onClick={confirmarTransferenciaTPDs}
              >
                {enviandoLote
                  ? 'Enviando...'
                  : `${origemTransferencia === 'P4' ? 'Enviar' : 'Devolver'} ${tpdsSelecionados.length || ''}`.trim()}
              </button>
            </footer>
          </section>
        </div>
      )}

      {recebimentoModalAberta && (
        <div
          className="tpd-transferencia-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !processandoTransferenciaId &&
              !processandoRecebimentoEmLote
            ) {
              setRecebimentoModalAberta(false)
            }
          }}
        >
          <section
            className="tpd-transferencia-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Receber TPDs"
          >
            <header>
              <div>
                <span>Recebimento patrimonial</span>
                <h2>
                  {origemTransferencia === 'P4'
                    ? 'COFRE DO SVDD → COFRE P4'
                    : 'COFRE P4 → COFRE DO SVDD'}
                </h2>
                <p>
                  Confirme ou recuse os TPDs pendentes destinados a {nomeOrigemTransferencia}.
                </p>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                disabled={
                  Boolean(processandoTransferenciaId) ||
                  processandoRecebimentoEmLote
                }
                onClick={() => setRecebimentoModalAberta(false)}
              >
                ×
              </button>
            </header>

            {transferenciasPendentes.length > 0 && (
              <div className="tpd-recebimento-toolbar">
                <button
                  type="button"
                  disabled={
                    Boolean(processandoTransferenciaId) ||
                    processandoRecebimentoEmLote
                  }
                  onClick={selecionarTodasTransferenciasPendentes}
                >
                  {transferenciasPendentes.every((transferencia) =>
                    transferenciasSelecionadas.includes(transferencia.id)
                  )
                    ? 'Desmarcar todas'
                    : 'Selecionar todas'}
                </button>

                <span>
                  {transferenciasSelecionadas.length} selecionada(s)
                </span>
              </div>
            )}

            <div className="tpd-transferencia-lista">
              {loadingOperacoes ? (
                <div className="tpd-empty-operacao">
                  Atualizando pendências...
                </div>
              ) : transferenciasPendentes.length === 0 ? (
                <div className="tpd-empty-operacao">
                  Nenhum TPD pendente de recebimento.
                </div>
              ) : (
                transferenciasPendentes.map((transferencia) => {
                  const identificacao =
                    transferencia?.metadata?.patrimonio ||
                    transferencia?.metadata?.numero_serie ||
                    transferencia?.protocolo ||
                    'TPD'

                  const processando =
                    processandoTransferenciaId === transferencia.id

                  return (
                    <div
                      key={transferencia.id}
                      className="tpd-transferencia-item tpd-recebimento-item"
                    >
                      <label className="tpd-recebimento-selecao">
                        <input
                          type="checkbox"
                          checked={transferenciasSelecionadas.includes(
                            transferencia.id
                          )}
                          disabled={
                            Boolean(processandoTransferenciaId) ||
                            processandoRecebimentoEmLote
                          }
                          onChange={() =>
                            alternarTransferenciaSelecionada(
                              transferencia.id
                            )
                          }
                        />

                        <div>
                          <strong>{identificacao}</strong>
                          <span>
                            Protocolo: {transferencia.protocolo || '-'}
                          </span>
                          <span>
                            {transferencia.origem_nome || '-'} → {transferencia.destino_nome || '-'}
                          </span>
                          <span>
                            Enviado por: {transferencia.enviado_por_nome || '-'}
                          </span>
                        </div>
                      </label>

                      <div
                        style={{
                          display: 'flex',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}
                      >
                        <button
                          type="button"
                          className="tpd-btn-primary"
                          disabled={
                            Boolean(processandoTransferenciaId) ||
                            processandoRecebimentoEmLote
                          }
                          onClick={() =>
                            handleAceitarTransferenciaTPD(transferencia)
                          }
                        >
                          {processando ? 'Processando...' : 'Receber'}
                        </button>

                        <button
                          type="button"
                          className="tpd-btn-secondary"
                          disabled={
                            Boolean(processandoTransferenciaId) ||
                            processandoRecebimentoEmLote
                          }
                          onClick={() =>
                            handleRecusarTransferenciaTPD(transferencia)
                          }
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <footer>
              <button
                type="button"
                className="tpd-btn-secondary"
                disabled={
                  Boolean(processandoTransferenciaId) ||
                  processandoRecebimentoEmLote
                }
                onClick={() => {
                  setTransferenciasSelecionadas([])
                  setRecebimentoModalAberta(false)
                }}
              >
                Fechar
              </button>

              <button
                type="button"
                className="tpd-btn-primary"
                disabled={
                  transferenciasSelecionadas.length === 0 ||
                  Boolean(processandoTransferenciaId) ||
                  processandoRecebimentoEmLote
                }
                onClick={handleReceberTransferenciasSelecionadas}
              >
                {processandoRecebimentoEmLote
                  ? 'Recebendo...'
                  : `Receber ${transferenciasSelecionadas.length || ''}`.trim()}
              </button>
            </footer>
          </section>
        </div>
      )}

      {tpdVisualizando && (
        <TPDDetalhesModal
          tpd={tpdVisualizando}
          fotos={fotosVisualizacao}
          carregandoFotos={carregandoFotos}
          erroFotos={erroFotos}
          onClose={fecharVisualizacao}
          onEdit={() =>
            abrirEdicao(
              tpdVisualizando
            )
          }
        />
      )}
    </main>
  )
}
