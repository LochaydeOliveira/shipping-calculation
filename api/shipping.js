export default async function handler(req, res) {
  // 1. Captura o CEP e itens independente se for POST ou GET (para facilitar testes)
  const cep = req.method === 'POST' ? req.body.cep : req.query.cep;
  const items = req.method === 'POST' ? req.body.items : [];

  if (!cep) return res.status(400).json({ error: 'CEP obrigatório' });

  const cepLimpo = cep.replace(/\D/g, '');
  const cepNum = parseInt(cepLimpo);

  try {
    // 🔹 LÓGICA DE RETIRADA (Curitiba e RMC: 80000-000 a 83800-999)
    let retirada = null;
    if (cepNum >= 80000000 && cepNum <= 83800999) {
      retirada = { nome: "Retirada na Loja", preco: 0, prazo: "Imediato" };
    }

    // 🔹 LÓGICA DE MOTOBOY (Cidades Específicas conforme sua imagem)
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

    // 🔹 PREPARAÇÃO DOS ITENS PARA A FRENET (Evita erro de Contrato Inválido)
    // Se o frontend não enviar medidas, usamos um padrão mínimo aceito pelos Correios
    const listaProdutos = items?.length > 0 
      ? items.map(item => ({
          Weight: parseFloat(item.Weight) || 0.5,
          Length: parseFloat(item.Length) || 16,
          Height: parseFloat(item.Height) || 11,
          Width: parseFloat(item.Width) || 11,
          Quantity: parseInt(item.Quantity) || 1
        }))
      : [{ Weight: 0.5, Length: 16, Height: 11, Width: 11, Quantity: 1 }];

    // 🔹 INTEGRAÇÃO COM A API DA FRENET[cite: 1]
    const frenetRes = await fetch('https://api.frenet.com.br/shipping/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': process.env.FRENET_TOKEN // Variável configurada no Vercel[cite: 1]
      },
      body: JSON.stringify({
        SellerCEP: "80230010", // CEP Real da Click Note[cite: 1]
        RecipientCEP: cepLimpo,
        ShipmentItemArray: listaProdutos
      })
    });

    const data = await frenetRes.json(); // Declaração correta da variável data[cite: 1]

    // Filtra apenas serviços que não retornaram erro na Frenet[cite: 1]
    const fretesFrenet = data.ShippingSevicesArray
      ? data.ShippingSevicesArray.filter(s => s.Error === false).map(s => ({
          nome: s.ServiceDescription,
          preco: parseFloat(s.ShippingPrice),
          prazo: parseInt(s.DeliveryTime)
        }))
      : [];

    // 🔹 RETORNO FINAL PARA O FRONTEND[cite: 1]
    return res.status(200).json({
      success: true,
      cep: cepLimpo,
      retirada,
      motoboy: motoboyMatch,
      fretes: fretesFrenet
    });

  } catch (error) {
    // Retorno detalhado em caso de erro no servidor[cite: 1]
    return res.status(500).json({ 
      error: 'Erro ao calcular frete', 
      detalhe: error.message 
    });
  }
}