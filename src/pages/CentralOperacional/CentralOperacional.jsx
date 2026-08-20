import { useCallback, useEffect, useMemo, useState } from 'react'

import './CentralOperacional.css'

import CentralResumo from './components/CentralResumo'
import CategoriaCard from './components/CategoriaCard'
import CategoriaDetalhes from './components/CategoriaDetalhes'
import ConferenciaPanel from './components/ConferenciaPanel'
import GaleriaFotos from './components/GaleriaFotos'
import QRScanner from './components/QRScanner'
import ResponsavelPanel from './components/ResponsavelPanel'
import TimelinePatrimonio from './components/TimelinePatrimonio'
import PainelOperacional from './components/PainelOperacional'

import {
  carregarDashboardPatrimonial,
  listarCategoriasOperacionais,
  listarPatrimoniosCategoria
} from '../../services/dashboardService'

import { carregarCentralOperacional } from '../../services/centralOperacionalService'
import { listarTonfas } from '../../services/tonfasService'
import { listarCautelasAtivas } from '../../services/tonfasMovimentacoesService'
import {
  ehEncarregado,
  ehAuxiliar
} from '../../services/permissionService'

function normalizarTexto(valor) {
  return String(valor ?? '').trim()
}

function normalizarMaiusculo(valor) {
  return normalizarTexto(valor).toUpperCase()
}

function obterDadosPatrimonio(patrimonio) {
  if (!patrimonio) {
    return {}
  }

  if (
    patrimonio.dados &&
    typeof patrimonio.dados === 'object'
  ) {
    return patrimonio.dados
  }

  return {}
}

function obterReferenciaPatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.identificador ||
    patrimonio?.numero_patrimonio ||
    patrimonio?.patrimonio ||
    patrimonio?.numero_serie ||
    patrimonio?.serie ||
    dados.numero_patrimonio ||
    dados.patrimonio ||
    dados.numero_serie ||
    dados.serie ||
    patrimonio?.referencia_id ||
    patrimonio?.id ||
    'SEM IDENTIFICAÇÃO'
  )
}

function obterNomePatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  const partes = [
    patrimonio?.tipo,
    dados.tipo,
    patrimonio?.marca,
    dados.marca,
    patrimonio?.modelo,
    dados.modelo
  ]
    .map(normalizarTexto)
    .filter(Boolean)

  if (partes.length > 0) {
    return [...new Set(partes)].join(' ')
  }

  return (
    dados.nome ||
    dados.descricao ||
    patrimonio?.descricao ||
    patrimonio?.tipo ||
    'Patrimônio'
  )
}

function obterStatusPatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  return normalizarMaiusculo(
    patrimonio?.status ||
    patrimonio?.status_operacional ||
    dados.status ||
    dados.status_operacional ||
    'SEM STATUS'
  )
}

function patrimonioPermiteResponsavelAtual(patrimonio) {
  const statusAtual = normalizarMaiusculo(
    patrimonio?.status ||
    patrimonio?.status_operacional ||
    ''
  )

  const localAtual = normalizarMaiusculo(
    patrimonio?.local_atual ||
    patrimonio?.local ||
    ''
  )

  // Estado/local atual prevalece sobre qualquer snapshot histórico.
  // Patrimônio em RESERVA ou no COFRE não pode permanecer vinculado
  // operacionalmente a policial por causa de carga antiga em `dados`.
  if (
    statusAtual.includes('RESERVA') ||
    localAtual.includes('COFRE')
  ) {
    return false
  }

  return (
    statusAtual.includes('CARGA') ||
    statusAtual.includes('CAUTELA') ||
    statusAtual.includes('EM_SERVICO') ||
    statusAtual.includes('EM SERVIÇO') ||
    localAtual.includes('CAUTELA')
  )
}

function obterResponsavelNome(patrimonio) {
  if (!patrimonioPermiteResponsavelAtual(patrimonio)) {
    return ''
  }

  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.responsavel_atual_nome ||
    patrimonio?.responsavel_nome ||
    patrimonio?.nome_responsavel ||
    patrimonio?.carga_policial_nome ||
    dados.responsavel_atual_nome ||
    dados.responsavel_nome ||
    dados.nome_responsavel ||
    dados.carga_policial_nome ||
    dados.recebedor_nome ||
    dados.policial_nome ||
    ''
  )
}

function obterResponsavelRe(patrimonio) {
  if (!patrimonioPermiteResponsavelAtual(patrimonio)) {
    return ''
  }

  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.responsavel_atual_re ||
    patrimonio?.responsavel_re ||
    patrimonio?.re_responsavel ||
    patrimonio?.carga_policial_re ||
    dados.responsavel_atual_re ||
    dados.responsavel_re ||
    dados.re_responsavel ||
    dados.carga_policial_re ||
    dados.recebedor_re ||
    dados.policial_re ||
    ''
  )
}

function obterResponsavelId(patrimonio) {
  if (!patrimonioPermiteResponsavelAtual(patrimonio)) {
    return ''
  }

  const dados = obterDadosPatrimonio(patrimonio)

  return (
    patrimonio?.responsavel_atual_id ||
    patrimonio?.responsavel_id ||
    patrimonio?.carga_policial_id ||
    patrimonio?.policial_id ||
    dados.responsavel_atual_id ||
    dados.responsavel_id ||
    dados.carga_policial_id ||
    dados.policial_id ||
    ''
  )
}

function obterLocalAtual(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  // A linha atual de sigmo_patrimonios é a fonte operacional vigente.
  // O JSON `dados` funciona apenas como fallback, pois pode guardar
  // snapshots antigos de cautela, carga ou localização.
  return (
    patrimonio?.local_atual ||
    patrimonio?.local ||
    dados.local_atual ||
    dados.local ||
    'NÃO INFORMADO'
  )
}

function normalizarPatrimonio(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  const responsavelNome =
    obterResponsavelNome(patrimonio)

  const responsavelRe =
    obterResponsavelRe(patrimonio)

  const localAtual =
    obterLocalAtual(patrimonio)

  const noCofre =
    normalizarMaiusculo(localAtual).includes('COFRE')

  const responsavelId =
    obterResponsavelId(patrimonio)

  const comPolicial = Boolean(
    responsavelId || responsavelNome || responsavelRe
  )

  return {
    ...dados,
    ...patrimonio,

    // `dados` pode conter snapshot histórico. Os campos operacionais
    // abaixo são sempre recalculados a partir do estado vigente.
    dados,

    identificador:
      obterReferenciaPatrimonio(patrimonio),

    nome_operacional:
      obterNomePatrimonio(patrimonio),

    status_operacional:
      obterStatusPatrimonio(patrimonio),

    responsavel_id:
      responsavelId,

    responsavel_nome:
      responsavelNome,

    responsavel_re:
      responsavelRe,

    local_atual:
      localAtual,

    com_policial:
      comPolicial,

    no_cofre:
      !comPolicial && noCofre
  }
}

function normalizarCategoria(categoria) {
  const total =
    Number(categoria?.total ?? 0)

  const comPolicial =
    Number(
      categoria?.com_policial ??
      categoria?.comPolicial ??
      0
    )

  const noCofre =
    Number(
      categoria?.no_cofre ??
      categoria?.reserva ??
      0
    )

  const semLocalizacao = Math.max(
    0,
    Number(
      categoria?.sem_localizacao ??
      total - comPolicial - noCofre
    )
  )

  return {
    ...categoria,

    categoria:
      normalizarMaiusculo(
        categoria?.categoria ||
        categoria?.tipo ||
        'OUTROS'
      ),

    tipo:
      normalizarTexto(
        categoria?.tipo ||
        categoria?.categoria ||
        'outros'
      ).toLowerCase(),

    total,

    com_policial:
      comPolicial,

    no_cofre:
      noCofre,

    sem_localizacao:
      semLocalizacao,

    divergencias:
      Number(categoria?.divergencias ?? 0)
  }
}


function patrimonioPertenceAoSVDD(patrimonio) {
  const dados = obterDadosPatrimonio(patrimonio)

  const local = normalizarMaiusculo(
    patrimonio?.local_atual ||
    patrimonio?.local ||
    dados?.local_atual ||
    dados?.local ||
    ''
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const origem = normalizarMaiusculo(
    patrimonio?.origem_local ||
    patrimonio?.local_origem ||
    dados?.origem_local ||
    dados?.local_origem ||
    ''
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const status = normalizarMaiusculo(
    patrimonio?.status_operacional ||
    patrimonio?.status ||
    dados?.status_operacional ||
    dados?.status ||
    ''
  )
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

  const localSVDD =
    local.includes('SVDD') ||
    local.includes('COFRE DO SVDD') ||
    local.includes('SERVICO DE DIA')

  const origemSVDD =
    origem.includes('SVDD') ||
    origem.includes('COFRE DO SVDD') ||
    origem.includes('SERVICO DE DIA')

  const foraDoCofreMasSobResponsabilidade =
    origemSVDD &&
    (
      status.includes('CAUTELA') ||
      status.includes('EM_SERVICO') ||
      status.includes('EM SERVICO') ||
      status.includes('MANUTENCAO') ||
      local.includes('CAUTELA') ||
      local.includes('MANUTENCAO')
    )

  return localSVDD || foraDoCofreMasSobResponsabilidade
}

function resumirCategoriaPorPatrimonios(categoria, patrimonios) {
  const lista = (patrimonios ?? []).map(normalizarPatrimonio)

  const comPolicial = lista.filter(
    (item) => item.com_policial
  ).length

  const noCofre = lista.filter(
    (item) => item.no_cofre
  ).length

  const semLocalizacao = lista.filter(
    (item) =>
      !item.com_policial &&
      !item.no_cofre &&
      normalizarMaiusculo(item.local_atual) === 'NÃO INFORMADO'
  ).length

  const divergencias = lista.filter(
    (item) =>
      item.divergencia === true ||
      item.possui_divergencia === true
  ).length

  return normalizarCategoria({
    ...categoria,
    total: lista.length,
    com_policial: comPolicial,
    no_cofre: noCofre,
    sem_localizacao: semLocalizacao,
    divergencias
  })
}


function normalizarSemAcento(valor) {
  return normalizarMaiusculo(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function filtrarTonfasPorTipo(lista = [], tipoMaterial = '') {
  const tipo = normalizarSemAcento(tipoMaterial)

  return (Array.isArray(lista) ? lista : []).filter(
    (item) => normalizarSemAcento(item?.tipo) === tipo
  )
}

function somarSaldoTonfas(lista = [], campo) {
  return (Array.isArray(lista) ? lista : []).reduce(
    (total, item) =>
      total + Number(item?.[campo] || 0),
    0
  )
}

function criarResumoQuantitativo({
  lista = [],
  tipoMaterial,
  visaoSVDD = false
}) {
  const linhas = filtrarTonfasPorTipo(
    lista,
    tipoMaterial
  )

  const noP4 = visaoSVDD
    ? 0
    : somarSaldoTonfas(linhas, 'quantidade_p4')

  const noSVDD =
    somarSaldoTonfas(linhas, 'quantidade_svdd')

  const emServico =
    somarSaldoTonfas(
      linhas,
      'quantidade_em_servico'
    )

  const manutencao =
    somarSaldoTonfas(
      linhas,
      'quantidade_manutencao'
    )

  const noCofre = noP4 + noSVDD
  const total =
    noCofre + emServico + manutencao

  return normalizarCategoria({
    tipo:
      normalizarSemAcento(tipoMaterial) ===
      'CASSETETE'
        ? 'cassetete'
        : 'tonfa',
    tipo_consulta: 'tonfa',
    tipo_material:
      normalizarSemAcento(tipoMaterial),
    categoria:
      normalizarSemAcento(tipoMaterial),
    total,
    com_policial: emServico,
    no_cofre: noCofre,
    sem_localizacao: 0,
    divergencias: 0,
    quantitativo: true
  })
}

function resumoTonfasGeral(lista = []) {
  return [
    criarResumoQuantitativo({
      lista,
      tipoMaterial: 'TONFA'
    }),
    criarResumoQuantitativo({
      lista,
      tipoMaterial: 'CASSETETE'
    })
  ]
}

function resumoTonfasSVDD(lista = []) {
  return [
    criarResumoQuantitativo({
      lista,
      tipoMaterial: 'TONFA',
      visaoSVDD: true
    }),
    criarResumoQuantitativo({
      lista,
      tipoMaterial: 'CASSETETE',
      visaoSVDD: true
    })
  ]
}

function CentralOperacional({ user }) {
  const visaoSVDD =
    ehEncarregado(user) ||
    ehAuxiliar(user)

  const [dashboard, setDashboard] = useState(null)
  const [operacional, setOperacional] = useState(null)

  const [categorias, setCategorias] = useState([])

  const [
    categoriaSelecionada,
    setCategoriaSelecionada
  ] = useState(null)

  const [
    patrimoniosCategoria,
    setPatrimoniosCategoria
  ] = useState([])

  const [
    patrimonioSelecionado,
    setPatrimonioSelecionado
  ] = useState(null)

  const [
    responsavelSelecionado,
    setResponsavelSelecionado
  ] = useState(null)

  const [
    conferenciaAberta,
    setConferenciaAberta
  ] = useState(false)

  const [
    carregandoCentral,
    setCarregandoCentral
  ] = useState(true)

  const [
    carregandoCategoria,
    setCarregandoCategoria
  ] = useState(false)

  const [erroCentral, setErroCentral] = useState('')

  const [erroCategoria, setErroCategoria] = useState('')

  const carregarCentral = useCallback(async () => {
    setCarregandoCentral(true)
    setErroCentral('')

    try {
      const [
        dadosDashboard,
        dadosCategorias,
        dadosOperacionais
      ] = await Promise.all([
        carregarDashboardPatrimonial(),
        listarCategoriasOperacionais(),
        carregarCentralOperacional({ user })
      ])

      setDashboard(dadosDashboard)
      setOperacional(dadosOperacionais)

      const categoriasBase =
        (dadosCategorias ?? []).map(
          normalizarCategoria
        )

      const tonfasResultado =
        await listarTonfas({
          pagina: 1,
          limite: 5000
        })

      if (visaoSVDD) {
        const categoriasTonfas =
          resumoTonfasSVDD(
            tonfasResultado?.data || []
          )

        const categoriasComEscopo =
          await Promise.all(
            categoriasBase
              .filter(
                (categoria) =>
                  categoria.tipo !== 'tonfa'
              )
              .map(
                async (categoria) => {
                  const lista =
                    await listarPatrimoniosCategoria(
                      categoria.tipo
                    )

                  const patrimoniosSVDD =
                    (lista ?? []).filter(
                      patrimonioPertenceAoSVDD
                    )

                  return resumirCategoriaPorPatrimonios(
                    categoria,
                    patrimoniosSVDD
                  )
                }
              )
          )

        setCategorias(
          [
            ...categoriasComEscopo,
            ...categoriasTonfas
          ].filter(
            (categoria) =>
              Number(categoria.total || 0) > 0
          )
        )
      } else {
        const categoriasTonfas =
          resumoTonfasGeral(
            tonfasResultado?.data || []
          )

        // Na visão geral, os quantitativos de TONFA/CASSETETE vêm do
        // estoque próprio. Para os patrimônios individualizados, porém,
        // a Central deve classificar usando a situação atual retornada
        // pelo módulo de origem (HT, Taser, TPD, Armas etc.), evitando
        // que registros antigos da central apareçam como "sem localização".
        const categoriasIndividualizadas =
          await Promise.all(
            categoriasBase
              .filter(
                (categoria) =>
                  categoria.tipo !== 'tonfa' &&
                  categoria.tipo !== 'cassetete'
              )
              .map(async (categoria) => {
                const lista =
                  await listarPatrimoniosCategoria(
                    categoria.tipo
                  )

                return resumirCategoriaPorPatrimonios(
                  categoria,
                  lista ?? []
                )
              })
          )

        setCategorias(
          [
            ...categoriasIndividualizadas,
            ...categoriasTonfas
          ].filter(
            (categoria) =>
              Number(categoria.total || 0) > 0
          )
        )
      }
    } catch (error) {
      console.error(
        'Erro ao carregar Central Operacional:',
        error
      )

      setErroCentral(
        error?.message ||
        'Não foi possível carregar a Central Operacional.'
      )
    } finally {
      setCarregandoCentral(false)
    }
  }, [user, visaoSVDD])

  useEffect(() => {
    carregarCentral()
  }, [carregarCentral])
    const abrirCategoria = useCallback(
    async (categoria) => {
      setCategoriaSelecionada(categoria)
      setPatrimonioSelecionado(null)
      setResponsavelSelecionado(null)
      setConferenciaAberta(false)
      setCarregandoCategoria(true)
      setErroCategoria('')

      try {
        if (categoria.quantitativo && categoria.tipo_material) {
          const cautelasAtivas = await listarCautelasAtivas({
            tipoMaterial: categoria.tipo_material
          })

          const patrimonios = (cautelasAtivas ?? [])
            .map((movimentacao) => {
              const saldo =
                movimentacao.saldo === null || movimentacao.saldo === undefined
                  ? Math.max(
                      0,
                      Number(movimentacao.quantidade || 0) -
                        Number(movimentacao.quantidade_devolvida || 0)
                    )
                  : Number(movimentacao.saldo || 0)

              return {
                ...movimentacao,
                id: `TONFA-MOV-${movimentacao.id}`,
                referencia_id: movimentacao.tonfa_id,
                tipo: normalizarMaiusculo(
                  movimentacao.tipo_material || categoria.tipo_material
                ),
                categoria: normalizarMaiusculo(
                  movimentacao.tipo_material || categoria.tipo_material
                ),
                identificador: normalizarMaiusculo(
                  movimentacao.tipo_material || categoria.tipo_material
                ),
                nome_operacional: normalizarMaiusculo(
                  movimentacao.tipo_material || categoria.tipo_material
                ),
                status_operacional: 'EM SERVIÇO',
                local_atual: 'CAUTELA INDIVIDUAL',
                responsavel_nome:
                  movimentacao.policial_nome || 'POLICIAL NÃO IDENTIFICADO',
                responsavel_re: movimentacao.policial_re || '',
                com_policial: true,
                no_cofre: false,
                quantidade: saldo,
                saldo
              }
            })
            .filter((item) => Number(item.saldo || 0) > 0)

          setPatrimoniosCategoria(patrimonios)
          return
        }

        const tipoConsulta = categoria.tipo_consulta || categoria.tipo
        const lista = await listarPatrimoniosCategoria(tipoConsulta)

        const listaPerfil =
          visaoSVDD
            ? (lista ?? []).filter(patrimonioPertenceAoSVDD)
            : (lista ?? [])

        setPatrimoniosCategoria(listaPerfil.map(normalizarPatrimonio))
      } catch (error) {
        console.error('Erro ao carregar categoria:', error)
        setErroCategoria(
          error?.message || 'Não foi possível carregar os patrimônios.'
        )
        setPatrimoniosCategoria([])
      } finally {
        setCarregandoCategoria(false)
      }
    },
    [visaoSVDD]
  )

  const voltarCategorias =
    useCallback(() => {
      setCategoriaSelecionada(null)
      setPatrimonioSelecionado(null)
      setResponsavelSelecionado(null)
      setPatrimoniosCategoria([])
      setConferenciaAberta(false)
    }, [])

  const selecionarPatrimonio =
    useCallback((patrimonio) => {
      setPatrimonioSelecionado(
        patrimonio
      )
    }, [])

  const selecionarResponsavel =
    useCallback(
      (responsavel) => {
        setResponsavelSelecionado(
          responsavel
        )
      },
      []
    )

  const abrirConferencia =
    useCallback(() => {
      setConferenciaAberta(true)
    }, [])

  const fecharConferencia =
    useCallback(() => {
      setConferenciaAberta(false)
    }, [])

  const responsaveis =
    useMemo(() => {
      const mapa = new Map()

      patrimoniosCategoria.forEach(
        (item) => {
          const re =
            item.responsavel_re || ''

          const nome =
            item.responsavel_nome || ''

          if (!re && !nome) {
            return
          }

          const chave =
            re || nome

          if (!mapa.has(chave)) {
            mapa.set(chave, {
              re,
              nome,
              quantidade: 0,
              patrimonios: []
            })
          }

          const registro =
            mapa.get(chave)

          registro.quantidade += 1

          registro.patrimonios.push(
            item
          )
        }
      )

      return Array.from(
        mapa.values()
      ).sort((a, b) =>
        a.nome.localeCompare(
          b.nome,
          'pt-BR'
        )
      )
    }, [
      patrimoniosCategoria,
      categoriaSelecionada
    ])

  const resumoGeral =
    useMemo(() => {
      return categorias.reduce(
        (acc, categoria) => ({
          total:
            acc.total +
            Number(categoria.total || 0),
          com_policial:
            acc.com_policial +
            Number(categoria.com_policial || 0),
          no_cofre:
            acc.no_cofre +
            Number(categoria.no_cofre || 0),
          sem_localizacao:
            acc.sem_localizacao +
            Number(categoria.sem_localizacao || 0),
          divergencias:
            acc.divergencias +
            Number(categoria.divergencias || 0)
        }),
        {
          total: 0,
          com_policial: 0,
          no_cofre: 0,
          sem_localizacao: 0,
          divergencias: 0
        }
      )
    }, [categorias])

  const resumo =
    useMemo(() => {
      if (
        categoriaSelecionada?.quantitativo
      ) {
        return {
          total: Number(
            categoriaSelecionada.total || 0
          ),
          com_policial: Number(
            categoriaSelecionada.com_policial || 0
          ),
          no_cofre: Number(
            categoriaSelecionada.no_cofre || 0
          ),
          sem_localizacao: Number(
            categoriaSelecionada.sem_localizacao || 0
          ),
          divergencias: Number(
            categoriaSelecionada.divergencias || 0
          )
        }
      }

      const total =
        patrimoniosCategoria.length

      const comPolicial =
        patrimoniosCategoria.filter(
          (item) =>
            item.com_policial
        ).length

      const noCofre =
        patrimoniosCategoria.filter(
          (item) => item.no_cofre
        ).length

      const semLocalizacao =
        patrimoniosCategoria.filter(
          (item) =>
            !item.com_policial &&
            !item.no_cofre
        ).length

      const divergencias =
        patrimoniosCategoria.filter(
          (item) =>
            item.divergencia === true ||
            item.possui_divergencia ===
              true
        ).length

      return {
        total,
        com_policial:
          comPolicial,
        no_cofre: noCofre,
        sem_localizacao:
          semLocalizacao,
        divergencias
      }
    }, [patrimoniosCategoria])

  return (
    <main className="central-operacional">
      <section className="central-hero">
        <div>
          <span className="central-section-eyebrow">
            SIGMO
          </span>

          <h1>
            Central Operacional
            Patrimonial
          </h1>

          <p>
            Acompanhe categorias,
            responsáveis,
            conferências,
            fotografias,
            QR Codes
            e histórico
            patrimonial em um
            único ambiente.
          </p>
        </div>

        <button
          type="button"
          className="central-button central-button-primary"
          onClick={carregarCentral}
          disabled={
            carregandoCentral
          }
        >
          {carregandoCentral
            ? 'Atualizando...'
            : 'Atualizar'}
        </button>
      </section>

      {erroCentral ? (
        <div className="central-error">
          {erroCentral}
        </div>
      ) : (
        <>
          {!categoriaSelecionada && (
            <PainelOperacional
              dados={operacional}
              carregando={carregandoCentral}
              user={user}
              onAtualizar={carregarCentral}
            />
          )}

          <CentralResumo
            resumo={
              categoriaSelecionada
                ? resumo
                : resumoGeral
            }
          />

          {!categoriaSelecionada && (
            <section className="central-categorias">
              <header className="central-section-header">
                <div>
                  <span className="central-section-eyebrow">
                    Categorias
                  </span>

                  <h2>
                    Patrimônio
                  </h2>
                </div>
              </header>

              <div className="central-categorias-grid">
                {categorias.map(
                  (
                    categoria
                  ) => (
                    <CategoriaCard
                      key={
                        `${categoria.tipo}-${categoria.categoria}`
                      }
                      categoria={
                        categoria
                      }
                      onClick={
                        abrirCategoria
                      }
                    />
                  )
                )}
              </div>
            </section>
          )}

          {categoriaSelecionada && (
            <CategoriaDetalhes
              categoria={
                categoriaSelecionada
              }
              patrimonios={
                patrimoniosCategoria
              }
              responsaveis={
                responsaveis
              }
              carregando={
                carregandoCategoria
              }
              onVoltar={
                voltarCategorias
              }
              onAbrirConferencia={
                abrirConferencia
              }
              onSelecionarPatrimonio={
                selecionarPatrimonio
              }
              onSelecionarResponsavel={
                selecionarResponsavel
              }
            />
          )}
                    {erroCategoria && (
            <div className="central-error">
              {erroCategoria}
            </div>
          )}

          {responsavelSelecionado && (
            <section className="central-panel">
              <div className="central-panel-header">
                <div>
                  <span className="central-section-eyebrow">
                    Responsável selecionado
                  </span>

                  <h3>
                    {responsavelSelecionado.nome ||
                      'Responsável'}
                  </h3>
                </div>

                <button
                  type="button"
                  className="central-link-button"
                  onClick={() =>
                    setResponsavelSelecionado(null)
                  }
                >
                  Fechar
                </button>
              </div>

              <ResponsavelPanel
                responsavel={responsavelSelecionado}
                patrimonios={
                  responsavelSelecionado.patrimonios ||
                  []
                }
              />
            </section>
          )}

          {patrimonioSelecionado && (
            <section className="central-patrimonio-detalhes">
              <header className="central-section-header">
                <div>
                  <span className="central-section-eyebrow">
                    Patrimônio selecionado
                  </span>

                  <h2>
                    {patrimonioSelecionado.nome_operacional}
                  </h2>

                  <p>
                    {
                      patrimonioSelecionado.identificador
                    }
                  </p>
                </div>

                <button
                  type="button"
                  className="central-link-button"
                  onClick={() =>
                    setPatrimonioSelecionado(null)
                  }
                >
                  Fechar detalhes
                </button>
              </header>

              <section className="central-panel">
                <div className="central-panel-header">
                  <div>
                    <span className="central-section-eyebrow">
                      Identificação
                    </span>

                    <h3>
                      Dados patrimoniais
                    </h3>
                  </div>

                  <span className="central-count">
                    {
                      patrimonioSelecionado.status_operacional
                    }
                  </span>
                </div>

                <div className="central-detalhes-metricas">
                  <div>
                    <span>Patrimônio</span>

                    <strong>
                      {
                        patrimonioSelecionado.identificador
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Tipo</span>

                    <strong>
                      {normalizarMaiusculo(
                        patrimonioSelecionado.tipo
                      ) || 'NÃO INFORMADO'}
                    </strong>
                  </div>

                  <div>
                    <span>Marca</span>

                    <strong>
                      {patrimonioSelecionado.marca ||
                        'NÃO INFORMADA'}
                    </strong>
                  </div>

                  <div>
                    <span>Modelo</span>

                    <strong>
                      {patrimonioSelecionado.modelo ||
                        'NÃO INFORMADO'}
                    </strong>
                  </div>

                  <div>
                    <span>Número de série</span>

                    <strong>
                      {patrimonioSelecionado.numero_serie ||
                        patrimonioSelecionado.serie ||
                        'NÃO INFORMADO'}
                    </strong>
                  </div>

                  <div>
                    <span>Local atual</span>

                    <strong>
                      {
                        patrimonioSelecionado.local_atual
                      }
                    </strong>
                  </div>
                </div>
              </section>

              <ResponsavelPanel
                patrimonio={patrimonioSelecionado}
                responsavelNome={
                  patrimonioSelecionado.responsavel_nome
                }
                responsavelRe={
                  patrimonioSelecionado.responsavel_re
                }
              />

              <QRScanner
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                codigo={
                  patrimonioSelecionado.qr_code ||
                  patrimonioSelecionado.codigo_qr ||
                  patrimonioSelecionado.identificador
                }
              />

              <GaleriaFotos
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                referenciaId={
                  patrimonioSelecionado.referencia_id
                }
                fotos={
                  patrimonioSelecionado.fotos ||
                  []
                }
              />

              <ConferenciaPanel
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                categoria={
                  categoriaSelecionada
                }
                aberto={
                  conferenciaAberta
                }
                onFechar={
                  fecharConferencia
                }
              />

              <TimelinePatrimonio
                patrimonio={patrimonioSelecionado}
                patrimonioId={
                  patrimonioSelecionado.id
                }
                referenciaId={
                  patrimonioSelecionado.referencia_id
                }
                tipo={
                  patrimonioSelecionado.tipo
                }
              />

              <section className="central-panel">
                <div className="central-panel-header">
                  <div>
                    <span className="central-section-eyebrow">
                      Observações
                    </span>

                    <h3>
                      Registro complementar
                    </h3>
                  </div>
                </div>

                <div className="central-observacoes">
                  {patrimonioSelecionado.observacoes ||
                    patrimonioSelecionado.observacao ||
                    patrimonioSelecionado.descricao ||
                    'Nenhuma observação cadastrada.'}
                </div>
              </section>
            </section>
          )}
        </>
      )}
    </main>
  )
}

export default CentralOperacional