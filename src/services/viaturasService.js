import { supabase } from './supabaseClient'

const TABLE = 'sigmo_viaturas'
const BUCKET_FOTOS = 'viaturas-fotos'

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function normalizarPlaca(valor) {
  const limpo = maiusculo(valor).replace(/[^A-Z0-9]/g, '')

  if (limpo.length !== 7) return maiusculo(valor)

  return `${limpo.slice(0, 3)}-${limpo.slice(3)}`
}

function placaValida(valor) {
  const placa = normalizarPlaca(valor)

  return (
    /^[A-Z]{3}-\d{4}$/.test(placa) ||
    /^[A-Z]{3}-\d[A-Z]\d{2}$/.test(placa)
  )
}

function fotoPublica(path) {
  if (!path) return null

  const { data } = supabase.storage
    .from(BUCKET_FOTOS)
    .getPublicUrl(path)

  return data?.publicUrl || null
}

export const TIPOS_VEICULO = [
  { value: 'VIATURA', label: 'Viatura' },
  { value: 'MOTOCICLETA', label: 'Motocicleta' }
]

export const SITUACOES_VIATURA = [
  { value: 'DISPONIVEL', label: 'Disponível' },
  { value: 'MANUTENCAO_INTERNA', label: 'Manutenção interna' },
  { value: 'MANUTENCAO_EXTERNA', label: 'Manutenção externa' },
  { value: 'PROCESSO_DESCARGA', label: 'Processo de descarga' }
]

export function formatarSituacaoViatura(valor) {
  return (
    SITUACOES_VIATURA.find((item) => item.value === valor)?.label ||
    texto(valor).replaceAll('_', ' ') ||
    '—'
  )
}

function prepararPayload(dados = {}) {
  return {
    prefixo: maiusculo(dados.prefixo),
    placa: normalizarPlaca(dados.placa),
    modelo: maiusculo(dados.modelo),
    ano: Number(dados.ano),
    tipo_veiculo: dados.tipo_veiculo || 'VIATURA',
    situacao: dados.situacao || 'DISPONIVEL',
    ativo: dados.ativo !== false,
    observacoes: texto(dados.observacoes) || null,
    updated_at: new Date().toISOString()
  }
}

function validarPrefixo(prefixo, tipo) {
  if (tipo === 'MOTOCICLETA') {
    if (!/^M-\d{5}-11$/i.test(prefixo)) {
      throw new Error('Para motocicleta, use o prefixo no formato M-27509-11.')
    }
    return
  }

  if (!/^M-\d{5}$/i.test(prefixo)) {
    throw new Error('Para viatura, use o prefixo no formato M-27505.')
  }
}

export async function listarViaturas() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('ativo', true)
    .order('prefixo', { ascending: true })

  if (error) throw error

  return (data || []).map((item) => ({
    ...item,
    foto_principal_url: fotoPublica(item.foto_principal_path)
  }))
}

export async function salvarViatura(dados) {
  const payload = prepararPayload(dados)

  if (!payload.prefixo) throw new Error('Informe o prefixo da viatura.')
  validarPrefixo(payload.prefixo, payload.tipo_veiculo)

  if (!payload.placa) throw new Error('Informe a placa da viatura.')
  if (!placaValida(payload.placa)) {
    throw new Error('Informe a placa no formato AAA-1234 ou AAA-1A23.')
  }

  if (!payload.modelo) throw new Error('Informe o modelo da viatura.')

  if (
    !Number.isInteger(payload.ano) ||
    payload.ano < 1900 ||
    payload.ano > 2100
  ) {
    throw new Error('Informe um ano válido.')
  }

  if (dados?.id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq('id', dados.id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('Já existe uma viatura cadastrada com esse prefixo.')
      }
      throw error
    }

    return {
      ...data,
      foto_principal_url: fotoPublica(data.foto_principal_path)
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('Já existe uma viatura cadastrada com esse prefixo.')
    }
    throw error
  }

  return {
    ...data,
    foto_principal_url: fotoPublica(data.foto_principal_path)
  }
}

export async function alterarSituacaoViatura(id, situacao) {
  const { data, error } = await supabase
    .from(TABLE)
    .update({
      situacao,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
