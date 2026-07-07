import Button from '../ui/Button/Button'
import Input from '../ui/Input/Input'

export default function PatrimonioToolbar({
    busca,
    onBusca,
    onNovo
}) {
    return (
        <div className="toolbar">
            <Input
                placeholder="Pesquisar..."
                value={busca}
                onChange={(e) => onBusca(e.target.value)}
            />

            <Button onClick={onNovo}>
                Novo
            </Button>
        </div>
    )
}