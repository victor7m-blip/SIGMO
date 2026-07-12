import { PatrimonioPage } from '../../features/patrimonio'
import materiaisConfig from '../../config/patrimonios/materiaisConfig'

export default function Materiais({ user }) {
  return (
    <PatrimonioPage
      config={materiaisConfig}
      user={user}
    />
  )
}