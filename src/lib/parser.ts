export interface Transaction {
  date: string;
  description: string;
  amount: number;
  operation_id: string;
  category: string;
  type: 'transaction' | 'caixinha_in' | 'caixinha_out' | 'rendimento';
  sequence: number; // To preserve order within the same day
}

export function parseBankStatement(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  
  const dateRegex = /\d{2}-\d{2}-\d{4}/g;
  let matches = [];
  let match;
  
  while ((match = dateRegex.exec(text)) !== null) {
    matches.push({
      date: match[0],
      index: match.index
    });
  }
  
  // We iterate in reverse if the PDF is in reverse chronological order, 
  // but let's just keep the order they appear in the text and use a sequence counter.
  let sequenceCounter = 0;

  for (let i = 0; i < matches.length; i++) {
    const currentMatch = matches[i];
    const nextMatchIndex = matches[i + 1] ? matches[i + 1].index : text.length;
    
    let chunk = text.substring(currentMatch.index, nextMatchIndex);
    const amountRegex = /R\$\s?(-?[\d.]+,\d{2})/g;
    const amountMatches = [...chunk.matchAll(amountRegex)];
    
    if (amountMatches.length >= 1) {
      const date = currentMatch.date;
      const fullAmountStr = amountMatches[0][1];
      const amount = parseFloat(fullAmountStr.replace(/\./g, '').replace(',', '.'));
      
      let midSection = chunk.substring(10, amountMatches[0].index).trim();
      const idMatch = midSection.match(/(\d+)$/);
      const id = idMatch ? idMatch[1] : '';
      
      let rawDescription = midSection.replace(id, '').trim().replace(/\n/g, ' ');
      
      if (rawDescription && !rawDescription.includes('DETALHE DOS MOVIMENTOS') && !rawDescription.toLowerCase().includes('saldo inicial')) {
        const [day, month, year] = date.split('-');
        const isoDate = `${year}-${month}-${day}`;

        let type: Transaction['type'] = 'transaction';
        let category = 'Geral';
        
        const lowerDesc = rawDescription.toLowerCase();
        
        // IDENTIFICATION LOGIC
        if (lowerDesc.includes('rendimento')) {
          type = 'rendimento';
          category = 'Rendimentos';
        } else if (lowerDesc.includes('dinheiro reservado')) {
          type = 'caixinha_in';
          category = rawDescription.replace(/dinheiro reservado/i, '').trim() || 'Reserva';
        } else if (lowerDesc.includes('dinheiro retirado')) {
          type = 'caixinha_out';
          category = rawDescription.replace(/dinheiro retirado/i, '').trim() || 'Reserva';
        } else if (lowerDesc.includes('lara') && lowerDesc.includes('caixeta')) {
          type = 'transaction';
          category = 'Saldo Inicial (Gestão 2025)';
        } else if (lowerDesc.includes('pix recebido')) {
          category = lowerDesc.includes('fernanda oliveira de queiroz') ? 'Transferência Própria' : 'Venda / Recebimento';
        } else if (lowerDesc.includes('pix enviado')) {
          category = lowerDesc.includes('fernanda oliveira de queiroz') ? 'Transferência Própria' : 'Pagamento / Despesa';
        } else if (amount < 0) {
          category = 'Despesa';
        } else {
          category = 'Entrada';
        }

        transactions.push({
          date: isoDate,
          description: rawDescription,
          amount,
          operation_id: id,
          category,
          type,
          sequence: sequenceCounter++
        });
      }
    }
  }
  
  return transactions;
}
