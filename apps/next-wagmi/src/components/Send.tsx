'use client'
import { utils } from 'ethers';
import { useEthersSigner } from '@knobs-dev/indid-ethers-adapters'
import { useState } from "react";


export function Send() {
    const signer = useEthersSigner().data
    const [toAddress, setToAddress] = useState('');
    const [amount, setAmount] = useState('');
    const [txHash, setTxHash] = useState('');
    
    const sendTransaction = async () => {
        
        try {
            if (!signer) {
                // Controlla se signer è definito
                throw new Error('Signer non definito. Assicurati di essere connesso.');
            }
          // Valida l'indirizzo
          if (!utils.isAddress(toAddress)) {
            throw new Error('Indirizzo non valido');
          }
    

          const amountInWei = utils.parseEther(amount);
          console.log(toAddress)
          console.log(amountInWei)
          if(signer){
            const tx = await signer.sendTransaction({
              to: toAddress,
              value: amountInWei,
            });

            const receipt = await tx.wait();
            console.log(receipt)
      
            // Imposta l'hash della transazione
            setTxHash(tx.hash);
          }
          
    
         
        } catch (error) {
          console.error('Errore durante l\'invio della transazione:', error);
        }
      };
   
return (
    <div>
      <h2>Invia Transazione</h2>
      <form>
        <div>
          <label>Indirizzo Destinatario:</label>
          <input type="text" value={toAddress} onChange={(e) => setToAddress(e.target.value)} />
        </div>
        <div>
          <label>Importo (in ETH):</label>
          <input type="text" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button type="button" onClick={sendTransaction}>Invia Transazione</button>
      </form>
      {txHash && <a href={`https://mumbai.polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
    Hash della transazione: {txHash}</a>}
    </div>
  );
}