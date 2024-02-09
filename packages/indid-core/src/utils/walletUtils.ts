import { BigNumberish, ethers } from "ethers";
import * as crypto from "crypto";
export async function signEIP712Transaction(
  wallet: string,
  moduleAddress: string,
  calldata: string,
  deadline: number,
  chainId: number | BigNumberish,
  signers: ethers.providers.JsonRpcSigner[] | ethers.Wallet[]
): Promise<{ signature: string; nonce: string }> {
  /* 
        Preparing the signature of the standard Transaction message
    */
  const domain = {
    name: "RelayerKnobs",
    version: "1",
    chainId: chainId,
    verifyingContract: moduleAddress,
  };

  // The named list of all type definitions
  const types = {
    Transaction: [
      { name: "wallet", type: "address" },
      { name: "data", type: "bytes" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const nonce = ethers.utils.hexlify(ethers.utils.randomBytes(32));
  let value = {
    wallet: wallet,
    data: calldata,
    nonce: nonce,
    deadline: deadline,
  };

  // Get the signatures and addresses for each signer
  const signatures = await Promise.all(
    signers.map(async (signer) => {
      const address = await signer.getAddress();
      const signature = await signer._signTypedData(domain, types, value);
      return { address, signature };
    })
  );

  // Sort the signatures by address
  signatures.sort((a, b) => a.address.localeCompare(b.address));

  // Concatenate the sorted signatures
  let signature = "0x";
  for (const { signature: signerSignature } of signatures) {
    signature += signerSignature.slice(2);
  }

  return { signature, nonce };
}
