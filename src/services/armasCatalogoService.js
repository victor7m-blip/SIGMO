import { supabase } from './supabaseClient'

function normalizarValor(valor) {
  return String(valor || '')
    .trim()
    .toUpperCase()
}

export async function registrarMarcaArma(marca) {
  const nome = normalizarValor(marca)

  if (!nome) return null

  const {
    data: existente,
    error: selectError
  } = await supabase
    .from('sigmo_armas_marcas')
    .select('id, nome, ativo')
    .eq('nome', nome)
    .maybeSingle()

  if (selectError) {
    throw selectError
  }

  if (existente) {
    if (!existente.ativo) {
      const {
        data,
        error
      } = await supabase
        .from('sigmo_armas_marcas')
        .update({
          ativo: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existente.id)
        .select()
        .single()

      if (error) throw error

      return data
    }

    return existente
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_armas_marcas')
    .insert({
      nome,
      ativo: true
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return null
    }

    throw error
  }

  return data
}

export async function registrarModeloArma({
  modelo,
  marca
}) {
  const nome = normalizarValor(modelo)
  const marcaNormalizada =
    normalizarValor(marca) || null

  if (!nome) return null

  let query = supabase
    .from('sigmo_armas_modelos')
    .select('id, nome, marca, ativo')
    .eq('nome', nome)

  if (marcaNormalizada) {
    query = query.eq(
      'marca',
      marcaNormalizada
    )
  } else {
    query = query.is('marca', null)
  }

  const {
    data: existente,
    error: selectError
  } = await query.maybeSingle()

  if (selectError) {
    throw selectError
  }

  if (existente) {
    if (!existente.ativo) {
      const {
        data,
        error
      } = await supabase
        .from('sigmo_armas_modelos')
        .update({
          ativo: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', existente.id)
        .select()
        .single()

      if (error) throw error

      return data
    }

    return existente
  }

  const {
    data,
    error
  } = await supabase
    .from('sigmo_armas_modelos')
    .insert({
      nome,
      marca: marcaNormalizada,
      ativo: true
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return null
    }

    throw error
  }

  return data
}

export async function registrarCatalogoArma({
  marca,
  modelo
}) {
  const marcaNormalizada =
    normalizarValor(marca)

  const modeloNormalizado =
    normalizarValor(modelo)

  if (marcaNormalizada) {
    await registrarMarcaArma(
      marcaNormalizada
    )
  }

  if (modeloNormalizado) {
    await registrarModeloArma({
      modelo: modeloNormalizado,
      marca: marcaNormalizada
    })
  }
}

export async function listarMarcasArmas() {
  const {
    data,
    error
  } = await supabase
    .from('sigmo_armas_marcas')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome', {
      ascending: true
    })

  if (error) throw error

  return data || []
}

export async function listarModelosArmas({
  marca = ''
} = {}) {
  let query = supabase
    .from('sigmo_armas_modelos')
    .select('id, nome, marca')
    .eq('ativo', true)
    .order('nome', {
      ascending: true
    })

  const marcaNormalizada =
    normalizarValor(marca)

  if (marcaNormalizada) {
    query = query.eq(
      'marca',
      marcaNormalizada
    )
  }

  const {
    data,
    error
  } = await query

  if (error) throw error

  return data || []
}