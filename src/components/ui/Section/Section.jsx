import './Section.css'

export default function Section({
    title,
    subtitle,
    actions,
    children
}){

    return(

        <section className="ui-section">

            <div className="ui-section-header">

                <div>

                    <h2>{title}</h2>

                    {subtitle &&
                        <p>{subtitle}</p>
                    }

                </div>

                {actions}

            </div>

            <div className="ui-section-body">

                {children}

            </div>

        </section>

    )

}