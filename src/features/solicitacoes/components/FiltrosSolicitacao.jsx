const STATUS = [
  {
    value: '',
    label: 'Todas'
  },

  {
    value: 'PENDENTE',
    label: 'Pendentes'
  },

  {
    value: 'EM_ANALISE',
    label: 'Em análise'
  },

  {
    value: 'APROVADO',
    label: 'Aprovadas'
  },

  {
    value: 'REPROVADO',
    label: 'Reprovadas'
  },

  {
    value: 'CANCELADO',
    label: 'Canceladas'
  }
]

const TIPOS = [
  {
    value: '',
    label: 'Todos os tipos'
  },

  {
    value: 'CADASTRO',
    label: 'Cadastro'
  },

  {
    value: 'ALTERACAO_SENHA',
    label: 'Senha'
  },

  {
    value: 'PERFIL_TEMPORARIO',
    label: 'Perfil Temporário'
  },

  {
    value: 'P4',
    label: 'P4'
  }
]

export default function FiltrosSolicitacao({
  filtros,
  onChange
}) {
  function alterar(campo, valor) {
    onChange({
      [campo]: valor
    })
  }

  return (
    <div className="solicitacoes-filtros">

      <select
        value={filtros.status}
        onChange={(e) =>
          alterar(
            'status',
            e.target.value
          )
        }
      >
        {STATUS.map((item) => (
          <option
            key={item.value}
            value={item.value}
          >
            {item.label}
          </option>
        ))}
      </select>

      <select
        value={filtros.tipo}
        onChange={(e) =>
          alterar(
            'tipo',
            e.target.value
          )
        }
      >
        {TIPOS.map((item) => (
          <option
            key={item.value}
            value={item.value}
          >
            {item.label}
          </option>
        ))}
      </select>

      <input
        type="search"
        placeholder="Buscar policial..."
        value={filtros.busca}
        onChange={(e) =>
          alterar(
            'busca',
            e.target.value
          )
        }
      />

    </div>
  )
}