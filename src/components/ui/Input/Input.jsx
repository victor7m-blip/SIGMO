import './Input.css'

export default function Input({

label,

...props

}){

return(

<label className="ui-input">

{label &&

<span>{label}</span>

}

<input

{...props}

/>

</label>

)

}