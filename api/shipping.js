export default async function handler(req, res) {
  try {

    const { cep } = req.query;

    if (!cep) {
      return res.status(400).json({ error: 'CEP obrigatório' });
    }

    const cepLimpo = cep.replace(/\D/g, '');

    const response = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': process.env.FRENET_TOKEN
      },
      body: JSON.stringify({
        SellerCEP: "80000000",
        RecipientCEP: cepLimpo,
        ShipmentInvoiceValue: 100,
        ShippingItemArray: [
          {
            Height: 2,
            Length: 16,
            Width: 11,
            Weight: 0.3,
            Quantity: 1
          }
        ]
      })
    });

    const text = await response.text(); // 👈 pegamos texto bruto

    return res.status(200).json({
      status: response.status,
      raw: text
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Erro interno',
      detalhe: error.message
    });
  }
}