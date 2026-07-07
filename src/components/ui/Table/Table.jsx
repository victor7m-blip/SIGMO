import './Table.css'

export default function Table({

children

}){

return(

<div className="ui-table">

<table>

{children}

</table>

</div>

)

}