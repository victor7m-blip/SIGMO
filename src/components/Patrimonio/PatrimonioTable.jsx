export default function PatrimonioTable({

    dados,

    colunas,

    onEditar,

    onExcluir,

    onVisualizar

}) {

    return (

        <table className="table">

            <thead>

                <tr>

                    {colunas.map(coluna => (

                        <th key={coluna.key}>

                            {coluna.label}

                        </th>

                    ))}

                    <th>Ações</th>

                </tr>

            </thead>

            <tbody>

                {dados.map(item => (

                    <tr key={item.id}>

                        {colunas.map(coluna => (

                            <td key={coluna.key}>

                                {item[coluna.key]}

                            </td>

                        ))}

                        <td>

                            <button
                                onClick={() => onVisualizar(item)}
                            >
                                Ver
                            </button>

                            <button
                                onClick={() => onEditar(item)}
                            >
                                Editar
                            </button>

                            <button
                                onClick={() => onExcluir(item)}
                            >
                                Excluir
                            </button>

                        </td>

                    </tr>

                ))}

            </tbody>

        </table>

    )

}