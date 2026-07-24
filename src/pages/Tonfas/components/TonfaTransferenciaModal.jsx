import { useEffect, useMemo, useState } from 'react'

import './TonfaTransferenciaModal.css'

const FORM_INICIAL = {
  tipo: 'TONFA',
  quantidade: '',
  motivo: 'DISTRIBUICAO_OPERACIONAL',
  observacoes: ''
}

function texto(valor) {
  return String(valor ?? '').trim()
}

function numeroInteiro(valor) {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return 0
  return Math.max(0, Math.trunc(numero))
}

function normalizarTipo(valor) {
  return texto(valor).toUpperCase()
}

function obterRotuloTipo(tipo) {
  return tipo === 'CASSETETE' ? 'Cassetete' : 'Tonfa'
}

export default function TonfaTransferenciaModal({
  aberto,
  modo = 'P4_SVDD',
  estoques = [],
  onClose,
  onConfirm
}) {
  const [form, setForm] = useState(FORM_INICIAL)
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  const estoquesAtivos = useMemo(
    () => estoques.filter((item) =>
      item?.ativo !== false &&
      ['TONFA', 'CASSETETE'].includes(normalizarTipo(item?.tipo))
    ),
    [estoques]
  )

  const estoqueSelecionado = useMemo(
    () => estoquesAtivos.find(
      (item) => normalizarTipo(item?.tipo) === form.tipo
    ) || null,
    [estoquesAtivos, form.tipo]
  )

  const saldoP4 = numeroInteiro(estoqueSelecionado?.quantidade_p4)

const saldoSvdd =
  numeroInteiro(
    estoqueSelecionado?.quantidade_svdd
  )

const devolucao =
  modo === 'SVDD_P4'

const saldoDisponivel =
  devolucao
    ? saldoSvdd
    : saldoP4

const origemNome =
  devolucao
    ? 'COFRE DO SVDD'
    : 'GUARDA DO P4'

const destinoNome =
  devolucao
    ? 'GUARDA DO P4'
    : 'COFRE DO SVDD'

const origemCodigo =
  devolucao
    ? 'SVDD'
    : 'P4'

const destinoCodigo =
  devolucao
    ? 'P4'
    : 'SVDD'

  useEffect(() => {
    if (!aberto) return

    const campoSaldo = devolucao
      ? 'quantidade_svdd'
      : 'quantidade_p4'

    const primeiroComSaldo =
      estoquesAtivos.find(
        (item) => numeroInteiro(item?.[campoSaldo]) > 0
      ) ||
      estoquesAtivos[0] ||
      null

    setForm({
      ...FORM_INICIAL,
      tipo: normalizarTipo(primeiroComSaldo?.tipo) || 'TONFA'
    })
    setErro('')
    setSaving(false)
  }, [aberto, devolucao, estoquesAtivos])

  if (!aberto) return null

  function handleChange(event) {
    const { name, value } = event.target
    setErro('')
    setForm((prev) => ({
      ...prev,
      [name]: name === 'quantidade' ? value.replace(/\D/g, '') : value
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()

    try {
      setSaving(true)
      setErro('')

      if (!estoqueSelecionado?.id) {
        throw new Error(
          `Não existe estoque ativo de ${obterRotuloTipo(form.tipo).toLowerCase()}.`
        )
      }

      const quantidade = numeroInteiro(form.quantidade)

      if (quantidade <= 0) {
        throw new Error('Informe uma quantidade maior que zero.')
      }

      if (quantidade > saldoDisponivel) {
        throw new Error(
          `${origemNome} possui apenas ${saldoDisponivel} unidade(s) disponível(is).`
        )
      }

      await onConfirm?.({
  tonfaId: estoqueSelecionado.id,
  categoria: normalizarTipo(
    estoqueSelecionado.tipo || form.tipo
  ),
  patrimonioId:
    estoqueSelecionado.patrimonio_id ||
    estoqueSelecionado.patrimonioId ||
    null,
  itemId:
    estoqueSelecionado.item_id ||
    estoqueSelecionado.itemId ||
    estoqueSelecionado.id,
  quantidade,

origemCodigo,
origemNome,

destinoCodigo,
destinoNome,

motivo: form.motivo,

observacoes:
  texto(form.observacoes) ||
  null
})

      onClose?.()
    } catch (error) {
      console.error('Erro ao transferir Tonfas ou Cassetetes:', error)
      setErro(error?.message || 'Não foi possível realizar a transferência.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="tonfa-transfer-backdrop"
      onMouseDown={() => {
        if (!saving) onClose?.()
      }}
    >
      <section
        className="tonfa-transfer-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tonfa-transfer-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="tonfa-transfer-header">
          <div>
            <span>Movimentação patrimonial</span>
            <h2 id="tonfa-transfer-title">
              {devolucao ? 'Devolver patrimônio' : 'Transferir patrimônio'}
            </h2>
            <p>
              {devolucao
                ? 'Movimente materiais do Cofre do SVDD para a Guarda do P4.'
                : 'Movimente materiais da Guarda do P4 para o Cofre do SVDD.'}
            </p>
          </div>

          <button
            type="button"
            className="tonfa-transfer-close"
            aria-label="Fechar"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </header>

        <div className="tonfa-transfer-origin">
          <div className="tonfa-transfer-origin-icon">
  {origemCodigo}
</div>
          <div>
            <span>Origem</span>
            <strong>{origemNome}</strong>
          </div>
        </div>

        {erro && (
          <div className="tonfa-alert-error tonfa-transfer-error" role="alert">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="tonfa-transfer-grid">
            <label>
              <span>Tipo de material *</span>
              <select name="tipo" value={form.tipo} onChange={handleChange} disabled={saving} required>
                <option value="TONFA">Tonfa</option>
                <option value="CASSETETE">Cassetete</option>
              </select>
            </label>

            <label>
              <span>Quantidade *</span>
              <input
                type="number"
                name="quantidade"
                min="1"
                max={Math.max(1, saldoDisponivel)}
                step="1"
                value={form.quantidade}
                onChange={handleChange}
                placeholder="Ex.: 20"
                disabled={saving || saldoDisponivel <= 0}
                required
              />
              <small>
                Disponível em {origemNome}: {saldoDisponivel}
              </small>
            </label>

            <label>
              <span>Destino *</span>
              <input
                type="text"
                value={destinoNome}
                readOnly
                disabled={saving}
              />
            </label>

            <label>
              <span>Motivo *</span>
              <select name="motivo" value={form.motivo} onChange={handleChange} disabled={saving} required>
                <option value="DISTRIBUICAO_OPERACIONAL">Distribuição operacional</option>
                <option value="RECOMPOSICAO_ESTOQUE">Recomposição de estoque</option>
                <option value="NECESSIDADE_SERVICO">Necessidade de serviço</option>
              </select>
            </label>

            <label className="tonfa-transfer-full">
              <span>Observações</span>
              <textarea
                name="observacoes"
                value={form.observacoes}
                onChange={handleChange}
                rows="4"
                placeholder={
                  devolucao
                    ? 'Ex.: Devolução de saldo excedente do SVDD ao P4.'
                    : 'Ex.: Transferência para composição do estoque operacional do SVDD.'
                }
                disabled={saving}
              />
            </label>
          </div>

          <footer className="tonfa-transfer-actions">
            <button type="button" className="tonfa-btn-secondary" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button
              type="submit"
              className="tonfa-btn-primary"
              disabled={saving || saldoDisponivel <= 0}
            >
              {
  devolucao
    ? 'Confirmar devolução'
    : 'Confirmar transferência'
}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
