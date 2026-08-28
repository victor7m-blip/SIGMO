import { supabase } from './supabaseClient'
import { criarTransferenciaHTPendente } from './htsTransferenciaService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function normalizar(valor) {
  return texto(valor).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
}

export async function encaminharManutencaoAoP4({ manutencao, user, observacao = '' }) {
  if (!manutencao?.id) throw new Error('Manutenção não informada.')
  if (normalizar(manutencao.modulo) !== 'HT') throw new Error('O encaminhamento ao P4 está habilitado somente para HT.')
  if (normalizar(manutencao.status) !== 'EM_MANUTENCAO') throw new Error('Somente manutenção ativa pode ser encaminhada ao P4.')

  const perfil = normalizar(user?.perfil_efetivo || user?.perfil || user?.role || user?.tipo_perfil)
  if (!perfil.includes('SVDD') && !perfil.includes('SERVICO DE DIA')) {
    throw new Error('Somente o SVDD pode encaminhar esta manutenção ao P4.')
  }

  if (!manutencao.patrimonio_id) throw new Error('A manutenção não possui patrimônio central vinculado.')

  const { data: patrimonio, error } = await supabase
    .from('sigmo_patrimonios')
    .select('id,tipo,referencia_id,status,local_atual,ativo')
    .eq('id', manutencao.patrimonio_id)
    .maybeSingle()

  if (error) throw error
  if (!patrimonio?.id) throw new Error('Patrimônio central não encontrado.')

  if (!patrimonio.referencia_id) {
    throw new Error('O patrimônio central não possui referência do HT.')
  }

  // A transferência deve usar a Engine patrimonial específica de HT.
  // Ela valida a custódia diretamente em sigmo_hts, mantém o HT no SVDD
  // enquanto estiver pendente e preserva MANUTENCAO no recebimento pelo P4.
  const movimentacao = await criarTransferenciaHTPendente({
    htId: patrimonio.referencia_id,
    origemCodigo: 'SVDD',
    destinoCodigo: 'P4',
    user
  })

  const movimentacaoId =
    typeof movimentacao === 'string'
      ? movimentacao
      : movimentacao?.id || null

  if (!movimentacaoId) {
    throw new Error('A transferência foi criada sem identificador.')
  }

  return {
    movimentacao_id: movimentacaoId,
    manutencao_id: manutencao.id,
    observacao: texto(observacao) || null
  }
}
