export function normalizarTexto(value) {
  return String(value || '').trim()
}

export function normalizarPatrimonio(form) {
  return {
    ...form,
    patrimonio: normalizarTexto(form.patrimonio),
    descricao: normalizarTexto(form.descricao),
    marca: normalizarTexto(form.marca),
    modelo: normalizarTexto(form.modelo),
    numero_serie: normalizarTexto(form.numero_serie),
    observacoes: normalizarTexto(form.observacoes),
    quantidade: Number(form.quantidade || 1)
  }
}

export function validarPatrimonioBasico(form) {
  if (!normalizarTexto(form.patrimonio)) {
    return 'Informe o patrimônio.'
  }

  if (!normalizarTexto(form.descricao)) {
    return 'Informe a descrição.'
  }

  if (!form.status) {
    return 'Informe o status.'
  }

  if (!form.estado_conservacao) {
    return 'Informe o estado de conservação.'
  }

  return ''
}