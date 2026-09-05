import { supabase } from './supabaseClient'
import { loadSessionToken } from './authService'

const TABLE_MUNICOES = 'sigmo_municoes'
const TABLE_LOTES = 'sigmo_municoes_lotes'
const VIEW_RESUMO = 'sigmo_municoes_resumo'
const VIEW_LOTES_RESUMO = 'sigmo_municoes_lotes_resumo'
const VIEW_LOTE_POLICIAL = 'sigmo_municoes_lote_policial'

function texto(valor) {
  return String(valor ?? '').trim()
}

function obterTokenSessao() {
  const token = loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  return token
}

function primeiroRegistro(data) {
  if (Array.isArray(data)) {
    return data[0] || null
  }

  return data || null
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

function numeroInteiroOuNull(valor) {
  if (
    valor === null ||
    valor === undefined ||
    String(valor).trim() === ''
  ) {
    return null
  }

  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return null
  }

  return Math.max(0, Math.trunc(numero))
}

function valorOuNull(valor) {
  const resultado = texto(valor)
  return resultado || null
}

function obterNomeUsuario(user) {
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

function normalizarMunicao(item = {}) {
  return {
    ...item,

    calibre:
      maiusculo(item.calibre),

    descricao:
      valorOuNull(
        maiusculo(item.descricao)
      ),

    unidade:
      maiusculo(item.unidade) ||
      '27º BPM/M - 5ª CIA',

    status_operacional:
      maiusculo(
        item.status_operacional
      ) ||
      'RESERVA',

    observacoes:
      valorOuNull(
        maiusculo(item.observacoes)
      ),

    ativo:
      item.ativo !== false
  }
}

function normalizarLote(item = {}) {
  return {
    ...item,

    numero_lote:
      maiusculo(item.numero_lote),

    fabricante:
      maiusculo(item.fabricante) ||
      'NÃO INFORMADO',

    tipo_municao:
      valorOuNull(
        maiusculo(item.tipo_municao)
      ),

    quantidade_inicial:
      numeroInteiro(
        item.quantidade_inicial
      ),

    quantidade_p4:
      numeroInteiro(
        item.quantidade_p4
      ),

    quantidade_svdd:
      numeroInteiro(
        item.quantidade_svdd
      ),

    data_fabricacao:
      valorOuNull(
        item.data_fabricacao
      ),

    validade:
      valorOuNull(
        item.validade
      ),

    data_entrega:
      valorOuNull(
        item.data_entrega
      ),

    alerta_validade_ativo:
      item.alerta_validade_ativo === true,

    alerta_validade_dias_antes:
      numeroInteiroOuNull(
        item.alerta_validade_dias_antes
      ),

    documento_entrada:
      valorOuNull(
        maiusculo(
          item.documento_entrada
        )
      ),

    observacoes:
      valorOuNull(
        maiusculo(item.observacoes)
      ),

    ativo:
      item.ativo !== false
  }
}

export async function listarMunicoes({
  somenteAtivas = true
} = {}) {
  const resumo =
    await listarResumoMunicoes({
      somenteAtivas
    })

  return (resumo || []).map(
    normalizarMunicao
  )
}

export async function listarResumoMunicoes({
  somenteAtivas = true
} = {}) {
  const token =
    obterTokenSessao()

  const { data, error } =
    await supabase.rpc(
      'sigmo_municoes_listar_resumo',
      {
        p_token: token
      }
    )

  if (error) {
    throw error
  }

  const lista =
    (data || []).map(
      (item) => ({
        ...item,

        calibre:
          maiusculo(item.calibre),

        quantidade_carga_inicial:
          numeroInteiro(
            item.quantidade_carga_inicial
          ),

        quantidade_p4:
          numeroInteiro(
            item.quantidade_p4
          ),

        quantidade_svdd:
          numeroInteiro(
            item.quantidade_svdd
          ),

        quantidade_em_servico:
          numeroInteiro(
            item.quantidade_em_servico
          ),

        quantidade_consumida:
          numeroInteiro(
            item.quantidade_consumida
          ),

        quantidade_total_atual:
          numeroInteiro(
            item.quantidade_total_atual
          )
      })
    )

  if (somenteAtivas) {
    return lista.filter(
      (item) => item.ativo !== false
    )
  }

  return lista
}

export async function buscarMunicaoPorId(id) {
  if (!id) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const lista =
    await listarResumoMunicoes()

  const item =
    lista.find(
      (registro) =>
        String(registro.id) ===
        String(id)
    ) || null

  return item
    ? normalizarMunicao(item)
    : null
}

export async function buscarMunicaoPorCalibre(
  calibre
) {
  const valor =
    maiusculo(calibre)

  if (!valor) {
    return null
  }

  const token =
    obterTokenSessao()

  const { data, error } =
    await supabase.rpc(
      'sigmo_municoes_buscar_calibre',
      {
        p_token: token,
        p_calibre: valor
      }
    )

  if (error) {
    throw error
  }

  const registro =
    primeiroRegistro(data)

  return registro
    ? normalizarMunicao(registro)
    : null
}

export async function cadastrarMunicao({
  dados,
  user = null
}) {
  const municao =
    normalizarMunicao(dados)

  if (!municao.calibre) {
    throw new Error(
      'Informe o calibre da munição.'
    )
  }

  const existente =
    await buscarMunicaoPorCalibre(
      municao.calibre
    )

  if (existente?.id) {
    throw new Error(
      `O calibre ${municao.calibre} já está cadastrado.`
    )
  }

  const token =
    obterTokenSessao()

  const { data, error } =
    await supabase.rpc(
      'sigmo_municoes_cadastrar',
      {
        p_token:
          token,

        p_calibre:
          municao.calibre,

        p_descricao:
          municao.descricao,

        p_unidade:
          municao.unidade,

        p_status_operacional:
          municao.status_operacional,

        p_observacoes:
          municao.observacoes,

        p_ativo:
          municao.ativo
      }
    )

  if (error) {
    throw error
  }

  const registro =
    primeiroRegistro(data)

  if (!registro) {
    throw new Error(
      'O cadastro da munição não retornou o registro criado.'
    )
  }

  return normalizarMunicao(
    registro
  )
}

export async function atualizarMunicao({
  id,
  dados
}) {
  if (!id) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const municao =
    normalizarMunicao(dados)

  if (!municao.calibre) {
    throw new Error(
      'Informe o calibre da munição.'
    )
  }

  const payload = {
    calibre:
      municao.calibre,

    descricao:
      municao.descricao,

    unidade:
      municao.unidade,

    status_operacional:
      municao.status_operacional,

    observacoes:
      municao.observacoes,

    ativo:
      municao.ativo
  }

  const { data, error } = await supabase
    .from(TABLE_MUNICOES)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    throw error
  }

  return normalizarMunicao(data)
}

export async function desativarMunicao(id) {
  if (!id) {
    throw new Error(
      'Munição não informada.'
    )
  }

  const { error } = await supabase
    .from(TABLE_MUNICOES)
    .update({
      ativo: false
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  return true
}

export async function listarLotesMunicao({
  municaoId,
  somenteAtivos = true
} = {}) {
  if (!municaoId) {
    return []
  }

  const lotes =
    await listarLotesResumo({
      municaoId,
      somenteAtivos
    })

  return (lotes || []).map(
    normalizarLote
  )
}

export async function listarLotesResumo({
  municaoId = null,
  calibre = '',
  somenteAtivos = true
} = {}) {
  const token =
    obterTokenSessao()

  const { data, error } =
    await supabase.rpc(
      'sigmo_municoes_listar_lotes',
      {
        p_token:
          token,

        p_municao_id:
          municaoId || null,

        p_calibre:
          texto(calibre)
            ? maiusculo(calibre)
            : null
      }
    )

  if (error) {
    throw error
  }

  const lista =
    (data || []).map(
      (item) => ({
        ...item,

        calibre:
          maiusculo(item.calibre),

        numero_lote:
          maiusculo(item.numero_lote),

        fabricante:
          maiusculo(item.fabricante),

        quantidade_inicial:
          numeroInteiro(
            item.quantidade_inicial
          ),

        quantidade_p4:
          numeroInteiro(
            item.quantidade_p4
          ),

        quantidade_svdd:
          numeroInteiro(
            item.quantidade_svdd
          ),

        quantidade_em_servico:
          numeroInteiro(
            item.quantidade_em_servico
          ),

        quantidade_consumida:
          numeroInteiro(
            item.quantidade_consumida
          ),

        quantidade_total_atual:
          numeroInteiro(
            item.quantidade_total_atual
          ),

        data_entrega:
          valorOuNull(
            item.data_entrega
          ),

        alerta_validade_ativo:
          item.alerta_validade_ativo === true,

        alerta_validade_dias_antes:
          numeroInteiroOuNull(
            item.alerta_validade_dias_antes
          )
      })
    )

  if (somenteAtivos) {
    return lista.filter(
      (item) => item.ativo !== false
    )
  }

  return lista
}

export async function buscarLotePorId(id) {
  if (!id) {
    throw new Error(
      'Lote de munição não informado.'
    )
  }

  const lotes =
    await listarLotesResumo()

  const lote =
    lotes.find(
      (item) =>
        String(item.lote_id || item.id) ===
        String(id)
    ) || null

  return lote
    ? normalizarLote({
        ...lote,
        id:
          lote.id ||
          lote.lote_id
      })
    : null
}

export async function cadastrarLoteMunicao({
  municaoId,
  dados,
  user = null
}) {
  if (!municaoId) {
    throw new Error(
      'Selecione o calibre da munição.'
    )
  }

  const lote =
    normalizarLote(dados)

  if (!lote.numero_lote) {
    throw new Error(
      'Informe o número do lote.'
    )
  }

  if (
    lote.quantidade_inicial <= 0
  ) {
    throw new Error(
      'A quantidade inicial do lote deve ser maior que zero.'
    )
  }

  if (
    lote.alerta_validade_ativo &&
    !lote.validade
  ) {
    throw new Error(
      'Informe a validade antes de ativar o lembrete de vencimento.'
    )
  }

  if (
    lote.alerta_validade_ativo &&
    (
      lote.alerta_validade_dias_antes === null ||
      lote.alerta_validade_dias_antes <= 0
    )
  ) {
    throw new Error(
      'Informe com quantos dias de antecedência o alerta de validade deve ser exibido.'
    )
  }

  const token =
    obterTokenSessao()

  const { data, error } =
    await supabase.rpc(
      'sigmo_municoes_cadastrar_lote',
      {
        p_token:
          token,

        p_municao_id:
          municaoId,

        p_numero_lote:
          lote.numero_lote,

        p_quantidade_inicial:
          lote.quantidade_inicial,

        p_data_entrega:
          lote.data_entrega,

        p_validade:
          lote.validade,

        p_alerta_validade_ativo:
          lote.alerta_validade_ativo,

        p_alerta_validade_dias_antes:
          lote.alerta_validade_ativo
            ? lote.alerta_validade_dias_antes
            : null,

        p_observacoes:
          lote.observacoes
      }
    )

  if (error) {
    if (
      error?.code === '23505'
    ) {
      throw new Error(
        'Já existe um lote com esta identificação para o calibre selecionado.'
      )
    }

    throw error
  }

  const registro =
    primeiroRegistro(data)

  if (!registro) {
    throw new Error(
      'O cadastro do lote não retornou o registro criado.'
    )
  }

  return normalizarLote(
    registro
  )
}

export async function atualizarLoteMunicao({
  id,
  dados
}) {
  if (!id) {
    throw new Error(
      'Lote de munição não informado.'
    )
  }

  const lote =
    normalizarLote(dados)

  if (!lote.numero_lote) {
    throw new Error(
      'Informe o número do lote.'
    )
  }

  if (
    lote.alerta_validade_ativo &&
    !lote.validade
  ) {
    throw new Error(
      'Informe a validade antes de ativar o lembrete de vencimento.'
    )
  }

  if (
    lote.alerta_validade_ativo &&
    (
      lote.alerta_validade_dias_antes === null ||
      lote.alerta_validade_dias_antes <= 0
    )
  ) {
    throw new Error(
      'Informe com quantos dias de antecedência o alerta de validade deve ser exibido.'
    )
  }

  const payload = {
    numero_lote:
      lote.numero_lote,

    fabricante:
      lote.fabricante,

    tipo_municao:
      lote.tipo_municao,

    data_fabricacao:
      lote.data_fabricacao,

    validade:
      lote.validade,

    data_entrega:
      lote.data_entrega,

    alerta_validade_ativo:
      lote.alerta_validade_ativo,

    alerta_validade_dias_antes:
      lote.alerta_validade_ativo
        ? lote.alerta_validade_dias_antes
        : null,

    documento_entrada:
      lote.documento_entrada,

    observacoes:
      lote.observacoes,

    ativo:
      lote.ativo
  }

  /*
   * Os saldos não são alterados por esta função.
   * Quantidades deverão ser modificadas somente
   * pelo serviço de movimentações, preservando
   * auditoria.
   */

  const { data, error } = await supabase
    .from(TABLE_LOTES)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (
      error?.code === '23505'
    ) {
      throw new Error(
        'Já existe um lote com esta identificação para o calibre selecionado.'
      )
    }

    throw error
  }

  return normalizarLote(data)
}

export async function desativarLoteMunicao(id) {
  if (!id) {
    throw new Error(
      'Lote de munição não informado.'
    )
  }

  const lote =
    await buscarLotePorId(id)

  if (!lote) {
    throw new Error(
      'Lote de munição não localizado.'
    )
  }

  if (
    lote.quantidade_p4 > 0 ||
    lote.quantidade_svdd > 0
  ) {
    throw new Error(
      'Não é possível desativar um lote que ainda possui saldo no P4 ou no SVDD.'
    )
  }

  const { error } = await supabase
    .from(TABLE_LOTES)
    .update({
      ativo: false
    })
    .eq('id', id)

  if (error) {
    throw error
  }

  return true
}

export async function listarPoliciaisComLote({
  loteId
}) {
  if (!loteId) {
    return []
  }

  const token =
    obterTokenSessao()

  const { data, error } =
    await supabase.rpc(
      'sigmo_municoes_listar_policial_lote',
      {
        p_token:
          token,

        p_lote_id:
          loteId
      }
    )

  if (error) {
    throw error
  }

  return (data || []).map(
    (item) => ({
      ...item,

      calibre:
        maiusculo(item.calibre),

      numero_lote:
        maiusculo(item.numero_lote),

      fabricante:
        maiusculo(item.fabricante),

      policial_re:
        texto(item.policial_re),

      policial_nome:
        maiusculo(item.policial_nome),

      quantidade_em_posse:
        numeroInteiro(
          item.quantidade_em_posse
        )
    })
  )
}

export async function obterDisponibilidadeCalibre({
  municaoId = null,
  calibre = '',
  origem = 'SVDD'
} = {}) {
  if (
    !municaoId &&
    !texto(calibre)
  ) {
    throw new Error(
      'Informe o calibre da munição.'
    )
  }

  const resumo =
    await listarResumoMunicoes()

  const data =
    resumo.find(
      (item) =>
        municaoId
          ? String(item.id) ===
            String(municaoId)
          : maiusculo(item.calibre) ===
            maiusculo(calibre)
    ) || null

  if (!data) {
    return null
  }

  const local =
    maiusculo(origem)

  const disponivel =
    local.includes('P4')
      ? numeroInteiro(
          data.quantidade_p4
        )
      : numeroInteiro(
          data.quantidade_svdd
        )

  return {
    ...data,

    calibre:
      maiusculo(data.calibre),

    quantidade_disponivel:
      disponivel
  }
}
