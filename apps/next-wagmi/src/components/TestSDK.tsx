'use client'
import { Client } from "@knobs-dev/indid-core-sdk";
import { AdminClient } from "@knobs-dev/indid-admin-sdk";
import { useEthersSigner } from "@knobs-dev/indid-ethers-adapters";
import { useState } from "react";
import { utils } from "ethers";

export function TestSDK() {
    const {data:owner} = useEthersSigner()
    const [friend, setFriend] = useState('');

    const [scw, setScw] = useState('');
    const [txHash, setTxHash] = useState('');

    const sdk = async () => {
        if(owner){
            if (!utils.isAddress(friend)) {
                throw new Error('Indirizzo non valido');
            }
            const clientUser = await Client.init(
                //CHANGE ME
                "rpcurl",
                "apikey"
            )
            const clientAdmin = await AdminClient.init(
                //CHANGE ME
                "rpcurl",
                "apikey"
            );
            console.log(clientUser)
            console.log(clientAdmin)

        
            // -> salt = 0 uso lo stesso account non ne creo uno nuovo
            // const salt = ethers.utils.randomBytes(32);
            // cast the salt to string
            // const saltString = ethers.utils.hexlify(salt);

            //creo l'scw metteondo come owner del contract il signer
    
            const response = await clientAdmin.createAccount(await owner.getAddress());
            console.log("response create account inside sdk:", response);
            setScw(response.accountAddress);

            // await ethers.provider.waitForTransaction(response.txHash);

            // await new Promise(resolve => setTimeout(resolve, 20000));

            //task per aspettare che il contract venga deployato
            await clientUser.waitTask(response.taskId);

            await clientUser.connectAccount(
                owner,
                response.accountAddress
            );

            //firmo per inviare la tx dal signer all'scw
            const tx = await owner.sendTransaction({ //signer to scw
                from: await owner.getAddress(),
                to: response.accountAddress,
                value: "1"
            });
            await tx.wait();
            setTxHash(tx.hash);

            //preparo la userOp per inviare 1 wei al friend
            const builder2 = await clientUser.prepareSendETH(friend, 1);
            console.log(builder2)
            //sponsorizzato da me
            await clientAdmin.getUserOpSponsorship(builder2);

            await clientUser.signUserOperation(builder2); //scw a wallet amico

            //invia la tx, dovrebbe stampare qualcosa la non stampa nulla, immagino per l'errore cors
            const response2 = await clientUser.sendUserOperation(builder2);
    
            //const userOpHash = await clientUser.sendUserOperationBundler(builder2);

            await clientUser.waitOP(response2.userOpHash);
        }
    }
    
    return (
      <div>
        <form>
        <div>
          <label>Indirizzo Destinatario:</label>
          <input type="text" value={friend} onChange={(e) => setFriend(e.target.value)} />
        </div>
        <button type="button" onClick={sdk}>TestSDK</button>
        </form>

        {owner?._address && <a href={`https://mumbai.polygonscan.com/address/${owner?._address}`} target="_blank" rel="noopener noreferrer">
        Signer: {owner?._address}</a>}
        <br></br>
        {friend && <a href={`https://mumbai.polygonscan.com/address/${friend}`} target="_blank" rel="noopener noreferrer">
        Friend: {friend}</a>}
        <br></br>
        {scw && <a href={`https://mumbai.polygonscan.com/address/${scw}`} target="_blank" rel="noopener noreferrer">
        SCW Address: {scw}</a>}
        <br></br>
        {txHash && <a href={`https://mumbai.polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
        Tx da Signer a Friend: {txHash}</a>}
      </div>
    )
  }
  