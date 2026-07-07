const TIPOS_LOCAL = [
  'GUARDA',
  'PESSOA',
  'VIATURA',
  'UNIDADE',
  'MANUTENCAO',
  'EXTERNO',
  'BAIXA',
]

export default function LocalForm({
  form,
  editandoId,
  onChange,
  onCancel,
  onSave,
}) {
  return (
    <div className="locais-modal-overlay">
      <div className="locais-modal">
        <header>
          <h2>{editandoId ? 'Editar Local' : 'Novo Local'}</h2>
          <button onClick={onCancel}>×</button>
        </header>

        <div className="locais-form">
          <label>
            Nome do local
            <input
              type="text"
              value={form.nome}
              onChange={(e) => onChange('nome', e.target.value)}
              placeholder="Ex.: Guarda do Quartel"
            />
          </label>

          <label>
            Tipo
            <select
              value={form.tipo}
              onChange={(e) => onChange('tipo', e.target.value)}
            >
              {TIPOS_LOCAL.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label>
            Descrição
            <textarea
              value={form.descricao}
              onChange={(e) => onChange('descricao', e.target.value)}
              placeholder="Descrição opcional do local"
            />
          </label>

          <div className="locais-checks">
            <label>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => onChange('ativo', e.target.checked)}
              />
              Local ativo
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.permite_receber}
                onChange={(e) =>
                  onChange('permite_receber', e.target.checked)
                }
              />
              Permite receber patrimônio
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.permite_entregar}
                onChange={(e) =>
                  onChange('permite_entregar', e.target.checked)
                }
              />
              Permite entregar patrimônio
            </label>
          </div>
        </div>

        <footer>
          <button onClick={onCancel}>Cancelar</button>
          <button className="btn-primary" onClick={onSave}>
            Salvar
          </button>
        </footer>
      </div>
    </div>
  )
}