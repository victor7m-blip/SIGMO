import { supabase } from './supabaseClient'
import { listarManutencoes } from './manutencoesService'
import { loadSessionToken } from './authService'

const TABLE = 'sigmo_manutencoes_externas'
const TABLE_ITENS = 'sigmo_manutencoes_externas_itens'

export const STATUS_MANUTENCAO_EXTERNA = Object.freeze({
  AGUARDANDO_APROVACAO: 'AGUARDANDO_APROVACAO',
  DILIGENCIA: 'DILIGENCIA',
  APROVADA: 'APROVADA',
  EM_MANUTENCAO_EXTERNA: 'EM_MANUTENCAO_EXTERNA',
  RETORNADA: 'RETORNADA',
  REPROVADA: 'REPROVADA',
  CANCELADA: 'CANCELADA'
})

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function origemEhP4(item) {
  const origemInstitucional = maiusculo(item?.origem_institucional)
  const origemGravada = maiusculo(item?.origem)

  if (origemInstitucional === 'P4') return true

  return (
    origemGravada === 'P4' ||
    origemGravada.includes('P4') ||
    origemGravada.includes('DEPÓSITO') ||
    origemGravada.includes('DEPOSITO') ||
    origemGravada.includes('GUARDA DO QUARTEL') ||
    origemGravada.includes('GUARDA DO P4')
  )
}

function obterUsuarioId(user) {
  return user?.id || user?.user_id || user?.usuario_id || user?.usuario?.id || null
}

function obterUsuarioNome(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.usuario?.nome_guerra ||
    user?.usuario?.nome ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

export async function listarManutencoesExternas({
  status = null,
  modulo = null,
  referenciaId = null,
  manutencaoId = null,
  pagina = 1,
  limite = 200
} = {}) {
  const token = loadSessionToken()

  if (!token) {
    throw new Error('Sessão SIGMO não localizada. Faça login novamente.')
  }

  const { data, error } = await supabase.rpc(
    'sigmo_listar_manutencoes_externas_contagem',
    { p_token: token }
  )

  if (error) throw error

  let registros = Array.isArray(data) ? data : []

  const statusNormalizado = Array.isArray(status)
    ? status.map(maiusculo).filter(Boolean)
    : maiusculo(status)

  const moduloNormalizado = maiusculo(modulo)
  const referenciaNormalizada = texto(referenciaId)
  const manutencaoNormalizada = texto(manutencaoId)

  registros = registros.filter((item) => {
    if (Array.isArray(statusNormalizado) && statusNormalizado.length > 0) {
      if (!statusNormalizado.includes(maiusculo(item?.status))) return false
    } else if (
      statusNormalizado &&
      maiusculo(item?.status) !== statusNormalizado
    ) {
      return false
    }

    if (
      moduloNormalizado &&
      maiusculo(item?.modulo) !== moduloNormalizado
    ) {
      return false
    }

    if (
      referenciaNormalizada &&
      texto(item?.referencia_id) !== referenciaNormalizada
    ) {
      return false
    }

    if (
      manutencaoNormalizada &&
      texto(item?.manutencao_id) !== manutencaoNormalizada
    ) {
      return false
    }

    return true
  })

  const paginaValida = Math.max(1, Number(pagina) || 1)
  const limiteValido = Math.min(500, Math.max(1, Number(limite) || 200))
  const inicio = (paginaValida - 1) * limiteValido
  const fim = inicio + limiteValido

  return {
    data: registros.slice(inicio, fim),
    total: registros.length,
    pagina: paginaValida,
    limite: limiteValido
  }
}

export async function listarHTsElegiveisManutencaoExterna() {
  const resultado = await listarManutencoes({
    modulo: 'HT',
    status: 'EM_MANUTENCAO',
    pagina: 1,
    limite: 200
  })

  // Proteção do fluxo atual:
  // primeiro usa origem_institucional quando ela existe;
  // para manutenções abertas diretamente pelo P4, aceita também
  // a origem gravada na própria manutenção.
  const manutencoes = (resultado?.data || []).filter(origemEhP4)

  if (manutencoes.length === 0) return []

  const manutencaoIds = manutencoes.map((item) => item.id)

  const { data: itensExternos, error } = await supabase
    .from(TABLE_ITENS)
    .select(`
      manutencao_id,
      manutencao_externa_id,
      sigmo_manutencoes_externas!inner (
        id,
        status
      )
    `)
    .in('manutencao_id', manutencaoIds)

  if (error) throw error

  const bloqueadas = new Set(
    (itensExternos || [])
      .filter((item) => {
        const status = maiusculo(item?.sigmo_manutencoes_externas?.status)
        return [
          STATUS_MANUTENCAO_EXTERNA.AGUARDANDO_APROVACAO,
          STATUS_MANUTENCAO_EXTERNA.DILIGENCIA,
          STATUS_MANUTENCAO_EXTERNA.APROVADA,
          STATUS_MANUTENCAO_EXTERNA.EM_MANUTENCAO_EXTERNA
        ].includes(status)
      })
      .map((item) => String(item.manutencao_id))
  )

  return manutencoes.filter((item) => !bloqueadas.has(String(item.id)))
}

export async function criarSolicitacaoManutencaoExterna({
  manutencoes = [],
  destinoNome,
  destinoTipo = null,
  destinoDocumento = null,
  destinoEndereco = null,
  destinoContato = null,
  tipoDocumento = null,
  numeroDocumento = null,
  dataDocumento = null,
  motivo = null,
  servicoSolicitado = null,
  observacoesSaida = null,
  previsaoRetorno = null,
  portador = null,
  user = null
}) {
  const itens = Array.isArray(manutencoes) ? manutencoes.filter(Boolean) : []

  if (itens.length === 0) {
    throw new Error('Selecione ao menos um material para manutenção externa.')
  }

  if (!texto(destinoNome)) {
    throw new Error('Informe o destino da manutenção externa.')
  }

  if (!texto(servicoSolicitado) && !texto(motivo)) {
    throw new Error('Informe o motivo ou o serviço solicitado.')
  }

  for (const item of itens) {
    if (maiusculo(item?.status) !== 'EM_MANUTENCAO') {
      throw new Error('Todos os itens devem possuir manutenção interna ativa.')
    }

    if (!origemEhP4(item)) {
      throw new Error(
        'Somente materiais sob responsabilidade institucional do P4 podem ser enviados por este fluxo.'
      )
    }
  }

  const ids = itens.map((item) => item.id)

  const { data: jaVinculados, error: vinculosError } = await supabase
    .from(TABLE_ITENS)
    .select(`
      manutencao_id,
      sigmo_manutencoes_externas!inner (
        status
      )
    `)
    .in('manutencao_id', ids)

  if (vinculosError) throw vinculosError

  const conflito = (jaVinculados || []).find((item) => {
    const status = maiusculo(item?.sigmo_manutencoes_externas?.status)
    return [
      STATUS_MANUTENCAO_EXTERNA.AGUARDANDO_APROVACAO,
      STATUS_MANUTENCAO_EXTERNA.DILIGENCIA,
      STATUS_MANUTENCAO_EXTERNA.APROVADA,
      STATUS_MANUTENCAO_EXTERNA.EM_MANUTENCAO_EXTERNA
    ].includes(status)
  })

  if (conflito) {
    throw new Error('Um dos materiais já possui uma solicitação de manutenção externa ativa.')
  }

  const token = loadSessionToken()

  if (!token) {
    throw new Error('Sessão SIGMO não localizada. Faça login novamente.')
  }

  const registros = itens.map((item) => ({
    manutencao_id: item.id,
    patrimonio_id: item.patrimonio_id || null,
    referencia_id: item.referencia_id || null,
    modulo: maiusculo(item.modulo) || 'HT',
    tipo_material: maiusculo(item.tipo_material) || 'HT',
    patrimonio: texto(item.patrimonio) || null,
    numero_serie: texto(item.numero_serie) || null,
    quantidade: Math.max(1, Number(item.quantidade || 1)),
    observacoes: null
  }))

  const { data: solicitacao, error } = await supabase.rpc(
    'sigmo_criar_manutencao_externa',
    {
      p_token: token,
      p_destino_nome: maiusculo(destinoNome),
      p_destino_tipo: maiusculo(destinoTipo) || null,
      p_destino_documento: maiusculo(destinoDocumento) || null,
      p_destino_endereco: maiusculo(destinoEndereco) || null,
      p_destino_contato: maiusculo(destinoContato) || null,
      p_tipo_documento: maiusculo(tipoDocumento) || null,
      p_numero_documento: maiusculo(numeroDocumento) || null,
      p_data_documento: dataDocumento || null,
      p_motivo: maiusculo(motivo) || null,
      p_servico_solicitado: maiusculo(servicoSolicitado) || null,
      p_observacoes_saida: maiusculo(observacoesSaida) || null,
      p_previsao_retorno: previsaoRetorno || null,
      p_portador_id: portador?.id || portador?.policial_id || null,
      p_portador_re: texto(portador?.re || portador?.policial_re) || null,
      p_portador_nome:
        maiusculo(
          portador?.nome_guerra ||
          portador?.nome ||
          portador?.nome_completo ||
          portador?.policial_nome
        ) || null,
      p_itens: registros
    }
  )

  if (error) throw error

  return solicitacao
}


export async function retornarManutencaoExterna({
  manutencaoExternaId,
  servicoExecutado = null,
  observacoes = null
}) {
  const id = texto(manutencaoExternaId)

  if (!id) {
    throw new Error('Manutenção externa não localizada para retorno.')
  }

  const token = loadSessionToken()

  if (!token) {
    throw new Error('Sessão SIGMO não localizada. Faça login novamente.')
  }

  const { data, error } = await supabase.rpc(
    'sigmo_retornar_manutencao_externa',
    {
      p_token: token,
      p_manutencao_externa_id: id,
      p_servico_executado: maiusculo(servicoExecutado) || null,
      p_observacoes: maiusculo(observacoes) || null
    }
  )

  if (error) throw error
  return data || null
}

export async function buscarHistoricoManutencaoExterna(manutencaoId) {
  const id = texto(manutencaoId)
  if (!id) return null

  const token = loadSessionToken()
  if (!token) {
    throw new Error('Sessão SIGMO não localizada. Faça login novamente.')
  }

  const { data, error } = await supabase.rpc(
    'sigmo_historico_manutencao_externa',
    {
      p_token: token,
      p_manutencao_id: id
    }
  )

  if (error) throw error
  return data || null
}
