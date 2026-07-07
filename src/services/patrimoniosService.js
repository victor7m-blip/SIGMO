import { supabase } from './supabaseClient'

// =====================================================
// SIGMO — PATRIMÔNIOS SERVICE
// Integra os cadastros específicos ao Motor de Movimentação
// =====================================================

export function montarDescricaoPatrimonio(tipo, dados = {}) {
  if (tipo === 'arma') {
    return [
      dados.especie,
      dados.marca,
      dados.modelo,
      dados.calibre
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'colete') {
    return [
      'Colete Balístico',
      dados.marca,
      dados.modelo,
      dados.nivel,
      dados.tamanho
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'ht') {
    return [
      'HT',
      dados.marca,
      dados.modelo
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'tpd') {
    return [
      'TPD',
      dados.marca,
      dados.modelo
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'ain') {
    return [
      'AIN',
      dados.marca,
      dados.modelo
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'cop') {
    return [
      'COP',
      dados.marca,
      dados.modelo
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'municao') {
    return [
      'Munição',
      dados.calibre,
      dados.lote
    ].filter(Boolean).join(' ')
  }

  if (tipo === 'viatura') {
    return [
      'Viatura',
      dados.prefixo,
      dados.placa,
      dados.modelo
    ].filter(Boolean).join(' ')
  }

  return (
    dados.descricao ||
    dados.nome ||
    dados.modelo ||
    dados.patrimonio ||
    'Patrimônio SIGMO'
  )
}

export function extrairNumeroPatrimonio(dados = {}) {
  return (
    dados.patrimonio ||
    dados.numero_patrimonio ||
    dados.numero_tombo ||
    dados.codigo_patrimonial ||
    ''
  )
}

export function extrairNumeroSerie(dados = {}) {
  return (
    dados.numero_serie ||
    dados.serie ||
    dados.serial ||
    dados.chassi ||
    dados.imei ||
    ''
  )
}

export function normalizarStatusPatrimonio(status = '') {
  const valor = String(status || '').toLowerCase()

  if (valor.includes('baix')) return 'baixado'
  if (valor.includes('manut')) return 'manutencao'
  if (valor.includes('indis')) return 'indisponivel'
  if (valor.includes('emprest')) return 'emprestado'
  if (valor.includes('carga')) return 'em_carga'
  if (valor.includes('uso')) return 'em_carga'

  return 'disponivel'
}

export async function buscarPatrimonioPorReferencia(tipo, referencia_id) {
  if (!tipo || !referencia_id) return null

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('tipo', tipo)
    .eq('referencia_id', referencia_id)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function criarOuAtualizarPatrimonio({
  tipo,
  referencia_id,
  dados,
  user,
  local_atual = 'Guarda do Quartel',
  companhia_atual = ''
}) {
  if (!tipo) throw new Error('Tipo do patrimônio não informado.')
  if (!referencia_id) throw new Error('Referência do patrimônio não informada.')

  const existente = await buscarPatrimonioPorReferencia(tipo, referencia_id)

  const payload = {
    tipo,
    referencia_id,
    descricao: montarDescricaoPatrimonio(tipo, dados),
    numero_patrimonio: extrairNumeroPatrimonio(dados),
    numero_serie: extrairNumeroSerie(dados),
    status: normalizarStatusPatrimonio(dados?.status || dados?.situacao),
    companhia_atual:
      companhia_atual ||
      dados?.companhia ||
      dados?.unidade ||
      existente?.companhia_atual ||
      '',
    ativo: dados?.ativo ?? true,
    created_by: existente?.created_by || user?.id || null,
    created_by_nome:
      existente?.created_by_nome ||
      user?.nome ||
      user?.nome_completo ||
      ''
  }

  if (existente?.id) {
    const { data, error } = await supabase
      .from('sigmo_patrimonios')
      .update(payload)
      .eq('id', existente.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .insert({
      ...payload,
      local_atual,
      responsavel_atual_id: null,
      responsavel_atual_nome: ''
    })
    .select()
    .single()

  if (error) throw error

  await registrarHistoricoCadastro({
    patrimonio_id: data.id,
    descricao: 'Patrimônio criado a partir de cadastro específico.',
    user
  })

  return data
}

export async function registrarHistoricoCadastro({
  patrimonio_id,
  descricao,
  user
}) {
  if (!patrimonio_id) return

  const { error } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert({
      patrimonio_id,
      tipo_evento: 'cadastro',
      descricao,
      created_by: user?.id || null,
      created_by_nome: user?.nome || user?.nome_completo || ''
    })

  if (error) throw error
}

export async function desativarPatrimonioPorReferencia({
  tipo,
  referencia_id,
  user,
  motivo = 'Cadastro específico desativado.'
}) {
  const patrimonio = await buscarPatrimonioPorReferencia(tipo, referencia_id)

  if (!patrimonio?.id) return null

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .update({
      ativo: false,
      status: 'baixado'
    })
    .eq('id', patrimonio.id)
    .select()
    .single()

  if (error) throw error

  const { error: historicoError } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert({
      patrimonio_id: patrimonio.id,
      tipo_evento: 'baixa',
      descricao: motivo,
      created_by: user?.id || null,
      created_by_nome: user?.nome || user?.nome_completo || ''
    })

  if (historicoError) throw historicoError

  return data
}

export async function listarPatrimonios(filtros = {}) {
  let query = supabase
    .from('sigmo_patrimonios')
    .select('*')
    .order('created_at', { ascending: false })

  if (filtros.tipo) {
    query = query.eq('tipo', filtros.tipo)
  }

  if (filtros.local_atual) {
    query = query.eq('local_atual', filtros.local_atual)
  }

  if (filtros.status) {
    query = query.eq('status', filtros.status)
  }

  if (typeof filtros.ativo === 'boolean') {
    query = query.eq('ativo', filtros.ativo)
  }

  if (filtros.busca) {
    query = query.or(
      `descricao.ilike.%${filtros.busca}%,numero_patrimonio.ilike.%${filtros.busca}%,numero_serie.ilike.%${filtros.busca}%`
    )
  }

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export async function atualizarLocalPatrimonio({
  patrimonio_id,
  local_atual,
  responsavel_atual_id = null,
  responsavel_atual_nome = '',
  user,
  motivo = 'Atualização manual de local.'
}) {
  if (!patrimonio_id) throw new Error('Patrimônio não informado.')

  const { data: anterior, error: anteriorError } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .eq('id', patrimonio_id)
    .single()

  if (anteriorError) throw anteriorError

  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .update({
      local_atual,
      responsavel_atual_id,
      responsavel_atual_nome
    })
    .eq('id', patrimonio_id)
    .select()
    .single()

  if (error) throw error

  const { error: historicoError } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert({
      patrimonio_id,
      tipo_evento: 'correcao',
      local_anterior: anterior.local_atual,
      local_novo: local_atual,
      responsavel_anterior_id: anterior.responsavel_atual_id,
      responsavel_anterior_nome: anterior.responsavel_atual_nome,
      responsavel_novo_id: responsavel_atual_id,
      responsavel_novo_nome: responsavel_atual_nome,
      descricao: motivo,
      created_by: user?.id || null,
      created_by_nome: user?.nome || user?.nome_completo || ''
    })

  if (historicoError) throw historicoError

  return data
}