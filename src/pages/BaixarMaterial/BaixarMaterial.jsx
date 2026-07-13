import MovimentarMaterial, {
  MODOS
} from '../MovimentarMaterial/MovimentarMaterial'

export default function BaixarMaterial({
  user,
  onVoltar,
  onConcluido
}) {
  return (
    <MovimentarMaterial
      user={user}
      modo={MODOS.BAIXAR}
      onVoltar={onVoltar}
      onConcluido={onConcluido}
    />
  )
}