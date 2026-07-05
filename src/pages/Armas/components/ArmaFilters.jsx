import { useEffect, useState } from 'react'
import {
  listarCalibres,
  listarEspecies,
  listarUnidades
} from '../../../services/armasService'
import QrScanner from '../../../components/QrScanner/QrScanner'

export default function ArmasFilters({
  filtros,
  onChange,
  onClear
}) {
  const [especies, setEspecies] = useState([])
  const [calibres, setCalibres] = useState([])
  const [unidades, setUnidades] = useState([])
  const [scannerAberto, setScannerAberto] = useState(false)

  function update(field, value) {
    onChange({
      ...filtros,
      [field]: value
    })
  }

  function handleQrRead(valor) {
    onChange({
      ...filtros,
      qr_code: valor
    })

    setScannerAberto(false)
  }

  useEffect(() => {
    async function carregarOpcoes() {
      try {
        const [
          listaEspecies,
          listaCalibres,
          listaUnidades
        ] = await Promise.all([
          listarEspecies(),
          listarCalibres(),
          listarUnidades()
        ])

        setEspecies(listaEspecies)
        setCalibres(listaCalibres)
        setUnidades(listaUnidades)
      } catch (error) {
        console.error('Erro ao carregar filtros:', error)
      }
    }

    carregarOpcoes()
  }, [])

  return (
    <>
      <section className="filters-card">
        <div className="filters-grid">
          <input
            placeholder="Pesquisar por patrimônio"
            value={filtros.patrimonio}
            onChange={(e) => update('patrimonio', e.target.value)}
          />

          <input
            placeholder="Pesquisar por número de série"
            value={filtros.numero_serie}
            onChange={(e) => update('numero_serie', e.target.value)}
          />

          <div className="qr-filter-group">
            <input
              placeholder="Pesquisar por QR Code"
              value={filtros.qr_code}
              onChange={(e) => update('qr_code', e.target.value)}
            />

            <button
              type="button"
              className="qr-filter-button"
              onClick={() => setScannerAberto(true)}
            >
              📷 Ler QR
            </button>
          </div>

          <select
            value={filtros.especie}
            onChange={(e) => update('especie', e.target.value)}
          >
            <option value="">Todas as espécies</option>

            {especies.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filtros.calibre}
            onChange={(e) => update('calibre', e.target.value)}
          >
            <option value="">Todos os calibres</option>

            {calibres.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={filtros.status}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="">Todos os status</option>
            <option value="Disponível">Disponível</option>
            <option value="Em uso">Em uso</option>
            <option value="Reserva">Reserva</option>
            <option value="Manutenção">Manutenção</option>
            <option value="Extraviada">Extraviada</option>
            <option value="Baixada">Baixada</option>
          </select>

          <select
            value={filtros.unidade}
            onChange={(e) => update('unidade', e.target.value)}
          >
            <option value="">Todas as unidades</option>

            {unidades.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <button type="button" onClick={onClear}>
            Limpar filtros
          </button>
        </div>
      </section>

      <QrScanner
        open={scannerAberto}
        onRead={handleQrRead}
        onClose={() => setScannerAberto(false)}
      />
    </>
  )
}