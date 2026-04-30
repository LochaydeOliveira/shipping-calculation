export default async function handler(req, res) {
  const cep = req.method === 'POST' ? req.body.cep : req.query.cep;
  const items = req.method === 'POST' ? req.body.items : [];

  if (!cep) return res.status(400).json({ error: 'CEP obrigatório' });

  const cepLimpo = cep.replace(/\D/g, '');
  const cepNum = parseInt(cepLimpo);

  try {
    // 🔹 LÓGICA DE RETIRADA (Curitiba e RMC)
    let retirada = null;
    if (cepNum >= 80000000 && cepNum <= 83800999) {
      retirada = { nome: "Retirada na Loja", preco: 0, prazo: "Imediato" };
    }

    // 🔹 LÓGICA DE MOTOBOY
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

    // 🔹 PREPARAÇÃO DOS ITENS (Forçando valores padrão seguros)
    const listaProdutos = items?.length > 0 
      ? items.map(item => ({
          Weight: parseFloat(item.Weight) || 0.5,
          Length: parseFloat(item.Length) || 16,
          Height: parseFloat(item.Height) || 11,
          Width: parseFloat(item.Width) || 11,
          Quantity: parseInt(item.Quantity) || 1,
          Category: "Default" // Algumas transportadoras exigem categoria[cite: 1]
        }))
      : [{ Weight: 0.5, Length: 16, Height: 11, Width: 11, Quantity: 1, Category: "Default" }];

    // 🔹 CHAMADA À FRENET[cite: 1]
    const frenetRes = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': process.env.FRENET_TOKEN
      },
      body: JSON.stringify({
        SellerCEP: "80230-010", // Verifique se este é o CEP de origem no painel Frenet[cite: 1]
        RecipientCEP: cepLimpo,
        ShipmentItemArray: listaProdutos
      })
    });

    const data = await frenetRes.json();

    // Filtramos os fretes. Se houver erro em um serviço, ele não entra na lista[cite: 1]
    const fretesFrenet = data.ShippingSevicesArray
      ? data.ShippingSevicesArray
          .filter(s => s.Error === false && parseFloat(s.ShippingPrice) > 0)
          .map(s => ({
            nome: s.ServiceDescription,
            preco: parseFloat(s.ShippingPrice),
            prazo: parseInt(s.DeliveryTime) + 2 // Adicionando margem de segurança no prazo[cite: 1]
          }))
      : [];

    return res.status(200).json({
      success: true,
      cep: cepLimpo,
      retirada,
      motoboy: motoboyMatch,
      fretes: fretesFrenet,
      // Debug temporário: Remova esta linha após funcionar para não expor erros no front[cite: 1]
      originalError: data.ShippingSevicesArray?.filter(s => s.Error === true).map(s => s.Msg)
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro ao calcular frete', detalhe: error.message });
  }
}