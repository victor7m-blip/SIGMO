import { useEffect, useMemo, useState } from 'react'
import './MapaForca.css'
import MapaForcaVisualizacao from './MapaForcaVisualizacao'
import PagarMaterialMapaForca from './components/PagarMaterialMapaForca'

import { supabase } from '../../services/supabaseClient'
import { loadSessionToken } from '../../services/authService'
import { criarMovimentacaoCompleta } from '../../services/movimentacaoEngine'
import { cautelarMunicaoParaPolicial } from '../../services/municoesMovimentacoesService'

import { listarPoliciais } from '../../services/policiaisService'
import { listarViaturas } from '../../services/viaturasService'
import { listarMateriaisEmServicoUsuario } from '../../services/cautelasUsuarioService'
import {
  carregarMapaEmElaboracao,
  excluirUSMapaForca,
  listarCautelasMapaForca,
  registrarCautelaMapaForca,
  salvarCabecalhoMapaForca,
  salvarUSMapaForca,
  vincularCautelasPendentesAUS
} from '../../services/mapaForcaService'

const EQUIPES_SERVICO = ['A', 'B', 'C', 'D']
const SERVICOS_DIA = ['SD27501', 'SD27502', 'SD27503', 'SD27504', 'SD27505']

const TIPOS_US = [
  { id: 'comando-cia', titulo: 'COMANDO DE CIA', subtitulo: 'Comando da Companhia no turno', tom: 'dourado', prefixo: 'CMT DE CIA', tipo: 'VIATURA', campos: ['COMANDANTE', 'MOTORISTA', 'AUXILIAR'] },
  { id: 'cgp', titulo: 'CGP / SUPERVISÃO', subtitulo: 'Comando e supervisão do turno', tom: 'vermelho', prefixo: 'CGP', tipo: 'VIATURA', campos: ['CGP', 'MOTORISTA', 'AUXILIAR'] },
  { id: 'servico-dia', titulo: 'SERVIÇO DE DIA', subtitulo: 'Equipe responsável pelo SVDD', tom: 'roxo', prefixo: 'SD27501', tipo: 'SERVIÇO', campos: ['ENCARREGADO', 'AUXILIAR'] },
  { id: 'radio-patrulhamento', titulo: 'RÁDIO PATRULHAMENTO', subtitulo: 'Viaturas de patrulhamento territorial', tom: 'ciano', prefixo: 'RP', tipo: 'VIATURA', campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR'] },
  { id: 'ronda-escolar', titulo: 'RONDA ESCOLAR', subtitulo: 'Policiamento escolar', tom: 'verde', prefixo: 'RONDA ESCOLAR', tipo: 'VIATURA', campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR'] },
  { id: 'base-comunitaria', titulo: 'BASE COMUNITÁRIA MÓVEL', subtitulo: 'Policiamento comunitário', tom: 'amarelo', prefixo: 'BCM', tipo: 'VIATURA', campos: ['ENCARREGADO', 'MOTORISTA / AUXILIAR'] },
  { id: 'pop', titulo: 'POP', subtitulo: 'Postos e equipes operacionais', tom: 'laranja', prefixo: 'POP', tipo: 'EQUIPE', campos: ['ENCARREGADO', 'PARCEIRO'] },
  { id: 'rpm', titulo: 'RPM', subtitulo: 'Radiopatrulhamento com motocicletas', tom: 'vermelho', prefixo: 'M-27509-11', tipo: 'MOTOCICLETA', campos: ['POLICIAL'] }
]

function dataInput(data) {
  const local = new Date(data.getTime() - data.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function dataInputValor(valor) {
  if (!valor) return ''
  return dataInput(new Date(valor))
}

function criarTurnoInicial() {
  const inicio = new Date()
  inicio.setHours(18, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  fim.setHours(6, 0, 0, 0)
  return { inicio: dataInput(inicio), fim: dataInput(fim) }
}

function nomeUsuario(user) {
  return user?.nome_guerra || user?.nome || user?.nome_completo || user?.re || 'USUÁRIO'
}

function nomePolicial(policial) {
  return [policial?.posto_graduacao, policial?.nome_guerra || policial?.nome]
    .filter(Boolean).join(' ')
}

function modeloTipo(id) {
  return TIPOS_US.find((item) => item.id === id) || null
}

function normalizarEquipamento(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(0, Math.trunc(numero))
}

function ehMunicaoMapa(item) {
  const campos = [
    item?.modulo,
    item?.categoria,
    item?.tipo,
    item?.tabela_origem
  ].map(normalizarEquipamento)

  const descricao =
    normalizarEquipamento(
      item?.descricao
    )

  return (
    Boolean(item?.municao_id) ||
    campos.includes('MUNICAO') ||
    campos.includes('MUNICOES') ||
    campos.includes('SIGMO_MUNICOES') ||
    descricao.startsWith('MUNICAO ')
  )
}

function chaveMaterialPreparado(item) {
  if (!item) {
    return ''
  }

  if (ehMunicaoMapa(item)) {
    return `MUNICAO:${
      item?.municao_id ||
      item?.referencia_id ||
      item?.id ||
      ''
    }`
  }

  if (item?.patrimonio_id) {
    return `PATRIMONIO:${item.patrimonio_id}`
  }

  if (item?.tonfa_id) {
    return `TONFA:${item.tonfa_id}`
  }

  if (item?.referencia_id) {
    return `REFERENCIA:${item.referencia_id}`
  }

  return `ITEM:${item?.tabela_origem || ''}:${item?.id || ''}`
}

function mesclarItensPreparados(
  anteriores = [],
  novos = []
) {
  const mapa = new Map()

  for (const item of anteriores || []) {
    const chave =
      chaveMaterialPreparado(item)

    if (!chave) {
      continue
    }

    mapa.set(chave, {
      ...item
    })
  }

  for (const item of novos || []) {
    const chave =
      chaveMaterialPreparado(item)

    if (!chave) {
      continue
    }

    const anterior =
      mapa.get(chave)

    const quantitativo =
      Boolean(
        item?.controla_quantidade ||
        ehMunicaoMapa(item)
      )

    if (
      anterior &&
      quantitativo
    ) {
      mapa.set(chave, {
        ...anterior,
        ...item,
        quantidade:
          Math.max(
            1,
            numeroInteiro(
              anterior?.quantidade ||
              0
            ) +
            numeroInteiro(
              item?.quantidade ||
              0
            )
          )
      })

      continue
    }

    mapa.set(chave, {
      ...item
    })
  }

  return Array.from(
    mapa.values()
  )
}

async function listarDisponibilidadeMunicaoSvddMapa() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_disponiveis_svdd',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return Array.isArray(data)
    ? data
    : []
}

async function resolverPatrimonioPreparadoMapa(
  item
) {
  if (item?.patrimonio_id) {
    return item.patrimonio_id
  }

  if (
    !item?.controla_quantidade ||
    !item?.tonfa_id
  ) {
    return null
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_patrimonios')
    .select('id')
    .eq('tipo', 'tonfa')
    .eq(
      'referencia_id',
      item.tonfa_id
    )
    .eq('ativo', true)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      `O patrimônio central de ${
        item?.descricao ||
        item?.categoria ||
        'Tonfa/Cassetete'
      } não foi localizado.`
    )
  }

  return data.id
}

async function prepararItensPatrimoniaisMapa(
  itens = []
) {
  const preparados = []

  for (const item of itens) {
    const patrimonioId =
      await resolverPatrimonioPreparadoMapa(
        item
      )

    if (!patrimonioId) {
      throw new Error(
        `Não foi possível identificar ${
          item?.descricao ||
          item?.categoria ||
          'um dos materiais'
        } para a cautela.`
      )
    }

    preparados.push({
      ...item,
      patrimonio_id:
        patrimonioId,
      quantidade:
        Math.max(
          1,
          Number(
            item?.quantidade ||
            1
          ) || 1
        ),
      observacao:
        item?.controla_quantidade
          ? JSON.stringify({
              tipo_registro:
                'TONFA_QUANTIDADE',
              tonfa_id:
                item?.tonfa_id ||
                item?.referencia_id ||
                null,
              categoria:
                item?.categoria ||
                item?.tipo ||
                null,
              quantidade:
                Math.max(
                  1,
                  Number(
                    item?.quantidade ||
                    1
                  ) || 1
                )
            })
          : (
              item?.observacao ||
              ''
            )
    })
  }

  return preparados
}

function extrairIdsTransferenciaMunicaoMapa(
  resultado
) {
  const ids =
    new Set()

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  function adicionar(valor) {
    const texto =
      String(valor || '')
        .trim()

    if (
      uuidRegex.test(texto)
    ) {
      ids.add(texto)
    }
  }

  function visitar(valor) {
    if (!valor) {
      return
    }

    if (typeof valor === 'string') {
      adicionar(valor)
      return
    }

    if (Array.isArray(valor)) {
      valor.forEach(visitar)
      return
    }

    if (typeof valor !== 'object') {
      return
    }

    adicionar(
      valor?.transferencia_id
    )
    adicionar(
      valor?.transferenciaId
    )
    adicionar(
      valor?.id_transferencia
    )

    if (
      typeof valor?.transferencia ===
      'string'
    ) {
      adicionar(
        valor.transferencia
      )
    } else {
      adicionar(
        valor?.transferencia?.id
      )
    }

    for (const campo of [
      'data',
      'resultado',
      'transferencias'
    ]) {
      const interno =
        valor?.[campo]

      if (
        interno &&
        interno !== valor
      ) {
        visitar(interno)
      }
    }
  }

  visitar(resultado)

  return Array.from(ids)
}

async function localizarMunicoesVinculadasMapa(
  movimentacaoPrincipalId
) {
  if (!movimentacaoPrincipalId) {
    return []
  }

  const token =
    loadSessionToken()

  if (!token) {
    return []
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_vinculadas_movimentacoes',
    {
      p_token:
        token,
      p_movimentacao_ids: [
        movimentacaoPrincipalId
      ]
    }
  )

  if (error) {
    console.warn(
      'Não foi possível localizar as munições vinculadas ao carrinho do Mapa Força:',
      error
    )

    return []
  }

  return (data || [])
    .map(
      (item) =>
        item?.transferencia_id ||
        item?.id ||
        null
    )
    .filter(Boolean)
}

async function efetivarMateriaisPreparadosMapa({
  preparacao,
  user,
  unidade
}) {
  const itens =
    Array.isArray(
      preparacao?.itensPreparados
    )
      ? preparacao.itensPreparados
      : []

  if (itens.length === 0) {
    return null
  }

  const policial =
    preparacao?.policial

  if (!policial?.id) {
    throw new Error(
      'O policial do material preparado não foi identificado.'
    )
  }

  const fimTurnoServico =
    unidade?.fimUs
      ? new Date(
          unidade.fimUs
        ).toISOString()
      : null

  const inicioTurnoServico =
    unidade?.inicioUs
      ? new Date(
          unidade.inicioUs
        ).toISOString()
      : null

  if (!fimTurnoServico) {
    throw new Error(
      'A US não possui horário de término válido para efetivar a cautela.'
    )
  }

  const observacoes = [
    'MAPA FORÇA',
    unidade?.prefixo
      ? `US ${unidade.prefixo}`
      : null,
    preparacao?.funcao ||
      null
  ]
    .filter(Boolean)
    .join(' • ')

  const municoes =
    itens.filter(
      ehMunicaoMapa
    )

  const patrimoniais =
    itens.filter(
      (item) =>
        !ehMunicaoMapa(item)
    )

  if (municoes.length > 0) {
    const disponibilidades =
      await listarDisponibilidadeMunicaoSvddMapa()

    const porMunicao =
      new Map(
        disponibilidades.map(
          (registro) => [
            String(
              registro?.municao_id ||
              ''
            ),
            numeroInteiro(
              registro
                ?.quantidade_disponivel
            )
          ]
        )
      )

    for (const item of municoes) {
      const municaoId =
        String(
          item?.municao_id ||
          item?.referencia_id ||
          ''
        )

      const solicitado =
        Math.max(
          1,
          numeroInteiro(
            item?.quantidade ||
            1
          )
        )

      const disponivel =
        Math.max(
          0,
          numeroInteiro(
            porMunicao.get(
              municaoId
            ) || 0
          )
        )

      if (
        solicitado >
        disponivel
      ) {
        throw new Error(
          `${
            item?.calibre ||
            item?.descricao ||
            'Munição'
          }: foram preparados ${solicitado} UN, mas existem somente ${disponivel} UN disponíveis no SVDD.`
        )
      }
    }
  }

  let movimentacaoPrincipalId =
    null

  if (patrimoniais.length > 0) {
    const preparados =
      await prepararItensPatrimoniaisMapa(
        patrimoniais
      )

    const resultado =
      await criarMovimentacaoCompleta({
        tipo:
          'CAUTELA',
        origemLocal:
          'COFRE DO SVDD',
        destinoLocal:
          'CAUTELA INDIVIDUAL',
        solicitante:
          user,
        recebedor:
          policial,
        observacoes,
        inicioTurnoServico,
        fimTurnoServico,
        previsaoEntrega:
          null,
        itens:
          preparados,
        aprovarAutomaticamente:
          false
      })

    movimentacaoPrincipalId =
      resultado?.movimentacaoId ||
      null

    if (
      !movimentacaoPrincipalId &&
      municoes.length > 0
    ) {
      throw new Error(
        'A cautela patrimonial foi criada sem o identificador necessário para vincular a munição.'
      )
    }
  }

  const transferenciasMunicaoIds =
    []

  for (const item of municoes) {
    const municaoId =
      item?.municao_id ||
      item?.referencia_id ||
      null

    if (!municaoId) {
      throw new Error(
        'Uma das munições preparadas não possui identificação válida.'
      )
    }

    const resultado =
      await cautelarMunicaoParaPolicial({
        municaoId,
        calibre:
          item?.calibre ||
          '',
        policial,
        quantidade:
          Math.max(
            1,
            Number(
              item?.quantidade ||
              1
            ) || 1
          ),
        devolucaoPrevista:
          fimTurnoServico,
        movimentacaoPrincipalId,
        observacoes,
        user
      })

    transferenciasMunicaoIds.push(
      ...extrairIdsTransferenciaMunicaoMapa(
        resultado
      )
    )
  }

  if (
    movimentacaoPrincipalId &&
    municoes.length > 0
  ) {
    transferenciasMunicaoIds.push(
      ...(
        await localizarMunicoesVinculadasMapa(
          movimentacaoPrincipalId
        )
      )
    )
  }

  return {
    movimentacaoPrincipalId,
    transferenciasMunicaoIds:
      Array.from(
        new Set(
          transferenciasMunicaoIds
            .map(
              (id) =>
                String(id || '')
                  .trim()
            )
            .filter(Boolean)
        )
      ),
    resumoItens:
      Array.isArray(
        preparacao?.resumoItens
      )
        ? preparacao.resumoItens
        : [],
    quantidadeItens:
      itens.length
  }
}

function rotuloEquipamento(item) {
  const texto = normalizarEquipamento([
    item?.tipo,
    item?.tipo_patrimonio,
    item?.categoria,
    item?.descricao
  ].filter(Boolean).join(' '))

  if (texto.includes('CASSETETE')) return 'CASSETETE'
  if (texto.includes('TONFA')) return 'TONFA'
  if (texto.includes('TASER')) return 'TASER'
  if (texto.includes('TPD')) return 'TPD'
  if (texto.includes('HT') || texto.includes('RADIO')) return 'HT'
  if (
    texto.includes('ARMA') ||
    texto.includes('PISTOLA') ||
    texto.includes('REVOLVER') ||
    texto.includes('FUZIL') ||
    texto.includes('CARABINA')
  ) return 'ARMA'

  return item?.tipo ? normalizarEquipamento(item.tipo) : 'EQUIPAMENTO'
}

function resumirEquipamentos(itens = []) {
  return Array.from(new Set((itens || []).map(rotuloEquipamento).filter(Boolean)))
}

function proximoCampoExtra(campos = []) {
  let numero = 1

  while (campos.includes(`POLICIAL EXTRA ${numero}`)) {
    numero += 1
  }

  return `POLICIAL EXTRA ${numero}`
}

function ehCampoExtra(campo) {
  return /^POLICIAL EXTRA \d+$/.test(String(campo || ''))
}

function criarUnidade(tipo, inicio, fim) {
  return {
    id: `nova-${Date.now()}`,
    persistido: false,
    prefixo: tipo.prefixo,
    tipo: tipo.tipo,
    campos: [...tipo.campos],
    criadaManualmente: true,
    inicioUs: inicio,
    fimUs: fim,
    viatura: null,
    vtrDiferenteEscala: false,
    viaturaPrevista: null,
    motivoTrocaVtr: '',
    localPop: '',
    policiais: {}
  }
}

function reconstruirUnidades(unidades, efetivo, inicioPadrao, fimPadrao) {
  return (unidades || []).map((registro) => {
    const tipo = modeloTipo(registro.grupo_id) || {
      id: registro.grupo_id,
      titulo: registro.grupo_titulo || registro.grupo_id,
      subtitulo: '',
      tom: 'azul',
      tipo: registro.tipo,
      campos: []
    }
    const efetivoUs = (efetivo || []).filter((item) => item.us_id === registro.id)
    const policiais = {}
    efetivoUs.forEach((item) => {
      if (item.funcao && item.policial) policiais[item.funcao] = item.policial
    })
    const camposSalvos = efetivoUs.map((item) => item.funcao).filter(Boolean)

    return {
      grupo: tipo,
      unidade: {
        id: registro.id,
        persistido: true,
        prefixo: registro.prefixo,
        tipo: registro.tipo,
        campos: Array.from(new Set([
          ...(tipo.campos?.length
            ? tipo.campos
            : (camposSalvos.length ? camposSalvos : ['ENCARREGADO', 'MOTORISTA / AUXILIAR'])),
          ...camposSalvos
        ])),
        criadaManualmente: true,
        inicioUs: dataInputValor(registro.inicio_us) || inicioPadrao,
        fimUs: dataInputValor(registro.fim_us) || fimPadrao,
        viatura: registro.viatura || null,
        vtrDiferenteEscala: Boolean(registro.vtr_diferente_escala),
        viaturaPrevista: registro.viatura_prevista || null,
        motivoTrocaVtr: registro.motivo_troca_vtr || '',
        localPop: registro.local_pop || '',
        policiais
      },
      ordem: Number(registro.ordem || 0)
    }
  })
}


function resumirCautelaMapa(cautela) {
  const itens =
    Array.isArray(cautela?.resumo_itens)
      ? cautela.resumo_itens
      : []

  const grupos =
    new Map()

  for (const item of itens) {
    const tipo =
      rotuloEquipamento(item)

    if (!tipo) {
      continue
    }

    const quantidade =
      Math.max(
        1,
        Number(
          item?.quantidade ||
          1
        ) || 1
      )

    grupos.set(
      tipo,
      (grupos.get(tipo) || 0) +
        quantidade
    )
  }

  return Array.from(
    grupos.entries()
  ).map(
    ([tipo, quantidade]) =>
      quantidade > 1
        ? `${tipo} ${quantidade}`
        : tipo
  )
}

function statusCautelaLabel(cautela) {
  const status =
    normalizarEquipamento(
      cautela?.status_atual ||
      cautela?.status ||
      ''
    )

  if (status === 'PREPARADO') {
    return '✓ MATERIAL PREPARADO • SALVE A US'
  }

  if (
    status.includes(
      'AGUARDANDO'
    ) ||
    status === 'PENDENTE'
  ) {
    return '✓ MATERIAL PAGO • AGUARDANDO ACEITE'
  }

  if (
    status.includes(
      'RECEB'
    ) ||
    status.includes(
      'CONCLUID'
    ) ||
    status.includes(
      'EM SERVICO'
    )
  ) {
    return '✓ MATERIAL RECEBIDO'
  }

  return '✓ MATERIAL PAGO'
}

function CampoComposicao({
  label,
  policial,
  onSelecionar,
  onRemover,
  onPagarMaterial = null,
  cautelaMapa = null,
  somenteLeitura = false
}) {
  if (policial) {
    return (
      <div
        className="mapa-forca-slot mapa-forca-selecionado"
        style={{ alignItems: 'stretch' }}
      >
        <div className="mapa-forca-mini-foto">
          {policial.foto_url ? <img src={policial.foto_url} alt={nomePolicial(policial)} /> : <span>👮</span>}
        </div>

        <div
          style={{
            display: 'flex',
            flex: 1,
            minWidth: 0,
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <button
            type="button"
            className="mapa-forca-dados-selecionados"
            onClick={somenteLeitura ? undefined : onSelecionar}
          >
            <small>{label}</small>
            <strong>{nomePolicial(policial)}</strong>
            <em>RE {policial.re || '—'}{somenteLeitura ? '' : ' • trocar'}</em>
          </button>

          {cautelaMapa?.ativa && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                alignItems: 'center'
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  minHeight: '26px',
                  padding: '4px 8px',
                  border: '1px solid rgba(52, 211, 153, .38)',
                  borderRadius: '8px',
                  background: 'rgba(16, 185, 129, .10)',
                  color: '#6ee7b7',
                  fontSize: '10px',
                  fontWeight: 900,
                  letterSpacing: '.03em'
                }}
              >
                {statusCautelaLabel(cautelaMapa)}
              </span>

              {resumirCautelaMapa(cautelaMapa).map(
                (item) => (
                  <span
                    key={`${policial?.id}-${item}`}
                    style={{
                      padding: '3px 7px',
                      border: '1px solid rgba(56, 189, 248, .24)',
                      borderRadius: '999px',
                      background: 'rgba(56, 189, 248, .07)',
                      color: '#bae6fd',
                      fontSize: '9px',
                      fontWeight: 800
                    }}
                  >
                    {item}
                  </span>
                )
              )}
            </div>
          )}

          {!somenteLeitura && typeof onPagarMaterial === 'function' && (
            <button
              type="button"
              onClick={onPagarMaterial}
              style={{
                width: 'fit-content',
                minHeight: '30px',
                padding: '6px 11px',
                border: cautelaMapa?.ativa
                  ? '1px solid rgba(52, 211, 153, .42)'
                  : '1px solid rgba(56, 189, 248, .42)',
                borderRadius: '8px',
                background: cautelaMapa?.ativa
                  ? 'rgba(16, 185, 129, .08)'
                  : 'rgba(56, 189, 248, .10)',
                color: cautelaMapa?.ativa
                  ? '#6ee7b7'
                  : '#7dd3fc',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '.04em',
                cursor: 'pointer'
              }}
            >
              {normalizarEquipamento(
                cautelaMapa?.status_atual ||
                cautelaMapa?.status ||
                ''
              ) === 'PREPARADO'
                ? 'Ver / alterar material'
                : cautelaMapa?.ativa
                  ? 'Ver / adicionar material'
                  : 'Pagar Material'}
            </button>
          )}
        </div>

        {!somenteLeitura && <button type="button" className="mapa-forca-remover" onClick={onRemover}>×</button>}
      </div>
    )
  }

  if (somenteLeitura) {
    return <div className="mapa-forca-slot"><span><small>{label}</small><strong>Não definido</strong></span></div>
  }

  return (
    <button type="button" className="mapa-forca-slot" onClick={onSelecionar}>
      <span className="mapa-forca-slot-icon">+</span>
      <span><small>{label}</small><strong>Selecionar policial</strong></span>
    </button>
  )
}

function UnidadeServico({
  grupoId,
  unidade,
  onPolicial,
  onRemoverPolicial,
  onAdicionarPolicial,
  onViatura,
  onRemoverViatura,
  onVtrDiferenteEscala,
  onViaturaPrevista,
  onRemoverViaturaPrevista,
  onMotivoTrocaVtr,
  onHorario,
  onPrefixo,
  onLocalPop,
  onPagarMaterial,
  cautelasPorPolicial = {},
  somenteLeitura = false
}) {
  return (
    <article className="mapa-forca-us">
      <div className="mapa-forca-us-head">
        <label className="mapa-forca-us-prefixo">
          <span>
            {grupoId === 'cgp'
              ? 'SUPERVISÃO'
              : grupoId === 'pop'
                ? 'POP'
                : unidade.tipo}
          </span>

          {somenteLeitura ? (
            <strong>{unidade.prefixo}</strong>
          ) : grupoId === 'servico-dia' ? (
            <select
              value={unidade.prefixo || 'SD27501'}
              onChange={(e) => onPrefixo(e.target.value)}
            >
              {SERVICOS_DIA.map((servico) => (
                <option key={servico} value={servico}>{servico}</option>
              ))}
            </select>
          ) : grupoId === 'pop' ? (
            <strong>POP</strong>
          ) : grupoId === 'cgp' ? (
            <strong>CGP</strong>
          ) : grupoId === 'radio-patrulhamento' ? (
            <strong>RP</strong>
          ) : (
            <input
              value={unidade.prefixo || ''}
              onChange={(e) => onPrefixo(e.target.value.toUpperCase())}
            />
          )}
        </label>

        {grupoId === 'pop' && (
          <label className="mapa-forca-us-prefixo">
            <span>LOCAL DO POP</span>
            {somenteLeitura
              ? <strong>{unidade.localPop || 'Não informado'}</strong>
              : (
                <input
                  value={unidade.localPop || ''}
                  onChange={(e) => onLocalPop?.(e.target.value.toUpperCase())}
                  placeholder="Ex.: RUA / PRAÇA / AVENIDA..."
                />
              )}
          </label>
        )}

        {!['servico-dia', 'pop'].includes(grupoId) && (
          unidade.viatura ? (
            <div className="mapa-forca-vtr mapa-forca-selecionado">
              <div className="mapa-forca-mini-vtr">
                {unidade.viatura.foto_principal_url
                  ? <img src={unidade.viatura.foto_principal_url} alt={unidade.viatura.prefixo} />
                  : <span>{unidade.viatura.tipo_veiculo === 'MOTOCICLETA' ? '🏍️' : '🚓'}</span>}
              </div>
              <button type="button" className="mapa-forca-dados-selecionados" onClick={somenteLeitura ? undefined : onViatura}>
                <small>VIATURA</small>
                <strong>{unidade.viatura.prefixo}</strong>
                {!somenteLeitura && <em>trocar</em>}
              </button>
              {!somenteLeitura && <button type="button" className="mapa-forca-remover" onClick={onRemoverViatura}>×</button>}
            </div>
          ) : somenteLeitura ? (
            <div className="mapa-forca-vtr"><span>▱</span><div><small>VIATURA</small><strong>Não definida</strong></div></div>
          ) : (
            <button type="button" className="mapa-forca-vtr" onClick={onViatura}>
              <span>{unidade.tipo === 'MOTOCICLETA' ? '🏍️' : '▱'}</span>
              <div><small>VIATURA</small><strong>Selecionar</strong></div>
            </button>
          )
        )}
      </div>

      {!['servico-dia', 'pop'].includes(grupoId) && unidade.viatura && (
        <div className={`mapa-forca-vtr-escala ${unidade.vtrDiferenteEscala ? 'ativo' : ''}`}>
          <label className="mapa-forca-vtr-escala-check">
            <input type="checkbox" checked={Boolean(unidade.vtrDiferenteEscala)} disabled={somenteLeitura}
              onChange={(e) => onVtrDiferenteEscala?.(e.target.checked)} />
            <span><strong>VTR diferente da escala</strong><small>Marque quando a viatura empregada for diferente da prevista na escala.</small></span>
          </label>
          {unidade.vtrDiferenteEscala && (
            <div className="mapa-forca-vtr-escala-detalhes">
              <div className="mapa-forca-vtr-prevista">
                <small>VIATURA PREVISTA NA ESCALA</small>
                {unidade.viaturaPrevista ? (
                  <div className="mapa-forca-vtr-prevista-selecionada">
                    <strong>{unidade.viaturaPrevista.prefixo}</strong>
                    {!somenteLeitura && <><button type="button" onClick={onViaturaPrevista}>Trocar</button><button type="button" className="remover" onClick={onRemoverViaturaPrevista}>×</button></>}
                  </div>
                ) : somenteLeitura ? <strong>Não informada</strong> : (
                  <button type="button" className="mapa-forca-vtr-prevista-btn" onClick={onViaturaPrevista}>Selecionar viatura prevista</button>
                )}
              </div>
              <label className="mapa-forca-vtr-motivo">
                <small>MOTIVO DA ALTERAÇÃO</small>
                {somenteLeitura ? <strong>{unidade.motivoTrocaVtr || 'Não informado'}</strong> : (
                  <textarea value={unidade.motivoTrocaVtr || ''} onChange={(e) => onMotivoTrocaVtr?.(e.target.value.toUpperCase())}
                    placeholder="Informe o motivo da troca da viatura..." rows={3} />
                )}
              </label>
            </div>
          )}
        </div>
      )}

      <div className="mapa-forca-composicao">
        {unidade.campos.map((campo) => {
          const policial = unidade.policiais?.[campo]

          return (
            <CampoComposicao
              key={`${unidade.id}-${campo}`}
              label={campo}
              policial={policial}
              onSelecionar={() => onPolicial?.(campo)}
              onRemover={() => onRemoverPolicial?.(campo)}
              onPagarMaterial={
                policial?.id && typeof onPagarMaterial === 'function'
                  ? () => onPagarMaterial({
                      policial,
                      funcao: campo,
                      unidade: {
                        id: unidade.id,
                        prefixo: unidade.prefixo,
                        inicioUs: unidade.inicioUs,
                        fimUs: unidade.fimUs
                      }
                    })
                  : null
              }
              cautelaMapa={
                policial?.id
                  ? cautelasPorPolicial[
                      String(policial.id)
                    ] || null
                  : null
              }
              somenteLeitura={somenteLeitura}
            />
          )
        })}

        {!somenteLeitura && (
          <button type="button" className="mapa-forca-slot mapa-forca-adicionar-policial" onClick={onAdicionarPolicial}>
            <span className="mapa-forca-slot-icon">+</span>
            <span><small>EFETIVO ADICIONAL</small><strong>Adicionar policial</strong></span>
          </button>
        )}
      </div>

    </article>
  )
}

function resumoMapa(salvas) {
  const policiais = new Set()
  const viaturas = new Set()
  let pops = 0

  salvas.forEach((item) => {
    Object.values(item.unidade.policiais || {}).forEach((policial) => {
      if (policial?.id) policiais.add(String(policial.id))
    })
    if (item.unidade.viatura?.id) viaturas.add(String(item.unidade.viatura.id))
    if (item.grupo.id === 'pop') pops += 1
  })

  return {
    us: salvas.length,
    policiais: policiais.size,
    viaturas: viaturas.size,
    pops
  }
}

function CartaoPolicialCompacto({ funcao, policial, materiais = [] }) {
  const equipamentos = resumirEquipamentos(materiais)

  return (
    <div className="mapa-forca-compact-policial">
      <div className="mapa-forca-compact-foto">
        {policial?.foto_url ? <img src={policial.foto_url} alt={nomePolicial(policial)} /> : <span>👮</span>}
      </div>
      <div>
        <small>{funcao}</small>
        <strong>{policial ? nomePolicial(policial) : 'NÃO DEFINIDO'}</strong>
        {policial && <em>RE {policial.re || '—'}</em>}
        {policial && equipamentos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '7px' }}>
            {equipamentos.map((equipamento) => (
              <span
                key={`${policial.id}-${equipamento}`}
                style={{
                  border: '1px solid rgba(56, 189, 248, .28)',
                  background: 'rgba(56, 189, 248, .08)',
                  borderRadius: '999px',
                  padding: '2px 7px',
                  fontSize: '10px',
                  fontStyle: 'normal',
                  fontWeight: 800,
                  letterSpacing: '.04em'
                }}
              >
                {equipamento}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function UnidadeCompacta({
  item,
  materiaisPorPolicial = {},
  onEditar = null,
  onExcluir = null
}) {
  const { unidade } = item
  return (
    <div
      className="mapa-forca-compact-us"
    >
      <div className="mapa-forca-compact-us-top">
        <div>
          <span className="mapa-forca-compact-prefixo">{unidade.prefixo}</span>
          {unidade.viatura && <small>VIATURA: {unidade.viatura.prefixo}</small>}
          {unidade.vtrDiferenteEscala && (
            <div className="mapa-forca-compact-vtr-alerta">
              <strong>⚠ VTR DIFERENTE DA ESCALA</strong>
              <span>Prevista: {unidade.viaturaPrevista?.prefixo || 'NÃO INFORMADA'}</span>
              <span>Motivo: {unidade.motivoTrocaVtr || 'NÃO INFORMADO'}</span>
            </div>
          )}
        </div>
        <span className="mapa-forca-compact-status">● EM ELABORAÇÃO</span>
      </div>

      <div className="mapa-forca-compact-efetivo">
        {unidade.campos.map((funcao) => (
          <CartaoPolicialCompacto
            key={`${unidade.id}-${funcao}`}
            funcao={funcao}
            policial={unidade.policiais?.[funcao]}
            materiais={materiaisPorPolicial[String(unidade.policiais?.[funcao]?.id || '')] || []}
          />
        ))}
      </div>

      <div className="mapa-forca-compact-rodape">
        <span>{dataInputValor(unidade.inicioUs).slice(11)} → {dataInputValor(unidade.fimUs).slice(11)}</span>
        <span className="mapa-forca-compact-acoes" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            className="mapa-forca-toolbar-btn"
            onClick={() => onEditar?.(item)}
            disabled={typeof onEditar !== 'function'}
          >
            ✎ EDITAR US
          </button>
          <button
            type="button"
            className="mapa-forca-toolbar-btn"
            onClick={() => onExcluir?.(item)}
            disabled={typeof onExcluir !== 'function'}
          >
            EXCLUIR
          </button>
        </span>
      </div>
    </div>
  )
}

function ModalSelecao({ selecao, itens, pesquisa, setPesquisa, loading, erro, ocupados, onClose, onSelecionar }) {
  const termo = String(pesquisa || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  const lista = itens.filter((item) => {
    const texto = selecao.tipo === 'POLICIAL'
      ? `${item.posto_graduacao || ''} ${item.nome_guerra || ''} ${item.nome || ''} ${item.re || ''}`
      : `${item.prefixo || ''} ${item.modelo || ''} ${item.placa || ''} ${item.ano || ''}`
    return !termo || texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().includes(termo)
  })

  return (
    <div className="mapa-forca-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="mapa-forca-modal">
        <header><div><small>MAPA FORÇA</small><h2>{selecao.tipo === 'POLICIAL' ? `Selecionar policial • ${selecao.campo}` : `Selecionar ${selecao.tipoVeiculo === 'MOTOCICLETA' ? 'motocicleta' : 'viatura'}`}</h2></div><button type="button" onClick={onClose}>×</button></header>
        <input
          autoFocus
          className="mapa-forca-modal-pesquisa"
          value={pesquisa}
          onChange={(e) => {
            const valor = e.target.value

            if (selecao.tipo === 'POLICIAL' && /^\d*$/.test(valor)) {
              setPesquisa(valor.slice(0, 6))
              return
            }

            setPesquisa(valor)
          }}
          inputMode={selecao.tipo === 'POLICIAL' && /^\d*$/.test(pesquisa || '') ? 'numeric' : undefined}
          placeholder={selecao.tipo === 'POLICIAL' ? 'Pesquisar nome, posto ou RE...' : 'Pesquisar prefixo, modelo ou placa...'}
        />
        {erro ? <div className="mapa-forca-modal-aviso erro">{erro}</div>
          : loading ? <div className="mapa-forca-modal-aviso">Carregando...</div>
          : lista.length === 0 ? <div className="mapa-forca-modal-aviso">Nenhum registro disponível.</div>
          : <div className="mapa-forca-modal-lista">{lista.map((item) => {
              const ocupado = ocupados.has(String(item.id))
              return <button type="button" key={item.id} className="mapa-forca-opcao" disabled={ocupado} onClick={() => onSelecionar(item)}>
                <div className="mapa-forca-opcao-foto">{selecao.tipo === 'POLICIAL'
                  ? (item.foto_url ? <img src={item.foto_url} alt={nomePolicial(item)} /> : <span>👮</span>)
                  : (item.foto_principal_url ? <img src={item.foto_principal_url} alt={item.prefixo} /> : <span>{item.tipo_veiculo === 'MOTOCICLETA' ? '🏍️' : '🚓'}</span>)}</div>
                <div><strong>{selecao.tipo === 'POLICIAL' ? nomePolicial(item) : item.prefixo}</strong>
                  <span>{selecao.tipo === 'POLICIAL' ? `RE ${item.re || '—'} • ${item.companhia || '—'}` : `${item.modelo || '—'} • ${item.placa || '—'} • ${item.ano || '—'}`}</span></div>
                <b>{ocupado ? 'JÁ ESCALADO' : 'SELECIONAR'}</b>
              </button>
            })}</div>}
      </section>
    </div>
  )
}

export default function MapaForca({
  user,
  onVoltar,
  onPagarMaterial = null,
  modoInicial = 'montagem',
  rascunhoInicial = null,
  onRascunhoChange = null,
  somenteLeitura = false
}) {
  const turnoInicial = useMemo(() => criarTurnoInicial(), [])
  const [inicio, setInicio] = useState(turnoInicial.inicio)
  const [fim, setFim] = useState(turnoInicial.fim)
  const [horarioPadraoInicio, setHorarioPadraoInicio] = useState(turnoInicial.inicio)
  const [horarioPadraoFim, setHorarioPadraoFim] = useState(turnoInicial.fim)
  const [status, setStatus] = useState('EM ELABORAÇÃO')
  const [equipeServico, setEquipeServico] = useState('')
  const [mapaId, setMapaId] = useState(null)
  const [salvas, setSalvas] = useState([])
  const [editor, setEditor] = useState(() => rascunhoInicial || null)
  const [modo, setModo] = useState(
    somenteLeitura || modoInicial === 'visualizacao' ? 'visualizacao' : 'montagem'
  )
  const [policiais, setPoliciais] = useState([])
  const [viaturas, setViaturas] = useState([])
  const [loadingPoliciais, setLoadingPoliciais] = useState(true)
  const [loadingViaturas, setLoadingViaturas] = useState(true)
  const [erroPoliciais, setErroPoliciais] = useState('')
  const [erroViaturas, setErroViaturas] = useState('')
  const [selecao, setSelecao] = useState(null)
  const [pesquisaSelecao, setPesquisaSelecao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [carregandoMapa, setCarregandoMapa] = useState(true)
  const [mensagemMapa, setMensagemMapa] = useState('')
  const [materiaisPorPolicial, setMateriaisPorPolicial] = useState({})
  const [cautelasMapa, setCautelasMapa] = useState([])
  const [pagarMaterialMapa, setPagarMaterialMapa] = useState(null)

  useEffect(() => {
    onRascunhoChange?.(editor)
  }, [editor, onRascunhoChange])

  async function recarregarMapa() {
    const salvo = await carregarMapaEmElaboracao()
    if (!salvo?.mapa) {
      setMapaId(null)
      setSalvas([])
      setCautelasMapa([])
      return
    }
    const inicioMapa = dataInputValor(salvo.mapa.inicio_turno)
    const fimMapa = dataInputValor(salvo.mapa.fim_turno)
    setMapaId(salvo.mapa.id)
    setInicio(inicioMapa)
    setFim(fimMapa)
    setHorarioPadraoInicio(inicioMapa)
    setHorarioPadraoFim(fimMapa)
    setStatus(salvo.mapa.status || 'EM ELABORAÇÃO')
    setEquipeServico(salvo.mapa.equipe_servico || '')
    setSalvas(reconstruirUnidades(salvo.unidades, salvo.efetivo, inicioMapa, fimMapa))

    try {
      const cautelas =
        await listarCautelasMapaForca({
          mapaId:
            salvo.mapa.id
        })

      setCautelasMapa(
        Array.isArray(cautelas)
          ? cautelas
          : []
      )
    } catch (error) {
      console.warn(
        'Não foi possível carregar os vínculos de cautela do Mapa Força:',
        error
      )
      setCautelasMapa([])
    }
  }

  useEffect(() => {
    let ativo = true
    async function carregarCadastros() {
      try {
        const resultado = await listarPoliciais({ filtros: { situacao: 'ATIVO' }, pagina: 1, limite: 1000, sortBy: 'nome_guerra', sortDirection: 'asc' })
        if (ativo) setPoliciais(resultado.data || [])
      } catch (error) {
        if (ativo) setErroPoliciais(error?.message || 'Não foi possível carregar os policiais.')
      } finally { if (ativo) setLoadingPoliciais(false) }

      try {
        const lista = await listarViaturas()
        if (ativo) setViaturas(lista || [])
      } catch (error) {
        if (ativo) setErroViaturas(error?.message || 'Não foi possível carregar as viaturas.')
      } finally { if (ativo) setLoadingViaturas(false) }
    }
    carregarCadastros()
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    recarregarMapa()
      .then(() => { if (ativo) setMensagemMapa('Mapa em elaboração carregado.') })
      .catch((error) => { if (ativo) setMensagemMapa(error?.message || 'Não foi possível carregar o mapa salvo.') })
      .finally(() => { if (ativo) setCarregandoMapa(false) })
    return () => { ativo = false }
  }, [])

  useEffect(() => {
    let ativo = true
    const policiaisDoMapa = new Map()

    salvas.forEach((item) => {
      Object.values(item?.unidade?.policiais || {}).forEach((policial) => {
        if (policial?.id) policiaisDoMapa.set(String(policial.id), policial)
      })
    })

    Object.values(editor?.unidade?.policiais || {}).forEach((policial) => {
      if (policial?.id) policiaisDoMapa.set(String(policial.id), policial)
    })

    if (policiaisDoMapa.size === 0) {
      setMateriaisPorPolicial({})
      return () => { ativo = false }
    }

    Promise.all(
      Array.from(policiaisDoMapa.entries()).map(async ([id, policial]) => {
        try {
          const itens = await listarMateriaisEmServicoUsuario(policial)
          return [id, itens || []]
        } catch (error) {
          console.warn(`Não foi possível carregar cautelas do policial ${policial?.re || id}:`, error)
          return [id, []]
        }
      })
    ).then((registros) => {
      if (ativo) setMateriaisPorPolicial(Object.fromEntries(registros))
    })

    return () => { ativo = false }
  }, [salvas, editor])


  const cautelasPorPolicial =
    useMemo(() => {
      const resultado = {}

      for (const cautela of cautelasMapa || []) {
        if (
          !cautela?.ativa ||
          !cautela?.policial_id
        ) {
          continue
        }

        const chave =
          String(
            cautela.policial_id
          )

        const atual =
          resultado[chave]

        if (
          !atual ||
          new Date(
            cautela.created_at ||
            0
          ).getTime() >=
            new Date(
              atual.created_at ||
              0
            ).getTime()
        ) {
          resultado[chave] =
            cautela
        }
      }

      return resultado
    }, [cautelasMapa])


  const cautelasEditorPorPolicial =
    useMemo(() => {
      const resultado = {}

      if (!editor?.unidade) {
        return resultado
      }

      const unidade =
        editor.unidade

      const usAtual =
        String(
          unidade?.id ||
          ''
        )

      const ehNovaUs =
        usAtual.startsWith(
          'nova-'
        )

      const criadaEmMs =
        ehNovaUs
          ? Number(
              usAtual.replace(
                /^nova-/,
                ''
              )
            )
          : null

      const prefixoAtual =
        normalizarEquipamento(
          unidade?.prefixo
        )

      const funcaoPorPolicial =
        new Map(
          Object.entries(
            unidade?.policiais ||
            {}
          )
            .filter(
              ([, policial]) =>
                policial?.id
            )
            .map(
              ([
                funcao,
                policial
              ]) => [
                String(
                  policial.id
                ),
                normalizarEquipamento(
                  funcao
                )
              ]
            )
        )

      for (
        const cautela of
        cautelasMapa || []
      ) {
        if (
          !cautela?.ativa ||
          !cautela?.policial_id
        ) {
          continue
        }

        const policialId =
          String(
            cautela.policial_id
          )

        const funcaoAtual =
          funcaoPorPolicial.get(
            policialId
          )

        if (!funcaoAtual) {
          continue
        }

        const usCautela =
          String(
            cautela?.us_id ||
            ''
          )

        let pertence =
          false

        if (
          !ehNovaUs &&
          usAtual
        ) {
          pertence =
            Boolean(
              usCautela &&
              usCautela ===
                usAtual
            )
        } else if (
          ehNovaUs &&
          !usCautela &&
          Number.isFinite(
            criadaEmMs
          ) &&
          criadaEmMs > 0
        ) {
          const cautelaCriadaEmMs =
            new Date(
              cautela?.created_at ||
              0
            ).getTime()

          const funcaoCautela =
            normalizarEquipamento(
              cautela?.funcao
            )

          const prefixoCautela =
            normalizarEquipamento(
              cautela?.prefixo_us
            )

          pertence =
            Number.isFinite(
              cautelaCriadaEmMs
            ) &&
            cautelaCriadaEmMs >=
              criadaEmMs &&
            (
              !funcaoCautela ||
              funcaoCautela ===
                funcaoAtual
            ) &&
            (
              !prefixoAtual ||
              !prefixoCautela ||
              prefixoCautela ===
                prefixoAtual
            )
        }

        if (!pertence) {
          continue
        }

        const atual =
          resultado[
            policialId
          ]

        if (
          !atual ||
          new Date(
            cautela?.created_at ||
            0
          ).getTime() >=
            new Date(
              atual?.created_at ||
              0
            ).getTime()
        ) {
          resultado[
            policialId
          ] =
            cautela
        }
      }

      return resultado
    }, [
      cautelasMapa,
      editor
    ])


  const cautelasEditorExibidasPorPolicial =
    useMemo(() => {
      const resultado = {
        ...cautelasEditorPorPolicial
      }

      const preparados =
        editor?.unidade
          ?.materiaisPreparados ||
        {}

      for (
        const [
          funcao,
          preparacao
        ] of Object.entries(
          preparados
        )
      ) {
        const policialId =
          String(
            preparacao?.policial_id ||
            preparacao?.policial?.id ||
            ''
          )

        if (!policialId) {
          continue
        }

        resultado[policialId] = {
          id:
            `PREPARADO:${editor?.unidade?.id || 'US'}:${funcao}`,
          ativa: true,
          policial_id:
            policialId,
          policial_re:
            preparacao?.policial?.re ||
            null,
          policial_nome:
            nomePolicial(
              preparacao?.policial
            ),
          funcao,
          prefixo_us:
            editor?.unidade
              ?.prefixo ||
            preparacao?.prefixoUs ||
            '',
          us_id:
            editor?.unidade
              ?.persistido
              ? editor.unidade.id
              : null,
          status:
            'PREPARADO',
          status_atual:
            'PREPARADO',
          resumo_itens:
            preparacao?.resumoItens ||
            [],
          quantidade_itens:
            preparacao
              ?.quantidadeItens ||
            0,
          created_at:
            preparacao
              ?.preparado_em ||
            new Date().toISOString()
        }
      }

      return resultado
    }, [
      cautelasEditorPorPolicial,
      editor
    ])


  const materiaisExibidosPorPolicial =
    useMemo(() => {
      const resultado = {
        ...materiaisPorPolicial
      }

      for (
        const [
          policialId,
          cautela
        ] of Object.entries(
          cautelasPorPolicial
        )
      ) {
        const ativos =
          Array.isArray(
            resultado[policialId]
          )
            ? resultado[policialId]
            : []

        const resumo =
          Array.isArray(
            cautela?.resumo_itens
          )
            ? cautela.resumo_itens
            : []

        if (resumo.length === 0) {
          continue
        }

        resultado[policialId] = [
          ...ativos,
          ...resumo
        ]
      }

      return resultado
    }, [
      materiaisPorPolicial,
      cautelasPorPolicial
    ])

  useEffect(() => {
    if (carregandoMapa || policiais.length === 0) return
    const porId = new Map(policiais.filter((p) => p?.id).map((p) => [String(p.id), p]))
    setSalvas((atuais) => atuais.map((item) => ({
      ...item,
      unidade: {
        ...item.unidade,
        policiais: Object.fromEntries(Object.entries(item.unidade.policiais || {}).map(([funcao, policial]) => {
          const atual = porId.get(String(policial?.id || ''))

          return [
            funcao,
            atual
              ? {
                  ...policial,
                  ...atual,
                  foto_url:
                    atual.foto_url ||
                    policial?.foto_url ||
                    null
                }
              : policial
          ]
        }))
      }
    })))
  }, [policiais, carregandoMapa])

  const policiaisOcupados = useMemo(() => {
    const ids = new Set()
    salvas.forEach((item) => {
      if (editor?.unidade?.persistido && item.unidade.id === editor.unidade.id) return
      Object.values(item.unidade.policiais || {}).forEach((p) => p?.id && ids.add(String(p.id)))
    })

    Object.entries(editor?.unidade?.policiais || {}).forEach(([campo, policial]) => {
      if (campo !== selecao?.campo && policial?.id) ids.add(String(policial.id))
    })

    return ids
  }, [salvas, editor, selecao])

  const viaturasOcupadas = useMemo(() => {
    const ids = new Set()
    salvas.forEach((item) => {
      if (editor?.unidade?.persistido && item.unidade.id === editor.unidade.id) return
      if (item.unidade.viatura?.id) ids.add(String(item.unidade.viatura.id))
    })
    return ids
  }, [salvas, editor])

  function iniciarNovaUS(tipoId) {
    const tipo = modeloTipo(tipoId)
    if (!tipo) return
    setEditor({ grupo: tipo, unidade: criarUnidade(tipo, horarioPadraoInicio, horarioPadraoFim) })
    setMensagemMapa('')
  }

  function atualizarEditor(fn) {
    setEditor((atual) => atual ? { ...atual, unidade: fn(atual.unidade) } : atual)
  }

  function abrirPolicial(campo) {
    if (!editor) return
    setPesquisaSelecao('')
    setSelecao({ tipo: 'POLICIAL', campo })
  }

  function abrirViatura() {
    if (!editor) return
    setPesquisaSelecao('')
    setSelecao({ tipo: 'VIATURA', tipoVeiculo: editor.grupo.id === 'rpm' ? 'MOTOCICLETA' : 'VIATURA' })
  }

  function selecionarPolicial(policial) {
    atualizarEditor((u) => {
      const campo =
        selecao?.campo

      const policialAnterior =
        u?.policiais?.[campo]

      const trocouPolicial =
        policialAnterior?.id &&
        String(policialAnterior.id) !==
          String(policial?.id || '')

      const materiaisPreparados = {
        ...(u?.materiaisPreparados || {})
      }

      if (
        trocouPolicial &&
        campo
      ) {
        delete materiaisPreparados[campo]
      }

      return {
        ...u,
        campos:
          selecao?.novoExtra &&
          !(u.campos || []).includes(campo)
            ? [
                ...(u.campos || []),
                campo
              ]
            : u.campos,
        policiais: {
          ...(u.policiais || {}),
          [campo]:
            policial
        },
        materiaisPreparados
      }
    })

    setSelecao(null)
  }

  function selecionarViatura(viatura) {
    atualizarEditor((u) => ({ ...u, viatura }))
    setSelecao(null)
  }

  function abrirViaturaPrevista() {
    if (!editor) return
    setPesquisaSelecao('')
    setSelecao({ tipo: 'VIATURA_PREVISTA', tipoVeiculo: editor.grupo.id === 'rpm' ? 'MOTOCICLETA' : 'VIATURA' })
  }

  function selecionarViaturaPrevista(viatura) {
    atualizarEditor((u) => ({ ...u, viaturaPrevista: viatura }))
    setSelecao(null)
  }

  function removerPolicial(campo) {
    atualizarEditor((u) => {
      const novos = {
        ...(u.policiais || {})
      }

      const materiaisPreparados = {
        ...(u?.materiaisPreparados || {})
      }

      delete novos[campo]
      delete materiaisPreparados[campo]

      return {
        ...u,
        policiais: novos,
        materiaisPreparados,
        campos: ehCampoExtra(campo)
          ? (u.campos || []).filter(
              (item) =>
                item !== campo
            )
          : u.campos
      }
    })
  }

  function adicionarPolicialExtra() {
    if (!editor) return
    const campo = proximoCampoExtra(editor.unidade.campos || [])
    setPesquisaSelecao('')
    setSelecao({ tipo: 'POLICIAL', campo, novoExtra: true })
  }


  async function abrirPagarMaterialMapa(
    contexto
  ) {
    try {
      setMensagemMapa('')

      let idMapaAtual =
        mapaId

      if (!idMapaAtual) {
        idMapaAtual =
          await salvarCabecalhoMapaForca({
            mapaId:
              null,
            inicio,
            fim,
            user,
            equipeServico
          })

        setMapaId(
          idMapaAtual
        )
      }

      setPagarMaterialMapa({
        ...contexto,
        mapaId:
          idMapaAtual
      })
    } catch (error) {
      console.error(
        'Erro ao preparar pagamento de material pelo Mapa Força:',
        error
      )

      setMensagemMapa(
        error?.message ||
        'Não foi possível preparar o Mapa Força para o pagamento.'
      )
    }
  }

  async function registrarPagamentoNoMapa(
    resumo
  ) {
    const contexto =
      pagarMaterialMapa

    if (
      !contexto?.policial?.id
    ) {
      return
    }

    /*
     * Novo fluxo do Mapa Força:
     * confirmar no modal apenas PREPARA o kit.
     * A cautela real só será criada no Salvar US.
     *
     * O ramo antigo permanece por compatibilidade durante
     * a troca dos dois arquivos, evitando quebrar o build
     * se este MapaForca.jsx for substituído primeiro.
     */
    if (resumo?.preparado === true) {
      atualizarEditor((unidadeAtual) => {
        const funcao =
          contexto?.funcao ||
          resumo?.funcao ||
          'EFETIVO'

        const existentes =
          unidadeAtual
            ?.materiaisPreparados?.[
              funcao
            ] ||
          null

        const itensPreparados =
          mesclarItensPreparados(
            existentes
              ?.itensPreparados ||
              [],
            resumo
              ?.itensPreparados ||
              []
          )

        const resumoItens =
          itensPreparados.map(
            (item) => {
              const correspondente =
                (
                  resumo
                    ?.resumoItens ||
                  []
                ).find(
                  (resumoItem) =>
                    chaveMaterialPreparado(
                      resumoItem
                    ) ===
                    chaveMaterialPreparado(
                      item
                    )
                )

              return {
                ...(correspondente ||
                  item),
                quantidade:
                  Math.max(
                    1,
                    Number(
                      item?.quantidade ||
                      1
                    ) || 1
                  )
              }
            }
          )

        return {
          ...unidadeAtual,
          materiaisPreparados: {
            ...(
              unidadeAtual
                ?.materiaisPreparados ||
              {}
            ),
            [funcao]: {
              ...(existentes || {}),
              preparado: true,
              policial:
                contexto.policial,
              policial_id:
                contexto.policial.id,
              funcao,
              prefixoUs:
                contexto?.unidade
                  ?.prefixo ||
                unidadeAtual?.prefixo ||
                '',
              itensPreparados,
              resumoItens,
              quantidadeItens:
                itensPreparados.length,
              preparado_em:
                new Date().toISOString()
            }
          }
        }
      })

      setMensagemMapa(
        `Material preparado para ${nomePolicial(
          contexto.policial
        )}. A cautela só será liberada ao policial quando você clicar em Salvar US.`
      )

      return
    }

    const idMapaAtual =
      contexto?.mapaId ||
      mapaId

    try {
      await registrarCautelaMapaForca({
        mapaId:
          idMapaAtual,

        usId:
          contexto?.unidade?.id ||
          null,

        policial:
          contexto.policial,

        funcao:
          contexto.funcao,

        prefixoUs:
          contexto?.unidade
            ?.prefixo ||
          '',

        movimentacaoPrincipalId:
          resumo
            ?.movimentacaoPrincipalId ||
          null,

        transferenciasMunicaoIds:
          resumo
            ?.transferenciasMunicaoIds ||
          [],

        resumoItens:
          resumo?.resumoItens ||
          [],

        quantidadeItens:
          resumo?.quantidadeItens ||
          0
      })

      const cautelas =
        await listarCautelasMapaForca({
          mapaId:
            idMapaAtual
        })

      setCautelasMapa(
        Array.isArray(cautelas)
          ? cautelas
          : []
      )

      setMensagemMapa(
        `Cautela registrada no Mapa Força para ${nomePolicial(
          contexto.policial
        )}. O material permanece no SVDD até o policial confirmar o recebimento.`
      )
    } catch (error) {
      console.error(
        'A cautela foi criada, mas não foi possível registrar o vínculo no Mapa Força:',
        error
      )

      setMensagemMapa(
        `A cautela foi criada para ${nomePolicial(
          contexto.policial
        )}, mas o vínculo visual com o Mapa Força não pôde ser atualizado: ${
          error?.message ||
          'erro não identificado'
        }.`
      )
    }
  }


  async function salvarCabecalho() {
    if (salvando) return
    setSalvando(true)
    setMensagemMapa('')
    try {
      const id = await salvarCabecalhoMapaForca({ mapaId, inicio, fim, user, equipeServico })
      setMapaId(id)
      setMensagemMapa('Horário do mapa salvo.')
    } catch (error) {
      setMensagemMapa(error?.message || 'Não foi possível salvar o mapa.')
    } finally { setSalvando(false) }
  }

  async function salvarUS() {
    if (!editor || salvando) return

    setSalvando(true)
    setMensagemMapa('')

    try {
      const prefixo =
        String(
          editor.unidade.prefixo ||
          ''
        ).trim()

      if (!prefixo) {
        throw new Error(
          'Informe o prefixo/identificação da US.'
        )
      }

      if (
        editor.unidade
          .vtrDiferenteEscala
      ) {
        if (
          !editor.unidade
            .viaturaPrevista?.id
        ) {
          throw new Error(
            'Selecione a viatura prevista originalmente na escala.'
          )
        }

        if (
          !String(
            editor.unidade
              .motivoTrocaVtr ||
            ''
          ).trim()
        ) {
          throw new Error(
            'Informe o motivo da troca da viatura.'
          )
        }
      }

      const unidadeParaSalvar = {
        ...editor.unidade,
        inicioUs:
          inicio,
        fimUs:
          fim
      }

      const resultado =
        await salvarUSMapaForca({
          mapaId,
          inicio,
          fim,
          user,
          grupo:
            editor.grupo,
          unidade:
            unidadeParaSalvar,
          ordem:
            editor.unidade
              .persistido
              ? (
                  salvas.find(
                    (item) =>
                      item.unidade.id ===
                      editor.unidade.id
                  )?.ordem ||
                  0
                )
              : (
                  salvas.reduce(
                    (maior, item) =>
                      Math.max(
                        maior,
                        Number(
                          item.ordem ||
                          0
                        )
                      ),
                    -1
                  ) + 1
                )
        })

      setMapaId(
        resultado.mapaId
      )
      setHorarioPadraoInicio(
        inicio
      )
      setHorarioPadraoFim(
        fim
      )

      const preparacoes = {
        ...(
          unidadeParaSalvar
            ?.materiaisPreparados ||
          {}
        )
      }

      const chavesPreparacao =
        Object.keys(
          preparacoes
        )

      if (
        chavesPreparacao.length >
        0
      ) {
        const restantes = {
          ...preparacoes
        }

        for (
          const funcao of
          chavesPreparacao
        ) {
          const preparacao =
            preparacoes[funcao]

          if (
            !preparacao?.policial?.id ||
            !Array.isArray(
              preparacao
                ?.itensPreparados
            ) ||
            preparacao
              .itensPreparados
              .length === 0
          ) {
            delete restantes[
              funcao
            ]
            continue
          }

          try {
            const efetivada =
              await efetivarMateriaisPreparadosMapa({
                preparacao,
                user,
                unidade: {
                  ...unidadeParaSalvar,
                  id:
                    resultado.usId,
                  persistido:
                    true
                }
              })

            if (efetivada) {
              await registrarCautelaMapaForca({
                mapaId:
                  resultado.mapaId,
                usId:
                  resultado.usId,
                policial:
                  preparacao.policial,
                funcao,
                prefixoUs:
                  unidadeParaSalvar
                    ?.prefixo ||
                  '',
                movimentacaoPrincipalId:
                  efetivada
                    .movimentacaoPrincipalId ||
                  null,
                transferenciasMunicaoIds:
                  efetivada
                    .transferenciasMunicaoIds ||
                  [],
                resumoItens:
                  preparacao
                    ?.resumoItens ||
                  efetivada
                    ?.resumoItens ||
                  [],
                quantidadeItens:
                  preparacao
                    ?.quantidadeItens ||
                  efetivada
                    ?.quantidadeItens ||
                  0
              })
            }

            delete restantes[
              funcao
            ]
          } catch (erroMaterial) {
            /*
             * A US já recebeu UUID real. Mantemos o editor nessa
             * US persistida e somente com os kits ainda não concluídos.
             * Assim o operador pode corrigir o problema e clicar
             * novamente em Salvar alterações da US sem criar outra US.
             */
            setEditor(
              (atual) =>
                atual
                  ? {
                      ...atual,
                      unidade: {
                        ...atual.unidade,
                        id:
                          resultado.usId,
                        persistido:
                          true,
                        inicioUs:
                          inicio,
                        fimUs:
                          fim,
                        materiaisPreparados:
                          restantes
                      }
                    }
                  : atual
            )

            await recarregarMapa()

            throw new Error(
              `A US foi salva, mas o material de ${
                nomePolicial(
                  preparacao.policial
                )
              } não pôde ser liberado: ${
                erroMaterial?.message ||
                'erro não identificado'
              }. Corrija e salve a US novamente.`
            )
          }
        }
      } else {
        /*
         * Compatibilidade com cautelas criadas pela versão anterior
         * do modal enquanto os dois arquivos são atualizados.
         */
        await vincularCautelasPendentesAUS({
          mapaId:
            resultado.mapaId,
          usId:
            resultado.usId,
          unidade:
            unidadeParaSalvar
        })
      }

      await recarregarMapa()
      setEditor(null)

      setMensagemMapa(
        chavesPreparacao.length > 0
          ? 'US salva. Os materiais preparados foram liberados para aceite dos policiais.'
          : 'US salva. A tela está pronta para montar a próxima equipe.'
      )
    } catch (error) {
      console.error(
        'Erro ao salvar US:',
        error
      )

      setMensagemMapa(
        error?.message ||
        'Não foi possível salvar a US.'
      )
    } finally {
      setSalvando(false)
    }
  }


  function editarUS(item) {
    const inicioUs = item.unidade.inicioUs || inicio
    const fimUs = item.unidade.fimUs || fim

    setInicio(inicioUs)
    setFim(fimUs)
    setHorarioPadraoInicio(inicioUs)
    setHorarioPadraoFim(fimUs)
    setEditor({
      grupo: item.grupo,
      unidade: {
        ...item.unidade,
        inicioUs,
        fimUs,
        policiais: { ...(item.unidade.policiais || {}) }
      }
    })
    setModo('montagem')
    setMensagemMapa(`Editando ${item.unidade.prefixo}.`)
  }

  async function excluirUS(item) {
    if (!window.confirm(`Excluir a US "${item.unidade.prefixo}" do Mapa Força?`)) return
    try {
      await excluirUSMapaForca({ mapaId, usId: item.unidade.id })
      await recarregarMapa()
      setMensagemMapa('US excluída do Mapa Força.')
    } catch (error) {
      setMensagemMapa(error?.message || 'Não foi possível excluir a US.')
    }
  }

  function novoMapa() {
    if (!window.confirm('Limpar a tela de montagem e iniciar uma nova composição? O mapa já salvo no banco não será apagado.')) return
    const turno = criarTurnoInicial()
    setInicio(turno.inicio)
    setFim(turno.fim)
    setHorarioPadraoInicio(turno.inicio)
    setHorarioPadraoFim(turno.fim)
    setEquipeServico('')
    setEditor(null)
    setModo('montagem')
    setMensagemMapa('Tela de montagem limpa. O mapa salvo anteriormente foi preservado.')
  }

  if (modo === 'visualizacao') {
    return (
      <main className="mapa-forca-page mapa-forca-page-visualizacao">
        <MapaForcaVisualizacao
          salvas={salvas}
          policiaisCadastro={policiais}
          materiaisPorPolicial={materiaisPorPolicial}
          onVoltarMontagem={somenteLeitura ? onVoltar : () => setModo('montagem')}
        />
      </main>
    )
  }

  return (
    <main className="mapa-forca-page">
      <header className="mapa-forca-hero">
        <div><span>SIGMO • GESTÃO OPERACIONAL</span><h1>MAPA FORÇA</h1><p>Monte uma US por vez. As equipes salvas aparecem na visualização completa.</p></div>
        <div className="mapa-forca-hero-actions">
          <button type="button" className="mapa-forca-secondary" onClick={onVoltar}>← Dashboard</button>
          <button type="button" className="mapa-forca-primary" onClick={novoMapa}>+ Novo mapa</button>
        </div>
      </header>

      <section className="mapa-forca-topbar">
        <div className="mapa-forca-topbar-info">
          <span>MAPA DO TURNO</span>
          <strong>{status}</strong>
          <small>Responsável: {nomeUsuario(user)} • {salvas.length} US salva(s)</small>
        </div>

        <div
          className="mapa-forca-topbar-periodo"
          style={{
            display: 'grid',
            gridTemplateColumns: '58px 172px 16px 172px max-content max-content',
            alignItems: 'end',
            justifyContent: 'start',
            columnGap: '3px',
            rowGap: '0',
            flex: '0 0 auto',
            width: 'auto',
            minWidth: 0
          }}
        >
          <label
            style={{
              width: '58px',
              minWidth: '58px',
              maxWidth: '58px',
              flex: '0 0 58px',
              margin: 0,
              padding: 0
            }}
          >
            <span>EQUIPE DE SERVIÇO</span>
            <select
              value={equipeServico}
              onChange={(e) => setEquipeServico(e.target.value)}
              style={{
                width: '54px',
                minWidth: '54px',
                maxWidth: '54px',
                height: '38px',
                padding: '0 8px',
                background: '#0b3f75',
                color: '#ffffff',
                border: '1px solid #2b6ea6',
                borderRadius: '8px',
                fontWeight: 800,
                textAlign: 'center',
                textAlignLast: 'center'
              }}
            >
              <option value="">—</option>
              {EQUIPES_SERVICO.map((equipe) => (
                <option key={equipe} value={equipe}>{equipe}</option>
              ))}
            </select>
          </label>
          <label>
            <span>INÍCIO</span>
            <input
              type="datetime-local"
              value={inicio}
              style={{ width: '172px', minWidth: 0 }}
              onChange={(e) => { setInicio(e.target.value); setHorarioPadraoInicio(e.target.value) }}
            />
          </label>
          <span className="mapa-forca-periodo-seta">→</span>
          <label>
            <span>TÉRMINO</span>
            <input
              type="datetime-local"
              value={fim}
              style={{ width: '172px', minWidth: 0 }}
              onChange={(e) => { setFim(e.target.value); setHorarioPadraoFim(e.target.value) }}
            />
          </label>
          <button type="button" className="mapa-forca-toolbar-btn mapa-forca-toolbar-save" onClick={salvarCabecalho} disabled={salvando}>
            {salvando ? 'SALVANDO...' : 'SALVAR HORÁRIO'}
          </button>

          <button
            type="button"
            className={`mapa-forca-toolbar-btn mapa-forca-toolbar-view ${modo === 'visualizacao' ? 'ativo' : ''}`}
            onClick={() => setModo(modo === 'visualizacao' ? 'montagem' : 'visualizacao')}
            style={{ marginLeft: 0 }}
          >
            {modo === 'visualizacao' ? 'MONTAR US' : 'VISUALIZAR MAPA FORÇA'}
          </button>
        </div>
      </section>

      {mensagemMapa && <div className="mapa-forca-mensagem">{mensagemMapa}</div>}

      {(
        <section className="mapa-forca-montagem">
          {!editor ? (
            <div className="mapa-forca-nova-us">
              <div><span>NOVA EQUIPE / US</span><h2>Escolha o tipo da unidade de serviço</h2><p>A tela permanece vazia até você escolher uma equipe. Depois de salvar, ela volta a ficar em branco.</p></div>
              <div className="mapa-forca-tipos-us">
                {TIPOS_US.map((tipo) => (
                  <button type="button" key={tipo.id} className={`mapa-forca-tipo-card mapa-forca-${tipo.tom}`} onClick={() => iniciarNovaUS(tipo.id)}>
                    <strong>{tipo.titulo}</strong><small>{tipo.subtitulo}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <section className={`mapa-forca-grupo mapa-forca-${editor.grupo.tom}`}>
              <header><div className="mapa-forca-grupo-identidade"><span className="mapa-forca-grupo-icon">▦</span><div><h2>{editor.grupo.titulo}</h2><p>{editor.grupo.subtitulo}</p></div></div>
                <div className="mapa-forca-grupo-meta"><button type="button" onClick={() => setEditor(null)}>Cancelar</button></div></header>
              <div className="mapa-forca-editor-unico">
                <UnidadeServico
                  grupoId={editor.grupo.id}
                  unidade={{
                    ...editor.unidade,
                    inicioUs: inicio,
                    fimUs: fim
                  }}
                  onPolicial={abrirPolicial} onRemoverPolicial={removerPolicial}
                  onAdicionarPolicial={adicionarPolicialExtra}
                  onViatura={abrirViatura} onRemoverViatura={() => atualizarEditor((u) => ({ ...u, viatura: null }))}
                  onVtrDiferenteEscala={(marcado) => atualizarEditor((u) => ({ ...u, vtrDiferenteEscala: marcado, viaturaPrevista: marcado ? u.viaturaPrevista : null, motivoTrocaVtr: marcado ? u.motivoTrocaVtr : '' }))}
                  onViaturaPrevista={abrirViaturaPrevista}
                  onRemoverViaturaPrevista={() => atualizarEditor((u) => ({ ...u, viaturaPrevista: null }))}
                  onMotivoTrocaVtr={(valor) => atualizarEditor((u) => ({ ...u, motivoTrocaVtr: valor }))}
                  onHorario={(campo, valor) => atualizarEditor((u) => ({ ...u, [campo]: valor }))}
                  onPrefixo={(valor) => atualizarEditor((u) => ({ ...u, prefixo: valor }))}
                  onLocalPop={(valor) => atualizarEditor((u) => ({ ...u, localPop: valor }))}
                  cautelasPorPolicial={cautelasEditorExibidasPorPolicial}
                  onPagarMaterial={abrirPagarMaterialMapa} />
                <div className="mapa-forca-editor-actions">
                  <button type="button" className="mapa-forca-secondary" onClick={() => setEditor(null)}>Cancelar</button>
                  <button type="button" className="mapa-forca-primary" onClick={salvarUS} disabled={salvando}>{salvando ? 'Salvando...' : editor.unidade.persistido ? 'Salvar alterações da US' : 'Salvar US'}</button>
                </div>
              </div>
            </section>
          )}
        </section>
      )}

      {salvas.length > 0 && (
        <section className="mapa-forca-montagem" style={{ marginBottom: '18px' }}>
          <div className="mapa-forca-nova-us">
            <div>
              <span>EQUIPES / US JÁ SALVAS</span>
              <h2>Gerenciar equipes do mapa atual</h2>
              <p>
                Selecione uma equipe para alterar policiais, viatura, horários, cautelas ou excluir a US.
                A visualização branca permanece separada no botão “Visualizar Mapa Força”.
              </p>
            </div>

            <div style={{ display: 'grid', gap: '14px', marginTop: '14px' }}>
              {salvas.map((item) => (
                <UnidadeCompacta
                  key={`salva-${item.unidade.id}`}
                  item={item}
                  materiaisPorPolicial={materiaisExibidosPorPolicial}
                  onEditar={editarUS}
                  onExcluir={excluirUS}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {selecao && <ModalSelecao selecao={selecao}
        itens={selecao.tipo === 'POLICIAL' ? policiais : viaturas.filter((v) => (selecao.tipo === 'VIATURA_PREVISTA' || v.situacao === 'DISPONIVEL') && v.tipo_veiculo === selecao.tipoVeiculo)}
        pesquisa={pesquisaSelecao} setPesquisa={setPesquisaSelecao}
        loading={selecao.tipo === 'POLICIAL' ? loadingPoliciais : loadingViaturas}
        erro={selecao.tipo === 'POLICIAL' ? erroPoliciais : erroViaturas}
        ocupados={selecao.tipo === 'POLICIAL' ? policiaisOcupados : (selecao.tipo === 'VIATURA_PREVISTA' ? new Set() : viaturasOcupadas)}
        onClose={() => setSelecao(null)}
        onSelecionar={selecao.tipo === 'POLICIAL' ? selecionarPolicial : (selecao.tipo === 'VIATURA_PREVISTA' ? selecionarViaturaPrevista : selecionarViatura)} />}

      {pagarMaterialMapa && (
        <PagarMaterialMapaForca
          open
          user={user}
          policial={pagarMaterialMapa.policial}
          funcao={pagarMaterialMapa.funcao}
          unidade={pagarMaterialMapa.unidade}
          itensPreparados={
            editor?.unidade
              ?.materiaisPreparados?.[
                pagarMaterialMapa.funcao
              ]?.itensPreparados ||
            []
          }
          itensReservadosMapa={
            Object.entries(
              editor?.unidade
                ?.materiaisPreparados ||
              {}
            )
              .filter(
                ([funcao]) =>
                  funcao !==
                  pagarMaterialMapa.funcao
              )
              .flatMap(
                ([, preparacao]) =>
                  preparacao
                    ?.itensPreparados ||
                  []
              )
          }
          onClose={() => setPagarMaterialMapa(null)}
          onConcluido={(resumo) => {
            void registrarPagamentoNoMapa(
              resumo
            )
          }}
        />
      )}

      <footer className="mapa-forca-footer"><div><strong>MAPA FORÇA • MONTAGEM POR US</strong><span>Uma equipe por vez. Cautelas e ativação operacional permanecem para a próxima etapa.</span></div><span>Mapa Força • SIGMO</span></footer>
    </main>
  )
}
