const STATUS_OPERACIONAIS = [
  'RESERVA',
  'PAGO',
  'CAUTELADO',
  'RECOLHIDO',
  'APREENDIDO',
  'MANUTENÇÃO',
  'BAIXADO',
  'BAIXADO DEFINITIVAMENTE',
  'PROCESSO DE DESCARGA',
  'DESCARREGADO'
]

export default function ArmaDados({
  form,
  erro,
  onChange,
  onCancel
}) {
  return (
    <div className="arma-form">
      {erro && <div className="form-error">{erro}</div>}

      <div className="form-grid">
        <label>
          Patrimônio
          <input name="patrimonio" value={form.patrimonio} onChange={onChange} required />
        </label>

        <label>
          Nº de série
          <input name="numero_serie" value={form.numero_serie} onChange={onChange} />
        </label>

        <label>
          Espécie
          <input name="especie" value={form.especie} onChange={onChange} />
        </label>

        <label>
          Marca
          <input name="marca" value={form.marca} onChange={onChange} />
        </label>

        <label>
          Modelo
          <input name="modelo" value={form.modelo} onChange={onChange} />
        </label>

        <label>
          Calibre
          <input name="calibre" value={form.calibre} onChange={onChange} />
        </label>

        <label>
          Acabamento
          <input name="acabamento" value={form.acabamento} onChange={onChange} />
        </label>

        <label>
          Unidade
          <input name="unidade" value={form.unidade} onChange={onChange} />
        </label>

        <label>
          Local atual
          <input
            name="local_atual"
            value={form.local_atual}
            onChange={onChange}
            placeholder="Ex.: COFRE DA RESERVA"
          />
        </label>

        <label>
          Responsável atual
          <input
            name="responsavel_atual"
            value={form.responsavel_atual}
            onChange={onChange}
            placeholder="Será automático no Motor de Movimentação"
          />
        </label>

        <label>
          Status operacional
          <select
            name="status_operacional"
            value={form.status_operacional}
            onChange={onChange}
          >
            {STATUS_OPERACIONAIS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Observações
        <textarea
          name="observacoes"
          value={form.observacoes}
          onChange={onChange}
          rows={4}
        />
      </label>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}