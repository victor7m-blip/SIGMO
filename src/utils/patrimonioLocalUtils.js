function normalizarTextoLocal(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

export const LOCAIS_PATRIMONIAIS = Object.freeze({
  P4: 'COFRE DO P4',
  SVDD: 'COFRE DO SVDD'
})

export function ehCofreP4(valor) {
  const local = normalizarTextoLocal(valor)

  return (
    local === 'P4' ||
    local === 'COFRE P4' ||
    local === 'COFRE DO P4' ||
    local === 'GUARDA P4' ||
    local === 'GUARDA DO P4' ||
    local === 'GUARDA PATRIMONIAL' ||
    local === 'DEPOSITO P4' ||
    local === 'DEPOSITO DO P4' ||
    local.includes('GUARDA DO P4') ||
    local.includes('DEPOSITO DO P4') ||
    local.includes('COFRE DO P4')
  )
}

export function ehCofreSVDD(valor) {
  const local = normalizarTextoLocal(valor)

  return (
    local === 'SVDD' ||
    local === 'COFRE SVDD' ||
    local === 'COFRE DO SVDD' ||
    local === 'SERVICO DE DIA' ||
    local === 'GUARDA DO SVDD' ||
    local.includes('COFRE DO SVDD') ||
    local.includes('SERVICO DE DIA') ||
    local.includes('SVDD')
  )
}

/**
 * Retorna o nome canônico usado na exibição e nas novas gravações.
 * Valores de outros destinos (CIA, FT, BTL etc.) são preservados.
 */
export function normalizarLocalPatrimonial(valor) {
  const original = String(valor ?? '').trim()
  if (!original) return ''

  if (ehCofreP4(original)) return LOCAIS_PATRIMONIAIS.P4
  if (ehCofreSVDD(original)) return LOCAIS_PATRIMONIAIS.SVDD

  return original.toUpperCase()
}

export function formatarLocalPatrimonial(valor, fallback = 'Não informado') {
  return normalizarLocalPatrimonial(valor) || fallback
}

/**
 * Adapta registros antigos ao valor utilizado pelo select de cadastro.
 * A lista LOCAIS_HT usa os códigos P4 e SVDD.
 */
export function normalizarLocalParaFormulario(valor) {
  if (ehCofreP4(valor)) return 'P4'
  if (ehCofreSVDD(valor)) return 'SVDD'

  return String(valor ?? '').trim().toUpperCase()
}

export default {
  LOCAIS_PATRIMONIAIS,
  ehCofreP4,
  ehCofreSVDD,
  normalizarLocalPatrimonial,
  formatarLocalPatrimonial,
  normalizarLocalParaFormulario
}
