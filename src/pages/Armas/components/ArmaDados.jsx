import SigmoInput from '../../../ui/components/SigmoInput'
import SigmoSelect from '../../../ui/components/SigmoSelect'
import SigmoTextarea from '../../../ui/components/SigmoTextarea'
import PatrimonioFormGrid from '../../../components/Patrimonio/PatrimonioFormGrid'

const statusOptions = [
  'Disponível',
  'Cautelado',
  'Recolhido',
  'Baixado',
  'Apreendido'
]

const especieOptions = [
  'Pistola',
  'Revólver',
  'Espingarda',
  'Carabina',
  'Fuzil',
  'Metralhadora',
  'Submetralhadora',
  'Outro'
]

export default function ArmaDados({ form, onChange, disabled = false }) {
  return (
    <>
      <PatrimonioFormGrid>
        <SigmoInput
          label="Patrimônio"
          name="patrimonio"
          value={form.patrimonio}
          onChange={onChange}
          required
          disabled={disabled}
        />

        <SigmoInput
          label="Número de série"
          name="numero_serie"
          value={form.numero_serie}
          onChange={onChange}
          required
          disabled={disabled}
        />

        <SigmoSelect
          label="Espécie"
          name="especie"
          value={form.especie}
          onChange={onChange}
          options={especieOptions}
          required
          disabled={disabled}
        />

        <SigmoInput
          label="Marca"
          name="marca"
          value={form.marca}
          onChange={onChange}
          disabled={disabled}
        />

        <SigmoInput
          label="Modelo"
          name="modelo"
          value={form.modelo}
          onChange={onChange}
          disabled={disabled}
        />

        <SigmoInput
          label="Calibre"
          name="calibre"
          value={form.calibre}
          onChange={onChange}
          disabled={disabled}
        />

        <SigmoInput
          label="Acabamento"
          name="acabamento"
          value={form.acabamento}
          onChange={onChange}
          disabled={disabled}
        />

        <SigmoInput
          label="Unidade"
          name="unidade"
          value={form.unidade}
          onChange={onChange}
          disabled={disabled}
        />

        <SigmoSelect
          label="Status"
          name="status"
          value={form.status}
          onChange={onChange}
          options={statusOptions}
          required
          disabled={disabled}
        />
      </PatrimonioFormGrid>

      <div style={{ marginTop: 14 }}>
        <SigmoTextarea
          label="Observações"
          name="observacoes"
          value={form.observacoes}
          onChange={onChange}
          disabled={disabled}
        />
      </div>
    </>
  )
}