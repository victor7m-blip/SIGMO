import {
  ESTADOS_CONSERVACAO,
  STATUS_PATRIMONIO
} from '../patrimonioConfig'

export default function PatrimonioDadosForm({
  form,
  erro,
  locais = [],
  camposExtras = null,
  salvando = false,
  onChange,
  onAvancar
}) {
  return (
    <div className="patrimonio-card">
      {erro && <div className="form-error">{erro}</div>}

      <div className="patrimonio-form-grid">
        <label>
          Patrimônio
          <input
            name="patrimonio"
            value={form.patrimonio || ''}
            onChange={onChange}
            placeholder="Ex: 001234"
          />
        </label>

        <label>
          Descrição
          <input
            name="descricao"
            value={form.descricao || ''}
            onChange={onChange}
            placeholder="Ex: Pistola, colete, rádio..."
          />
        </label>

        <label>
          Marca
          <input
            name="marca"
            value={form.marca || ''}
            onChange={onChange}
          />
        </label>

        <label>
          Modelo
          <input
            name="modelo"
            value={form.modelo || ''}
            onChange={onChange}
          />
        </label>

        <label>
          Nº de série
          <input
            name="numero_serie"
            value={form.numero_serie || ''}
            onChange={onChange}
          />
        </label>

        <label>
          Quantidade
          <input
            type="number"
            min="1"
            name="quantidade"
            value={form.quantidade || 1}
            onChange={onChange}
          />
        </label>

        <label>
          Status
          <select
            name="status"
            value={form.status || 'ATIVO'}
            onChange={onChange}
          >
            {STATUS_PATRIMONIO.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>

        <label>
          Estado de conservação
          <select
            name="estado_conservacao"
            value={form.estado_conservacao || 'BOM'}
            onChange={onChange}
          >
            {ESTADOS_CONSERVACAO.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
        </label>

        <label>
          Local
          <select
            name="local_id"
            value={form.local_id || ''}
            onChange={onChange}
          >
            <option value="">Selecione</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome || local.descricao || local.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {camposExtras && (
        <div className="patrimonio-extra-fields">
          {camposExtras}
        </div>
      )}

      <label className="patrimonio-observacoes">
        Observações
        <textarea
          name="observacoes"
          value={form.observacoes || ''}
          onChange={onChange}
          rows="4"
        />
      </label>

      <div className="patrimonio-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onAvancar}
          disabled={salvando}
        >
          {salvando ? 'Salvando...' : 'Seguinte'}
        </button>
      </div>
    </div>
  )
}