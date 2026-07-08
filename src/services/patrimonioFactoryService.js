export function criarPatrimonioService(nomeTabela, supabase) {
  async function listar() {
    const { data, error } = await supabase
      .from(nomeTabela)
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async function buscarPorId(id) {
    const { data, error } = await supabase
      .from(nomeTabela)
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    return data
  }

  async function cadastrar(payload) {
    const { data, error } = await supabase
      .from(nomeTabela)
      .insert(payload)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function atualizar(id, payload) {
    const { data, error } = await supabase
      .from(nomeTabela)
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function excluir(id) {
    const { error } = await supabase
      .from(nomeTabela)
      .delete()
      .eq('id', id)

    if (error) throw error
  }

  return {
    listar,
    buscarPorId,
    cadastrar,
    atualizar,
    excluir
  }
}