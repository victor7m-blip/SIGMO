import { useEffect, useState } from 'react'
import { listarPoliciais } from '../services/policiais'

export default function Usuarios({ setRoute }) {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    carregar()
  }, [])

  async function carregar() {
    try {
      const dados = await listarPoliciais()
      setUsuarios(dados)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="panel">

      <div className="panel-title">
        <h2>Usuários</h2>

        <button
          className="primary-btn"
          onClick={() => setRoute('novo-usuario')}
        >
          + Novo Usuário
        </button>

      </div>

      <br />

      {loading ? (
        <p>Carregando...</p>
      ) : usuarios.length === 0 ? (
        <p>Nenhum policial cadastrado.</p>
      ) : (
        <table>

          <thead>

            <tr>

              <th>RE</th>

              <th>Nome</th>

              <th>Posto</th>

              <th>Companhia</th>

              <th>Situação</th>

            </tr>

          </thead>

          <tbody>

            {usuarios.map((u) => (

              <tr key={u.id}>

                <td>{u.re}</td>

                <td>{u.nome}</td>

                <td>{u.posto_graduacao}</td>

                <td>{u.companhia}</td>

                <td>{u.situacao}</td>

              </tr>

            ))}

          </tbody>

        </table>
      )}

    </section>
  )
}