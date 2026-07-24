export const GESTOR_PATRIMONIAL_PADRAO = Object.freeze({
  tipo: 'SETOR',
  codigo: 'P4',
  nome: 'P4'
})

export const TIPOS_GUARDIAO = Object.freeze({
  SETOR: 'SETOR',
  POLICIAL: 'POLICIAL',
  UNIDADE: 'UNIDADE',
  EMPRESA: 'EMPRESA',
  OUTRO: 'OUTRO'
})

export const GUARDIOES_PATRIMONIAIS = Object.freeze({
  P4: {
    tipo: TIPOS_GUARDIAO.SETOR,
    codigo: 'P4',
    nome: 'P4'
  },

  SERVICO_DIA: {
    tipo: TIPOS_GUARDIAO.SETOR,
    codigo: 'SERVICO_DIA',
    nome: 'SERVIÇO DE DIA'
  },

  SVDD: {
    tipo: TIPOS_GUARDIAO.SETOR,
    codigo: 'SVDD',
    nome: 'SVDD'
  },

  MANUTENCAO: {
    tipo: TIPOS_GUARDIAO.EMPRESA,
    codigo: 'MANUTENCAO',
    nome: 'MANUTENÇÃO'
  }
})

export const TIPOS_MOVIMENTACAO_PATRIMONIAL =
  Object.freeze({
    RECEBIMENTO: 'RECEBIMENTO',

    DISTRIBUICAO: 'DISTRIBUICAO',

    TRANSFERENCIA: 'TRANSFERENCIA',

    CAUTELA_SERVICO: 'CAUTELA_SERVICO',

    CARGA_PERMANENTE: 'CARGA_PERMANENTE',

    EMPRESTIMO: 'EMPRESTIMO',

    DEVOLUCAO: 'DEVOLUCAO',

    RECOLHIMENTO: 'RECOLHIMENTO',

    MANUTENCAO: 'MANUTENCAO',

    RETORNO_MANUTENCAO:
      'RETORNO_MANUTENCAO',

    BAIXA: 'BAIXA',

    AJUSTE_ESTOQUE: 'AJUSTE_ESTOQUE',

    CONFERENCIA: 'CONFERENCIA'
  })

export const STATUS_MOVIMENTACAO_PATRIMONIAL =
  Object.freeze({
    PENDENTE: 'PENDENTE',
    EM_ANDAMENTO: 'EM_ANDAMENTO',
    CONCLUIDA: 'CONCLUIDA',
    CANCELADA: 'CANCELADA',
    ATRASADA: 'ATRASADA'
  })

export const STATUS_PATRIMONIAL = Object.freeze({
  RESERVA: 'RESERVA',

  EM_SERVICO: 'EM_SERVICO',

  CARGA: 'CARGA',

  EMPRESTADO: 'EMPRESTADO',

  MANUTENCAO: 'MANUTENCAO',

  RECOLHIDO: 'RECOLHIDO',

  BAIXADO: 'BAIXADO',

  APREENDIDO: 'APREENDIDO'
})

export const PERFIS_PATRIMONIAIS = Object.freeze({
  ADMINISTRADOR: 'ADMINISTRADOR',

  COMANDANTE_CIA: 'COMANDANTE DE CIA',

  ENCARREGADO_P4: 'ENCARREGADO DO P4',

  AUXILIAR_P4: 'AUXILIAR DO P4',

  ENCARREGADO_SVDD:
    'ENCARREGADO DO SVDD',

  AUXILIAR_SVDD: 'AUXILIAR DO SVDD',

  USUARIO: 'USUÁRIO'
})

export function normalizarCodigoPatrimonial(
  valor,
  fallback = null
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return fallback
  }

  const texto = String(valor)
    .trim()
    .toUpperCase()

  return texto || fallback
}

export function criarGuardiaoPatrimonial({
  tipo = TIPOS_GUARDIAO.OUTRO,
  codigo,
  nome,
  id = null,
  re = null,
  companhia = null,
  dados = {}
}) {
  const codigoNormalizado =
    normalizarCodigoPatrimonial(codigo)

  const nomeNormalizado =
    normalizarCodigoPatrimonial(
      nome,
      codigoNormalizado
    )

  if (!codigoNormalizado) {
    throw new Error(
      'O código do guardião patrimonial é obrigatório.'
    )
  }

  return {
    tipo:
      normalizarCodigoPatrimonial(
        tipo,
        TIPOS_GUARDIAO.OUTRO
      ),

    codigo:
      codigoNormalizado,

    nome:
      nomeNormalizado,

    id:
      id || null,

    re:
      re
        ? String(re).replace(/\D/g, '')
        : null,

    companhia:
      normalizarCodigoPatrimonial(
        companhia
      ),

    dados:
      dados &&
      typeof dados === 'object'
        ? dados
        : {}
  }
}

export function criarGuardiaoPolicial(
  policial = {}
) {
  const re = String(
    policial.re ?? ''
  ).replace(/\D/g, '')

  if (re.length !== 6) {
    throw new Error(
      'O policial guardião deve possuir RE com 6 dígitos.'
    )
  }

  const nome =
    policial.nome_guerra ||
    policial.nome ||
    policial.nome_completo

  if (!nome) {
    throw new Error(
      'O nome do policial guardião é obrigatório.'
    )
  }

  return criarGuardiaoPatrimonial({
    tipo: TIPOS_GUARDIAO.POLICIAL,

    codigo: `POLICIAL_${re}`,

    nome,

    id:
      policial.id ||
      null,

    re,

    companhia:
      policial.companhia ||
      null,

    dados: {
      nome_guerra:
        policial.nome_guerra ||
        null,

      posto_graduacao:
        policial.posto_graduacao ||
        policial.posto ||
        null,

      pelotao:
        policial.pelotao ||
        null,

      funcao:
        policial.funcao ||
        null,

      foto_url:
        policial.foto_url ||
        null
    }
  })
}

export function guardiaoEhP4(
  guardiao
) {
  return (
    normalizarCodigoPatrimonial(
      guardiao?.codigo
    ) === 'P4'
  )
}