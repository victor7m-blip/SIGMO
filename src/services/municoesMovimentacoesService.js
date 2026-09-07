import { supabase } from './supabaseClient'
import { loadSessionToken } from './authService'

const TABLE_MUNICOES = 'sigmo_municoes'
const TABLE_LOTES = 'sigmo_municoes_lotes'
const TABLE_CAUTELAS = 'sigmo_municoes_cautelas'
const TABLE_MOVIMENTACOES = 'sigmo_municoes_movimentacoes'

export const STATUS_CAUTELA_MUNICAO = {
  EM_SERVICO: 'EM_SERVICO',
  DEVOLVIDA: 'DEVOLVIDA',
  CONSUMIDA: 'CONSUMIDA',
  ENCERRADA: 'ENCERRADA',
  CANCELADA: 'CANCELADA'
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function numeroInteiro(valor) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return 0
  }

  return Math.max(0, Math.trunc(numero))
}

function somenteNumeros(valor) {
  return texto(valor).replace(/\D/g, '')
}

function normalizarRe(valor) {
  return somenteNumeros(valor).slice(0, 6)
}

function nomeUsuario(user) {
  return (
    user?.nome ||
    user?.nome_guerra ||
    user?.nome_completo ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function nomePolicial(policial) {
  return (
    policial?.nome_guerra ||
    policial?.nome ||
    policial?.nome_completo ||
    null
  )
}

function idPolicial(policial) {
  return (
    policial?.id ||
    policial?.policial_id ||
    null
  )
}

function rePolicial(policial) {
  return (
    policial?.re ||
    policial?.policial_re ||
    null
  )
}

async function buscarMunicao({
  municaoId = null,
  calibre = ''
} = {}) {
  let query = supabase
    .from(TABLE_MUNICOES)
    .select('*')
    .eq('ativo', true)

  if (municaoId) {
    query = query.eq('id', municaoId)
  } else if (texto(calibre)) {
    query = query.ilike(
      'calibre',
      maiusculo(calibre)
    )
  } else {
    throw new Error(
      'Informe o calibre da munição.'
    )
  }

  const { data, error } =
    await query.maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      'Calibre de munição não localizado.'
    )
  }

  return data
}

async function listarLotesDisponiveis({
  municaoId,
  campoSaldo
}) {
  let query = supabase
    .from(TABLE_LOTES)
    .select('*')
    .eq('municao_id', municaoId)
    .eq('ativo', true)
    .gt(campoSaldo, 0)

  /*
   * O lote é escolhido internamente.
   * Prioriza validade mais próxima e, depois,
   * os lotes cadastrados há mais tempo.
   */
  query = query
    .order('validade', {
      ascending: true,
      nullsFirst: false
    })
    .order('criado_em', {
      ascending: true
    })

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}

async function registrarHistorico({
  municaoId,
  loteId = null,
  cautelaId = null,
  movimentacaoPrincipalId = null,
  tipoMovimentacao,
  origem = null,
  destino = null,
  quantidade,
  policial = null,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade da movimentação deve ser maior que zero.'
    )
  }

  const payload = {
    municao_id:
      municaoId,

    lote_id:
      loteId,

    cautela_id:
      cautelaId,

    movimentacao_principal_id:
      movimentacaoPrincipalId,

    tipo_movimentacao:
      maiusculo(tipoMovimentacao),

    origem:
      origem ? maiusculo(origem) : null,

    destino:
      destino ? maiusculo(destino) : null,

    quantidade:
      valor,

    policial_id:
      idPolicial(policial),

    policial_re:
      rePolicial(policial),

    policial_nome:
      nomePolicial(policial),

    documento:
      texto(documento)
        ? maiusculo(documento)
        : null,

    observacoes:
      texto(observacoes)
        ? maiusculo(observacoes)
        : null,

    registrado_por_id:
      user?.id || null,

    registrado_por_nome:
      nomeUsuario(user)
  }

  const { data, error } = await supabase
    .from(TABLE_MOVIMENTACOES)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return data
}

async function atualizarSaldoLote({
  lote,
  campoOrigem,
  campoDestino = null,
  quantidade
}) {
  const valor =
    numeroInteiro(quantidade)

  const saldoOrigem =
    numeroInteiro(
      lote?.[campoOrigem]
    )

  if (valor <= 0) {
    throw new Error(
      'A quantidade deve ser maior que zero.'
    )
  }

  if (valor > saldoOrigem) {
    throw new Error(
      'O lote não possui saldo suficiente para esta movimentação.'
    )
  }

  const payload = {
    [campoOrigem]:
      saldoOrigem - valor
  }

  if (campoDestino) {
    payload[campoDestino] =
      numeroInteiro(
        lote?.[campoDestino]
      ) + valor
  }

  const { data, error } = await supabase
    .from(TABLE_LOTES)
    .update(payload)
    .eq('id', lote.id)
    /*
     * Controle otimista: se outro operador alterar
     * o saldo entre leitura e gravação, a operação
     * não deve consumir um saldo antigo.
     */
    .eq(
      campoOrigem,
      saldoOrigem
    )
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      'O estoque foi alterado por outra operação. Atualize a tela e tente novamente.'
    )
  }

  return data
}

async function restaurarSaldoLote({
  loteId,
  valores
}) {
  try {
    await supabase
      .from(TABLE_LOTES)
      .update(valores)
      .eq('id', loteId)
  } catch (error) {
    console.error(
      'Falha ao restaurar saldo de lote de munição:',
      error
    )
  }
}

async function apagarRegistro({
  tabela,
  id
}) {
  if (!id) return

  try {
    await supabase
      .from(tabela)
      .delete()
      .eq('id', id)
  } catch (error) {
    console.error(
      `Falha ao remover registro de rollback em ${tabela}:`,
      error
    )
  }
}

async function movimentarEntreEstoques({
  municaoId = null,
  calibre = '',
  quantidade,
  campoOrigem,
  campoDestino,
  origem,
  destino,
  tipoMovimentacao,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  const municao =
    await buscarMunicao({
      municaoId,
      calibre
    })

  const lotes =
    await listarLotesDisponiveis({
      municaoId: municao.id,
      campoSaldo: campoOrigem
    })

  const totalDisponivel =
    lotes.reduce(
      (total, lote) =>
        total +
        numeroInteiro(
          lote?.[campoOrigem]
        ),
      0
    )

  if (valor > totalDisponivel) {
    throw new Error(
      `Existem apenas ${totalDisponivel} unidade(s) de ${maiusculo(municao.calibre)} disponíveis em ${origem}.`
    )
  }

  const processados = []
  let restante = valor

  try {
    for (const lote of lotes) {
      if (restante <= 0) {
        break
      }

      const saldo =
        numeroInteiro(
          lote?.[campoOrigem]
        )

      if (saldo <= 0) {
        continue
      }

      const quantidadeLote =
        Math.min(
          saldo,
          restante
        )

      const loteAtualizado =
        await atualizarSaldoLote({
          lote,
          campoOrigem,
          campoDestino,
          quantidade:
            quantidadeLote
        })

      const historico =
        await registrarHistorico({
          municaoId:
            municao.id,

          loteId:
            lote.id,

          tipoMovimentacao,

          origem,
          destino,

          quantidade:
            quantidadeLote,

          documento,
          observacoes,
          user
        })

      processados.push({
        lote,
        loteAtualizado,
        historico,
        quantidade:
          quantidadeLote
      })

      restante -=
        quantidadeLote
    }

    if (restante > 0) {
      throw new Error(
        'Não foi possível completar a movimentação com os lotes disponíveis.'
      )
    }

    return {
      municao,
      quantidade:
        valor,
      lotes:
        processados.map(
          (item) => ({
            lote_id:
              item.lote.id,
            numero_lote:
              item.lote.numero_lote,
            quantidade:
              item.quantidade
          })
        )
    }
  } catch (error) {
    for (
      const item of
      [...processados].reverse()
    ) {
      await apagarRegistro({
        tabela:
          TABLE_MOVIMENTACOES,
        id:
          item.historico?.id
      })

      await restaurarSaldoLote({
        loteId:
          item.lote.id,
        valores: {
          [campoOrigem]:
            item.lote[campoOrigem],
          [campoDestino]:
            item.lote[campoDestino]
        }
      })
    }

    throw error
  }
}

export async function transferirMunicaoP4ParaSvdd({
  municaoId = null,
  calibre = '',
  quantidade,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  /*
   * Mantém compatibilidade com chamadas antigas
   * que eventualmente informem apenas o calibre.
   * A tela atual de Munições já envia municaoId.
   */
  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_transferir_p4_svdd',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_quantidade:
        valor,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function transferirMunicaoSvddParaP4({
  municaoId = null,
  calibre = '',
  quantidade,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  /*
   * Mantém compatibilidade com chamadas antigas
   * que eventualmente informem apenas o calibre.
   * A tela atual de Munições já envia municaoId.
   */
  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_transferir_svdd_p4',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_quantidade:
        valor,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}


export async function transferirMunicaoExterna({
  municaoId = null,
  calibre = '',
  quantidade,
  destinoTipo,
  destinoNome,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'Informe uma quantidade maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const tipoDestino =
    maiusculo(destinoTipo)

  const destinosPermitidos = [
    'CARGA_PERMANENTE',
    'OUTRAS_CIAS',
    'BATALHAO',
    'OUTRA_UNIDADE'
  ]

  if (
    !destinosPermitidos.includes(
      tipoDestino
    )
  ) {
    throw new Error(
      'Tipo de destino externo inválido.'
    )
  }

  const nomeDestino =
    maiusculo(destinoNome)

  if (!nomeDestino) {
    throw new Error(
      'Informe a unidade ou destino da transferência.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_transferir_externa',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_quantidade:
        valor,

      p_destino_tipo:
        tipoDestino,

      p_destino_nome:
        nomeDestino,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarTransferenciasExternasPendentes() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_transferencias_externas_pendentes',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}


export async function aprovarTransferenciaMunicaoCmt(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_aprovar_transferencia_cmt',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}



export async function listarCargasPermanentesPendentesPolicial() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_cargas_pendentes_policial',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

export async function receberCargaPermanenteMunicao(
  transferenciaId
) {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  if (!transferenciaId) {
    throw new Error(
      'Transferência de munição não informada.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_carga_permanente',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarTransferenciasOutrosRecebidos() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_outros_recebidos',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

export async function confirmarTransferenciaExterna(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Transferência não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_confirmar_transferencia_externa',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function cautelarMunicaoParaPolicial({
  municaoId = null,
  calibre = '',
  policial,
  quantidade,
  devolucaoPrevista = null,
  movimentacaoPrincipalId = null,
  documento = null,
  observacoes = null,
  user = null
}) {
  if (!policial) {
    throw new Error(
      'O policial responsável pela cautela não foi informado.'
    )
  }

  const policialId =
    idPolicial(policial)

  if (!policialId) {
    throw new Error(
      'O policial responsável pela cautela não possui identificação válida.'
    )
  }

  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade da cautela deve ser maior que zero.'
    )
  }

  let idMunicao =
    municaoId

  if (
    !idMunicao &&
    texto(calibre)
  ) {
    const municao =
      await buscarMunicao({
        calibre
      })

    idMunicao =
      municao.id
  }

  if (!idMunicao) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_criar_cautela_pendente',
    {
      p_token:
        token,

      p_municao_id:
        idMunicao,

      p_policial_id:
        policialId,

      p_quantidade:
        valor,

      p_devolucao_prevista:
        devolucaoPrevista ||
        null,

      p_movimentacao_principal_id:
        movimentacaoPrincipalId ||
        null,

      p_documento:
        texto(documento)
          ? maiusculo(documento)
          : null,

      p_observacoes:
        texto(observacoes)
          ? maiusculo(observacoes)
          : null
    }
  )

  if (error) {
    throw error
  }

  return data
}

export async function listarCautelasPendentesPolicial() {
  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_listar_cautelas_pendentes_policial',
    {
      p_token:
        token
    }
  )

  if (error) {
    throw error
  }

  return data || []
}

export async function receberCautelaMunicaoPolicial(
  transferenciaId
) {
  if (!transferenciaId) {
    throw new Error(
      'Cautela de munição não informada.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_municoes_receber_cautela_policial',
    {
      p_token:
        token,

      p_transferencia_id:
        transferenciaId
    }
  )

  if (error) {
    throw error
  }

  return data
}


export async function buscarCautelaMunicaoPorId(
  cautelaId
) {
  if (!cautelaId) {
    throw new Error(
      'Cautela de munição não informada.'
    )
  }

  const { data, error } = await supabase
    .from(TABLE_CAUTELAS)
    .select(
      '*, municao:sigmo_municoes(*), lote:sigmo_municoes_lotes(*)'
    )
    .eq('id', cautelaId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return data || null
}

export async function devolverMunicaoDoPolicialAoSvdd({
  cautelaId,
  quantidade,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade devolvida deve ser maior que zero.'
    )
  }

  const cautela =
    await buscarCautelaMunicaoPorId(
      cautelaId
    )

  if (!cautela?.id) {
    throw new Error(
      'Cautela de munição não localizada.'
    )
  }

  if (
    maiusculo(cautela.status) !==
    STATUS_CAUTELA_MUNICAO.EM_SERVICO
  ) {
    throw new Error(
      'Esta cautela não está mais em serviço.'
    )
  }

  const saldoAtual =
    numeroInteiro(
      cautela.saldo
    )

  if (valor > saldoAtual) {
    throw new Error(
      `A cautela possui apenas ${saldoAtual} unidade(s) pendente(s).`
    )
  }

  const lote =
    cautela.lote

  if (!lote?.id) {
    throw new Error(
      'O lote associado à cautela não foi localizado.'
    )
  }

  const novaDevolvida =
    numeroInteiro(
      cautela.quantidade_devolvida
    ) + valor

  const novoSaldo =
    Math.max(
      0,
      saldoAtual - valor
    )

  const novoStatus =
    novoSaldo === 0
      ? STATUS_CAUTELA_MUNICAO.DEVOLVIDA
      : STATUS_CAUTELA_MUNICAO.EM_SERVICO

  const saldoSvddAnterior =
    numeroInteiro(
      lote.quantidade_svdd
    )

  let loteAtualizado = null
  let cautelaAtualizada = null
  let historico = null

  try {
    const {
      data: loteNovo,
      error: erroLote
    } = await supabase
      .from(TABLE_LOTES)
      .update({
        quantidade_svdd:
          saldoSvddAnterior + valor
      })
      .eq('id', lote.id)
      .eq(
        'quantidade_svdd',
        saldoSvddAnterior
      )
      .select('*')
      .maybeSingle()

    if (erroLote) {
      throw erroLote
    }

    if (!loteNovo?.id) {
      throw new Error(
        'O estoque do lote foi alterado. Atualize e tente novamente.'
      )
    }

    loteAtualizado =
      loteNovo

    const {
      data: cautelaNova,
      error: erroCautela
    } = await supabase
      .from(TABLE_CAUTELAS)
      .update({
        quantidade_devolvida:
          novaDevolvida,

        status:
          novoStatus
      })
      .eq('id', cautela.id)
      .eq(
        'quantidade_devolvida',
        numeroInteiro(
          cautela.quantidade_devolvida
        )
      )
      .select('*')
      .maybeSingle()

    if (erroCautela) {
      throw erroCautela
    }

    if (!cautelaNova?.id) {
      throw new Error(
        'A cautela foi alterada por outra operação.'
      )
    }

    cautelaAtualizada =
      cautelaNova

    historico =
      await registrarHistorico({
        municaoId:
          cautela.municao_id,

        loteId:
          lote.id,

        cautelaId:
          cautela.id,

        movimentacaoPrincipalId:
          cautela.movimentacao_principal_id,

        tipoMovimentacao:
          'DEVOLUCAO',

        origem:
          'POLICIAL',

        destino:
          'SVDD',

        quantidade:
          valor,

        policial: {
          id:
            cautela.policial_id,
          re:
            cautela.policial_re,
          nome_guerra:
            cautela.policial_nome
        },

        observacoes,
        user
      })

    return {
      cautela:
        cautelaAtualizada,
      lote:
        loteAtualizado,
      historico
    }
  } catch (error) {
    if (historico?.id) {
      await apagarRegistro({
        tabela:
          TABLE_MOVIMENTACOES,
        id:
          historico.id
      })
    }

    if (cautelaAtualizada?.id) {
      try {
        await supabase
          .from(TABLE_CAUTELAS)
          .update({
            quantidade_devolvida:
              cautela.quantidade_devolvida,
            status:
              cautela.status
          })
          .eq('id', cautela.id)
      } catch (rollbackError) {
        console.error(
          'Falha ao restaurar cautela de munição:',
          rollbackError
        )
      }
    }

    if (loteAtualizado?.id) {
      await restaurarSaldoLote({
        loteId:
          lote.id,
        valores: {
          quantidade_svdd:
            saldoSvddAnterior
        }
      })
    }

    throw error
  }
}

export async function registrarConsumoMunicao({
  cautelaId,
  quantidade,
  documento = null,
  observacoes = null,
  user = null
}) {
  const valor =
    numeroInteiro(quantidade)

  if (valor <= 0) {
    throw new Error(
      'A quantidade consumida deve ser maior que zero.'
    )
  }

  const cautela =
    await buscarCautelaMunicaoPorId(
      cautelaId
    )

  if (!cautela?.id) {
    throw new Error(
      'Cautela de munição não localizada.'
    )
  }

  if (
    maiusculo(cautela.status) !==
    STATUS_CAUTELA_MUNICAO.EM_SERVICO
  ) {
    throw new Error(
      'Esta cautela não está mais em serviço.'
    )
  }

  const saldoAtual =
    numeroInteiro(
      cautela.saldo
    )

  if (valor > saldoAtual) {
    throw new Error(
      `A cautela possui apenas ${saldoAtual} unidade(s) pendente(s).`
    )
  }

  const novaConsumida =
    numeroInteiro(
      cautela.quantidade_consumida
    ) + valor

  const novoSaldo =
    Math.max(
      0,
      saldoAtual - valor
    )

  const novoStatus =
    novoSaldo === 0
      ? STATUS_CAUTELA_MUNICAO.CONSUMIDA
      : STATUS_CAUTELA_MUNICAO.EM_SERVICO

  const {
    data,
    error
  } = await supabase
    .from(TABLE_CAUTELAS)
    .update({
      quantidade_consumida:
        novaConsumida,
      status:
        novoStatus
    })
    .eq('id', cautela.id)
    .eq(
      'quantidade_consumida',
      numeroInteiro(
        cautela.quantidade_consumida
      )
    )
    .select('*')
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!data?.id) {
    throw new Error(
      'A cautela foi alterada por outra operação. Atualize e tente novamente.'
    )
  }

  try {
    await registrarHistorico({
      municaoId:
        cautela.municao_id,

      loteId:
        cautela.lote_id,

      cautelaId:
        cautela.id,

      movimentacaoPrincipalId:
        cautela.movimentacao_principal_id,

      tipoMovimentacao:
        'CONSUMO',

      origem:
        'CAUTELA INDIVIDUAL',

      destino:
        'CONSUMO',

      quantidade:
        valor,

      policial: {
        id:
          cautela.policial_id,
        re:
          cautela.policial_re,
        nome_guerra:
          cautela.policial_nome
      },

      documento,
      observacoes,
      user
    })
  } catch (historicoError) {
    await supabase
      .from(TABLE_CAUTELAS)
      .update({
        quantidade_consumida:
          cautela.quantidade_consumida,
        status:
          cautela.status
      })
      .eq('id', cautela.id)

    throw historicoError
  }

  return data
}

export async function listarCautelasMunicaoAtivas({
  municaoId = null,
  calibre = '',
  loteId = null
} = {}) {
  let query = supabase
    .from(TABLE_CAUTELAS)
    .select(
      '*, municao:sigmo_municoes(*), lote:sigmo_municoes_lotes(*)'
    )
    .eq(
      'status',
      STATUS_CAUTELA_MUNICAO.EM_SERVICO
    )
    .gt('saldo', 0)
    .order('criado_em', {
      ascending: false
    })

  if (municaoId) {
    query = query.eq(
      'municao_id',
      municaoId
    )
  }

  if (loteId) {
    query = query.eq(
      'lote_id',
      loteId
    )
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  const lista = data || []

  if (!texto(calibre)) {
    return lista
  }

  const calibreNormalizado =
    maiusculo(calibre)

  return lista.filter(
    (item) =>
      maiusculo(
        item?.municao?.calibre
      ) === calibreNormalizado
  )
}

export async function listarMunicoesEmServico({
  re = '',
  policialId = null
} = {}) {
  const reNormalizado =
    normalizarRe(re)

  if (
    !reNormalizado &&
    !policialId
  ) {
    return []
  }

  /*
   * Primeiro tenta a consulta segura do próprio policial
   * autenticado. A RPC agrega por calibre/munição e não
   * expõe lote.
   *
   * Se o policial retornado pela sessão não corresponder
   * ao policial solicitado, mantemos a consulta antiga
   * como fallback para usos administrativos, como o
   * Mapa Força consultando outro policial.
   */
  const token =
    loadSessionToken()

  if (token) {
    const {
      data: minhasCautelas,
      error: minhasCautelasError
    } = await supabase.rpc(
      'sigmo_municoes_listar_minhas_cautelas',
      {
        p_token:
          token
      }
    )

    if (!minhasCautelasError) {
      const listaSegura =
        Array.isArray(
          minhasCautelas
        )
          ? minhasCautelas
          : []

      const correspondeAoSolicitado =
        listaSegura.some(
          (item) => {
            const mesmoId =
              policialId &&
              String(
                item?.policial_id ||
                ''
              ) ===
                String(
                  policialId
                )

            const mesmoRe =
              reNormalizado &&
              normalizarRe(
                item?.policial_re
              ) ===
                reNormalizado

            return (
              mesmoId ||
              mesmoRe
            )
          }
        )

      if (
        correspondeAoSolicitado ||
        (
          listaSegura.length === 0 &&
          !policialId &&
          !reNormalizado
        )
      ) {
        return listaSegura
          .map(
            (item) => {
              const quantidade =
                numeroInteiro(
                  item?.quantidade_em_posse
                )

              return {
                id:
                  `MUNICAO-${item.municao_id}`,

                patrimonio_id:
                  null,

                referencia_id:
                  item.municao_id,

                municao_id:
                  item.municao_id,

                tipo_registro:
                  'MUNICAO_QUANTIDADE',

                modulo:
                  'MUNICAO_QUANTIDADE',

                tipo:
                  'MUNICAO',

                categoria:
                  'MUNICAO',

                calibre:
                  maiusculo(
                    item?.calibre
                  ),

                patrimonio:
                  'ESTOQUE CONTROLADO',

                identificador:
                  maiusculo(
                    item?.calibre
                  ) ||
                  'MUNIÇÃO',

                descricao:
                  item?.descricao
                    ? maiusculo(
                        item.descricao
                      )
                    : `MUNIÇÃO ${
                        maiusculo(
                          item?.calibre
                        )
                      }`.trim(),

                local_origem:
                  'CAUTELA INDIVIDUAL',

                local_atual:
                  'CAUTELA INDIVIDUAL',

                status:
                  'EM SERVIÇO',

                quantidade,

                saldo:
                  quantidade,

                policial_id:
                  item?.policial_id ||
                  null,

                policial_re:
                  item?.policial_re ||
                  null,

                policial_nome:
                  item?.policial_nome ||
                  null,

                devolucao_prevista:
                  item?.devolucao_prevista ||
                  null,

                primeira_retirada:
                  item?.primeira_retirada ||
                  null,

                /*
                 * Lotes e cautelas individuais não são expostos
                 * nesta consulta do usuário. A devolução será
                 * tratada por RPC própria no próximo passo.
                 */
                cautelas:
                  []
              }
            }
          )
          .filter(
            (item) =>
              item.quantidade >
              0
          )
      }
    } else {
      console.warn(
        'Não foi possível consultar as cautelas de munição pela RPC segura. Tentando consulta administrativa de compatibilidade.',
        minhasCautelasError
      )
    }
  }

  /*
   * Compatibilidade administrativa:
   * mantém o comportamento anterior para telas que
   * consultam outro policial e já possuem permissão
   * de leitura direta.
   */
  const {
    data,
    error
  } = await supabase
    .from(TABLE_CAUTELAS)
    .select(
      '*, municao:sigmo_municoes(id,calibre,descricao)'
    )
    .eq(
      'status',
      STATUS_CAUTELA_MUNICAO.EM_SERVICO
    )
    .gt('saldo', 0)
    .order('criado_em', {
      ascending: true
    })

  if (error) {
    throw error
  }

  const doPolicial =
    (data || []).filter(
      (item) => {
        const mesmoId =
          policialId &&
          String(
            item.policial_id ||
            ''
          ) ===
            String(policialId)

        const mesmoRe =
          reNormalizado &&
          normalizarRe(
            item.policial_re
          ) ===
            reNormalizado

        return (
          mesmoId ||
          mesmoRe
        )
      }
    )

  const porMunicao =
    new Map()

  for (const cautela of doPolicial) {
    const chave =
      String(
        cautela.municao_id
      )

    if (!porMunicao.has(chave)) {
      porMunicao.set(
        chave,
        {
          id:
            `MUNICAO-${chave}`,

          patrimonio_id:
            null,

          referencia_id:
            cautela.municao_id,

          municao_id:
            cautela.municao_id,

          tipo_registro:
            'MUNICAO_QUANTIDADE',

          modulo:
            'MUNICAO_QUANTIDADE',

          tipo:
            'MUNICAO',

          categoria:
            'MUNICAO',

          calibre:
            maiusculo(
              cautela?.municao?.calibre
            ),

          patrimonio:
            'ESTOQUE CONTROLADO',

          identificador:
            maiusculo(
              cautela?.municao?.calibre
            ) ||
            'MUNIÇÃO',

          descricao:
            `MUNIÇÃO ${
              maiusculo(
                cautela?.municao?.calibre
              )
            }`.trim(),

          local_origem:
            'CAUTELA INDIVIDUAL',

          local_atual:
            'CAUTELA INDIVIDUAL',

          status:
            'EM SERVIÇO',

          quantidade:
            0,

          saldo:
            0,

          policial_id:
            cautela.policial_id,

          policial_re:
            cautela.policial_re,

          policial_nome:
            cautela.policial_nome,

          devolucao_prevista:
            cautela.devolucao_prevista,

          cautelas:
            []
        }
      )
    }

    const agregado =
      porMunicao.get(chave)

    const saldo =
      numeroInteiro(
        cautela.saldo
      )

    agregado.quantidade +=
      saldo

    agregado.saldo +=
      saldo

    agregado.cautelas.push({
      cautela_id:
        cautela.id,

      lote_id:
        cautela.lote_id,

      quantidade:
        saldo,

      criado_em:
        cautela.criado_em
    })
  }

  return Array.from(
    porMunicao.values()
  )
}


export async function listarHistoricoMunicao({
  municaoId = null,
  loteId = null,
  policialId = null
} = {}) {
  let query = supabase
    .from(TABLE_MOVIMENTACOES)
    .select('*')
    .order('criado_em', {
      ascending: false
    })

  if (municaoId) {
    query = query.eq(
      'municao_id',
      municaoId
    )
  }

  if (loteId) {
    query = query.eq(
      'lote_id',
      loteId
    )
  }

  if (policialId) {
    query = query.eq(
      'policial_id',
      policialId
    )
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return data || []
}
