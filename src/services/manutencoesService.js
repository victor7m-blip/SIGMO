import { supabase } from './supabaseClient'
import { loadSessionToken } from './authService'
import { criarOuAtualizarPatrimonio } from './patrimoniosService'
import { listarTorniquetes } from './torniquetesService'
import { criarNotificacaoParaPerfil } from './notificacoesService'

const TABLE = 'sigmo_manutencoes'
const BUCKET = 'manutencoes-fotos'
const TABELA_FOTOS = 'sigmo_manutencoes_fotos'

export const MODULOS_MANUTENCAO = Object.freeze({
  ARMAS: 'ARMAS',
  TONFAS: 'TONFAS',
  HT: 'HT',
  COP: 'COP',
  TPD: 'TPD',
  TASER: 'TASER',
  MUNICAO: 'MUNICAO',
  TORNIQUETE: 'TORNIQUETE',
  COLETE: 'COLETE',
  COLETE_REFLETIVO: 'COLETE_REFLETIVO',
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

async function buscarTorniqueteSeguroPorId(referenciaId) {
  const referencia =
    texto(referenciaId)

  if (!referencia) {
    throw new Error(
      'A referência do torniquete não foi informada.'
    )
  }

  const lista =
    await listarTorniquetes()

  const torniquete =
    (Array.isArray(lista) ? lista : []).find(
      (item) =>
        String(item?.id || '') === referencia
    ) || null

  if (!torniquete?.id) {
    throw new Error(
      'Torniquete não localizado no estoque ativo.'
    )
  }

  return torniquete
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

function ehFotoExistente(valor) {
  if (!valor || typeof valor !== 'object' || ehArquivo(valor)) {
    return false
  }

  return Boolean(
    texto(
      valor.foto_url ||
      valor.url ||
      valor.publicUrl ||
      valor.public_url
    )
  )
}

function normalizarFotoExistente(valor, indice = 0) {
  const fotoUrl = texto(
    valor?.foto_url ||
    valor?.url ||
    valor?.publicUrl ||
    valor?.public_url
  )

  if (!fotoUrl) return null

  return {
    foto_url: fotoUrl,
    foto_caminho:
      texto(
        valor?.foto_caminho ||
        valor?.caminho ||
        valor?.path
      ) || null,
    categoria:
      maiusculo(valor?.categoria) || 'ENTRADA',
    tipo:
      maiusculo(valor?.tipo) || null,
    legenda:
      texto(valor?.legenda || valor?.descricao) || null,
    principal:
      Boolean(valor?.principal),
    ordem:
      inteiroPositivo(valor?.ordem, indice + 1),
    criada_por_id:
      valor?.criada_por_id ||
      valor?.registrada_por_id ||
      null,
    criada_por_nome:
      texto(
        valor?.criada_por_nome ||
        valor?.registrada_por_nome
      ) || null
  }
}

function normalizarFotosEntrada({
  foto = null,
  fotos = []
} = {}) {
  const candidatos = [
    ...(Array.isArray(fotos) ? fotos : []),
    ...(foto ? [foto] : [])
  ]

  const arquivos = []
  const existentes = []
  const chavesExistentes = new Set()

  for (let indice = 0; indice < candidatos.length; indice += 1) {
    const candidato = candidatos[indice]

    if (ehArquivo(candidato)) {
      if (!arquivos.includes(candidato)) {
        arquivos.push(candidato)
      }
      continue
    }

    if (ehFotoExistente(candidato)) {
      const normalizada = normalizarFotoExistente(candidato, indice)
      if (!normalizada) continue

      const chave = `${normalizada.foto_url}|${normalizada.foto_caminho || ''}`
      if (!chavesExistentes.has(chave)) {
        chavesExistentes.add(chave)
        existentes.push(normalizada)
      }
    }
  }

  return {
    arquivos,
    existentes
  }
}

function normalizarArquivosFotos({
  foto = null,
  fotos = []
} = {}) {
  return normalizarFotosEntrada({ foto, fotos }).arquivos
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

export async function buscarNovidadePatrimonialDaManutencao(manutencao) {
  const patrimonioId = texto(manutencao?.patrimonio_id)
  const referenciaId = texto(manutencao?.referencia_id)

  if (!patrimonioId && !referenciaId) {
    return { novidade: null, fotos: [] }
  }

  let query = supabase
    .from('sigmo_patrimonio_novidades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)

  query = patrimonioId
    ? query.eq('patrimonio_id', patrimonioId)
    : query.eq('referencia_id', referenciaId)

  const { data: novidades, error: novidadeError } = await query
  if (novidadeError) throw novidadeError

  const novidade = novidades?.[0] || null
  if (!novidade?.id) return { novidade: null, fotos: [] }

  const { data: fotos, error: fotosError } = await supabase
    .from('sigmo_patrimonio_novidades_fotos')
    .select('*')
    .eq('novidade_id', novidade.id)
    .order('principal', { ascending: false })
    .order('ordem', { ascending: true })
    .order('created_at', { ascending: true })

  if (fotosError) throw fotosError

  return {
    novidade,
    fotos: (fotos || []).map((foto, indice) => ({
      ...foto,
      foto_url: foto?.foto_url || foto?.url || null,
      foto_caminho: foto?.foto_caminho || foto?.caminho || null,
      ordem: foto?.ordem || indice + 1,
      principal: foto?.principal === true || indice === 0,
      origem: 'USUARIO'
    }))
  }
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

function separarObservacoesEstruturadasCOP(valor = null) {
  const resultado = {
    observacoesEntrada: null,
    statusAnterior: null,
    localAnterior: null,
    novidadePatrimonialId: null
  }

  const partes = String(valor || '')
    .split('|')
    .map((parte) => parte.trim())
    .filter(Boolean)

  const observacoesEntrada = []

  for (const parte of partes) {
    const parteNormalizada = maiusculo(parte)

    if (parteNormalizada.startsWith('STATUS ANTERIOR:')) {
      resultado.statusAnterior =
        texto(parte.slice(parte.indexOf(':') + 1)) || null
      continue
    }

    if (parteNormalizada.startsWith('LOCAL ANTERIOR:')) {
      resultado.localAnterior =
        texto(parte.slice(parte.indexOf(':') + 1)) || null
      continue
    }

    if (parteNormalizada.startsWith('NOVIDADE PATRIMONIAL:')) {
      resultado.novidadePatrimonialId =
        texto(parte.slice(parte.indexOf(':') + 1)) || null
      continue
    }

    observacoesEntrada.push(parte)
  }

  resultado.observacoesEntrada =
    observacoesEntrada.length > 0
      ? maiusculo(observacoesEntrada.join(' | '))
      : null

  resultado.statusAnterior =
    maiusculo(resultado.statusAnterior) || null

  resultado.localAnterior =
    maiusculo(resultado.localAnterior) || null

  return resultado
}


async function aplicarEntradaManutencaoArma({
  referenciaId,
  user = null
}) {
  const { data: arma, error } = await supabase
    .from('sigmo_armas')
    .select('*')
    .eq('id', referenciaId)
    .single()

  if (error) throw error

  const payloadAnterior = {
    status: arma.status,
    local_atual: arma.local_atual,
    carga_policial_id: arma.carga_policial_id,
    carga_policial_re: arma.carga_policial_re,
    carga_policial_nome: arma.carga_policial_nome,
    carga_policial_posto_graduacao: arma.carga_policial_posto_graduacao,
    carga_policial_companhia: arma.carga_policial_companhia,
    carga_policial_pelotao: arma.carga_policial_pelotao,
    carga_policial_funcao: arma.carga_policial_funcao
  }

  const payloadNovo = {
    status: 'MANUTENCAO',
    local_atual: 'MANUTENCAO',
    carga_policial_id: null,
    carga_policial_re: null,
    carga_policial_nome: null,
    carga_policial_posto_graduacao: null,
    carga_policial_companhia: null,
    carga_policial_pelotao: null,
    carga_policial_funcao: null
  }

  const { data: atualizada, error: updateError } = await supabase
    .from('sigmo_armas')
    .update(payloadNovo)
    .eq('id', arma.id)
    .select()
    .single()

  if (updateError) throw updateError

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'arma',
      referencia_id: atualizada.id,
      dados: atualizada,
      user,
      local_atual: 'MANUTENCAO',
      companhia_atual: atualizada.unidade || ''
    })
  } catch (error) {
    await supabase
      .from('sigmo_armas')
      .update(payloadAnterior)
      .eq('id', arma.id)

    throw error
  }

  return {
    arma: atualizada,
    rollback: async () => {
      const { data: restaurada, error: rollbackError } = await supabase
        .from('sigmo_armas')
        .update(payloadAnterior)
        .eq('id', arma.id)
        .select()
        .single()

      if (rollbackError) throw rollbackError

      await criarOuAtualizarPatrimonio({
        tipo: 'arma',
        referencia_id: restaurada.id,
        dados: restaurada,
        user,
        local_atual: restaurada.local_atual || 'COFRE DO SVDD',
        companhia_atual: restaurada.unidade || ''
      })
    }
  }
}


async function aplicarEntradaManutencaoHT({
  referenciaId,
  user = null
}) {
  const { data: ht, error } = await supabase
    .from('sigmo_hts')
    .select('*')
    .eq('id', referenciaId)
    .single()

  if (error) throw error

  const statusAtual = maiusculo(ht.status_operacional)

  if (statusAtual === 'MANUTENCAO') {
    throw new Error('O HT já está registrado como em manutenção.')
  }

  const payloadAnterior = {
    status_operacional: ht.status_operacional,
    local_atual: ht.local_atual,
    equipe_vinculada: ht.equipe_vinculada,
    viatura_vinculada: ht.viatura_vinculada,
    ativo: ht.ativo
  }

  const payloadNovo = {
    status_operacional: 'MANUTENCAO',
    local_atual: ht.local_atual,
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


async function aplicarEntradaManutencaoCOP({
  referenciaId,
  user = null
}) {
  const { data: cop, error } = await supabase
    .from('sigmo_cops')
    .select('*')
    .eq('id', referenciaId)
    .single()

  if (error) throw error

  const statusAtual = maiusculo(
    cop.status_operacional
  )

  if (
    cop.ativo === false ||
    statusAtual === 'BAIXADA' ||
    statusAtual === 'BAIXADO'
  ) {
    throw new Error(
      'Uma COP baixada ou inativa não pode ser colocada em manutenção.'
    )
  }

  if (statusAtual === 'MANUTENCAO') {
    throw new Error(
      'A COP já está registrada como em manutenção.'
    )
  }

  const payloadAnterior = {
    status_operacional:
      cop.status_operacional,
    local_atual:
      cop.local_atual,
    ativo:
      cop.ativo
  }

  const payloadNovo = {
    status_operacional:
      'MANUTENCAO',
    local_atual:
      cop.local_atual ||
      'SVDD',
    ativo:
      true
  }

  const {
    data: atualizada,
    error: updateError
  } = await supabase
    .from('sigmo_cops')
    .update(payloadNovo)
    .eq('id', cop.id)
    .select()
    .single()

  if (updateError) {
    throw updateError
  }

  try {
    await criarOuAtualizarPatrimonio({
      tipo:
        'cop',
      referencia_id:
        atualizada.id,
      dados:
        atualizada,
      user,
      local_atual:
        atualizada.local_atual ||
        'SVDD',
      companhia_atual:
        ''
    })
  } catch (error) {
    await supabase
      .from('sigmo_cops')
      .update(payloadAnterior)
      .eq('id', cop.id)

    throw error
  }

  return {
    cop:
      atualizada,

    rollback:
      async () => {
        const {
          data: restaurada,
          error: rollbackError
        } = await supabase
          .from('sigmo_cops')
          .update(payloadAnterior)
          .eq('id', cop.id)
          .select()
          .single()

        if (rollbackError) {
          throw rollbackError
        }

        await criarOuAtualizarPatrimonio({
          tipo:
            'cop',
          referencia_id:
            restaurada.id,
          dados:
            restaurada,
          user,
          local_atual:
            restaurada.local_atual ||
            'SVDD',
          companhia_atual:
            ''
        })
      }
  }
}



async function garantirPatrimonioTorniqueteManutencao({
  referenciaId,
  origem = null,
  user = null
}) {
  const torniquete =
    await buscarTorniqueteSeguroPorId(
      referenciaId
    )

  const origemNormalizada =
    maiusculo(origem)

  const localAtual =
    origemNormalizada.includes('SVDD') ||
    origemNormalizada.includes('SERVIÇO DE DIA') ||
    origemNormalizada.includes('SERVICO DE DIA')
      ? 'COFRE DO SVDD'
      : 'COFRE DO P4'

  const patrimonio =
    await criarOuAtualizarPatrimonio({
      tipo:
        'torniquete',

      referencia_id:
        torniquete.id,

      dados: {
        ...torniquete,
        torniquete_id:
          torniquete.id,
        tipo_registro:
          'TORNIQUETE_QUANTIDADE',
        descricao:
          'TORNIQUETE',
        status_operacional:
          'MANUTENCAO',
        local_atual:
          localAtual
      },

      user,

      local_atual:
        localAtual,

      companhia_atual:
        ''
    })

  return {
    torniquete,
    patrimonio
  }
}


async function aplicarEntradaManutencaoTorniquete({
  referenciaId,
  quantidade,
  origem = null,
  user = null
}) {
  const quantidadeValida =
    inteiroPositivo(
      quantidade
    )

  if (quantidadeValida <= 0) {
    throw new Error(
      'A quantidade de torniquetes enviada para manutenção deve ser maior que zero.'
    )
  }

  const origemNormalizada =
    maiusculo(origem)

  const origemSVDD =
    origemNormalizada.includes('SVDD') ||
    origemNormalizada.includes('SERVIÇO DE DIA') ||
    origemNormalizada.includes('SERVICO DE DIA')

  const origemCodigo =
    origemSVDD
      ? 'SVDD'
      : 'P4'

  const origemLocal =
    origemSVDD
      ? 'COFRE DO SVDD'
      : 'COFRE DO P4'

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_torniquetes_movimentar_manutencao',
    {
      p_token:
        token,

      p_origem:
        origemCodigo,

      p_quantidade:
        quantidadeValida,

      p_acao:
        'ENVIAR'
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível movimentar o torniquete para manutenção.'
    )
  }

  const atualizado = {
    id:
      data?.torniquete_id ||
      referenciaId,

    quantidade_p4:
      inteiroPositivo(
        data?.quantidade_p4
      ),

    quantidade_svdd:
      inteiroPositivo(
        data?.quantidade_svdd
      ),

    quantidade_manutencao:
      inteiroPositivo(
        data?.quantidade_manutencao
      ),

    status_operacional:
      data?.status_operacional ||
      'MANUTENCAO',

    local_atual:
      data?.local_atual ||
      origemLocal,

    ativo:
      true
  }

  try {
    await criarOuAtualizarPatrimonio({
      tipo:
        'torniquete',

      referencia_id:
        atualizado.id,

      dados: {
        ...atualizado,
        torniquete_id:
          atualizado.id,
        tipo_registro:
          'TORNIQUETE_QUANTIDADE',
        descricao:
          'TORNIQUETE',
        status_operacional:
          atualizado.status_operacional,
        local_atual:
          atualizado.local_atual
      },

      user,

      local_atual:
        atualizado.local_atual,

      companhia_atual:
        ''
    })
  } catch (errorPatrimonio) {
    const {
      error: rollbackError
    } = await supabase.rpc(
      'sigmo_torniquetes_movimentar_manutencao',
      {
        p_token:
          token,

        p_origem:
          origemCodigo,

        p_quantidade:
          quantidadeValida,

        p_acao:
          'DESFAZER'
      }
    )

    if (rollbackError) {
      console.error(
        'Erro ao desfazer movimentação de manutenção do torniquete:',
        rollbackError
      )
    }

    throw errorPatrimonio
  }

  return {
    torniquete:
      atualizado,

    rollback:
      async () => {
        const {
          error: rollbackError
        } = await supabase.rpc(
          'sigmo_torniquetes_movimentar_manutencao',
          {
            p_token:
              token,

            p_origem:
              origemCodigo,

            p_quantidade:
              quantidadeValida,

            p_acao:
              'DESFAZER'
          }
        )

        if (rollbackError) {
          throw rollbackError
        }
      }
  }
}


async function movimentarManutencaoColeteRefletivo({
  referenciaId,
  quantidade,
  acao
}) {
  const referencia =
    texto(referenciaId)

  const quantidadeValida =
    inteiroPositivo(
      quantidade
    )

  const acaoValida =
    maiusculo(
      acao
    )

  if (!referencia) {
    throw new Error(
      'A referência do Colete Refletivo não foi informada.'
    )
  }

  if (quantidadeValida <= 0) {
    throw new Error(
      'A quantidade do Colete Refletivo deve ser maior que zero.'
    )
  }

  if (
    ![
      'ENVIAR',
      'RETORNAR',
      'DESFAZER'
    ].includes(
      acaoValida
    )
  ) {
    throw new Error(
      'Ação de manutenção inválida para Colete Refletivo.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_colete_refletivo_movimentar_manutencao',
    {
      p_colete_refletivo_id:
        referencia,

      p_quantidade:
        quantidadeValida,

      p_acao:
        acaoValida
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível movimentar o Colete Refletivo na manutenção.'
    )
  }

  return data
}


async function aplicarEntradaManutencaoColeteRefletivo({
  referenciaId,
  quantidade
}) {
  const quantidadeValida =
    inteiroPositivo(
      quantidade
    )

  const atualizado =
    await movimentarManutencaoColeteRefletivo({
      referenciaId,
      quantidade:
        quantidadeValida,
      acao:
        'ENVIAR'
    })

  return {
    colete_refletivo:
      atualizado,

    rollback:
      async () => {
        await movimentarManutencaoColeteRefletivo({
          referenciaId,
          quantidade:
            quantidadeValida,
          acao:
            'DESFAZER'
        })
      }
  }
}


async function aplicarRetornoColeteRefletivo(
  manutencao
) {
  const referenciaId =
    manutencao?.referencia_id

  const quantidade =
    inteiroPositivo(
      manutencao?.quantidade
    )

  const atualizado =
    await movimentarManutencaoColeteRefletivo({
      referenciaId,
      quantidade,
      acao:
        'RETORNAR'
    })

  return {
    colete_refletivo:
      atualizado,

    rollback:
      async () => {
        await movimentarManutencaoColeteRefletivo({
          referenciaId,
          quantidade,
          acao:
            'ENVIAR'
        })
      }
  }
}


async function garantirPatrimonioMunicaoManutencao({
  referenciaId,
  origem = null,
  user = null
}) {
  const { data: municao, error } = await supabase
    .from('sigmo_municoes')
    .select('id, calibre, descricao, ativo')
    .eq('id', referenciaId)
    .single()

  if (error) throw error

  const origemNormalizada = maiusculo(origem)

  const localAtual =
    origemNormalizada.includes('SVDD') ||
    origemNormalizada.includes('SERVIÇO DE DIA') ||
    origemNormalizada.includes('SERVICO DE DIA')
      ? 'COFRE DO SVDD'
      : 'COFRE DO P4'

  const patrimonio = await criarOuAtualizarPatrimonio({
    tipo: 'municao',
    referencia_id: municao.id,
    dados: {
      ...municao,
      municao_id: municao.id,
      tipo_registro: 'MUNICAO_QUANTIDADE',
      status_operacional: 'MANUTENCAO',
      local_atual: localAtual
    },
    user,
    local_atual: localAtual,
    companhia_atual: ''
  })

  return {
    municao,
    patrimonio
  }
}


async function registrarHistoricoManutencaoMunicao({
  municaoId,
  loteId,
  manutencaoId,
  tipoMovimentacao,
  origem,
  destino,
  quantidade,
  observacoes = null,
  user = null
}) {
  const payload = {
    municao_id: municaoId,
    lote_id: loteId,
    cautela_id: null,
    movimentacao_principal_id: null,
    tipo_movimentacao: maiusculo(tipoMovimentacao),
    origem: maiusculo(origem) || null,
    destino: maiusculo(destino) || null,
    quantidade: inteiroPositivo(quantidade),
    policial_id: null,
    policial_re: null,
    policial_nome: null,
    documento: null,
    observacoes: [
      `MANUTENCAO SIGMO: ${manutencaoId}`,
      maiusculo(observacoes) || null
    ].filter(Boolean).join(' | '),
    registrado_por_id: obterUsuarioId(user),
    registrado_por_nome: obterUsuarioNome(user)
  }

  const { data, error } = await supabase
    .from('sigmo_municoes_movimentacoes')
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error

  return data
}


async function aplicarEntradaManutencaoMunicao({
  referenciaId,
  quantidade,
  origem = null,
  manutencao,
  user = null
}) {
  const quantidadeValida = inteiroPositivo(quantidade)

  if (quantidadeValida <= 0) {
    throw new Error('A quantidade de munição enviada para manutenção deve ser maior que zero.')
  }

  const origemNormalizada = maiusculo(origem)

  const origemSVDD =
    origemNormalizada.includes('SVDD') ||
    origemNormalizada.includes('SERVIÇO DE DIA') ||
    origemNormalizada.includes('SERVICO DE DIA')

  const campoOrigem = origemSVDD
    ? 'quantidade_svdd'
    : 'quantidade_p4'

  const origemLocal = origemSVDD
    ? 'COFRE DO SVDD'
    : 'COFRE DO P4'

  const { data: lotes, error } = await supabase
    .from('sigmo_municoes_lotes')
    .select('*')
    .eq('municao_id', referenciaId)
    .eq('ativo', true)
    .gt(campoOrigem, 0)
    .order('validade', { ascending: true, nullsFirst: false })
    .order('criado_em', { ascending: true })

  if (error) throw error

  const saldoTotal = (lotes || []).reduce(
    (soma, lote) => soma + inteiroPositivo(lote?.[campoOrigem]),
    0
  )

  if (quantidadeValida > saldoTotal) {
    throw new Error(
      `Existem apenas ${saldoTotal} unidade(s) disponíveis em ${origemLocal} para manutenção.`
    )
  }

  const alteracoes = []
  const historicos = []
  let restante = quantidadeValida

  try {
    for (const lote of lotes || []) {
      if (restante <= 0) break

      const saldoOrigem = inteiroPositivo(lote?.[campoOrigem])
      if (saldoOrigem <= 0) continue

      const saldoManutencao = inteiroPositivo(lote?.quantidade_manutencao)
      const usar = Math.min(saldoOrigem, restante)

      const { data: atualizado, error: updateError } = await supabase
        .from('sigmo_municoes_lotes')
        .update({
          [campoOrigem]: saldoOrigem - usar,
          quantidade_manutencao: saldoManutencao + usar,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', lote.id)
        .eq(campoOrigem, saldoOrigem)
        .eq('quantidade_manutencao', saldoManutencao)
        .select('*')
        .maybeSingle()

      if (updateError) throw updateError

      if (!atualizado?.id) {
        throw new Error(
          'O estoque da munição foi alterado por outra operação. Atualize a tela e tente novamente.'
        )
      }

      alteracoes.push({
        loteId: lote.id,
        campoOrigem,
        saldoOrigem,
        saldoManutencao
      })

      const historico = await registrarHistoricoManutencaoMunicao({
        municaoId: referenciaId,
        loteId: lote.id,
        manutencaoId: manutencao.id,
        tipoMovimentacao: 'MANUTENCAO_ENTRADA',
        origem: origemLocal,
        destino: 'MANUTENCAO',
        quantidade: usar,
        observacoes: manutencao?.descricao || manutencao?.tipo_novidade || null,
        user
      })

      historicos.push(historico?.id)
      restante -= usar
    }

    if (restante > 0) {
      throw new Error(
        'Não foi possível separar toda a quantidade de munição para manutenção.'
      )
    }

    return {
      municao: {
        id: referenciaId,
        quantidade: quantidadeValida,
        origem: origemLocal
      },
      rollback: async () => {
        for (const historicoId of historicos.filter(Boolean)) {
          await supabase
            .from('sigmo_municoes_movimentacoes')
            .delete()
            .eq('id', historicoId)
        }

        for (const item of [...alteracoes].reverse()) {
          await supabase
            .from('sigmo_municoes_lotes')
            .update({
              [item.campoOrigem]: item.saldoOrigem,
              quantidade_manutencao: item.saldoManutencao,
              atualizado_em: new Date().toISOString()
            })
            .eq('id', item.loteId)
        }
      }
    }
  } catch (errorEntrada) {
    for (const historicoId of historicos.filter(Boolean)) {
      await supabase
        .from('sigmo_municoes_movimentacoes')
        .delete()
        .eq('id', historicoId)
    }

    for (const item of [...alteracoes].reverse()) {
      await supabase
        .from('sigmo_municoes_lotes')
        .update({
          [item.campoOrigem]: item.saldoOrigem,
          quantidade_manutencao: item.saldoManutencao,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', item.loteId)
    }

    throw errorEntrada
  }
}


async function registrarNovidadePatrimonialManutencaoDireta({
  modulo,
  tipoMaterial,
  patrimonioId,
  referenciaId,
  tipoNovidade,
  descricao,
  fotos = [],
  user = null
}) {
  if (!patrimonioId) {
    return null
  }

  // Para patrimônios individualizados (HT/COP), uma novidade aberta pode
  // ser reutilizada quando a manutenção nasce do recebimento/devolução.
  // Para MUNIÇÃO, que é quantitativa e agregada por calibre, cada entrada
  // direta em manutenção deve gerar sua própria novidade. Quando o fluxo
  // já possui uma novidade específica, ela é informada explicitamente ao
  // registrarManutencao.
  if (
    maiusculo(modulo) !== MODULOS_MANUTENCAO.MUNICAO &&
    maiusculo(modulo) !== MODULOS_MANUTENCAO.TORNIQUETE
  ) {
    const { data: novidadesExistentes, error: buscaError } = await supabase
      .from('sigmo_patrimonio_novidades')
      .select('id, patrimonio_id, titulo, status, created_at')
      .eq('patrimonio_id', patrimonioId)
      .eq('status', 'registrada')
      .order('created_at', { ascending: false })
      .limit(1)

    if (buscaError) throw buscaError

    const existente = novidadesExistentes?.[0] || null

    if (existente?.id) {
      return {
        ...existente,
        criada_agora: false
      }
    }
  }

  const titulo =
    maiusculo(tipoNovidade) ||
    'NOVIDADE IDENTIFICADA EM MANUTENÇÃO'

  const descricaoOficial =
    [
      maiusculo(descricao) || 'SEM DESCRIÇÃO',
      'PROVIDÊNCIA: MANUTENÇÃO INTERNA'
    ]
      .filter(Boolean)
      .join(' | ')

  const tipoPatrimonio =
    maiusculo(tipoMaterial) ||
    maiusculo(modulo) ||
    'MATERIAL'

  const { data, error } = await supabase.rpc(
    'sigmo_registrar_patrimonio_novidade',
    {
      p_patrimonio_id: patrimonioId,
      p_tipo_patrimonio: tipoPatrimonio,
      p_titulo: titulo,
      p_descricao: descricaoOficial,
      p_gravidade: 'baixa',
      p_registrado_por_id: obterUsuarioId(user),
      p_registrado_por_nome: maiusculo(obterUsuarioNome(user)) || null
    }
  )

  if (error) {
    throw new Error(
      `Não foi possível registrar a novidade patrimonial da manutenção: ${error.message}`
    )
  }

  const novidadeId =
    Array.isArray(data)
      ? (
          data[0]?.id ||
          data[0]?.sigmo_registrar_patrimonio_novidade ||
          data[0] ||
          null
        )
      : (
          data?.id ||
          data?.sigmo_registrar_patrimonio_novidade ||
          data ||
          null
        )

  if (!novidadeId) {
    return null
  }

  const fotosValidas = (Array.isArray(fotos) ? fotos : [])
    .filter((item) => item?.foto_url)

  if (fotosValidas.length > 0) {
    const registrosFotos = fotosValidas.map((item, indice) => ({
      novidade_id: novidadeId,
      foto_url: item.foto_url,
      foto_caminho: item.foto_caminho || null,
      nome_original: item?.arquivo?.name || null,
      tipo_arquivo: item?.arquivo?.type || null,
      tamanho_bytes: Number(item?.arquivo?.size || 0) || null,
      principal: item.principal === true || indice === 0,
      ordem: inteiroPositivo(item.ordem, indice + 1)
    }))

    const { error: fotosError } = await supabase
      .from('sigmo_patrimonio_novidades_fotos')
      .insert(registrosFotos)

    if (fotosError) {
      throw new Error(
        `A novidade patrimonial foi criada, mas não foi possível vincular as fotos: ${fotosError.message}`
      )
    }
  }

  return {
    id: novidadeId,
    patrimonio_id: patrimonioId,
    referencia_id: referenciaId || null,
    tipo_patrimonio: tipoPatrimonio,
    titulo,
    status: 'registrada',
    criada_agora: true
  }
}

export async function registrarManutencao({
  modulo,
  tipoMaterial,
  referenciaId,
  patrimonioId = null,
  novidadePatrimonialId = null,
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
  estoqueJaMovido = false,
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

  let patrimonioVinculado =
    patrimonioId || null

  if (
    moduloValido === MODULOS_MANUTENCAO.MUNICAO &&
    !patrimonioVinculado
  ) {
    const contextoMunicao =
      await garantirPatrimonioMunicaoManutencao({
        referenciaId: referenciaValida,
        origem,
        user
      })

    patrimonioVinculado =
      contextoMunicao?.patrimonio?.id ||
      null
  }


  if (
    moduloValido === MODULOS_MANUTENCAO.TORNIQUETE &&
    !patrimonioVinculado
  ) {
    const contextoTorniquete =
      await garantirPatrimonioTorniqueteManutencao({
        referenciaId:
          referenciaValida,
        origem,
        user
      })

    patrimonioVinculado =
      contextoTorniquete?.patrimonio?.id ||
      null
  }

  const {
    arquivos,
    existentes: fotosExistentes
  } = normalizarFotosEntrada({
    foto,
    fotos
  })

  const fotosEnviadas = []
  let manutencaoCriada = null
  let movimentacaoPatrimonial = null
  let novidadePatrimonial =
    novidadePatrimonialId
      ? {
          id: novidadePatrimonialId,
          criada_agora: false
        }
      : null

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

    const todasFotosEntrada = [
      ...fotosExistentes,
      ...fotosEnviadas
    ]

    const fotoPrincipal =
      todasFotosEntrada.find((item) => item.principal) ||
      todasFotosEntrada[0] || {
        foto_url: null,
        foto_caminho: null
      }

    // Manutenção aberta diretamente no módulo (sem novidade prévia) deve
    // gerar também a novidade patrimonial oficial. Para HTs vindos de
    // devolução/recebimento, a novidade já existe e apenas é reutilizada.
    if (
      !novidadePatrimonial?.id &&
      (
        moduloValido === MODULOS_MANUTENCAO.HT ||
        moduloValido === MODULOS_MANUTENCAO.COP ||
        moduloValido === MODULOS_MANUTENCAO.MUNICAO ||
        moduloValido === MODULOS_MANUTENCAO.TORNIQUETE
      )
    ) {
      novidadePatrimonial =
        await registrarNovidadePatrimonialManutencaoDireta({
          modulo: moduloValido,
          tipoMaterial: tipoValido,
          patrimonioId: patrimonioVinculado || null,
          referenciaId: referenciaValida,
          tipoNovidade,
          descricao,
          fotos: todasFotosEntrada,
          user
        })
    }

    const dadosEstruturadosCOP =
      moduloValido === MODULOS_MANUTENCAO.COP
        ? separarObservacoesEstruturadasCOP(observacoes)
        : null

    const payload = {
      modulo:
        moduloValido,

      tipo_material:
        tipoValido,

      referencia_id:
        referenciaValida,

      patrimonio_id:
        patrimonioVinculado || null,

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
        [
          maiusculo(observacoes) || null,
          novidadePatrimonial?.id
            ? `NOVIDADE PATRIMONIAL: ${novidadePatrimonial.id}`
            : null
        ]
          .filter(Boolean)
          .join(' | ') ||
        null,

      ...(moduloValido === MODULOS_MANUTENCAO.COP
        ? {
            observacoes_entrada:
              dadosEstruturadosCOP?.observacoesEntrada || null,

            status_anterior:
              dadosEstruturadosCOP?.statusAnterior || null,

            local_anterior:
              dadosEstruturadosCOP?.localAnterior || null,

            novidade_patrimonial_id:
              novidadePatrimonial?.id ||
              dadosEstruturadosCOP?.novidadePatrimonialId ||
              null,

            servico_executado:
              null,

            observacoes_retorno:
              null
          }
        : {}),

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

    if (todasFotosEntrada.length > 0) {
      const existePrincipal = todasFotosEntrada.some(
        (item) => Boolean(item.principal)
      )

      const registrosFotos = todasFotosEntrada.map(
        (item, indice) => ({
          manutencao_id: data.id,
          foto_url: item.foto_url,
          foto_caminho: item.foto_caminho || null,
          categoria: maiusculo(item.categoria) || 'ENTRADA',
          tipo:
            maiusculo(item.tipo) ||
            maiusculo(tipoNovidade) ||
            'GERAL',
          legenda:
            texto(item.legenda) ||
            texto(descricao) ||
            null,
          principal:
            existePrincipal
              ? Boolean(item.principal)
              : indice === 0,
          ordem:
            inteiroPositivo(item.ordem, indice + 1),
          criada_por_id:
            item.criada_por_id ||
            obterUsuarioId(user),
          criada_por_nome:
            texto(item.criada_por_nome) ||
            obterUsuarioNome(user)
        })
      )

      const { error: fotosError } = await supabase
        .from(TABELA_FOTOS)
        .insert(registrosFotos)

      if (fotosError) {
        throw fotosError
      }
    }

    if (moduloValido === MODULOS_MANUTENCAO.ARMAS) {
      movimentacaoPatrimonial = await aplicarEntradaManutencaoArma({
        referenciaId: referenciaValida,
        user
      })
    }

    if (moduloValido === MODULOS_MANUTENCAO.HT) {
      movimentacaoPatrimonial = await aplicarEntradaManutencaoHT({
        referenciaId: referenciaValida,
        user
      })
    }

    if (moduloValido === MODULOS_MANUTENCAO.COP) {
      movimentacaoPatrimonial = await aplicarEntradaManutencaoCOP({
        referenciaId: referenciaValida,
        user
      })
    }

    if (
      moduloValido === MODULOS_MANUTENCAO.MUNICAO &&
      !estoqueJaMovido
    ) {
      movimentacaoPatrimonial =
        await aplicarEntradaManutencaoMunicao({
          referenciaId: referenciaValida,
          quantidade: quantidadeValida,
          origem,
          manutencao: data,
          user
        })
    }


    if (
      moduloValido === MODULOS_MANUTENCAO.TORNIQUETE &&
      !estoqueJaMovido
    ) {
      movimentacaoPatrimonial =
        await aplicarEntradaManutencaoTorniquete({
          referenciaId:
            referenciaValida,
          quantidade:
            quantidadeValida,
          origem,
          user
        })
    }

    if (
      moduloValido === MODULOS_MANUTENCAO.COLETE_REFLETIVO &&
      !estoqueJaMovido
    ) {
      movimentacaoPatrimonial =
        await aplicarEntradaManutencaoColeteRefletivo({
          referenciaId:
            referenciaValida,
          quantidade:
            quantidadeValida
        })
    }

    return normalizarManutencao(
      data
    )
  } catch (error) {
    if (movimentacaoPatrimonial?.rollback) {
      try {
        await movimentacaoPatrimonial.rollback()
      } catch (rollbackError) {
        console.error(
          'Erro ao desfazer entrada patrimonial em manutenção:',
          rollbackError
        )
      }
    }

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
    const referenciasEncontradas = new Set()

    // Para ARMAS, o número de série fica em sigmo_armas,
    // enquanto a manutenção guarda o id da arma em referencia_id.
    const {
      data: armasEncontradas,
      error: armasError
    } = await supabase
      .from('sigmo_armas')
      .select('id, numero_serie')
      .ilike('numero_serie', `%${termo}%`)
      .limit(100)

    if (armasError) {
      console.warn(
        'Não foi possível pesquisar manutenções pelo número de série da arma:',
        armasError
      )
    } else {
      for (const arma of armasEncontradas || []) {
        if (arma?.id) {
          referenciasEncontradas.add(
            String(arma.id)
          )
        }
      }
    }

    const filtrosPesquisa = [
      `tipo_material.ilike.%${termo}%`,
      `tipo_novidade.ilike.%${termo}%`,
      `descricao.ilike.%${termo}%`,
      `observacoes.ilike.%${termo}%`,
      `policial_nome.ilike.%${termo}%`,
      `policial_re.ilike.%${termo}%`
    ]

    for (
      const referenciaEncontrada of
      referenciasEncontradas
    ) {
      filtrosPesquisa.push(
        `referencia_id.eq.${referenciaEncontrada}`
      )
    }

    query = query.or(
      filtrosPesquisa.join(',')
    )
  }

  const { data, error, count } = await query

  if (error) throw error

  const manutencoes = (data || []).map(normalizarManutencao)

  // Define o guardião institucional da manutenção pela última CAUTELA
  // finalizada do patrimônio antes da abertura da manutenção.
  // Ex.: DEPÓSITO DO P4 -> CAUTELA INDIVIDUAL = P4
  //      COFRE DO SVDD -> CAUTELA INDIVIDUAL = SVDD
  const patrimoniosManutencao = [...new Set(
    manutencoes
      .map((item) => item?.patrimonio_id)
      .filter(Boolean)
      .map(String)
  )]

  const cautelasPorPatrimonio = new Map()

  if (patrimoniosManutencao.length > 0) {
    const { data: itensMovimentacao, error: itensMovimentacaoError } =
      await supabase
        .from('sigmo_movimentacao_itens')
        .select('patrimonio_id, movimentacao_id')
        .in('patrimonio_id', patrimoniosManutencao)

    if (itensMovimentacaoError) {
      console.warn(
        'Não foi possível identificar a origem institucional das manutenções:',
        itensMovimentacaoError
      )
    } else {
      const movimentacaoIds = [...new Set(
        (itensMovimentacao || [])
          .map((item) => item?.movimentacao_id)
          .filter(Boolean)
          .map(String)
      )]

      if (movimentacaoIds.length > 0) {
        const { data: movimentacoes, error: movimentacoesError } =
          await supabase
            .from('sigmo_movimentacoes')
            .select('id, tipo_movimentacao, status, origem_local, destino_local, created_at')
            .in('id', movimentacaoIds)
            .eq('tipo_movimentacao', 'CAUTELA')
            .eq('status', 'finalizada')
            .order('created_at', { ascending: false })

        if (movimentacoesError) {
          console.warn(
            'Não foi possível carregar as cautelas das manutenções:',
            movimentacoesError
          )
        } else {
          const patrimoniosPorMovimentacao = new Map()

          for (const itemMovimentacao of itensMovimentacao || []) {
            const movimentacaoId =
              String(itemMovimentacao?.movimentacao_id || '')
            const patrimonioId =
              String(itemMovimentacao?.patrimonio_id || '')

            if (!movimentacaoId || !patrimonioId) continue

            if (!patrimoniosPorMovimentacao.has(movimentacaoId)) {
              patrimoniosPorMovimentacao.set(
                movimentacaoId,
                []
              )
            }

            patrimoniosPorMovimentacao
              .get(movimentacaoId)
              .push(patrimonioId)
          }

          // `movimentacoes` já vem da mais recente para a mais antiga.
          // Percorremos nessa ordem para preservar corretamente o histórico
          // institucional de cada patrimônio.
          for (const movimentacao of movimentacoes || []) {
            const destino = maiusculo(movimentacao?.destino_local)

            if (destino !== 'CAUTELA INDIVIDUAL') continue

            const patrimonioIds =
              patrimoniosPorMovimentacao.get(
                String(movimentacao?.id || '')
              ) || []

            for (const patrimonioId of patrimonioIds) {
              if (!cautelasPorPatrimonio.has(patrimonioId)) {
                cautelasPorPatrimonio.set(
                  patrimonioId,
                  []
                )
              }

              cautelasPorPatrimonio
                .get(patrimonioId)
                .push(movimentacao)
            }
          }
        }
      }
    }
  }

  const manutencoesComOrigemInstitucional = manutencoes.map((item) => {
    const patrimonioId = texto(item?.patrimonio_id)
    const registradaEm = item?.registrada_em
      ? new Date(item.registrada_em).getTime()
      : Number.POSITIVE_INFINITY

    const cautelas = cautelasPorPatrimonio.get(patrimonioId) || []

    const cautela = cautelas.find((movimentacao) => {
      const criadaEm = movimentacao?.created_at
        ? new Date(movimentacao.created_at).getTime()
        : 0

      return criadaEm <= registradaEm
    })

    const origemCautela = maiusculo(cautela?.origem_local)
    const origemGravada = maiusculo(item?.origem)

    let origemInstitucional = null
    let origemInstitucionalLocal =
      cautela?.origem_local ||
      item?.origem ||
      null

    if (
      origemCautela.includes('P4') ||
      origemCautela.includes('DEPÓSITO') ||
      origemCautela.includes('DEPOSITO') ||
      origemCautela.includes('GUARDA DO QUARTEL') ||
      origemCautela.includes('COFRE DO P4')
    ) {
      origemInstitucional = 'P4'
    } else if (
      origemCautela.includes('SVDD') ||
      origemCautela.includes('SERVIÇO DE DIA') ||
      origemCautela.includes('SERVICO DE DIA') ||
      origemCautela.includes('COFRE DO SVDD')
    ) {
      origemInstitucional = 'SVDD'
    } else if (
      origemGravada.includes('P4') ||
      origemGravada.includes('DEPÓSITO') ||
      origemGravada.includes('DEPOSITO') ||
      origemGravada.includes('GUARDA DO QUARTEL') ||
      origemGravada.includes('COFRE DO P4')
    ) {
      origemInstitucional = 'P4'
    } else if (
      origemGravada.includes('SVDD') ||
      origemGravada.includes('SERVIÇO DE DIA') ||
      origemGravada.includes('SERVICO DE DIA') ||
      origemGravada.includes('COFRE DO SVDD')
    ) {
      origemInstitucional = 'SVDD'
    }

    return {
      ...item,
      origem_institucional: origemInstitucional,
      origem_institucional_local: origemInstitucionalLocal,
      origem_institucional_movimentacao_id: cautela?.id || null
    }
  })

  const referenciasArmas = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.ARMAS &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  const referenciasTPD = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.TPD &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  const referenciasHT = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.HT &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  const referenciasCOP = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.COP &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  const referenciasTaser = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.TASER &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  const referenciasMunicao = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.MUNICAO &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  const referenciasTorniquete = [...new Set(
    manutencoesComOrigemInstitucional
      .filter((item) =>
        item.modulo === MODULOS_MANUTENCAO.TORNIQUETE &&
        item.referencia_id
      )
      .map((item) => String(item.referencia_id))
  )]

  let armasPorId = new Map()
  let htsPorId = new Map()
  let copsPorId = new Map()
  let tpdsPorId = new Map()
  let tasersPorId = new Map()
  let municoesPorId = new Map()
  let torniquetesPorId = new Map()

  if (referenciasArmas.length > 0) {
    const { data: armas, error: armasError } = await supabase
      .from('sigmo_armas')
      .select('id, patrimonio, numero_serie, especie, marca, modelo, calibre')
      .in('id', referenciasArmas)

    if (armasError) {
      console.warn(
        'Não foi possível carregar a identificação das armas em manutenção:',
        armasError
      )
    } else {
      armasPorId = new Map(
        (armas || []).map((arma) => [String(arma.id), arma])
      )
    }
  }

  if (referenciasHT.length > 0) {
    const { data: hts, error: htsError } = await supabase
      .from('sigmo_hts')
      .select('id, patrimonio, numero_serie, marca, modelo, tipo_ht, status_operacional, local_atual')
      .in('id', referenciasHT)

    if (htsError) {
      console.warn(
        'Não foi possível carregar a identificação dos HTs em manutenção:',
        htsError
      )
    } else {
      htsPorId = new Map(
        (hts || []).map((ht) => [String(ht.id), ht])
      )
    }
  }

  if (referenciasCOP.length > 0) {
    const { data: cops, error: copsError } = await supabase
      .from('sigmo_cops')
      .select(
        'id, numero, identificacao_equipamento, marca, status_operacional, local_atual, foto_url'
      )
      .in('id', referenciasCOP)

    if (copsError) {
      console.warn(
        'Não foi possível carregar a identificação das COPs em manutenção:',
        copsError
      )
    } else {
      copsPorId = new Map(
        (cops || []).map(
          (cop) => [
            String(cop.id),
            cop
          ]
        )
      )
    }
  }

  if (referenciasTPD.length > 0) {
    const { data: tpds, error: tpdsError } = await supabase
      .from('sigmo_tpds')
      .select('id, patrimonio, numero_serie, marca, modelo, tipo_equipamento')
      .in('id', referenciasTPD)

    if (tpdsError) {
      console.warn(
        'Não foi possível carregar a identificação dos TPDs em manutenção:',
        tpdsError
      )
    } else {
      tpdsPorId = new Map(
        (tpds || []).map((tpd) => [String(tpd.id), tpd])
      )
    }
  }

  if (referenciasTaser.length > 0) {
    const { data: tasers, error: tasersError } = await supabase
      .from('sigmo_tasers')
      .select('id, patrimonio, numero_serie, marca, modelo, tipo_taser')
      .in('id', referenciasTaser)

    if (tasersError) {
      console.warn(
        'Não foi possível carregar a identificação dos Tasers em manutenção:',
        tasersError
      )
    } else {
      tasersPorId = new Map(
        (tasers || []).map((taser) => [String(taser.id), taser])
      )
    }
  }

  if (referenciasMunicao.length > 0) {
    const { data: municoes, error: municoesError } = await supabase
      .from('sigmo_municoes')
      .select('id, calibre, descricao')
      .in('id', referenciasMunicao)

    if (municoesError) {
      console.warn(
        'Não foi possível carregar a identificação das munições em manutenção:',
        municoesError
      )
    } else {
      municoesPorId = new Map(
        (municoes || []).map((municao) => [String(municao.id), municao])
      )
    }
  }


  if (referenciasTorniquete.length > 0) {
    const {
      data: torniquetes,
      error: torniquetesError
    } = await supabase
      .from('sigmo_torniquetes')
      .select(
        'id, quantidade_total, quantidade_p4, quantidade_svdd, quantidade_em_servico, quantidade_carga_permanente, quantidade_manutencao, quantidade_descarga, status_operacional, local_atual, ativo'
      )
      .in('id', referenciasTorniquete)

    if (torniquetesError) {
      console.warn(
        'Não foi possível carregar a identificação dos torniquetes em manutenção:',
        torniquetesError
      )
    } else {
      torniquetesPorId =
        new Map(
          (torniquetes || []).map(
            (torniquete) => [
              String(torniquete.id),
              torniquete
            ]
          )
        )
    }
  }

  return {
    data: manutencoesComOrigemInstitucional.map((item) => {
      if (!item.referencia_id) {
        return item
      }

      const referenciaId = String(item.referencia_id)

      if (item.modulo === MODULOS_MANUTENCAO.ARMAS) {
        const arma = armasPorId.get(referenciaId)
        if (!arma) return item

        return {
          ...item,
          patrimonio: arma.patrimonio || null,
          numero_serie: arma.numero_serie || null,
          especie: arma.especie || null,
          marca: arma.marca || null,
          modelo: arma.modelo || null,
          calibre: arma.calibre || null
        }
      }

      if (item.modulo === MODULOS_MANUTENCAO.HT) {
        const ht = htsPorId.get(referenciaId)
        if (!ht) return item

        const localAtualHT = maiusculo(ht.local_atual)

let origemInstitucionalHT = item.origem_institucional

if (
  localAtualHT.includes('P4') ||
  localAtualHT.includes('DEPÓSITO') ||
  localAtualHT.includes('DEPOSITO') ||
  localAtualHT.includes('GUARDA DO P4') ||
  localAtualHT.includes('GUARDA DO QUARTEL')
) {
  origemInstitucionalHT = 'P4'
} else if (
  localAtualHT.includes('SVDD') ||
  localAtualHT.includes('SERVIÇO DE DIA') ||
  localAtualHT.includes('SERVICO DE DIA')
) {
  origemInstitucionalHT = 'SVDD'
}

return {
  ...item,
  patrimonio: ht.patrimonio || null,
  numero_serie: ht.numero_serie || null,
  marca: ht.marca || null,
  modelo: ht.modelo || null,
  tipo_ht: ht.tipo_ht || null,
  status_operacional: ht.status_operacional || null,
  local_atual: ht.local_atual || null,
  origem_institucional: origemInstitucionalHT,
  origem_institucional_local: ht.local_atual || item.origem_institucional_local
}
      }

      if (item.modulo === MODULOS_MANUTENCAO.COP) {
        const cop = copsPorId.get(
          referenciaId
        )

        if (!cop) {
          return item
        }

        return {
          ...item,
          patrimonio:
            `COP ${String(
              cop.numero ||
              ''
            ).padStart(2, '0')}`.trim(),
          numero:
            cop.numero ||
            null,
          identificacao_equipamento:
            cop.identificacao_equipamento ||
            null,
          marca:
            cop.marca ||
            null,
          status_operacional:
            cop.status_operacional ||
            null,
          local_atual:
            cop.local_atual ||
            null,
          foto_url_cadastro:
            cop.foto_url ||
            null,
          origem_institucional:
            'SVDD',
          origem_institucional_local:
            cop.local_atual ||
            item.origem_institucional_local ||
            'SVDD'
        }
      }

      if (item.modulo === MODULOS_MANUTENCAO.TPD) {
        const tpd = tpdsPorId.get(referenciaId)
        if (!tpd) return item

        return {
          ...item,
          patrimonio: tpd.patrimonio || null,
          numero_serie: tpd.numero_serie || null,
          marca: tpd.marca || null,
          modelo: tpd.modelo || null,
          tipo_equipamento: tpd.tipo_equipamento || null
        }
      }

      if (item.modulo === MODULOS_MANUTENCAO.TASER) {
        const taser = tasersPorId.get(referenciaId)
        if (!taser) return item

        return {
          ...item,
          patrimonio: taser.patrimonio || null,
          numero_serie: taser.numero_serie || null,
          marca: taser.marca || null,
          modelo: taser.modelo || null,
          tipo_taser: taser.tipo_taser || null
        }
      }

      if (item.modulo === MODULOS_MANUTENCAO.MUNICAO) {
        const municao = municoesPorId.get(referenciaId)
        if (!municao) return item

        return {
          ...item,
          calibre: municao.calibre || null,
          descricao_municao: municao.descricao || null
        }
      }

      if (item.modulo === MODULOS_MANUTENCAO.TORNIQUETE) {
        const torniquete =
          torniquetesPorId.get(
            referenciaId
          )

        if (!torniquete) {
          return item
        }

        return {
          ...item,
          descricao_torniquete:
            'TORNIQUETE',
          quantidade_total:
            torniquete.quantidade_total,
          quantidade_p4:
            torniquete.quantidade_p4,
          quantidade_svdd:
            torniquete.quantidade_svdd,
          quantidade_manutencao:
            torniquete.quantidade_manutencao,
          status_operacional:
            torniquete.status_operacional,
          local_atual:
            torniquete.local_atual
        }
      }

      return item
    }),
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



async function obterOrigemInstitucionalManutencao(manutencao) {
  const origemGravada = maiusculo(manutencao?.origem)

  if (
    origemGravada.includes('P4') ||
    origemGravada.includes('DEPÓSITO') ||
    origemGravada.includes('DEPOSITO') ||
    origemGravada.includes('GUARDA DO QUARTEL')
  ) {
    return {
      setor: 'P4',
      origem_local: origemGravada,
      movimentacao_id: manutencao?.movimentacao_id || null
    }
  }

  if (
    origemGravada.includes('SVDD') ||
    origemGravada.includes('SERVIÇO DE DIA') ||
    origemGravada.includes('SERVICO DE DIA')
  ) {
    return {
      setor: 'SVDD',
      origem_local: origemGravada,
      movimentacao_id: manutencao?.movimentacao_id || null
    }
  }

  let patrimonioId = texto(manutencao?.patrimonio_id)

  if (!patrimonioId && texto(manutencao?.referencia_id)) {
    const { data: patrimonio, error: patrimonioError } = await supabase
      .from('sigmo_patrimonios')
      .select('id')
      .eq('referencia_id', texto(manutencao.referencia_id))
      .maybeSingle()

    if (patrimonioError) throw patrimonioError

    patrimonioId = texto(patrimonio?.id)
  }

  if (!patrimonioId) {
    throw new Error(
      'Não foi possível identificar o patrimônio para definir o setor de retorno da manutenção.'
    )
  }

  const { data: itens, error: itensError } = await supabase
    .from('sigmo_movimentacao_itens')
    .select('movimentacao_id')
    .eq('patrimonio_id', patrimonioId)

  if (itensError) throw itensError

  const movimentacaoIds = [
    ...new Set(
      (itens || [])
        .map((item) => item?.movimentacao_id)
        .filter(Boolean)
    )
  ]

  if (movimentacaoIds.length === 0) {
    throw new Error(
      'Não foi encontrada a cautela que definiu a responsabilidade institucional do material.'
    )
  }

  let query = supabase
    .from('sigmo_movimentacoes')
    .select(
      'id, tipo_movimentacao, status, origem_local, destino_local, solicitante_nome, recebedor_nome, created_at'
    )
    .in('id', movimentacaoIds)
    .eq('tipo_movimentacao', 'CAUTELA')
    .eq('status', 'finalizada')
    .order('created_at', { ascending: false })
    .limit(20)

  if (manutencao?.registrada_em) {
    query = query.lte('created_at', manutencao.registrada_em)
  }

  const { data: cautelas, error: cautelasError } = await query

  if (cautelasError) throw cautelasError

  const cautela = (cautelas || []).find((movimentacao) => {
    const destino = maiusculo(movimentacao?.destino_local)
    return destino === 'CAUTELA INDIVIDUAL'
  })

  if (!cautela) {
    throw new Error(
      'Não foi encontrada uma cautela finalizada válida para definir o retorno da manutenção.'
    )
  }

  const origem = maiusculo(cautela.origem_local)

  if (
    origem.includes('P4') ||
    origem.includes('DEPÓSITO') ||
    origem.includes('DEPOSITO') ||
    origem.includes('GUARDA DO QUARTEL')
  ) {
    return {
      setor: 'P4',
      origem_local: cautela.origem_local,
      movimentacao_id: cautela.id
    }
  }

  if (
    origem.includes('SVDD') ||
    origem.includes('SERVIÇO DE DIA') ||
    origem.includes('SERVICO DE DIA')
  ) {
    return {
      setor: 'SVDD',
      origem_local: cautela.origem_local,
      movimentacao_id: cautela.id
    }
  }

  throw new Error(
    `A origem institucional da cautela não foi reconhecida: ${cautela.origem_local || 'NÃO INFORMADA'}.`
  )
}

async function aplicarRetornoArma(manutencao, user) {
  const { data: arma, error } = await supabase
    .from('sigmo_armas')
    .select('*')
    .eq('id', manutencao.referencia_id)
    .single()

  if (error) throw error

  if (maiusculo(arma.status) !== 'MANUTENCAO') {
    throw new Error('A arma não está registrada como em manutenção.')
  }

  const payloadAnterior = {
    status: arma.status,
    local_atual: arma.local_atual,
    carga_policial_id: arma.carga_policial_id,
    carga_policial_re: arma.carga_policial_re,
    carga_policial_nome: arma.carga_policial_nome,
    carga_policial_posto_graduacao: arma.carga_policial_posto_graduacao,
    carga_policial_companhia: arma.carga_policial_companhia,
    carga_policial_pelotao: arma.carga_policial_pelotao,
    carga_policial_funcao: arma.carga_policial_funcao
  }

  const origemInstitucional =
    await obterOrigemInstitucionalManutencao(
      manutencao
    )

  const localRetorno =
    origemInstitucional.setor === 'P4'
      ? 'COFRE DO P4'
      : 'COFRE DO SVDD'

  const payloadNovo = {
    status: 'RESERVA',
    local_atual: localRetorno,
    carga_policial_id: null,
    carga_policial_re: null,
    carga_policial_nome: null,
    carga_policial_posto_graduacao: null,
    carga_policial_companhia: null,
    carga_policial_pelotao: null,
    carga_policial_funcao: null
  }

  const { data: atualizada, error: updateError } = await supabase
    .from('sigmo_armas')
    .update(payloadNovo)
    .eq('id', arma.id)
    .select()
    .single()

  if (updateError) throw updateError

  try {
    await criarOuAtualizarPatrimonio({
      tipo: 'arma',
      referencia_id: atualizada.id,
      dados: atualizada,
      user,
      local_atual: localRetorno,
      companhia_atual: atualizada.unidade || ''
    })
  } catch (error) {
    await supabase
      .from('sigmo_armas')
      .update(payloadAnterior)
      .eq('id', arma.id)

    throw error
  }

  return {
    arma: atualizada,
    rollback: async () => {
      const { data: restaurada, error: rollbackError } = await supabase
        .from('sigmo_armas')
        .update(payloadAnterior)
        .eq('id', arma.id)
        .select()
        .single()

      if (rollbackError) throw rollbackError

      await criarOuAtualizarPatrimonio({
        tipo: 'arma',
        referencia_id: restaurada.id,
        dados: restaurada,
        user,
        local_atual: restaurada.local_atual || 'MANUTENCAO',
        companhia_atual: restaurada.unidade || ''
      })
    }
  }
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
    local_atual: retornoAoSVDD ? 'COFRE DO SVDD' : 'COFRE DO P4',
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

async function aplicarRetornoCOP(
  manutencao,
  user
) {
  const {
    data: cop,
    error
  } = await supabase
    .from('sigmo_cops')
    .select('*')
    .eq(
      'id',
      manutencao.referencia_id
    )
    .single()

  if (error) {
    throw error
  }

  if (
    maiusculo(
      cop.status_operacional
    ) !== 'MANUTENCAO'
  ) {
    throw new Error(
      'A COP não está registrada como em manutenção.'
    )
  }

  const payloadAnterior = {
    status_operacional:
      cop.status_operacional,
    local_atual:
      cop.local_atual,
    ativo:
      cop.ativo
  }

  const payloadNovo = {
    status_operacional:
      'RESERVA',
    local_atual:
      'SVDD',
    ativo:
      true
  }

  const {
    data: atualizada,
    error: updateError
  } = await supabase
    .from('sigmo_cops')
    .update(payloadNovo)
    .eq('id', cop.id)
    .select()
    .single()

  if (updateError) {
    throw updateError
  }

  try {
    await criarOuAtualizarPatrimonio({
      tipo:
        'cop',
      referencia_id:
        atualizada.id,
      dados:
        atualizada,
      user,
      local_atual:
        atualizada.local_atual ||
        'SVDD',
      companhia_atual:
        ''
    })
  } catch (error) {
    await supabase
      .from('sigmo_cops')
      .update(payloadAnterior)
      .eq('id', cop.id)

    throw error
  }

  return {
    cop:
      atualizada,

    rollback:
      async () => {
        const {
          data: restaurada,
          error: rollbackError
        } = await supabase
          .from('sigmo_cops')
          .update(payloadAnterior)
          .eq('id', cop.id)
          .select()
          .single()

        if (rollbackError) {
          throw rollbackError
        }

        await criarOuAtualizarPatrimonio({
          tipo:
            'cop',
          referencia_id:
            restaurada.id,
          dados:
            restaurada,
          user,
          local_atual:
            restaurada.local_atual ||
            'SVDD',
          companhia_atual:
            ''
        })
      }
  }
}


async function aplicarRetornoMunicao(manutencao, user) {
  const quantidade = inteiroPositivo(
    manutencao?.quantidade
  )

  if (quantidade <= 0) {
    throw new Error(
      'A manutenção de munição não possui quantidade válida para retorno.'
    )
  }

  if (!manutencao?.id) {
    throw new Error(
      'A manutenção de munição não possui identificação válida.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  /*
   * O lote de munição é informação interna do estoque e não deve
   * depender de leitura direta pelo perfil SVDD. O retorno passa por
   * uma RPC SECURITY DEFINER que valida a sessão SIGMO e movimenta
   * internamente os lotes vinculados à manutenção.
   */
  const { data, error } = await supabase.rpc(
    'sigmo_municoes_retornar_manutencao',
    {
      p_token:
        token,

      p_manutencao_id:
        manutencao.id,

      p_acao:
        'RETORNAR'
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível devolver a munição da manutenção ao estoque.'
    )
  }

  return {
    municao:
      data || {
        id:
          manutencao?.referencia_id ||
          null,
        quantidade
      },

    rollback: async () => {
      const {
        error: rollbackError
      } = await supabase.rpc(
        'sigmo_municoes_retornar_manutencao',
        {
          p_token:
            token,

          p_manutencao_id:
            manutencao.id,

          p_acao:
            'DESFAZER'
        }
      )

      if (rollbackError) {
        throw rollbackError
      }
    }
  }
}



async function aplicarRetornoTorniquete(
  manutencao,
  user
) {
  const quantidade =
    inteiroPositivo(
      manutencao?.quantidade
    )

  if (quantidade <= 0) {
    throw new Error(
      'A manutenção de torniquete não possui quantidade válida para retorno.'
    )
  }

  if (!manutencao?.id) {
    throw new Error(
      'A manutenção de torniquete não possui identificação válida.'
    )
  }

  const token =
    loadSessionToken()

  if (!token) {
    throw new Error(
      'Sessão SIGMO inválida ou expirada. Entre novamente no sistema.'
    )
  }

  const {
    data,
    error
  } = await supabase.rpc(
    'sigmo_torniquetes_retornar_manutencao',
    {
      p_token:
        token,

      p_manutencao_id:
        manutencao.id,

      p_acao:
        'RETORNAR'
    }
  )

  if (error) {
    throw new Error(
      error?.message ||
      'Não foi possível devolver o torniquete da manutenção ao estoque.'
    )
  }

  const atualizado = {
    id:
      data?.torniquete_id ||
      manutencao?.referencia_id ||
      null,

    quantidade_p4:
      inteiroPositivo(
        data?.quantidade_p4
      ),

    quantidade_svdd:
      inteiroPositivo(
        data?.quantidade_svdd
      ),

    quantidade_manutencao:
      inteiroPositivo(
        data?.quantidade_manutencao
      ),

    status_operacional:
      data?.status_operacional ||
      'RESERVA',

    local_atual:
      data?.local_atual ||
      null,

    ativo:
      true
  }

  try {
    await criarOuAtualizarPatrimonio({
      tipo:
        'torniquete',

      referencia_id:
        atualizado.id,

      dados: {
        ...atualizado,
        torniquete_id:
          atualizado.id,
        tipo_registro:
          'TORNIQUETE_QUANTIDADE',
        descricao:
          'TORNIQUETE'
      },

      user,

      local_atual:
        atualizado.local_atual,

      companhia_atual:
        ''
    })
  } catch (errorPatrimonio) {
    const {
      error: rollbackError
    } = await supabase.rpc(
      'sigmo_torniquetes_retornar_manutencao',
      {
        p_token:
          token,

        p_manutencao_id:
          manutencao.id,

        p_acao:
          'DESFAZER'
      }
    )

    if (rollbackError) {
      console.error(
        'Erro ao desfazer retorno da manutenção do torniquete:',
        rollbackError
      )
    }

    throw errorPatrimonio
  }

  return {
    torniquete:
      atualizado,

    rollback:
      async () => {
        const {
          error: rollbackError
        } = await supabase.rpc(
          'sigmo_torniquetes_retornar_manutencao',
          {
            p_token:
              token,

            p_manutencao_id:
              manutencao.id,

            p_acao:
              'DESFAZER'
          }
        )

        if (rollbackError) {
          throw rollbackError
        }
      }
  }
}


async function aplicarRetornoPatrimonial(manutencao, user) {
  if (manutencao.modulo === MODULOS_MANUTENCAO.ARMAS) {
    return aplicarRetornoArma(manutencao, user)
  }

  if (manutencao.modulo === MODULOS_MANUTENCAO.TONFAS) {
    return aplicarRetornoTonfa(manutencao, user)
  }

  if (manutencao.modulo === MODULOS_MANUTENCAO.HT) {
    return aplicarRetornoHT(manutencao, user)
  }

  if (manutencao.modulo === MODULOS_MANUTENCAO.COP) {
    return aplicarRetornoCOP(
      manutencao,
      user
    )
  }

  if (manutencao.modulo === MODULOS_MANUTENCAO.MUNICAO) {
    return aplicarRetornoMunicao(
      manutencao,
      user
    )
  }

  if (manutencao.modulo === MODULOS_MANUTENCAO.TORNIQUETE) {
    return aplicarRetornoTorniquete(
      manutencao,
      user
    )
  }

  if (
    manutencao.modulo ===
    MODULOS_MANUTENCAO.COLETE_REFLETIVO
  ) {
    return aplicarRetornoColeteRefletivo(
      manutencao
    )
  }

  return {
    rollback: async () => {}
  }
}


async function concluirNovidadePatrimonialDaManutencao(manutencao, user) {
  const dadosEstruturados =
    separarObservacoesEstruturadasCOP(
      manutencao?.observacoes
    )

  const novidadeVinculadaId =
    texto(
      manutencao?.novidade_patrimonial_id ||
      dadosEstruturados?.novidadePatrimonialId
    )

  let patrimonioId = texto(manutencao?.patrimonio_id)

  // Manutenções criadas a partir de alguns fluxos antigos podem não ter
  // patrimonio_id gravado. Nesse caso, resolve o patrimônio pela referência
  // exata do material antes de concluir a novidade.
  if (!patrimonioId && texto(manutencao?.referencia_id)) {
    const { data: patrimonio, error: patrimonioError } = await supabase
      .from('sigmo_patrimonios')
      .select('id')
      .eq('referencia_id', texto(manutencao.referencia_id))
      .maybeSingle()

    if (patrimonioError) throw patrimonioError

    patrimonioId = texto(patrimonio?.id)
  }

  if (!patrimonioId) {
    return null
  }

  let queryNovidade = supabase
    .from('sigmo_patrimonio_novidades')
    .select('id, patrimonio_id, titulo, status, created_at')
    .eq('status', 'registrada')

  if (novidadeVinculadaId) {
    queryNovidade = queryNovidade
      .eq('id', novidadeVinculadaId)
      .limit(1)
  } else {
    queryNovidade = queryNovidade
      .eq('patrimonio_id', patrimonioId)
      .lte('created_at', manutencao.registrada_em)
      .order('created_at', { ascending: false })
      .limit(1)
  }

  const { data: novidades, error: buscaError } = await queryNovidade

  if (buscaError) throw buscaError

  const novidade = novidades?.[0] || null
  if (!novidade?.id) {

    return null
  }

  const payloadConclusao = {
    status: 'concluida',
    aprovado_por_id: obterUsuarioId(user),
    aprovado_por_nome: obterUsuarioNome(user),
    updated_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('sigmo_patrimonio_novidades')
    .update(payloadConclusao)
    .eq('id', novidade.id)
    .eq('status', 'registrada')
    .select()
    .maybeSingle()

  if (error) throw error

  return data || null
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

  const dadosLegadosCOP =
    atual.modulo === MODULOS_MANUTENCAO.COP
      ? separarObservacoesEstruturadasCOP(atual.observacoes)
      : null

  try {
    const payloadConclusao = {
      status: STATUS_MANUTENCAO.CONCLUIDA,
      observacoes: observacoesFinais,
      concluida_em: agora,
      concluida_por_id: obterUsuarioId(user),
      concluida_por_nome: obterUsuarioNome(user),
      atualizado_em: agora,

      ...(atual.modulo === MODULOS_MANUTENCAO.COP
        ? {
            observacoes_entrada:
              atual.observacoes_entrada ||
              dadosLegadosCOP?.observacoesEntrada ||
              null,

            status_anterior:
              atual.status_anterior ||
              dadosLegadosCOP?.statusAnterior ||
              null,

            local_anterior:
              atual.local_anterior ||
              dadosLegadosCOP?.localAnterior ||
              null,

            novidade_patrimonial_id:
              atual.novidade_patrimonial_id ||
              dadosLegadosCOP?.novidadePatrimonialId ||
              null,

            servico_executado:
              maiusculo(servicoExecutado) ||
              atual.servico_executado ||
              null,

            observacoes_retorno:
              maiusculo(observacoes) ||
              atual.observacoes_retorno ||
              null
          }
        : {})
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(payloadConclusao)
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

    await concluirNovidadePatrimonialDaManutencao(atual, user)

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
