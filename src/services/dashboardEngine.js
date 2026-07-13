import { supabase } from './supabaseClient'

const FONTES = [
  {
    titulo: 'Materiais',
    tabela: 'sigmo_materiais'
  },
  {
    titulo: 'Armas',
    tabela: 'sigmo_armas'
  },
  {
    titulo: 'Munições',
    tabela: 'sigmo_municoes'
  },
  {
    titulo: 'Policiais',
    tabela: 'policiais'
  }
]

async function contarTabela(tabela) {
  const { count } = await supabase
    .from(tabela)
    .select('*', {
      head: true,
      count: 'exact'
    })

  return count || 0
}

export async function carregarDashboard() {
  const cards = await Promise.all(
    FONTES.map(async (fonte) => ({
      titulo: fonte.titulo,
      total: await contarTabela(fonte.tabela)
    }))
  )

  return {
    cards
  }
}