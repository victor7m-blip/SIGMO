import { supabase } from './supabaseClient'
import { listarNovidadesPatrimoniais } from './dashboardService'
import { listarMovimentacoes, buscarMovimentacaoPorId } from './movimentacoesService'
import { obterPerfilEfetivo, normalizarPerfil } from './permissionService'

function texto(valor) {
  return String(valor ?? '').trim()
}

function upper(valor) {
  return texto(valor).toUpperCase()
}

function contem(valor, termos) {
  const alvo = upper(valor)
  return termos.some((termo) => alvo.includes(termo))
}

function dataItem(item) {
  return item?.created_at || item?.atualizado_em || item?.updated_at || null
}

function ordenarRecentes(lista) {
  return [...lista].sort((a, b) => {
    const da = new Date(dataItem(a) || 0).getTime()
    const db = new Date(dataItem(b) || 0).getTime()
    return db - da
  })
}

function perfilCentral(user) {
  return normalizarPerfil(obterPerfilEfetivo(user))
}

function pertenceAoPerfil(item, perfil) {
  if (!item || !perfil) return true
  if (perfil === 'ADMINISTRADOR') return true

  const origem = upper(item.origem_local || item.local_origem || item.origem)
  const destino = upper(item.destino_local || item.local_destino || item.destino)
  const conjunto = `${origem} ${destino}`

  if (perfil.includes('SVDD')) {
    return contem(conjunto, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE'])
  }

  if (perfil.includes('P4')) {
    return contem(conjunto, ['P4', 'DEPÓSITO', 'DEPOSITO'])
  }

  return true
}


async function listarTransferenciasOperacionaisPendentes() {
  const { data, error } = await supabase
    .from('sigmo_transferencias_patrimoniais')
    .select('*')
    .eq('status', 'PENDENTE')
    .order('enviado_em', { ascending: true })
    .limit(500)

  if (error) throw error
  return data ?? []
}

function transferenciaParaPerfil(item, perfil) {
  if (!item || !perfil) return true
  if (perfil === 'ADMINISTRADOR') return true

  const destino = upper(item.destino_codigo || item.destino_nome)

  if (perfil.includes('SVDD')) {
    return contem(destino, ['SVDD', 'SERVIÇO DE DIA', 'SERVICO DE DIA', 'COFRE'])
  }

  if (perfil.includes('P4')) {
    return contem(destino, ['P4', 'DEPÓSITO', 'DEPOSITO'])
  }

  return false
}


async function listarBaixasAguardandoAprovacao() {
  const { data, error } = await supabase
    .from('sigmo_patrimonio_baixas')
    .select('*')
    .eq('status', 'AGUARDANDO_APROVACAO')
    .order('solicitada_em', { ascending: false })

  if (error) throw error

  return (data ?? []).map((item) => ({
    ...item,
    origem_aprovacao: 'BAIXA_PATRIMONIAL',
    tipo: `BAIXA ${upper(item.modulo) || 'PATRIMONIAL'}`,
    created_at: item.solicitada_em || item.created_at
  }))
}

function aprovacoesVisiveisAoPerfil({ movimentacoes = [], baixas = [], perfil }) {
  const aprovacoesMovimentacao = movimentacoes
    .filter((item) =>
      contem(item.status, [
        'AGUARDANDO_APROVACAO',
        'AGUARDANDO APROVACAO',
        'PENDENTE_APROVACAO',
        'PENDENTE APROVACAO'
      ])
    )
    .map((item) => ({
      ...item,
      origem_aprovacao: 'MOVIMENTACAO'
    }))

  // Baixa patrimonial é decidida pelo Comandante/Admin. P4 e SVDD podem
  // acompanhar seus próprios fluxos em módulos específicos, mas não recebem
  // a decisão como pendência operacional na Central.
  const podeDecidirBaixa =
    perfil === 'ADMINISTRADOR' ||
    perfil.includes('COMANDANTE')

  return ordenarRecentes([
    ...aprovacoesMovimentacao,
    ...(podeDecidirBaixa ? baixas : [])
  ])
}


function normalizarSemAcentos(valor) {
  return texto(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

function patrimonioEstaBaixado(item) {
  const status = normalizarSemAcentos(
    item?.status_operacional || item?.status
  )

  // "INATIVO" e "EXCLUIDO" podem representar registros centrais antigos
  // ou substituídos. O card Baixados deve refletir somente baixa patrimonial
  // explícita para não misturar histórico técnico com baixa operacional.
  return status === 'BAIXADO'
}

function patrimonioNaoLocalizado(item) {
  if (patrimonioEstaBaixado(item)) return false

  const status = normalizarSemAcentos(
    item?.status_operacional || item?.status
  )
  const local = normalizarSemAcentos(item?.local_atual)

  // Mesma convenção já utilizada por Armas/HT/Tonfas: status/local explícito
  // ou ausência de localização operacional.
  return (
    status.includes('NAO LOCALIZ') ||
    local.includes('NAO LOCALIZ') ||
    !local
  )
}

async function listarPatrimoniosIndicadores() {
  const { data, error } = await supabase
    .from('sigmo_patrimonios')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function carregarCentralOperacional({ user } = {}) {
  const perfil = perfilCentral(user)

  const resultados = await Promise.allSettled([
    listarMovimentacoes(),
    listarTransferenciasOperacionaisPendentes(),
    listarNovidadesPatrimoniais({ limite: 20 }),
    listarPatrimoniosIndicadores(),
    listarBaixasAguardandoAprovacao()
  ])

  const [movRes, transfRes, novRes, patRes, baixasRes] = resultados
  const movimentacoes = movRes.status === 'fulfilled' ? movRes.value : []
  const transferencias = transfRes.status === 'fulfilled' ? transfRes.value : []
  const novidades = novRes.status === 'fulfilled' ? novRes.value : []
  const patrimonios = patRes.status === 'fulfilled' ? patRes.value : []
  const baixasAprovacao = baixasRes.status === 'fulfilled' ? baixasRes.value : []

  const movPerfil = movimentacoes.filter((item) => pertenceAoPerfil(item, perfil))
  const transfPerfil = transferencias.filter((item) => transferenciaParaPerfil(item, perfil))

  const aguardandoAprovacao = aprovacoesVisiveisAoPerfil({
    movimentacoes: movPerfil,
    baixas: baixasAprovacao,
    perfil
  })

  // A Engine usa estados positivos de pendência. Não inferimos pendência
  // simplesmente por "não estar concluída", pois FINALIZADA é histórico.
  const statusRecebimentoPendente = [
    'AGUARDANDO_RECEBIMENTO',
    'AGUARDANDO RECEBIMENTO',
    'PENDENTE_RECEBIMENTO',
    'PENDENTE RECEBIMENTO'
  ]

  const statusDevolucaoPendente = [
    ...statusRecebimentoPendente,
    'ALTERACAO_SOLICITADA',
    'ALTERAÇÃO SOLICITADA',
    'EM_ANDAMENTO',
    'EM ANDAMENTO'
  ]

  const aguardandoRecebimentoBase = movPerfil.filter((item) =>
    contem(item.status, statusRecebimentoPendente)
  )

  // Só detalhamos as pendências exibidas na Central. Isso permite mostrar
  // destinatário, itens e quantidades sem alterar a Engine de movimentação.
  const aguardandoRecebimento = await Promise.all(
    aguardandoRecebimentoBase.map(async (item) => {
      try {
        return await buscarMovimentacaoPorId(item.id) || item
      } catch {
        return item
      }
    })
  )

  const devolucoes = movPerfil.filter((item) =>
    contem(item.tipo_movimentacao, ['DEVOLUÇÃO', 'DEVOLUCAO', 'RETORNO']) &&
    contem(item.status, statusDevolucaoPendente)
  )

  const baixados = patrimonios.filter(patrimonioEstaBaixado)

  const naoLocalizados = patrimonios.filter(patrimonioNaoLocalizado)

  return {
    perfil,
    atualizadoEm: new Date().toISOString(),
    alertas: [
      { key: 'aprovacoes', titulo: 'Aguardando aprovações', total: aguardandoAprovacao.length, itens: ordenarRecentes(aguardandoAprovacao), tom: 'atencao' },
      { key: 'recebimentos', titulo: 'Aguardando recebimento pelo usuário', total: aguardandoRecebimento.length, itens: ordenarRecentes(aguardandoRecebimento), tom: 'acao' },
      { key: 'devolucoes', titulo: 'Devoluções pendentes', total: devolucoes.length, itens: ordenarRecentes(devolucoes), tom: 'acao' },
      { key: 'transferencias', titulo: 'Transferências pendentes', total: transfPerfil.length, itens: ordenarRecentes(transfPerfil), tom: 'atencao' }
    ],
    indicadores: [
      { key: 'nao-localizados', titulo: 'Não localizados', total: naoLocalizados.length, itens: naoLocalizados },
      { key: 'baixados', titulo: 'Baixados', total: baixados.length, itens: baixados },
      { key: 'novidades', titulo: 'Novidades patrimoniais', total: novidades.length, itens: novidades }
    ]
  }
}
