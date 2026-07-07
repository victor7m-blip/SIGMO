export function buildTable(items, colunas) {

    return items.map(item => {

        const row = {}

        colunas.forEach(coluna => {

            row[coluna.key] = item[coluna.key]

        })

        row.id = item.id

        return row

    })

}