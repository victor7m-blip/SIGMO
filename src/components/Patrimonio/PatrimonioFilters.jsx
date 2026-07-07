import { Select } from '../ui/Select'

export default function PatrimonioFilters({
    status,
    local,
    onStatus,
    onLocal,
    locais = []
}) {
    return (
        <div className="filters">

            <Select
                value={status}
                onChange={(e)=>onStatus(e.target.value)}
            >
                <option value="">Todos</option>
                <option value="ATIVO">Ativo</option>
                <option value="BAIXADO">Baixado</option>
            </Select>

            <Select
                value={local}
                onChange={(e)=>onLocal(e.target.value)}
            >
                <option value="">Todos locais</option>

                {locais.map(l=>(
                    <option
                        key={l.id}
                        value={l.nome}
                    >
                        {l.nome}
                    </option>
                ))}

            </Select>

        </div>
    )
}