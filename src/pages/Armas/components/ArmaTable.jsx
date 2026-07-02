const armasMock = [
  {
    patrimonio: 'PM-0001',
    especie: 'Pistola',
    marca: 'Taurus',
    modelo: 'PT 100',
    calibre: '.40',
    serie: 'ABC12345',
    situacao: 'Em uso',
    unidade: '1ª Cia',
  },
  {
    patrimonio: 'PM-0002',
    especie: 'Carabina',
    marca: 'Taurus',
    modelo: 'CTT',
    calibre: '5.56',
    serie: 'DEF67890',
    situacao: 'Reserva',
    unidade: 'Reserva de Armas',
  },
]

export default function ArmaTable() {
  return (
    <div className="armas-table-wrap">
      <table className="armas-table">
        <thead>
          <tr>
            <th>Patrimônio</th>
            <th>Espécie</th>
            <th>Marca</th>
            <th>Modelo</th>
            <th>Calibre</th>
            <th>Série</th>
            <th>Situação</th>
            <th>Unidade</th>
            <th>Ações</th>
          </tr>
        </thead>

        <tbody>
          {armasMock.map((arma) => (
            <tr key={arma.patrimonio}>
              <td>{arma.patrimonio}</td>
              <td>{arma.especie}</td>
              <td>{arma.marca}</td>
              <td>{arma.modelo}</td>
              <td>{arma.calibre}</td>
              <td>{arma.serie}</td>
              <td>
                <span className="armas-status">
                  {arma.situacao}
                </span>
              </td>
              <td>{arma.unidade}</td>
              <td>
                <div className="armas-actions">
                  <button>Ver</button>
                  <button>Editar</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}