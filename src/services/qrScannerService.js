export function normalizarCodigoQr(
  valor
) {
  return String(valor ?? '').trim()
}

export function interpretarCodigoQr(
  valor
) {
  const codigo =
    normalizarCodigoQr(valor)

  if (!codigo) {
    return {
      codigo: '',
      patrimonioId: '',
      referenciaId: '',
      tipo: '',
      dados: null
    }
  }

  try {
    const dados = JSON.parse(codigo)

    return {
      codigo,

      patrimonioId:
        dados.patrimonio_id ||
        dados.patrimonioId ||
        dados.id ||
        '',

      referenciaId:
        dados.referencia_id ||
        dados.referenciaId ||
        '',

      tipo:
        dados.tipo ||
        dados.categoria ||
        '',

      dados
    }
  } catch {
    // Continua para os outros formatos.
  }

  try {
    const url = new URL(codigo)

    const partes = url.pathname
      .split('/')
      .filter(Boolean)

    return {
      codigo,

      patrimonioId:
        url.searchParams.get(
          'patrimonio_id'
        ) ||
        url.searchParams.get('id') ||
        partes.at(-1) ||
        '',

      referenciaId:
        url.searchParams.get(
          'referencia_id'
        ) || '',

      tipo:
        url.searchParams.get('tipo') ||
        '',

      dados: {
        url: codigo
      }
    }
  } catch {
    // Não é URL.
  }

  const pares = codigo
    .split(/[;|,]/)
    .map((item) => item.trim())
    .filter(Boolean)

  const objeto = {}

  for (const par of pares) {
    const separador =
      par.includes('=')
        ? '='
        : par.includes(':')
          ? ':'
          : null

    if (!separador) {
      continue
    }

    const [
      chave,
      ...restante
    ] = par.split(separador)

    objeto[
      String(chave)
        .trim()
        .toLowerCase()
    ] = restante
      .join(separador)
      .trim()
  }

  if (
    Object.keys(objeto).length > 0
  ) {
    return {
      codigo,

      patrimonioId:
        objeto.patrimonio_id ||
        objeto.patrimonio ||
        objeto.id ||
        '',

      referenciaId:
        objeto.referencia_id ||
        objeto.referencia ||
        '',

      tipo:
        objeto.tipo ||
        objeto.categoria ||
        '',

      dados: objeto
    }
  }

  return {
    codigo,
    patrimonioId: codigo,
    referenciaId: codigo,
    tipo: '',
    dados: null
  }
}

export function encontrarPatrimonioPorQr({
  codigo,
  patrimonios = []
}) {
  const leitura =
    interpretarCodigoQr(codigo)

  const valores = [
    leitura.patrimonioId,
    leitura.referenciaId,
    leitura.codigo
  ]
    .map((item) =>
      String(item ?? '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean)

  if (valores.length === 0) {
    return null
  }

  return (
    patrimonios.find(
      (patrimonio) => {
        const candidatos = [
          patrimonio.id,
          patrimonio.referencia_id,

          patrimonio?.dados?.id,
          patrimonio?.dados?.patrimonio,
          patrimonio?.dados
            ?.numero_patrimonio,
          patrimonio?.dados?.codigo,
          patrimonio?.dados
            ?.numero_serie,
          patrimonio?.dados?.serie,
          patrimonio?.dados?.registro,
          patrimonio?.dados?.sigma,
          patrimonio?.dados?.sinarm
        ]
          .map((item) =>
            String(item ?? '')
              .trim()
              .toLowerCase()
          )
          .filter(Boolean)

        return valores.some(
          (valor) =>
            candidatos.includes(valor)
        )
      }
    ) || null
  )
}