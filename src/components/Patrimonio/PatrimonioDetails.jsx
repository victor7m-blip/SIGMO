import PatrimonioGallery from './PatrimonioGallery'
import PatrimonioQRCode from './PatrimonioQRCode'

export default function PatrimonioDetails({

    children,

    fotos,

    qrCode

}) {

    return (

        <>

            {children}

            <PatrimonioGallery
                fotos={fotos}
            />

            <PatrimonioQRCode
                codigo={qrCode}
            />

        </>

    )

}