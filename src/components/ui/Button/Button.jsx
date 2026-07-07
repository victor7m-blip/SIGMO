import './Button.css'

export default function Button({

children,

variant='primary',

...props

}){

return(

<button

className={`ui-button ${variant}`}

{...props}

>

{children}

</button>

)

}