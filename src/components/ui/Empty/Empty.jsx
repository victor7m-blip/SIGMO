import './Empty.css'

export default function Empty({

title,

description

}){

return(

<div className="ui-empty">

<h3>{title}</h3>

<p>{description}</p>

</div>

)

}