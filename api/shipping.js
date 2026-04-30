export default async function handler(req, res) {
  try {

    const { cep } = req.query;

    if (!cep) {
      return res.status(400).json({ error: 'CEP obrigatório' });
    }

    const cepLimpo = cep.replace(/\D/g, '');
    const cepNum = parseInt(cepLimpo);

    // =========================
    // REGRAS FIXAS
    // =========================

    // RETIRADA
    const retirada =
      cepNum >= 80000000 && cepNum <= 83800999
        ? {
            nome: "Retirada na Loja",
            preco: 0,
            prazo: "Imediato"
          }
        : null;

    // MOTOBOY
    const faixasMotoboy = [
      { nome: "Curitiba", inicio: 80000000, fim: 82999999, valor: 9.9 },
      { nome: "São José dos Pinhais", inicio: 83000001, fim: 83189999, valor: 13.9 },
      { nome: "Pinhais", inicio: 83320001, fim: 83349999, valor: 14.9 },
      { nome: "Piraquara", inicio: 83300001, fim: 83319999, valor: 14.9 },
      { nome: "Colombo", inicio: 83400001, fim: 83419999, valor: 14.9 },
      { nome: "Almirante Tamandaré", inicio: 83500001, fim: 83534999, valor: 14.9 },
      { nome: "Araucária", inicio: 83700001, fim: 83729999, valor: 14.9 }
    ];

    const motoboy = faixasMotoboy.find(
      f => cepNum >= f.inicio && cepNum <= f.fim
    );

    // =========================
    // FRENET (AUTOMÁTICO)
    // =========================

    let fretes = [];

    try {
      const response = await fetch('https://api.frenet.com.br/shipping/quote', {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': process.env.FRENET_TOKEN
        },
        body: JSON.stringify({
          SellerCEP: "80000000", // seu CEP origem
          RecipientCEP: cepLimpo,
          ShipmentInvoiceValue: 100,
          ShippingItemArray: [
            {
              Height: 4,
              Length: 20,
              Width: 15,
              Weight: 0.5,
              Quantity: 1
            }
          ]
        })
      });

      const data = await response.json();

      if (data && data.ShippingSevicesArray) {
        fretes = data.ShippingSevicesArray
          .filter(s =>
            !(
              s.ServiceDescription?.toLowerCase().includes('local delivery') ||
              s.ServiceDescription?.toLowerCase().includes('entrega local')
            )
          )
          .map(s => ({
            nome: s.ServiceDescription,
            preco: s.ShippingPrice,
            prazo: s.DeliveryTime
          }));
      }

    } catch (err) {
      // Frenet falhou → não quebra o fluxo
      fretes = [];
    }


    
    // =========================
    // RESPOSTA FINAL
    // =========================

    return res.status(200).json({
        raw: data        
    });

    } catch (error) {
        console.error('ERRO FRENET:', error);
        console.log("FRENET RESPONSE:", data);
        return res.status(500).json({
            error: 'Erro ao calcular frete',
            detalhe: error.message
        });
    }
}