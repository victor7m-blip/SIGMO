import { supabase } from './supabaseClient'

const TABLE = 'sigmo_releases'

export async function buscarUltimaRelease() {
  const {
    data,
    error
  } = await supabase
    .from(TABLE)
    .select(`
      id,
      versao,
      titulo,
      descricao,
      novidades,
      data_publicacao
    `)
    .eq('ativo', true)
    .order('data_publicacao', {
      ascending: false
    })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error(
      'Erro ao carregar última atualização:',
      error
    )

    return null
  }

  return data
}