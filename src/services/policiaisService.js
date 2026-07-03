import { supabase } from './supabase'

export async function listarPoliciais() {
  const { data, error } = await supabase
    .from('policiais')
    .select('*')
    .order('nome')

  if (error) throw error

  return data
}

export async function buscarPolicialPorRe(re) {
  const { data, error } = await supabase
    .from('policiais')
    .select('*')
    .eq('re', re)
    .maybeSingle()

  if (error) throw error

  return data
}

export async function criarPolicial(policial) {
  const { data, error } = await supabase
    .from('policiais')
    .insert(policial)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function atualizarPolicial(id, policial) {
  const { data, error } = await supabase
    .from('policiais')
    .update(policial)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}

export async function excluirPolicial(id) {
  const { error } = await supabase
    .from('policiais')
    .delete()
    .eq('id', id)

  if (error) throw error
}

export async function salvarCadastroPolicial(form) {
  if (!form.re || !form.nome || !form.posto_graduacao) {
    throw new Error('Informe RE, nome e posto/graduação.')
  }

  const existente = await buscarPolicialPorRe(form.re)

  if (existente) {
    throw new Error('Já existe policial cadastrado com este RE.')
  }

  const policial = await criarPolicial({
    re: form.re.trim(),
    nome: form.nome.trim(),
    nome_guerra: form.nome_guerra?.trim() || null,
    posto_graduacao: form.posto_graduacao,
    companhia: form.companhia || '5ª Companhia',
    pelotao: form.pelotao || null,
    equipe: form.equipe || null,
    funcao: form.funcao || null,
    telefone: form.telefone || null,
    email: form.email || null,
    situacao: form.situacao || 'Ativo',
    observacoes: form.observacoes || null
  })

  return policial
}