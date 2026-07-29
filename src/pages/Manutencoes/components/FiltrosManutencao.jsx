import {
  MODULOS_MANUTENCAO,
  STATUS_MANUTENCAO
} from '../../../services/manutencoesService'

const STATUS = [
  { value: '', label: 'Todos os status' },
  { value: STATUS_MANUTENCAO.EM_MANUTENCAO, label: 'Em manutenção' },
  { value: STATUS_MANUTENCAO.CONCLUIDA, label: 'Concluída' },
  { value: STATUS_MANUTENCAO.CANCELADA, label: 'Cancelada' }
]

const MODULOS = [
  { value: '', label: 'Todos os módulos' },
  ...Object.values(MODULOS_MANUTENCAO).map((value) => ({
    value,
    label: value.replaceAll('_', ' ')
  }))
]

export default function FiltrosManutencao({
  filtros,
  onChange,
  onLimpar,
  loading
}) {
  function alterar(campo, valor) {
    onChange({ ...filtros, [campo]: valor })
  }

  return (
    <section className="manutencoes-filtros">
      <label>
        <span>Pesquisar</span>
        <input
          type="search"
          value={filtros.pesquisa}
          placeholder="Patrimônio, policial, RE ou descrição"
          onChange={(event) => alterar('pesquisa', event.target.value)}
        />
      </label>

      <label>
        <span>Módulo</span>
        <select
          value={filtros.modulo}
          onChange={(event) => alterar('modulo', event.target.value)}
        >
          {MODULOS.map((item) => (
            <option key={item.value || 'todos'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Status</span>
        <select
          value={filtros.status}
          onChange={(event) => alterar('status', event.target.value)}
        >
          {STATUS.map((item) => (
            <option key={item.value || 'todos'} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Data inicial</span>
        <input
          type="date"
          value={filtros.dataInicial}
          onChange={(event) => alterar('dataInicial', event.target.value)}
        />
      </label>

      <label>
        <span>Data final</span>
        <input
          type="date"
          value={filtros.dataFinal}
          onChange={(event) => alterar('dataFinal', event.target.value)}
        />
      </label>

      <button
        type="button"
        className="manutencoes-btn-secundario"
        onClick={onLimpar}
        disabled={loading}
      >
        Limpar filtros
      </button>
    </section>
  )
}
