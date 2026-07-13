import MovimentarMaterial, {
  MODOS
} from '../MovimentarMaterial/MovimentarMaterial'

export default function TransferirMaterial({
  user,
  onVoltar,
  onConcluido
}) {
  return (
    <MovimentarMaterial
      user={user}
      modo={MODOS.TRANSFERIR}
      onVoltar={onVoltar}
      onConcluido={onConcluido}
    />
  )
}