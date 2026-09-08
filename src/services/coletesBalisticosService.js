import { supabase } from './supabaseClient'

import {
  criarOuAtualizarPatrimonio,
  desativarPatrimonioPorReferencia
} from './patrimoniosService'

import {
  criarMovimentacaoCompleta
} from './movimentacaoEngine'

import {
  obterPerfilEfetivo
} from './permissionService'

import {
  COLETE_BALISTICO_ALERTA_VALIDADE_MESES,
  COLETE_BALISTICO_FABRICANTE_PADRAO,
  COLETE_BALISTICO_MODELAGENS,
  COLETE_BALISTICO_NIVEL_PADRAO,
  COLETE_BALISTICO_SEXOS,
  COLETE_BALISTICO_STATUS,
  COLETE_BALISTICO_TAMANHOS
} from '../constants/coletesBalisticosConstants'

const TABLE = 'sigmo_coletes_balisticos'
const TIPO_PATRIMONIAL = 'colete_balistico'

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function normalizarChave(valor) {
  return maiusculo(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function valorOuNull(valor) {
  const resultado = texto(valor)

  return resultado || null
}

function dataOuNull(valor) {
  const resultado = texto(valor)

  return resultado
    ? resultado.slice(0, 10)
    : null
}

function statusValido(valor) {
  return COLETE_BALISTICO_STATUS.includes(
    normalizarChave(valor)
  )
}

function normalizarColete(item = {}) {
  return {
    ...item,

    patrimonio:
      maiusculo(item.patrimonio),

    numero_serie:
      maiusculo(item.numero_serie),

    numero_lote:
      maiusculo(item.numero_lote),

    fabricante:
      maiusculo(item.fabricante) ||
      COLETE_BALISTICO_FABRICANTE_PADRAO,

    modelo:
      valorOuNull(
        maiusculo(item.modelo)
      ),

    nivel_protecao:
      maiusculo(item.nivel_protecao) ||
      COLETE_BALISTICO_NIVEL_PADRAO,

    sexo:
      normalizarChave(item.sexo),

    tamanho:
      normalizarChave(item.tamanho),

    modelagem:
      normalizarChave(item.modelagem),

    data_fabricacao:
      dataOuNull(item.data_fabricacao),

    validade:
      dataOuNull(item.validade),

    alerta_validade_meses:
      Math.max(
        1,
        Math.min(
          24,
          Number(
            item.alerta_validade_meses ??
            COLETE_BALISTICO_ALERTA_VALIDADE_MESES
          ) ||
          COLETE_BALISTICO_ALERTA_VALIDADE_MESES
        )
      ),

    data_entrada_carga:
      dataOuNull(item.data_entrada_carga),

    contrato_fornecimento:
      valorOuNull(
        maiusculo(
          item.contrato_fornecimento
        )
      ),

    status_operacional:
      normalizarChave(
        item.status_operacional
      ) || 'RESERVA',

    local_atual:
      texto(item.local_atual) ||
      'P4',

    carga_policial_id:
      item.carga_policial_id ||
      null,

    carga_policial_re:
      valorOuNull(
        maiusculo(
          item.carga_policial_re
        )
      ),

    carga_policial_nome:
      valorOuNull(
        maiusculo(
          item.carga_policial_nome
        )
      ),

    observacoes:
      valorOuNull(
        maiusculo(item.observacoes)
      ),

    foto_url:
      valorOuNull(item.foto_url),

    ativo:
      item.ativo !== false
  }
}

function prepararPayload(dados = {}) {
  const colete =
    normalizarColete(dados)

  if (!colete.patrimonio) {
    throw new Error(
      'Informe o número de patrimônio do colete.'
    )
  }

  if (!colete.numero_serie) {
    throw new Error(
      'Informe o número de série do colete.'
    )
  }

  if (!colete.numero_lote) {
    throw new Error(
      'Informe o número do lote do colete.'
    )
  }

  if (
    !COLETE_BALISTICO_SEXOS.some(
      (item) =>
        item.value === colete.sexo
    )
  ) {
    throw new Error(
      'Selecione o sexo/modelagem corporal do colete.'
    )
  }

  if (
    !COLETE_BALISTICO_TAMANHOS.includes(
      colete.tamanho
    )
  ) {
    throw new Error(
      'Selecione o tamanho do colete.'
    )
  }

  if (
    !COLETE_BALISTICO_MODELAGENS.some(
      (item) =>
        item.value ===
        colete.modelagem
    )
  ) {
    throw new Error(
      'Selecione a modelagem do colete.'
    )
  }

  if (!colete.validade) {
    throw new Error(
      'Informe a validade do colete.'
    )
  }

  if (
    !statusValido(
      colete.status_operacional
    )
  ) {
    throw new Error(
      'Status operacional do colete inválido.'
    )
  }

  return {
    patrimonio:
      colete.patrimonio,

    numero_serie:
      colete.numero_serie,

    numero_lote:
      colete.numero_lote,

    fabricante:
      colete.fabricante,

    modelo:
      colete.modelo,

    nivel_protecao:
      colete.nivel_protecao,

    sexo:
      colete.sexo,

    tamanho:
      colete.tamanho,

    modelagem:
      colete.modelagem,

    data_fabricacao:
      colete.data_fabricacao,

    validade:
      colete.validade,

    alerta_validade_meses:
      colete.alerta_validade_meses,

    data_entrada_carga:
      colete.data_entrada_carga,

    contrato_fornecimento:
      colete.contrato_fornecimento,

    status_operacional:
      colete.status_operacional,

    local_atual:
      colete.local_atual || 'P4',

    carga_policial_id:
      colete.carga_policial_id,

    carga_policial_re:
      colete.carga_policial_re,

    carga_policial_nome:
      colete.carga_policial_nome,

    observacoes:
      colete.observacoes,

    foto_url:
      colete.foto_url,

    ativo:
      colete.ativo
  }
}

function definirLocalPatrimonial(colete) {
  const status =
    normalizarChave(
      colete?.status_operacional
    )

  if (
    status === 'CARGA_INDIVIDUAL'
  ) {
    return 'CARGA INDIVIDUAL'
  }

  if (
    status ===
    'AGUARDANDO_RECEBIMENTO'
  ) {
    return 'AGUARDANDO RECEBIMENTO'
  }

  if (status === 'MANUTENCAO') {
    return 'MANUTENCAO'
  }

  if (status === 'TRANSFERIDO') {
    return colete?.local_atual ||
      'TRANSFERIDO'
  }

  if (status === 'BAIXADO') {
    return 'BAIXADO'
  }

  return colete?.local_atual ||
    'P4'
}

function aplicarEstadoPatrimonial(
  colete,
  patrimonio = null
) {
  const normalizado =
    normalizarColete(colete)

  if (!patrimonio) {
    return normalizado
  }

  const statusPatrimonial =
    normalizarChave(
      patrimonio.status
    )

  const localPatrimonial =
    texto(
      patrimonio.local_atual
    )

  const localChave =
    normalizarChave(
      localPatrimonial
    )

  let statusEfetivo =
    normalizado.status_operacional

  if (
    statusPatrimonial ===
      'CAUTELADO' ||
    statusPatrimonial ===
      'CARGA' ||
    statusPatrimonial ===
      'CARGA_INDIVIDUAL' ||
    localChave.includes(
      'CARGA_INDIVIDUAL'
    ) ||
    localChave.includes(
      'CARGA_PERMANENTE'
    )
  ) {
    statusEfetivo =
      'CARGA_INDIVIDUAL'
  } else if (
    statusPatrimonial ===
      'AGUARDANDO_RECEBIMENTO' ||
    localChave.includes(
      'AGUARDANDO_RECEBIMENTO'
    )
  ) {
    statusEfetivo =
      'AGUARDANDO_RECEBIMENTO'
  } else if (
    statusPatrimonial ===
      'MANUTENCAO' ||
    localChave.includes(
      'MANUTEN'
    )
  ) {
    statusEfetivo =
      'MANUTENCAO'
  } else if (
    statusPatrimonial ===
      'TRANSFERIDO'
  ) {
    statusEfetivo =
      'TRANSFERIDO'
  } else if (
    [
      'BAIXADO',
      'INATIVO'
    ].includes(
      statusPatrimonial
    ) ||
    patrimonio.ativo === false
  ) {
    statusEfetivo =
      'BAIXADO'
  } else if (
    statusPatrimonial ===
      'RESERVA' ||
    statusPatrimonial ===
      'ATIVO'
  ) {
    statusEfetivo =
      'RESERVA'
  }

  return {
    ...normalizado,

    status_operacional:
      statusEfetivo,

    local_atual:
      localPatrimonial ||
      normalizado.local_atual,

    carga_policial_id:
      patrimonio.responsavel_atual_id ||
      normalizado.carga_policial_id ||
      null,

    carga_policial_nome:
      patrimonio.responsavel_atual_nome ||
      normalizado.carga_policial_nome ||
      null,

    status_patrimonial:
      patrimonio.status ||
      null,

    local_patrimonial:
      patrimonio.local_atual ||
      null,

    ativo:
      normalizado.ativo !== false &&
      patrimonio.ativo !== false
  }
}

function dataLocalDoCampo(valor) {
  if (!valor) {
    return null
  }

  const data =
    new Date(
      `${String(valor).slice(0, 10)}T12:00:00`
    )

  if (
    Number.isNaN(
      data.getTime()
    )
  ) {
    return null
  }

  return data
}

function mesesAlertaDoColete(
  colete,
  mesesOverride = null
) {
  const valor =
    mesesOverride ??
    colete?.alerta_validade_meses ??
    COLETE_BALISTICO_ALERTA_VALIDADE_MESES

  return Math.max(
    1,
    Math.min(
      24,
      Math.trunc(
        Number(valor) ||
        COLETE_BALISTICO_ALERTA_VALIDADE_MESES
      )
    )
  )
}

function uuidOuNull(valor) {
  const textoValor =
    String(
      valor || ''
    )
      .trim()
      .toLowerCase()

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    textoValor
  )
    ? textoValor
    : null
}

export function obterSituacaoValidadeColete(
  colete,
  mesesOverride = null
) {
  const validade =
    dataLocalDoCampo(
      colete?.validade
    )

  if (!validade) {
    return 'SEM_VALIDADE'
  }

  const hoje =
    new Date()

  hoje.setHours(
    12,
    0,
    0,
    0
  )

  /*
   * Regra SIGMO:
   * - validade igual a hoje já é VENCIDO;
   * - ALERTA vale apenas para data futura dentro da janela;
   * - validade é um indicador paralelo ao status patrimonial.
   */
  if (
    validade.getTime() <=
    hoje.getTime()
  ) {
    return 'VENCIDO'
  }

  const inicioAlerta =
    new Date(
      validade.getTime()
    )

  inicioAlerta.setMonth(
    inicioAlerta.getMonth() -
    mesesAlertaDoColete(
      colete,
      mesesOverride
    )
  )

  if (
    hoje.getTime() >=
    inicioAlerta.getTime()
  ) {
    return 'ALERTA'
  }

  return 'OK'
}

export function coleteElegivelParaCarga(
  colete
) {
  return (
    colete?.ativo !== false &&
    colete?.descarga_pendente !== true &&
    normalizarChave(
      colete?.status_operacional
    ) === 'RESERVA' &&
    obterSituacaoValidadeColete(
      colete
    ) !== 'VENCIDO'
  )
}

export async function listarColetesBalisticos({
  filtros = {},
  pagina = 1,
  limite = 100,
  sortBy = 'patrimonio',
  sortDirection = 'asc'
} = {}) {
  const [
    {
      data: coletesData,
      error: coletesError
    },
    {
      data: patrimoniosData,
      error: patrimoniosError
    },
    {
      data: baixasPendentesData,
      error: baixasPendentesError
    }
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*'),

    supabase
      .from('sigmo_patrimonios')
      .select(
        'referencia_id, status, local_atual, ativo, responsavel_atual_id, responsavel_atual_nome'
      )
      .eq(
        'tipo',
        TIPO_PATRIMONIAL
      ),

    supabase
      .from('sigmo_patrimonio_baixas')
      .select(
        'id, referencia_id, status, motivo, observacoes, solicitada_em, solicitada_por_id, solicitada_por_nome'
      )
      .eq(
        'modulo',
        'COLETE_BALISTICO'
      )
      .eq(
        'status',
        'AGUARDANDO_APROVACAO'
      )
  ])

  if (coletesError) {
    throw coletesError
  }

  if (patrimoniosError) {
    throw patrimoniosError
  }

  if (baixasPendentesError) {
    throw baixasPendentesError
  }

  const baixaPendentePorReferencia =
    new Map(
      (baixasPendentesData || [])
        .filter(
          (item) =>
            item?.referencia_id
        )
        .map(
          (item) => [
            String(
              item.referencia_id
            ),
            item
          ]
        )
    )

  const patrimonioPorReferencia =
    new Map(
      (patrimoniosData || [])
        .filter(
          (item) =>
            item?.referencia_id
        )
        .map(
          (item) => [
            String(
              item.referencia_id
            ),
            item
          ]
        )
    )

  let lista =
    (coletesData || [])
      .map(
        (colete) => {
          const efetivo =
            aplicarEstadoPatrimonial(
              colete,
              patrimonioPorReferencia.get(
                String(colete.id)
              ) || null
            )

          const baixaPendente =
            baixaPendentePorReferencia.get(
              String(colete.id)
            ) || null

          return {
            ...efetivo,
            descarga_pendente:
              Boolean(
                baixaPendente
              ),
            descarga_solicitacao:
              baixaPendente
          }
        }
      )

  const pesquisa =
    normalizarChave(
      filtros.pesquisa
    )

  if (pesquisa) {
    lista = lista.filter(
      (colete) =>
        [
          colete.patrimonio,
          colete.numero_serie,
          colete.numero_lote,
          colete.fabricante,
          colete.modelo,
          colete.sexo,
          colete.tamanho,
          colete.modelagem,
          colete.carga_policial_nome,
          colete.carga_policial_re
        ].some(
          (valor) =>
            normalizarChave(
              valor
            ).includes(
              pesquisa
            )
        )
    )
  }

  for (
    const [
      campo,
      valor
    ] of [
      [
        'sexo',
        filtros.sexo
      ],
      [
        'tamanho',
        filtros.tamanho
      ],
      [
        'modelagem',
        filtros.modelagem
      ],
      [
        'status_operacional',
        filtros.status_operacional
      ]
    ]
  ) {
    const filtro =
      normalizarChave(
        valor
      )

    if (!filtro) {
      continue
    }

    lista = lista.filter(
      (colete) =>
        normalizarChave(
          colete[campo]
        ) === filtro
    )
  }

  if (
    filtros.ativo !== undefined &&
    filtros.ativo !== null &&
    filtros.ativo !== ''
  ) {
    const ativo =
      filtros.ativo === true ||
      filtros.ativo === 'true'

    lista = lista.filter(
      (colete) =>
        colete.ativo === ativo
    )
  }

  const direcao =
    sortDirection === 'desc'
      ? -1
      : 1

  lista.sort(
    (a, b) =>
      String(
        a?.[sortBy] || ''
      ).localeCompare(
        String(
          b?.[sortBy] || ''
        ),
        'pt-BR',
        {
          numeric: true,
          sensitivity: 'base'
        }
      ) * direcao
  )

  const total =
    lista.length

  const paginaValida =
    Math.max(
      1,
      Number(pagina) || 1
    )

  const limiteValido =
    Math.max(
      1,
      Number(limite) || 100
    )

  const inicio =
    (
      paginaValida - 1
    ) * limiteValido

  return {
    data:
      lista.slice(
        inicio,
        inicio +
          limiteValido
      ),

    total
  }
}

export async function obterResumoColetesBalisticos() {
  const {
    data
  } =
    await listarColetesBalisticos({
      filtros: {
        ativo: true
      },
      pagina: 1,
      limite: 10000
    })

  const resumo = {
    total: 0,
    reserva: 0,
    cargaIndividual: 0,
    aguardandoRecebimento: 0,
    manutencao: 0,
    transferidos: 0,
    vencendo: 0,
    vencidos: 0
  }

  for (const colete of data) {
    resumo.total += 1

    const status =
      normalizarChave(
        colete.status_operacional
      )

    if (status === 'RESERVA') {
      resumo.reserva += 1
    }

    if (
      status ===
      'CARGA_INDIVIDUAL'
    ) {
      resumo.cargaIndividual += 1
    }

    if (
      status ===
      'AGUARDANDO_RECEBIMENTO'
    ) {
      resumo.aguardandoRecebimento += 1
    }

    if (
      status === 'MANUTENCAO'
    ) {
      resumo.manutencao += 1
    }

    if (
      status === 'TRANSFERIDO'
    ) {
      resumo.transferidos += 1
    }

    /*
     * Validade é indicador paralelo.
     * O mesmo colete pode, por exemplo, somar em CARGA INDIVIDUAL
     * e também em VENCIDOS, sem aumentar o TOTAL CONTROLADO.
     */
    const situacao =
      obterSituacaoValidadeColete(
        colete
      )

    if (
      situacao === 'VENCIDO'
    ) {
      resumo.vencidos += 1
    } else if (
      situacao === 'ALERTA'
    ) {
      resumo.vencendo += 1
    }
  }

  return resumo
}

export async function buscarColeteBalisticoPorId(
  id
) {
  if (!id) {
    throw new Error(
      'Colete balístico não informado.'
    )
  }

  const {
    data
  } =
    await listarColetesBalisticos({
      pagina: 1,
      limite: 10000
    })

  return (
    data.find(
      (item) =>
        String(item.id) ===
        String(id)
    ) ||
    null
  )
}

export async function cadastrarColeteBalistico({
  dados,
  user = null
}) {
  const payload =
    prepararPayload({
      ...dados,

      status_operacional:
        'RESERVA',

      local_atual:
        'P4',

      carga_policial_id:
        null,

      carga_policial_re:
        null,

      carga_policial_nome:
        null,

      ativo:
        true
    })

  const {
    data,
    error
  } =
    await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()

  if (error) {
    throw error
  }

  const normalizado =
    normalizarColete(data)

  try {
    await criarOuAtualizarPatrimonio({
      tipo:
        TIPO_PATRIMONIAL,

      referencia_id:
        normalizado.id,

      dados:
        normalizado,

      user,

      local_atual:
        'P4',

      companhia_atual:
        '27º BPM/M - 5ª CIA'
    })
  } catch (errorPatrimonio) {
    await supabase
      .from(TABLE)
      .delete()
      .eq(
        'id',
        normalizado.id
      )

    throw errorPatrimonio
  }

  return normalizado
}

export async function atualizarColeteBalistico(
  id,
  dados,
  user = null
) {
  if (!id) {
    throw new Error(
      'Colete balístico não informado.'
    )
  }

  const [
    {
      data: anterior,
      error: erroBusca
    },
    {
      data: patrimonioAtual,
      error: erroPatrimonio
    }
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single(),

    supabase
      .from('sigmo_patrimonios')
      .select(
        'id, referencia_id, status, local_atual, ativo, responsavel_atual_id, responsavel_atual_nome, dados'
      )
      .eq(
        'tipo',
        TIPO_PATRIMONIAL
      )
      .eq(
        'referencia_id',
        id
      )
      .maybeSingle()
  ])

  if (erroBusca) {
    throw erroBusca
  }

  if (erroPatrimonio) {
    throw erroPatrimonio
  }

  /*
   * O estado operacional vigente vem do patrimônio central.
   * Alterar dados cadastrais (validade, lote, observação etc.)
   * jamais pode devolver o colete para o P4, retirar de carga,
   * trocar responsável ou alterar a movimentação física atual.
   */
  const atual =
    aplicarEstadoPatrimonial(
      anterior,
      patrimonioAtual
    )

  const payload =
    prepararPayload({
      ...atual,
      ...dados,

      status_operacional:
        atual.status_operacional,

      local_atual:
        atual.local_atual,

      carga_policial_id:
        atual.carga_policial_id,

      carga_policial_re:
        atual.carga_policial_re,

      carga_policial_nome:
        atual.carga_policial_nome,

      ativo:
        atual.ativo
    })

  const {
    data,
    error
  } =
    await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single()

  if (error) {
    throw error
  }

  const normalizado =
    normalizarColete(data)

  try {
    if (patrimonioAtual?.id) {
      /*
       * Atualizamos apenas o snapshot cadastral do patrimônio.
       * STATUS, LOCAL e RESPONSÁVEL permanecem exatamente como
       * estavam antes da edição.
       */
      const dadosPatrimoniaisAtuais =
        patrimonioAtual?.dados &&
        typeof patrimonioAtual.dados ===
          'object'
          ? patrimonioAtual.dados
          : {}

      const {
        error:
          erroAtualizarDadosPatrimoniais
      } = await supabase
        .from('sigmo_patrimonios')
        .update({
          dados: {
            ...dadosPatrimoniaisAtuais,
            ...normalizado,

            status:
              patrimonioAtual.status,

            status_operacional:
              normalizado.status_operacional,

            local_atual:
              patrimonioAtual.local_atual,

            carga_policial_id:
              normalizado.carga_policial_id,

            carga_policial_re:
              normalizado.carga_policial_re,

            carga_policial_nome:
              normalizado.carga_policial_nome
          },
          updated_at:
            new Date()
              .toISOString()
        })
        .eq(
          'id',
          patrimonioAtual.id
        )

      if (
        erroAtualizarDadosPatrimoniais
      ) {
        throw erroAtualizarDadosPatrimoniais
      }
    } else {
      /*
       * Compatibilidade para cadastro antigo que ainda não possua
       * espelho no patrimônio central.
       */
      await criarOuAtualizarPatrimonio({
        tipo:
          TIPO_PATRIMONIAL,

        referencia_id:
          normalizado.id,

        dados:
          normalizado,

        user,

        local_atual:
          definirLocalPatrimonial(
            normalizado
          ),

        companhia_atual:
          '27º BPM/M - 5ª CIA'
      })
    }
  } catch (errorPatrimonio) {
    await supabase
      .from(TABLE)
      .update(anterior)
      .eq('id', id)

    throw errorPatrimonio
  }

  return normalizado
}

export async function desativarColeteBalistico(
  id,
  user = null,
  motivo = ''
) {
  if (!id) {
    throw new Error(
      'Colete balístico não informado.'
    )
  }

  const perfil =
    normalizarChave(
      obterPerfilEfetivo(user)
    )

  if (perfil !== 'P4') {
    throw new Error(
      'Somente o P4 pode solicitar a descarga de colete balístico.'
    )
  }

  const justificativa =
    maiusculo(motivo)

  if (!justificativa) {
    throw new Error(
      'Informe a justificativa da descarga.'
    )
  }

  const [
    {
      data: coleteAtual,
      error: coleteError
    },
    {
      data: patrimonioAtual,
      error: patrimonioError
    },
    {
      data: solicitacaoExistente,
      error: solicitacaoError
    }
  ] = await Promise.all([
    supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .eq('ativo', true)
      .maybeSingle(),

    supabase
      .from('sigmo_patrimonios')
      .select(
        'id, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados, ativo'
      )
      .eq(
        'tipo',
        TIPO_PATRIMONIAL
      )
      .eq(
        'referencia_id',
        id
      )
      .maybeSingle(),

    supabase
      .from('sigmo_patrimonio_baixas')
      .select(
        'id, status'
      )
      .eq(
        'modulo',
        'COLETE_BALISTICO'
      )
      .eq(
        'referencia_id',
        id
      )
      .eq(
        'status',
        'AGUARDANDO_APROVACAO'
      )
      .maybeSingle()
  ])

  if (coleteError) {
    throw coleteError
  }

  if (patrimonioError) {
    throw patrimonioError
  }

  if (solicitacaoError) {
    throw solicitacaoError
  }

  if (!coleteAtual) {
    throw new Error(
      'O colete não foi encontrado ou já está inativo.'
    )
  }

  if (solicitacaoExistente?.id) {
    throw new Error(
      'Este colete já possui uma solicitação de descarga aguardando aprovação do Comandante da Cia.'
    )
  }

  const estadoAtual =
    aplicarEstadoPatrimonial(
      coleteAtual,
      patrimonioAtual
    )

  const statusAtual =
    normalizarChave(
      estadoAtual.status_operacional
    )

  const localAtual =
    normalizarChave(
      estadoAtual.local_atual
    )

  if (
    statusAtual !== 'RESERVA' ||
    ![
      'P4',
      'COFRE_DO_P4',
      'DEPOSITO_DO_P4'
    ].includes(localAtual)
  ) {
    throw new Error(
      'Somente coletes em RESERVA no COFRE DO P4 podem ter descarga solicitada. Se estiver em carga, devolva o colete ao P4 primeiro.'
    )
  }

  const solicitanteId =
    uuidOuNull(
      user?.id ||
      user?.user_id ||
      user?.usuario_id ||
      null
    )

  const solicitanteNome =
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.email ||
    'P4'

  const {
    data: solicitacao,
    error
  } = await supabase
    .from(
      'sigmo_patrimonio_baixas'
    )
    .insert({
      modulo:
        'COLETE_BALISTICO',

      referencia_id:
        id,

      patrimonio:
        coleteAtual.patrimonio ||
        null,

      numero_serie:
        coleteAtual.numero_serie ||
        null,

      status:
        'AGUARDANDO_APROVACAO',

      motivo:
        justificativa,

      observacoes:
        justificativa,

      status_anterior:
        statusAtual ||
        'RESERVA',

      local_anterior:
        estadoAtual.local_atual ||
        'COFRE DO P4',

      solicitada_por_id:
        solicitanteId,

      solicitada_por_nome:
        solicitanteNome
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return {
    ...solicitacao,
    descarga_pendente:
      true,
    colete:
      normalizarColete(
        coleteAtual
      )
  }
}

export async function listarDescargasColetesPendentes() {
  const {
    data,
    error
  } = await supabase
    .from(
      'sigmo_patrimonio_baixas'
    )
    .select('*')
    .eq(
      'modulo',
      'COLETE_BALISTICO'
    )
    .eq(
      'status',
      'AGUARDANDO_APROVACAO'
    )
    .order(
      'solicitada_em',
      {
        ascending:
          false
      }
    )

  if (error) {
    throw error
  }

  return data || []
}

export async function decidirDescargaColete({
  solicitacao,
  decisao,
  observacoes = '',
  user = null
}) {
  if (!solicitacao?.id) {
    throw new Error(
      'Solicitação de descarga não informada.'
    )
  }

  const perfil =
    normalizarChave(
      obterPerfilEfetivo(user)
    )

  const ehComandante =
    perfil ===
      'ADMINISTRADOR' ||
    perfil ===
      'COMANDANTE' ||
    perfil ===
      'COMANDANTE_DE_CIA' ||
    perfil ===
      'COMANDANTE_DA_CIA' ||
    perfil.includes(
      'COMANDANTE'
    )

  if (!ehComandante) {
    throw new Error(
      'Somente o Comandante da Cia pode decidir a solicitação de descarga.'
    )
  }

  const acao =
    normalizarChave(
      decisao
    )

  if (
    ![
      'APROVAR',
      'REPROVAR',
      'DILIGENCIA'
    ].includes(
      acao
    )
  ) {
    throw new Error(
      'Decisão de descarga inválida.'
    )
  }

  const observacaoDecisao =
    maiusculo(
      observacoes
    )

  if (
    acao !==
      'APROVAR' &&
    !observacaoDecisao
  ) {
    throw new Error(
      'Informe a justificativa da decisão.'
    )
  }

  const [
    {
      data: baixaAtual,
      error: baixaError
    },
    {
      data: coleteAtual,
      error: coleteError
    },
    {
      data: patrimonioAtual,
      error: patrimonioError
    }
  ] = await Promise.all([
    supabase
      .from(
        'sigmo_patrimonio_baixas'
      )
      .select('*')
      .eq(
        'id',
        solicitacao.id
      )
      .eq(
        'status',
        'AGUARDANDO_APROVACAO'
      )
      .maybeSingle(),

    supabase
      .from(TABLE)
      .select('*')
      .eq(
        'id',
        solicitacao.referencia_id
      )
      .maybeSingle(),

    supabase
      .from(
        'sigmo_patrimonios'
      )
      .select(
        'id, status, local_atual, responsavel_atual_id, responsavel_atual_nome, dados, ativo'
      )
      .eq(
        'tipo',
        TIPO_PATRIMONIAL
      )
      .eq(
        'referencia_id',
        solicitacao.referencia_id
      )
      .maybeSingle()
  ])

  if (baixaError) {
    throw baixaError
  }

  if (coleteError) {
    throw coleteError
  }

  if (patrimonioError) {
    throw patrimonioError
  }

  if (!baixaAtual) {
    throw new Error(
      'A solicitação não está mais aguardando aprovação.'
    )
  }

  if (!coleteAtual) {
    throw new Error(
      'Colete da solicitação não localizado.'
    )
  }

  if (acao === 'APROVAR') {
    const estadoAtual =
      aplicarEstadoPatrimonial(
        coleteAtual,
        patrimonioAtual
      )

    const statusAtual =
      normalizarChave(
        estadoAtual.status_operacional
      )

    const localAtual =
      normalizarChave(
        estadoAtual.local_atual
      )

    if (
      statusAtual !== 'RESERVA' ||
      ![
        'P4',
        'COFRE_DO_P4',
        'DEPOSITO_DO_P4'
      ].includes(
        localAtual
      )
    ) {
      throw new Error(
        'A descarga não pode ser aprovada porque o colete não está mais em RESERVA no COFRE DO P4.'
      )
    }
  }

  const novoStatusSolicitacao =
    acao === 'APROVAR'
      ? 'APROVADA'
      : acao === 'REPROVAR'
      ? 'REPROVADA'
      : 'DILIGENCIA'

  const decisorId =
    uuidOuNull(
      user?.id ||
      user?.user_id ||
      user?.usuario_id ||
      null
    )

  const decisorNome =
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.email ||
    'COMANDANTE DA CIA'

  const agora =
    new Date()
      .toISOString()

  const {
    data: baixaDecidida,
    error: decisaoError
  } = await supabase
    .from(
      'sigmo_patrimonio_baixas'
    )
    .update({
      status:
        novoStatusSolicitacao,

      decisao_observacoes:
        observacaoDecisao ||
        null,

      decidida_em:
        agora,

      decidida_por_id:
        decisorId,

      decidida_por_nome:
        decisorNome
    })
    .eq(
      'id',
      baixaAtual.id
    )
    .eq(
      'status',
      'AGUARDANDO_APROVACAO'
    )
    .select()
    .single()

  if (decisaoError) {
    throw decisaoError
  }

  if (acao !== 'APROVAR') {
    return baixaDecidida
  }

  const observacoesColete =
    [
      texto(
        coleteAtual.observacoes
      ),
      `DESCARGA APROVADA PELO CMT DE CIA: ${baixaAtual.motivo}`
    ]
      .filter(Boolean)
      .join(' | ')

  const {
    data: coleteBaixado,
    error: baixaColeteError
  } = await supabase
    .from(TABLE)
    .update({
      status_operacional:
        'BAIXADO',

      local_atual:
        'DESCARGA',

      carga_policial_id:
        null,

      carga_policial_re:
        null,

      carga_policial_nome:
        null,

      observacoes:
        observacoesColete,

      ativo:
        false,

      updated_at:
        agora
    })
    .eq(
      'id',
      coleteAtual.id
    )
    .select()
    .single()

  if (baixaColeteError) {
    throw baixaColeteError
  }

  await desativarPatrimonioPorReferencia({
    tipo:
      TIPO_PATRIMONIAL,

    referencia_id:
      coleteAtual.id,

    user,

    motivo:
      `DESCARGA DE COLETE BALÍSTICO APROVADA PELO CMT DE CIA: ${baixaAtual.motivo}`
  })

  if (patrimonioAtual?.id) {
    const dadosAtuais =
      patrimonioAtual?.dados &&
      typeof patrimonioAtual.dados ===
        'object'
        ? patrimonioAtual.dados
        : {}

    const {
      error:
        patrimonioUpdateError
    } = await supabase
      .from(
        'sigmo_patrimonios'
      )
      .update({
        local_atual:
          'DESCARGA',

        responsavel_atual_id:
          null,

        responsavel_atual_nome:
          null,

        dados: {
          ...dadosAtuais,
          ...normalizarColete(
            coleteBaixado
          ),
          status:
            'INATIVO',
          status_operacional:
            'BAIXADO',
          local_atual:
            'DESCARGA',
          carga_policial_id:
            null,
          carga_policial_re:
            null,
          carga_policial_nome:
            null,
          motivo_descarga:
            baixaAtual.motivo,
          descarga_solicitada_em:
            baixaAtual.solicitada_em ||
            null,
          descarga_solicitada_por_nome:
            baixaAtual.solicitada_por_nome ||
            null,
          descarga_aprovada_em:
            agora,
          descarga_aprovada_por_nome:
            decisorNome
        },

        updated_at:
          agora
      })
      .eq(
        'id',
        patrimonioAtual.id
      )

    if (
      patrimonioUpdateError
    ) {
      throw patrimonioUpdateError
    }
  }

  return {
    solicitacao:
      baixaDecidida,
    colete:
      normalizarColete(
        coleteBaixado
      )
  }
}

export async function pagarColeteCargaIndividual({
  colete,
  policial,
  observacoes = '',
  user
}) {
  const perfil =
    normalizarChave(
      obterPerfilEfetivo(user)
    )

  if (perfil !== 'P4') {
    throw new Error(
      'Somente o P4 pode pagar colete balístico como carga individual.'
    )
  }

  const coleteId =
    colete?.id || null

  if (!coleteId) {
    throw new Error(
      'Selecione o colete balístico.'
    )
  }

  if (!policial?.id) {
    throw new Error(
      'Informe um policial válido para receber a carga.'
    )
  }

  const {
    data: coleteAtual,
    error: coleteError
  } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', coleteId)
    .eq('ativo', true)
    .maybeSingle()

  if (coleteError) {
    throw coleteError
  }

  if (!coleteAtual) {
    throw new Error(
      'O colete selecionado não foi encontrado ou está inativo.'
    )
  }

  const coleteNormalizado =
    normalizarColete(
      coleteAtual
    )

  if (
    normalizarChave(
      coleteNormalizado.status_operacional
    ) !== 'RESERVA'
  ) {
    throw new Error(
      'Somente coletes em reserva podem ser pagos como carga individual.'
    )
  }

  if (
    obterSituacaoValidadeColete(
      coleteNormalizado
    ) === 'VENCIDO'
  ) {
    throw new Error(
      'Este colete está vencido e não pode receber nova carga individual.'
    )
  }

  const {
    data: patrimonio,
    error: patrimonioError
  } = await supabase
    .from('sigmo_patrimonios')
    .select(
      'id, tipo, referencia_id, status, local_atual, ativo'
    )
    .eq(
      'tipo',
      TIPO_PATRIMONIAL
    )
    .eq(
      'referencia_id',
      coleteId
    )
    .eq(
      'ativo',
      true
    )
    .maybeSingle()

  if (patrimonioError) {
    throw patrimonioError
  }

  if (!patrimonio?.id) {
    throw new Error(
      'O registro patrimonial deste colete não foi encontrado. Sincronize o patrimônio antes de pagar a carga.'
    )
  }

  const statusPatrimonial =
    normalizarChave(
      patrimonio.status
    )

  const localPatrimonial =
    normalizarChave(
      patrimonio.local_atual
    )

  if (
    ![
      'RESERVA',
      'ATIVO'
    ].includes(
      statusPatrimonial
    )
  ) {
    throw new Error(
      'O estado patrimonial deste colete não permite nova carga.'
    )
  }

  if (
    localPatrimonial &&
    ![
      'P4',
      'DEPOSITO_DO_P4',
      'COFRE_DO_P4'
    ].includes(
      localPatrimonial
    )
  ) {
    throw new Error(
      'Este colete não está disponível no P4.'
    )
  }

  const resultado =
    await criarMovimentacaoCompleta({
      tipo: 'ENTREGA',
      origemLocal:
        'COFRE DO P4',
      destinoLocal:
        'CARGA PERMANENTE',
      solicitante:
        user,
      recebedor:
        policial,
      observacoes:
        texto(observacoes)
          .toUpperCase(),
      itens: [
        {
          patrimonio_id:
            patrimonio.id,
          quantidade: 1,
          observacao:
            JSON.stringify({
              tipo_registro:
                'COLETE_BALISTICO_CARGA',
              colete_id:
                coleteId,
              patrimonio:
                coleteNormalizado.patrimonio,
              numero_serie:
                coleteNormalizado.numero_serie,
              numero_lote:
                coleteNormalizado.numero_lote,
              sexo:
                coleteNormalizado.sexo,
              tamanho:
                coleteNormalizado.tamanho,
              modelagem:
                coleteNormalizado.modelagem
            })
        }
      ],
      aprovarAutomaticamente:
        false
    })

  return {
    movimentacao:
      resultado,
    colete:
      coleteNormalizado,
    policial
  }
}


export async function sincronizarColetesBalisticosComPatrimonios(
  user = null
) {
  const {
    data,
    error
  } =
    await supabase
      .from(TABLE)
      .select('*')

  if (error) {
    throw error
  }

  const lista =
    (data || []).map(
      normalizarColete
    )

  for (const colete of lista) {
    if (colete.ativo === false) {
      continue
    }

    await criarOuAtualizarPatrimonio({
      tipo:
        TIPO_PATRIMONIAL,

      referencia_id:
        colete.id,

      dados:
        colete,

      user,

      local_atual:
        definirLocalPatrimonial(
          colete
        ),

      companhia_atual:
        '27º BPM/M - 5ª CIA'
    })
  }

  return lista.length
}
