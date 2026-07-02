export default function ArmaFilters() {
  return (
    <div className="armas-filters">
      <input type="text" placeholder="Pesquisar por patrimônio, série, modelo ou responsável..." />

      <select defaultValue="">
        <option value="">Situação</option>
        <option>Em uso</option>
        <option>Reserva</option>
        <option>Manutenção</option>
        <option>Acautelada</option>
        <option>Baixada</option>
      </select>

      <select defaultValue="">
        <option value="">Tipo</option>
        <option>Pistola</option>
        <option>Revólver</option>
        <option>Carabina</option>
        <option>Espingarda</option>
        <option>Fuzil</option>
      </select>

      <select defaultValue="">
        <option value="">Calibre</option>
        <option>.40</option>
        <option>9mm</option>
        <option>12</option>
        <option>5.56</option>
        <option>7.62</option>
      </select>
    </div>
  )
}