import { supabase } from './supabaseClient'

import {
  normalizarTexto,
  obterDadosPatrimonio,
  obterResponsavelPatrimonio,
  obterReResponsavelPatrimonio
} from '../utils/centralPatrimonioUtils'

const TABLE = 'sigmo_patrimonios'

function correspondeResponsavel(
  patrimonio,
  {
    re = '',
    nome = ''
  } = {}
) {
  const reAtual = normalizarTexto(
    obterReResponsavelPatrimonio(
      patrimonio
    )
  )

  const nomeAtual = normalizarTexto(
    obterResponsavelPatrimonio(
      patrimonio
    )
  )

  const reProcurado =
    normalizarTexto(re)

  const nomeProcurado =
    normalizarTexto(nome)

  if (
    reProcurado &&
    reAtual === reProcurado
  ) {
    return true
  }

  if (
    nomeProcurado &&
    nomeAtual === nomeProcurado
  ) {
    return true
  }

  if (
    nomeProcurado &&
    nomeAtual.includes(nomeProcurado)
  ) {
    return true
  }

  return false
}

export async function listarPatrimoniosResponsavel({
  re = '',
  nome = ''
} = {}) {
  if (!re && !nome) {
    return []
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .neq('status', 'INATIVO')
    .order('tipo', {
      ascending: true
    })

  if (error) {
    throw error
  }

  return (data ?? []).filter(
    (patrimonio) =>
      correspondeResponsavel(
        patrimonio,
        {
          re,
          nome
        }
      )
  )
}

export async function listarResponsabilidades() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .neq('status', 'INATIVO')

  if (error) {
    throw error
  }

  const mapa = new Map()

  for (const patrimonio of data ?? []) {
    const dados =
      obterDadosPatrimonio(patrimonio)

    const re =
      obterReResponsavelPatrimonio(
        patrimonio
      )

    const nome =
      obterResponsavelPatrimonio(
        patrimonio
      )

    if (
      !re &&
      nome ===
        'Reserva / sem responsável'
    ) {
      continue
    }

    const chave =
      re ||
      normalizarTexto(nome)

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        chave,
        re,
        nome,
        total: 0,
        tipos: {},
        patrimonios: []
      })
    }

    const responsavel =
      mapa.get(chave)

    const tipo = String(
      patrimonio.tipo || 'outros'
    ).toLowerCase()

    responsavel.total += 1

    responsavel.tipos[tipo] =
      (responsavel.tipos[tipo] || 0) + 1

    responsavel.patrimonios.push({
      ...patrimonio,
      dados
    })
  }

  return [...mapa.values()].sort(
    (a, b) => {
      if (b.total !== a.total) {
        return b.total - a.total
      }

      return String(a.nome).localeCompare(
        String(b.nome),
        'pt-BR'
      )
    }
  )
}