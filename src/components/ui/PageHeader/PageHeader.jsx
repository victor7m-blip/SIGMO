import './PageHeader.css'

export default function PageHeader({

title,

subtitle,

children

}){

return(

<header className="ui-page-header">

<div>

<h1>{title}</h1>

{subtitle &&

<p>{subtitle}</p>

}

</div>

<div>

{children}

</div>

</header>

)

}