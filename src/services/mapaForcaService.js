import { supabase } from './supabaseClient'

const TABLE_MAPA = 'sigmo_mapa_forca'
const TABLE_US = 'sigmo_mapa_forca_us'
const TABLE_EFETIVO = 'sigmo_mapa_forca_efetivo'

function isoOuNull(valor) {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

function cabecalhoMapa({ inicio, fim, user }) {
  const inicioIso = isoOuNull(inicio)
  const fimIso = isoOuNull(fim)

  if (!inicioIso || !fimIso) {
    throw new Error('Informe corretamente o início e o término do turno.')
  }

  if (new Date(fimIso) <= new Date(inicioIso)) {
    throw new Error('O término do turno deve ser posterior ao início.')
  }

  return {
    inicio_turno: inicioIso,
    fim_turno: fimIso,
    status: 'EM ELABORAÇÃO',
    criado_por: user?.id || null,
    criado_por_nome:
      user?.nome_guerra ||
      user?.nome ||
      user?.nome_completo ||
      user?.re ||
      'USUÁRIO',
    updated_at: new Date().toISOString()
  }
}

export async function carregarMapaEmElaboracao() {
  const { data: mapa, error } = await supabase
    .from(TABLE_MAPA)
    .select('*')
    .eq('status', 'EM ELABORAÇÃO')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!mapa) return null

  const { data: unidades, error: erroUs } = await supabase
    .from(TABLE_US)
    .select('*, viatura:sigmo_viaturas(*)')
    .eq('mapa_id', mapa.id)
    .order('ordem', { ascending: true })

  if (erroUs) throw erroUs

  const { data: efetivo, error: erroEfetivo } = await supabase
    .from(TABLE_EFETIVO)
    .select('*, policial:policiais(*)')
    .eq('mapa_id', mapa.id)
    .order('ordem', { ascending: true })

  if (erroEfetivo) throw erroEfetivo

  return {
    mapa,
    unidades: unidades || [],
    efetivo: efetivo || []
  }
}

export async function salvarCabecalhoMapaForca({
  mapaId,
  inicio,
  fim,
  user
}) {
  const cabecalho = cabecalhoMapa({ inicio, fim, user })

  if (mapaId) {
    const { error } = await supabase
      .from(TABLE_MAPA)
      .update(cabecalho)
      .eq('id', mapaId)

    if (error) throw error
    return mapaId
  }

  const { data, error } = await supabase
    .from(TABLE_MAPA)
    .insert(cabecalho)
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function salvarUSMapaForca({
  mapaId,
  inicio,
  fim,
  user,
  grupo,
  unidade,
  ordem = 0
}) {
  if (!grupo?.id || !unidade) {
    throw new Error('Selecione o tipo da US.')
  }

  const idMapa = await salvarCabecalhoMapaForca({
    mapaId,
    inicio,
    fim,
    user
  })

  const inicioUs = isoOuNull(unidade.inicioUs) || isoOuNull(inicio)
  const fimUs = isoOuNull(unidade.fimUs) || isoOuNull(fim)

  if (!inicioUs || !fimUs || new Date(fimUs) <= new Date(inicioUs)) {
    throw new Error(`O término da US "${unidade.prefixo || grupo.titulo}" deve ser posterior ao início.`)
  }

  const payload = {
    mapa_id: idMapa,
    grupo_id: grupo.id,
    grupo_titulo: grupo.titulo,
    prefixo: String(unidade.prefixo || grupo.titulo).trim().toUpperCase(),
    tipo: unidade.tipo,
    ordem,
    viatura_id: unidade.viatura?.id || null,
    criada_manualmente: true,
    inicio_us: inicioUs,
    fim_us: fimUs,
    updated_at: new Date().toISOString()
  }

  let usId = unidade.persistido ? unidade.id : null

  if (usId) {
    const { error } = await supabase
      .from(TABLE_US)
      .update(payload)
      .eq('id', usId)
      .eq('mapa_id', idMapa)

    if (error) throw error

    const { error: erroLimparEfetivo } = await supabase
      .from(TABLE_EFETIVO)
      .delete()
      .eq('us_id', usId)

    if (erroLimparEfetivo) throw erroLimparEfetivo
  } else {
    const { data, error } = await supabase
      .from(TABLE_US)
      .insert(payload)
      .select('id')
      .single()

    if (error) throw error
    usId = data.id
  }

  const efetivo = Object.entries(unidade.policiais || {})
    .filter(([, policial]) => policial?.id)
    .map(([funcao, policial], indice) => ({
      mapa_id: idMapa,
      us_id: usId,
      policial_id: policial.id,
      funcao,
      ordem: indice
    }))

  if (efetivo.length) {
    const { error } = await supabase
      .from(TABLE_EFETIVO)
      .insert(efetivo)

    if (error) throw error
  }

  return { mapaId: idMapa, usId }
}

export async function excluirUSMapaForca({ mapaId, usId }) {
  if (!mapaId || !usId) return

  const { error } = await supabase
    .from(TABLE_US)
    .delete()
    .eq('id', usId)
    .eq('mapa_id', mapaId)

  if (error) throw error
}

// Mantida por compatibilidade com a etapa anterior.
export async function salvarMapaForca({ mapaId, inicio, fim, user, grupos }) {
  const id = await salvarCabecalhoMapaForca({ mapaId, inicio, fim, user })

  const { error: erroLimpeza } = await supabase
    .from(TABLE_US)
    .delete()
    .eq('mapa_id', id)

  if (erroLimpeza) throw erroLimpeza

  let ordem = 0
  for (const grupo of grupos || []) {
    for (const unidade of grupo.unidades || []) {
      await salvarUSMapaForca({
        mapaId: id,
        inicio,
        fim,
        user,
        grupo,
        unidade: { ...unidade, persistido: false },
        ordem
      })
      ordem += 1
    }
  }

  return id
}
