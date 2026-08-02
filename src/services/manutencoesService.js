import { supabase } from './supabaseClient'
import { criarOuAtualizarPatrimonio } from './patrimoniosService'
import { criarNotificacaoParaPerfil } from './notificacoesService'

const TABLE = 'sigmo_manutencoes'
const BUCKET = 'manutencoes-fotos'
const TABELA_FOTOS = 'sigmo_manutencoes_fotos'

export const MODULOS_MANUTENCAO = Object.freeze({
  ARMAS: 'ARMAS',
  TONFAS: 'TONFAS',
  HT: 'HT',
  TPD: 'TPD',
  TASER: 'TASER',
  MUNICAO: 'MUNICAO',
  COLETE: 'COLETE',
  OUTROS: 'OUTROS'
})

export const STATUS_MANUTENCAO = Object.freeze({
  EM_MANUTENCAO: 'EM_MANUTENCAO',
  CONCLUIDA: 'CONCLUIDA',
  CANCELADA: 'CANCELADA'
})

function texto(valor) {
  return String(valor ?? '').trim()
}

function maiusculo(valor) {
  return texto(valor).toUpperCase()
}

function inteiroPositivo(valor, padrao = 0) {
  const numero = Number(valor)

  if (!Number.isFinite(numero)) {
    return padrao
  }

  return Math.max(0, Math.trunc(numero))
}

function obterUsuarioId(user) {
  return (
    user?.id ||
    user?.user_id ||
    user?.usuario_id ||
    user?.usuario?.id ||
    null
  )
}

function obterUsuarioNome(user) {
  return (
    user?.nome_guerra ||
    user?.nome ||
    user?.nome_completo ||
    user?.usuario?.nome_guerra ||
    user?.usuario?.nome ||
    user?.user_metadata?.nome ||
    user?.user_metadata?.full_name ||
    user?.email ||
    'USUÁRIO SIGMO'
  )
}

function validarModulo(modulo) {
  const valor = maiusculo(modulo)
  const permitidos = Object.values(MODULOS_MANUTENCAO)

  if (!permitidos.includes(valor)) {
    throw new Error(
      `Módulo de manutenção inválido: ${valor || 'NÃO INFORMADO'}.`
    )
  }

  return valor
}

function validarStatus(status) {
  const valor =
    maiusculo(status) || STATUS_MANUTENCAO.EM_MANUTENCAO

  const permitidos = Object.values(STATUS_MANUTENCAO)

  if (!permitidos.includes(valor)) {
    throw new Error(`Status de manutenção inválido: ${valor}.`)
  }

  return valor
}

function obterExtensaoArquivo(arquivo) {
  const nome = texto(arquivo?.name)

  const extensaoNome = nome.includes('.')
    ? nome.split('.').pop().toLowerCase()
    : ''

  if (['jpg', 'jpeg', 'png', 'webp'].includes(extensaoNome)) {
    return extensaoNome === 'jpeg' ? 'jpg' : extensaoNome
  }

  const tipo = texto(arquivo?.type).toLowerCase()

  if (tipo === 'image/png') return 'png'
  if (tipo === 'image/webp') return 'webp'

  return 'jpg'
}


function ehArquivo(valor) {
  return (
    valor &&
    typeof valor === 'object' &&
    typeof valor.arrayBuffer === 'function' &&
    typeof valor.name === 'string'
  )
}

function normalizarArquivosFotos({
  foto = null,
  fotos = []
} = {}) {
  const candidatos = [
    ...(Array.isArray(fotos) ? fotos : []),
    ...(foto ? [foto] : [])
  ]

  const arquivos = []

  for (const candidato of candidatos) {
    if (
      ehArquivo(candidato) &&
      !arquivos.includes(candidato)
    ) {
      arquivos.push(candidato)
    }
  }

  return arquivos
}

function criarCaminhoFoto({ modulo, referenciaId, arquivo }) {
  const extensao = obterExtensaoArquivo(arquivo)

  const identificador =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return [
    maiusculo(modulo).toLowerCase(),
    texto(referenciaId) || 'sem-referencia',
    `${identificador}.${extensao}`
  ].join('/')
}

async function uploadFotoManutencao({
  modulo,
  referenciaId,
  arquivo
}) {
  if (!arquivo) {
    return {
      foto_url: null,
      foto_caminho: null
    }
  }

  if (!texto(arquivo.type).toLowerCase().startsWith('image/')) {
    throw new Error('O arquivo da manutenção deve ser uma imagem.')
  }

  const limiteBytes = 5 * 1024 * 1024

  if (Number(arquivo.size || 0) > limiteBytes) {
    throw new Error(
      'A foto da manutenção deve possuir no máximo 5 MB.'
    )
  }

  const caminho = criarCaminhoFoto({
    modulo,
    referenciaId,
    arquivo
  })

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, arquivo, {
      cacheControl: '3600',
      upsert: false,
      contentType: arquivo.type || undefined
    })

  if (uploadError) {
    throw new Error(
      `Não foi possível enviar a foto da manutenção: ${uploadError.message}`
    )
  }

  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(caminho)

  const fotoUrl = data?.publicUrl || null

  if (!fotoUrl) {
    await supabase.storage.from(BUCKET).remove([caminho])

    throw new Error(
      'Não foi possível gerar a URL pública da foto da manutenção.'
    )
  }

  return {
    foto_url: fotoUrl,
    foto_caminho: caminho
  }
}

async function removerFotoPorCaminho(caminho) {
  if (!caminho) return

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([caminho])

  if (error) {
    console.error('Erro ao remover foto de manutenção:', error)
  }
}

export async function listarFotosManutencao(manutencaoId) {
  const { data, error } = await supabase
    .from(TABELA_FOTOS)
    .select('*')
    .eq('manutencao_id', manutencaoId)
    .order('principal', { ascending: false })
    .order('ordem', { ascending: true })
    .order('criada_em', { ascending: true })

  if (error) throw error

  return data || []
}

export async function adicionarFotoManutencao({
  manutencaoId,
  modulo,
  referenciaId,
  arquivo,
  categoria = 'ENTRADA',
  tipo = 'GERAL',
  legenda = '',
  principal = false,
  user = null
}) {
  const foto = await uploadFotoManutencao({
    modulo,
    referenciaId,
    arquivo
  })

  if (principal) {
    await supabase
      .from(TABELA_FOTOS)
      .update({ principal: false })
      .eq('manutencao_id', manutencaoId)
  }

  const { data, error } = await supabase
    .from(TABELA_FOTOS)
    .insert({
      manutencao_id: manutencaoId,
      foto_url: foto.foto_url,
      foto_caminho: foto.foto_caminho,
      categoria,
      tipo,
      legenda,
      principal,
      criada_por_id: obterUsuarioId(user),
      criada_por_nome: obterUsuarioNome(user)
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export async function definirFotoPrincipal(fotoId, manutencaoId) {
  await supabase
    .from(TABELA_FOTOS)
    .update({ principal: false })
    .eq('manutencao_id', manutencaoId)

  const { error } = await supabase
    .from(TABELA_FOTOS)
    .update({ principal: true })
    .eq('id', fotoId)

  if (error) throw error
}

export async function excluirFotoManutencaoFoto(fotoId) {
  const { data, error } = await supabase
    .from(TABELA_FOTOS)
    .select('*')
    .eq('id', fotoId)
    .single()

  if (error) throw error

  if (data?.foto_caminho) {
    await removerFotoPorCaminho(data.foto_caminho)
  }

  const { error: deleteError } = await supabase
    .from(TABELA_FOTOS)
    .delete()
    .eq('id', fotoId)

  if (deleteError) throw deleteError
}

function normalizarManutencao(item = {}) {
  return {
    ...item,
    modulo: maiusculo(item.modulo),
    tipo_material: maiusculo(item.tipo_material),
    quantidade: inteiroPositivo(item.quantidade, 1),
    status: validarStatus(item.status),
    tipo_novidade: maiusculo(item.tipo_novidade) || null,
    origem: maiusculo(item.origem) || null,
    destino: maiusculo(item.destino) || null
  }
}

export async function registrarManutencao({
  modulo,
  tipoMaterial,
  referenciaId,
  patrimonioId = null,
  movimentacaoId = null,
  quantidade = 1,
  tipoNovidade = null,
  descricao = null,
  observacoes = null,
  origem = null,
  destino = 'MANUTENCAO',
  policial = null,
  foto = null,
  fotos = [],
  user = null
}) {
  const moduloValido =
    validarModulo(modulo)

  const referenciaValida =
    texto(referenciaId)

  if (!referenciaValida) {
    throw new Error(
      'A referência do material não foi informada.'
    )
  }

  const tipoValido =
    maiusculo(tipoMaterial)

  if (!tipoValido) {
    throw new Error(
      'O tipo do material não foi informado.'
    )
  }

  const quantidadeValida =
    inteiroPositivo(quantidade)

  if (quantidadeValida <= 0) {
    throw new Error(
      'A quantidade da manutenção deve ser maior que zero.'
    )
  }

  const arquivos =
    normalizarArquivosFotos({
      foto,
      fotos
    })

  const fotosEnviadas = []
  let manutencaoCriada = null

  try {
    for (
      let indice = 0;
      indice < arquivos.length;
      indice += 1
    ) {
      const arquivo =
        arquivos[indice]

      const fotoEnviada =
        await uploadFotoManutencao({
          modulo:
            moduloValido,

          referenciaId:
            referenciaValida,

          arquivo
        })

      fotosEnviadas.push({
        ...fotoEnviada,
        arquivo,
        ordem:
          indice + 1,

        principal:
          indice === 0
      })
    }

    const fotoPrincipal =
      fotosEnviadas[0] || {
        foto_url: null,
        foto_caminho: null
      }

    const payload = {
      modulo:
        moduloValido,

      tipo_material:
        tipoValido,

      referencia_id:
        referenciaValida,

      patrimonio_id:
        patrimonioId || null,

      movimentacao_id:
        movimentacaoId || null,

      quantidade:
        quantidadeValida,

      tipo_novidade:
        maiusculo(tipoNovidade) ||
        null,

      descricao:
        maiusculo(descricao) ||
        null,

      observacoes:
        maiusculo(observacoes) ||
        null,

      origem:
        maiusculo(origem) ||
        null,

      destino:
        maiusculo(destino) ||
        'MANUTENCAO',

      policial_id:
        policial?.id ||
        policial?.policial_id ||
        null,

      policial_re:
        texto(
          policial?.re ||
          policial?.policial_re
        ) || null,

      policial_nome:
        texto(
          policial?.nome_guerra ||
          policial?.nome ||
          policial?.nome_completo ||
          policial?.policial_nome
        ) || null,

      foto_url:
        fotoPrincipal.foto_url,

      foto_caminho:
        fotoPrincipal.foto_caminho,

      status:
        STATUS_MANUTENCAO.EM_MANUTENCAO,

      registrada_por_id:
        obterUsuarioId(user),

      registrada_por_nome:
        obterUsuarioNome(user)
    }

    const {
      data,
      error
    } = await supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error) {
      throw error
    }

    manutencaoCriada = data

    if (
      fotosEnviadas.length > 0
    ) {
      const registrosFotos =
        fotosEnviadas.map(
          (item) => ({
            manutencao_id:
              data.id,

            foto_url:
              item.foto_url,

            foto_caminho:
              item.foto_caminho,

            categoria:
              'ENTRADA',

            tipo:
              maiusculo(
                tipoNovidade
              ) ||
              'GERAL',

            legenda:
              texto(descricao) ||
              null,

            principal:
              item.principal,

            ordem:
              item.ordem,

            criada_por_id:
              obterUsuarioId(user),

            criada_por_nome:
              obterUsuarioNome(user)
          })
        )

      const {
        error: fotosError
      } = await supabase
        .from(TABELA_FOTOS)
        .insert(
          registrosFotos
        )

      if (fotosError) {
        throw fotosError
      }
    }

    return normalizarManutencao(
      data
    )
  } catch (error) {
    if (manutencaoCriada?.id) {
      try {
        await supabase
          .from(TABLE)
          .delete()
          .eq(
            'id',
            manutencaoCriada.id
          )
      } catch (rollbackError) {
        console.error(
          'Erro ao desfazer manutenção sem fotos:',
          rollbackError
        )
      }
    }

    for (
      const fotoEnviada of fotosEnviadas
    ) {
      await removerFotoPorCaminho(
        fotoEnviada.foto_caminho
      )
    }

    throw error
  }
}

export async function listarManutencoes({
  modulo = null,
  status = STATUS_MANUTENCAO.EM_MANUTENCAO,
  tipoMaterial = null,
  referenciaId = null,
  policialId = null,
  pesquisa = null,
  pagina = 1,
  limite = 50
} = {}) {
  const paginaValida = Math.max(1, inteiroPositivo(pagina, 1))
  const limiteValido = Math.min(
    200,
    Math.max(1, inteiroPositivo(limite, 50))
  )

  const inicio = (paginaValida - 1) * limiteValido
  const fim = inicio + limiteValido - 1

  let query = supabase
    .from(TABLE)
    .select('*', { count: 'exact' })
    .order('registrada_em', { ascending: false })
    .range(inicio, fim)

  if (modulo) {
    query = query.eq('modulo', validarModulo(modulo))
  }

  if (status) {
    query = query.eq('status', validarStatus(status))
  }

  if (tipoMaterial) {
    query = query.eq('tipo_material', maiusculo(tipoMaterial))
  }

  if (referenciaId) {
    query = query.eq('referencia_id', referenciaId)
  }

  if (policialId) {
    query = query.eq('policial_id', policialId)
  }

  const termo = texto(pesquisa).replace(/[%(),]/g, '')

  if (termo) {
    query = query.or(
      [
        `tipo_material.ilike.%${termo}%`,
        `tipo_novidade.ilike.%${termo}%`,
        `descricao.ilike.%${termo}%`,
        `observacoes.ilike.%${termo}%`,
        `policial_nome.ilike.%${termo}%`,
        `policial_re.ilike.%${termo}%`
      ].join(',')
    )
  }

  const { data, error, count } = await query

  if (error) throw error

  return {
    data: (data || []).map(normalizarManutencao),
    total: count || 0,
    pagina: paginaValida,
    limite: limiteValido
  }
}

export async function buscarManutencao(manutencaoId) {
  if (!manutencaoId) {
    throw new Error('Manutenção não informada.')
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('id', manutencaoId)
    .single()

  if (error) throw error

  return normalizarManutencao(data)
}

async function aplicarRetornoTonfa(manutencao, user) {
  const { data: tonfa, error } = await supabase
    .from('sigmo_tonfas')
    .select('*')
    .eq('id', manutencao.referencia_id)
    .single()

  if (error) throw error

  const quantidade = inteiroPositivo(manutencao.quantidade, 1)
  const emManutencao = inteiroPositivo(tonfa.quantidade_manutencao)

  if (quantidade > emManutencao) {
    throw new Error(
      `A manutenção possui ${quantidade} unidade(s), mas o estoque registra apenas ${emManutencao} em manutenção.`
    )
  }

  const origem = maiusculo(manutencao.origem)
  const retornarAoP4 = origem === 'P4'

  const quantidadeP4 =
    inteiroPositivo(tonfa.quantidade_p4) +
    (retornarAoP4 ? quantidade : 0)

  const quantidadeSvdd =
    inteiroPositivo(tonfa.quantidade_svdd) +
    (retornarAoP4 ? 0 : quantidade)

  const quantidadeEmServico =
    inteiroPositivo(tonfa.quantidade_em_servico)

  const quantidadeManutencao =
    emManutencao - quantidade

  const locais = []
  if (quantidadeP4 > 0) locais.push(`${quantidadeP4} no P4`)
  if (quantidadeSvdd > 0) locais.push(`${quantidadeSvdd} no Cofre do SVDD`)
  if (quantidadeEmServico > 0) locais.push(`${quantidadeEmServico} em serviço`)
  if (quantidadeManutencao > 0) locais.push(`${quantidadeManutencao} em manutenção`)

  const statusOperacional =
    quantidadeEmServico > 0 || quantidadeSvdd > 0
      ? 'CARGA'
      : quantidadeP4 > 0
        ? 'RESERVA'
        : quantidadeManutencao > 0
          ? 'MANUTENCAO'
          : 'RECOLHIDO'

  const payloadAnterior = {
    quantidade_p4: tonfa.quantidade_p4,
    quantidade_svdd: tonfa.quantidade_svdd,
    quantidade_em_servico: tonfa.quantidade_em_servico,
    quantidade_manutencao: tonfa.quantidade_manutencao,
    quantidade_disponivel: tonfa.quantidade_disponivel,
    status_operacional: tonfa.status_operacional,
    local_atual: tonfa.local_atual
  }

  const payloadNovo = {
    quantidade_p4: quantidadeP4,
    quantidade_svdd: quantidadeSvdd,
    quantidade_em_servico: quantidadeEmServico,
    quantidade_manutencao: quantidadeManutencao,
    quantidade_disponivel: quantidadeP4,
    status_operacional: statusOperacional,
    local_atual: locais.join(' • ') || 'SEM LOCAL DEFINIDO'
  }

  const { data: atualizada, error: updateError } = await supabase
    .from('sigmo_tonfas')
    .update(payloadNovo)
    .eq('id', tonfa.id)
    .select()
    .single()

  if (updateError) throw updateError

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'tonfa',
      referencia_id: atualizada.id,
      dados: atualizada,
      user,
      local_atual: atualizada.local_atual,
      companhia_atual: atualizada.unidade || ''
    })
  } catch (error) {
    await supabase
      .from('sigmo_tonfas')
      .update(payloadAnterior)
      .eq('id', tonfa.id)

    throw error
  }

  return {
    tonfa: atualizada,
    rollback: async () => {
      const { data: restaurada, error: rollbackError } = await supabase
        .from('sigmo_tonfas')
        .update(payloadAnterior)
        .eq('id', tonfa.id)
        .select()
        .single()

      if (rollbackError) throw rollbackError

      await criarOuAtualizarPatrimonio({
        tipo: 'tonfa',
        referencia_id: restaurada.id,
        dados: restaurada,
        user,
        local_atual: restaurada.local_atual,
        companhia_atual: restaurada.unidade || ''
      })
    }
  }
}


async function notificarP4SaidaManutencao({ manutencao, ht, user }) {
  const identificacao = ht?.patrimonio || ht?.numero_serie || 'HT'
  const perfis = ['ADMINISTRADOR']

  for (const perfil of perfis) {
    try {
      await criarNotificacaoParaPerfil({
        perfil,
        titulo: 'Saída de manutenção aprovada',
        mensagem: `${identificacao} teve o retorno da manutenção registrado e ficou disponível em ${ht?.local_atual || 'seu guardião atual'}.`,
        tipo: 'PATRIMONIO',
        modulo: 'HT',
        prioridade: 'NORMAL',
        link: 'ht',
        metadata: {
          modulo: 'HT',
          ht_id: ht?.id || manutencao?.referencia_id || null,
          manutencao_id: manutencao?.id || null,
          aprovado_por: obterUsuarioNome(user)
        }
      })
    } catch (error) {
      console.warn(`Saída do HT concluída, mas não foi possível notificar o perfil ${perfil}:`, error)
    }
  }
}

async function aplicarRetornoHT(manutencao, user) {
  const { data: ht, error } = await supabase
    .from('sigmo_hts')
    .select('*')
    .eq('id', manutencao.referencia_id)
    .single()

  if (error) throw error

  if (maiusculo(ht.status_operacional) !== 'MANUTENCAO') {
    throw new Error('O HT não está registrado como em manutenção.')
  }

  const payloadAnterior = {
    status_operacional: ht.status_operacional,
    local_atual: ht.local_atual,
    equipe_vinculada: ht.equipe_vinculada,
    viatura_vinculada: ht.viatura_vinculada
  }

  const localAtual = maiusculo(ht.local_atual)
  const retornoAoSVDD =
    localAtual.includes('SVDD') ||
    localAtual.includes('SERVICO DE DIA')

  const payloadNovo = {
    status_operacional: 'RESERVA',
    local_atual: retornoAoSVDD ? 'COFRE DO SVDD' : 'DEPÓSITO P4',
    equipe_vinculada: null,
    viatura_vinculada: null,
    ativo: true
  }

  const { data: atualizado, error: updateError } = await supabase
    .from('sigmo_hts')
    .update(payloadNovo)
    .eq('id', ht.id)
    .select()
    .single()

  if (updateError) throw updateError

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'ht',
      referencia_id: atualizado.id,
      dados: atualizado,
      user,
      local_atual: atualizado.local_atual,
      companhia_atual: atualizado.unidade || ''
    })
  } catch (error) {
    await supabase
      .from('sigmo_hts')
      .update(payloadAnterior)
      .eq('id', ht.id)

    throw error
  }

  return {
    ht: atualizado,
    rollback: async () => {
      const { data: restaurado, error: rollbackError } = await supabase
        .from('sigmo_hts')
        .update(payloadAnterior)
        .eq('id', ht.id)
        .select()
        .single()

      if (rollbackError) throw rollbackError

      await criarOuAtualizarPatrimonio({
        tipo: 'ht',
        referencia_id: restaurado.id,
        dados: restaurado,
        user,
        local_atual: restaurado.local_atual,
        companhia_atual: restaurado.unidade || ''
      })
    }
  }
}

async function aplicarRetornoPatrimonial(manutencao, user) {
  if (manutencao.modulo === MODULOS_MANUTENCAO.TONFAS) {
    return aplicarRetornoTonfa(manutencao, user)
  }

  if (manutencao.modulo === MODULOS_MANUTENCAO.HT) {
    return aplicarRetornoHT(manutencao, user)
  }

  return {
    rollback: async () => {}
  }
}

export async function concluirManutencao({
  manutencaoId,
  servicoExecutado = null,
  observacoes = null,
  fotos = [],
  user = null
}) {
  if (!manutencaoId) {
    throw new Error('Manutenção não informada.')
  }

  const atual = await buscarManutencao(manutencaoId)

  if (atual.status !== STATUS_MANUTENCAO.EM_MANUTENCAO) {
    throw new Error('Esta manutenção não está mais ativa.')
  }

  const retorno = await aplicarRetornoPatrimonial(atual, user)
  const agora = new Date().toISOString()

  const blocoRetorno = [
    texto(servicoExecutado)
      ? `SERVIÇO EXECUTADO: ${maiusculo(servicoExecutado)}`
      : null,
    texto(observacoes)
      ? `OBSERVAÇÕES DO RETORNO: ${maiusculo(observacoes)}`
      : null,
    `RETORNO REGISTRADO EM: ${new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(agora))}`
  ]
    .filter(Boolean)
    .join(' | ')

  const observacoesFinais =
    [texto(atual.observacoes), blocoRetorno]
      .filter(Boolean)
      .join(' | ') || null

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: STATUS_MANUTENCAO.CONCLUIDA,
        observacoes: observacoesFinais,
        concluida_em: agora,
        concluida_por_id: obterUsuarioId(user),
        concluida_por_nome: obterUsuarioNome(user),
        atualizado_em: agora
      })
      .eq('id', manutencaoId)
      .eq('status', STATUS_MANUTENCAO.EM_MANUTENCAO)
      .select()
      .single()

    if (error) throw error

    if (atual.modulo === MODULOS_MANUTENCAO.HT && retorno?.ht) {
      await notificarP4SaidaManutencao({
        manutencao: data,
        ht: retorno.ht,
        user
      })
    }

    const arquivosRetorno = normalizarArquivosFotos({ fotos })

    for (let indice = 0; indice < arquivosRetorno.length; indice += 1) {
      await adicionarFotoManutencao({
        manutencaoId,
        modulo: atual.modulo,
        referenciaId: atual.referencia_id,
        arquivo: arquivosRetorno[indice],
        categoria: 'RETORNO',
        tipo: 'RETORNO_MANUTENCAO',
        legenda: texto(servicoExecutado) || 'RETORNO DA MANUTENÇÃO',
        principal: false,
        user
      })
    }

    return normalizarManutencao(data)
  } catch (error) {
    try {
      await retorno.rollback()
    } catch (rollbackError) {
      console.error('Erro ao desfazer retorno da manutenção:', rollbackError)
    }
    throw error
  }
}

export async function cancelarManutencao({
  manutencaoId,
  motivo = null,
  user = null
}) {
  if (!manutencaoId) {
    throw new Error('Manutenção não informada.')
  }

  const atual = await buscarManutencao(manutencaoId)

  if (atual.status !== STATUS_MANUTENCAO.EM_MANUTENCAO) {
    throw new Error('Esta manutenção não está mais ativa.')
  }

  const retorno = await aplicarRetornoPatrimonial(atual, user)
  const agora = new Date().toISOString()

  const observacoesFinais = [
    texto(atual.observacoes),
    motivo
      ? `CANCELAMENTO: ${texto(motivo)}`
      : 'MANUTENÇÃO CANCELADA'
  ]
    .filter(Boolean)
    .join(' | ')

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        status: STATUS_MANUTENCAO.CANCELADA,
        observacoes: observacoesFinais,
        concluida_em: agora,
        concluida_por_id: obterUsuarioId(user),
        concluida_por_nome: obterUsuarioNome(user),
        atualizado_em: agora
      })
      .eq('id', manutencaoId)
      .eq('status', STATUS_MANUTENCAO.EM_MANUTENCAO)
      .select()
      .single()

    if (error) throw error

    return normalizarManutencao(data)
  } catch (error) {
    try {
      await retorno.rollback()
    } catch (rollbackError) {
      console.error('Erro ao desfazer cancelamento da manutenção:', rollbackError)
    }
    throw error
  }
}

export async function excluirFotoManutencao({ manutencaoId }) {
  const manutencao = await buscarManutencao(manutencaoId)

  if (manutencao.foto_caminho) {
    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .remove([manutencao.foto_caminho])

    if (storageError) throw storageError
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      foto_url: null,
      foto_caminho: null,
      atualizado_em: new Date().toISOString()
    })
    .eq('id', manutencaoId)
    .select()
    .single()

  if (error) throw error

  return normalizarManutencao(data)
}
