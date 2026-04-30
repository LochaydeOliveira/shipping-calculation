export default async function handler(req, res) {
  // Permitir apenas POST ou GET para testes rápidos
  const cep = req.method === 'POST' ? req.body.cep : req.query.cep;
  const items = req.method === 'POST' ? req.body.items : [];

  if (!cep) return res.status(400).json({ error: 'CEP obrigatório' });

  const cepLimpo = cep.replace(/\D/g, '');
  const cepNum = parseInt(cepLimpo);

  try {
    // 🔹 1. Lógica de Retirada (Curitiba e RMC)
    let retirada = null;
    if (cepNum >= 80000000 && cepNum <= 83800999) {
      retirada = { nome: "Retirada na Loja", preco: 0, prazo: "Imediato" };
    }

    // 🔹 2. Lógica de Motoboy (Cidades Específicas)
    const faixasMotoboy = [
      { nome: "Curitiba", inicio: 80000000, fim: 82999999, valor: 9.90 },
      { nome: "São José dos Pinhais", inicio: 83000001, fim: 83189999, valor: 13.90 },
      { nome: "Pinhais", inicio: 83320001, fim: 83349999, valor: 14.90 },
      { nome: "Piraquara", inicio: 83300001, fim: 83319999, valor: 14.90 },
      { nome: "Colombo", inicio: 83400001, fim: 83419999, valor: 14.90 },
      { nome: "Almirante Tamandaré", inicio: 83500001, fim: 83534999, valor: 14.90 },
      { nome: "Araucária", inicio: 83700001, fim: 83729999, valor: 14.90 }
    ];
    const motoboyMatch = faixasMotoboy.find(f => cepNum >= f.inicio && cepNum <= f.fim);

    // 🔹 3. Integração Real com a Frenet
    // Importante: Se não vier itens do front, enviamos um item padrão para teste não dar erro
    const listaProdutos = items?.length > 0 ? items : [{ Weight: 0.5, Length: 15, Height: 10, Width: 15, Quantity: 1 }];

    const frenetRes = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': process.env.FRENET_TOKEN // Insira isso no Dashboard do Vercel!
      },
      body: JSON.stringify({
        SellerCEP: "80000000", // Substitua pelo seu CEP de origem
        RecipientCEP: cepLimpo,
        ShipmentItemArray: listaProdutos
      })
    });

    const data = await frenetRes.json(); // Aqui declaramos o 'data' corretamente

    // Filtramos apenas fretes que não retornaram erro na Frenet
    const fretesFrenet = data.ShippingSevicesArray
      ? data.ShippingSevicesArray.filter(s => s.Error === false).map(s => ({
          nome: s.ServiceDescription,
          preco: parseFloat(s.ShippingPrice),
          prazo: parseInt(s.DeliveryTime)
        }))
      : [];

    return res.status(200).json({
      success: true,
      cep: cepLimpo,
      retirada,
      motoboy: motoboyMatch,
      fretes: fretesFrenet
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular frete', detalhe: error.message });
  }
}