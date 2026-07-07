export default function PatrimonioQRCode({
    codigo
}) {

    if (!codigo)
        return null

    return (
        <div className="qr-area">

            <img
                src={codigo}
                alt="QR Code"
            />

        </div>
    )
}