import { supabase } from './supabaseClient'

function normalizarPayload(payload = {}) {
  const novoPayload = {}

  Object.entries(payload).forEach(([chave, valor]) => {
    novoPayload[chave] =
      typeof valor === 'string' ? valor.trim().toUpperCase() : valor
  })

  return novoPayload
}

async function registrarHistoricoPatrimonio({
  patrimonio_id,
  tipo_evento,
  descricao,
}) {
  if (!patrimonio_id) return

  const { error } = await supabase
    .from('sigmo_patrimonio_historico')
    .insert([
      {
        patrimonio_id,
        movimentacao_id: null,
        tipo_evento,
        descricao,
        created_by: null,
        created_by_nome: 'SIGMO',
      },
    ])

  if (error) {
    console.warn('Erro ao registrar histórico patrimonial:', error)
  }
}

function descreverAlteracoes(antes = {}, depois = {}) {
  const ignorar = ['updated_at', 'created_at']

  const alteracoes = Object.keys(depois)
    .filter((chave) => !ignorar.includes(chave))
    .filter((chave) => String(antes?.[chave] ?? '') !== String(depois?.[chave] ?? ''))
    .map((chave) => `${chave}: ${antes?.[chave] || '-'} → ${depois?.[chave] || '-'}`)

  return alteracoes.length ? alteracoes.join(' | ') : 'Registro atualizado.'
}

export async function listarPatrimoniosEngine(config) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function buscarPatrimonioEnginePorId(config, id) {
  const { data, error } = await supabase
    .from(config.tabela)
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function cadastrarPatrimonioEngine(config, payload) {
  const payloadNormalizado = normalizarPayload(payload)

  const { data, error } = await supabase
    .from(config.tabela)
    .insert([payloadNormalizado])
    .select()
    .single()

  if (error) throw error

  await registrarHistoricoPatrimonio({
    patrimonio_id: data.id,
    tipo_evento: 'cadastro',
    descricao: 'Cadastro realizado.',
  })

  return data
}

export async function atualizarPatrimonioEngine(config, id, payload) {
  const antes = await buscarPatrimonioEnginePorId(config, id)
  const payloadNormalizado = normalizarPayload(payload)

  const { data, error } = await supabase
    .from(config.tabela)
    .update(payloadNormalizado)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  await registrarHistoricoPatrimonio({
    patrimonio_id: id,
    tipo_evento: 'edicao',
    descricao: descreverAlteracoes(antes, data),
  })

  return data
}

export async function excluirPatrimonioEngine(config, id) {
  const antes = await buscarPatrimonioEnginePorId(config, id)

  const { error } = await supabase
    .from(config.tabela)
    .delete()
    .eq('id', id)

  if (error) throw error

  await registrarHistoricoPatrimonio({
    patrimonio_id: id,
    tipo_evento: 'exclusao',
    descricao: `Registro excluído: ${antes?.patrimonio || antes?.descricao || id}`,
  })

  return true
}