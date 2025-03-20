import { BigNumberish, ethers } from "ethers";
import { ec as EC } from "elliptic";
import BN from "bn.js";
import { IndidAddress, SignerKind, SignatureType } from "./address";

/**
 * Creates a random secp256k1 signer
 * @param signerKind Optional signer kind (Owner by default)
 * @returns An object containing the IndidSigner instance and the private key
 */
export function createRandomSecp256k1Signer(signerKind: SignerKind = SignerKind.Owner): { signer: IndidSigner, privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return {
    signer: IndidSigner.fromSecp256k1(wallet.privateKey, signerKind),
    privateKey: wallet.privateKey
  };
}

/**
 * Creates a random secp256r1 signer
 * @param signerKind Optional signer kind (Owner by default)
 * @returns An object containing the IndidSigner instance and the private key
 */
export function createRandomSecp256r1Signer(signerKind: SignerKind = SignerKind.Owner): { signer: IndidSigner, privateKey: string } {
  const ecCurve = new EC('p256'); // p256 is the same as secp256r1
  const keyPair = ecCurve.genKeyPair();
  const privateKey = `0x${keyPair.getPrivate('hex')}`;
  
  return {
    signer: IndidSigner.fromSecp256r1(privateKey, signerKind),
    privateKey
  };
}

/**
 * IndidSigner is a wrapper class that can work with different types of signers
 * It supports both ethers.Wallet/JsonRpcSigner and EC.keypair signers.
 */
export class IndidSigner {
  private ethersSigner?: ethers.Wallet | ethers.JsonRpcSigner;
  private ecKeypair?: EC.KeyPair;
  private address?: string;
  private curveType: 'secp256k1' | 'secp256r1' = 'secp256k1';
  private signerKind: SignerKind;

  /**
   * Create a new IndidSigner from various input types
   * @param signer Either an ethers.Wallet, ethers.providers.JsonRpcSigner, an EC.KeyPair, or a private key string
   * @param curveType Required curve type when providing a private key string, must be 'secp256k1' or 'secp256r1'
   * @param signerKind The kind of signer (Owner or Guardian), defaults to Owner
   */
  constructor(
    signer: ethers.Wallet | ethers.JsonRpcSigner | EC.KeyPair | string,
    curveType: 'secp256k1' | 'secp256r1' = 'secp256k1',
    signerKind: SignerKind | SignerKind.Owner
  ) {
    this.signerKind = signerKind;
    this.curveType = curveType;
    
    // Case 1: String private key
    if (typeof signer === 'string') {
      const privateKey = signer.startsWith('0x') ? signer : `0x${signer}`;

      if (curveType === 'secp256k1') {
        try {
          // For secp256k1, create an ethers wallet
          this.ethersSigner = new ethers.Wallet(privateKey);
        } catch (error: any) {
          throw new Error(`Invalid secp256k1 private key: ${error.message || 'Unknown error'}`);
        }
      } else if (curveType === 'secp256r1') {
        try {
          // For secp256r1, create an EC keypair
          const ecCurve = new EC('p256'); // p256 is the same as secp256r1
          this.ecKeypair = ecCurve.keyFromPrivate(privateKey.slice(2), 'hex');

          // Compute the Ethereum address from the public key
          const pubKey = this.ecKeypair.getPublic();
          this.address = IndidAddress.formatFullPublicKeyWith0xPrefix(pubKey);
        } catch (error: any) {
          throw new Error(`Invalid secp256r1 private key: ${error.message || 'Unknown error'}`);
        }
      } else {
        throw new Error("Invalid curve type. Use 'secp256k1' or 'secp256r1'");
      }
    }
    // Case 2: Ethers wallet or JsonRpcSigner
    else if (curveType === 'secp256k1') {
      this.ethersSigner = signer as ethers.Wallet | ethers.JsonRpcSigner;
      // Ensure curve type is set to secp256k1 for Ethers signers
      this.curveType = 'secp256k1';
    }
    // Case 3: EC KeyPair
    else {
      this.ecKeypair = signer as EC.KeyPair;
      // Ensure curve type is set to secp256r1 for EC KeyPair
      this.curveType = 'secp256r1';

      // Compute the public key and address
      const pubKey = this.ecKeypair.getPublic();
      this.address = IndidAddress.formatFullPublicKeyWith0xPrefix(pubKey);
    }
  }

  /**
   * Creates a signer from a secp256k1 (Ethereum) private key
   * @param privateKey The private key as a hex string
   * @param signerKind Optional signer kind (Owner by default)
   * @returns A new IndidSigner instance
   */
  public static fromSecp256k1(privateKey: string, signerKind: SignerKind = SignerKind.Owner): IndidSigner {
    return new IndidSigner(privateKey, 'secp256k1', signerKind);
  }

  /**
   * Creates a signer from a secp256r1 (P-256) private key
   * @param privateKey The private key as a hex string
   * @param signerKind Optional signer kind (Owner by default)
   * @returns A new IndidSigner instance
   */
  public static fromSecp256r1(privateKey: string, signerKind: SignerKind = SignerKind.Owner): IndidSigner {
    return new IndidSigner(privateKey, 'secp256r1', signerKind);
  }

  /**
   * Gets the address associated with this signer
   */
  public async getAddress(): Promise<string> {
    //TODO: check this code
    if (this.ethersSigner) {
      //this is done because the constructor cannot await promises
      return IndidAddress.createPrefixedAddress(SignatureType.Secp256k1, await this.ethersSigner.getAddress());
    } else if (this.address) {
      return IndidAddress.createPrefixedAddress(this.curveType === 'secp256k1' ? SignatureType.Secp256k1 : SignatureType.Secp256r1, this.address);
    }
    throw new Error("No signer configured");
  }

  /**
   * Gets the curve type used by this signer
   * @returns The curve type ('secp256k1' or 'secp256r1') or undefined if not set
   */
  public getCurveType(): 'secp256k1' | 'secp256r1' | undefined {
    return this.curveType;
  }

  /**
   * Signs a message using the underlying signer
   * @param message The message to sign
   * @returns The signature
   */
  public async signMessage(message: string | ethers.BytesLike,
    signerKind: SignerKind = SignerKind.Owner
  ): Promise<string> {
    if (this.ethersSigner) {
      return this.ethersSigner.signMessage(message);
    } else if (this.ecKeypair) {

      let signature = this.ecKeypair.sign(message);

      // Ensure s is in the lower half of the curve order
      const curveN = BigInt(this.ecKeypair.ec.n!.toString());
      const halfCurveN = curveN / 2n;
      let sBN = BigInt(`0x${signature.s.toString(16)}`);

      if (sBN > halfCurveN) {
        sBN = curveN - sBN;
        // Convert BigNumber to BN
        signature.s = new BN(sBN.toString(16), 16);
        // Flip the recovery param
        signature.recoveryParam = signature.recoveryParam ? 0 : 1;
      }
      // Convert to Buffer/Uint8Array first to preserve exact byte lengths
      const rBuffer = signature.r.toArrayLike(Buffer, 'be', 32);
      const sBuffer = signature.s.toArrayLike(Buffer, 'be', 32);

      // Convert to hex strings, preserving all bytes including leading zeros
      const r = rBuffer.toString('hex');
      const s = sBuffer.toString('hex');
      const v = (signature.recoveryParam ?? 0).toString(16).padStart(2, '0');

      const cleanSignature = `0x${r}${s}${v}`;

      const prefixedSignature = IndidSigner
        .createPrefixedSignature(signerKind,
          this.curveType === 'secp256k1' ? SignatureType.Secp256k1 : SignatureType.Secp256r1,
          this.address!, cleanSignature);

      return prefixedSignature;
    }

    throw new Error("No signer configured");
  }

  /**
   * Signs a EIP712 transaction
   * @param wallet The wallet address
   * @param moduleAddress The module address
   * @param calldata The calldata
   * @param deadline The deadline
   * @param chainId The chain id
   * @returns The signature and nonce
   */
  public async signEIP712Transaction(
    wallet: string,
    moduleAddress: string,
    calldata: string,
    deadline: number,
    chainId: number | BigNumberish,
    signerKind: SignerKind = SignerKind.Owner
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

    const nonce = BigInt(ethers.hexlify(ethers.randomBytes(32)));
    let message = {
      wallet: wallet,
      data: calldata,
      nonce: nonce,
      deadline: deadline,
    };

    const signature = await this.signTypedData(domain, types, message, signerKind);

    return { signature: signature, nonce: nonce.toString() };
  }

  public async signTypedData(domain: any, types: any, message: any, signerKind: SignerKind ): Promise<string> {
    if (this.ethersSigner) {
      return this.ethersSigner.signTypedData(domain, types, message);
    } else {
      // Get the typed data hash and ensure it's a proper Buffer/Uint8Array
      const typedDataHash = ethers.TypedDataEncoder.hash(domain, types, message);
      const hashBytes = ethers.getBytes(typedDataHash); // Convert to proper byte array

      return await this.signMessage(hashBytes, signerKind);
    }
  }


  /**
   * Creates a prefixed signature
   * @param kind The kind of signer, either Guardian or Owner
   * @param signatureType The type of signature, either Secp256k1 or Secp256r1
   * @param signerAddress The address of the signer
   * @param signature The signature
   * @returns The prefixed signature
   */
  public static createPrefixedSignature(
    kind: SignerKind,
    signatureType: SignatureType,
    signerAddress: string,
    signature: string
  ): string {
    // Construct the first byte
    const ownerKind = kind === SignerKind.Owner ? 0 : 1;
    const sigType = signatureType === SignatureType.Secp256k1 ? 0 : 1;
    const firstByte = (ownerKind << 7) | sigType;

    let signerHash: string;
    // Create the signerHash (32 bytes with 1 byte prefix)
    if (signatureType == SignatureType.Secp256k1) {
      signerHash = ethers.keccak256(ethers.getBytes(IndidAddress.createPrefixedAddress(signatureType, signerAddress)));
    } else if (signatureType == SignatureType.Secp256r1) {
      signerHash = ethers.keccak256(ethers.getBytes(IndidAddress.createPrefixedAddress(signatureType, signerAddress)));
    }
    else {
      throw new Error("util:createPrefixedSignature: Invalid signature type");
    }


    // Combine all parts
    const finalPrefixedSignature = ethers.concat([
      new Uint8Array([firstByte]),
      ethers.getBytes(signerHash),
      ethers.getBytes(signature)
    ]);

    return ethers.hexlify(finalPrefixedSignature);
  }

  // public static createPrefixedAddress(signerType: SignatureType, owner: string): string {

  //   let prefixedAddress: Uint8Array;
  //   let addressBytes: Uint8Array;
  //   if (signerType == SignatureType.Secp256k1) {
  //     prefixedAddress = new Uint8Array(21);
  //     prefixedAddress[0] = 0;
  //     // Ensure the owner is a valid address
  //     const cleanOwner = ethers.getAddress(owner);

  //     // Remove the '0x' prefix if present and get the address bytes
  //     addressBytes = ethers.getBytes(cleanOwner);
  //   } else if (signerType == SignatureType.Secp256r1) {
  //     prefixedAddress = new Uint8Array(65);
  //     prefixedAddress[0] = 1;
  //     const parsedAddress = owner.slice(2);
  //     if (parsedAddress.length !== 64 * 2) { //*2 because in hex each byte is 2 characters
  //       throw new Error("util:createPrefixedAddress: Invalid address length");
  //     }
  //     addressBytes = ethers.getBytes(owner);
  //   } else {
  //     throw new Error("util:createPrefixedAddress: Invalid signature type");
  //   }
  //   // Set the remaining 20 bytes to the address
  //   prefixedAddress.set(addressBytes, 1);

  //   return ethers.hexlify(prefixedAddress);
  // }

  /**
   * Creates an IndidAddress from this signer
   * @returns A Promise resolving to the IndidAddress corresponding to this signer
   */
  public async getIndidAddress(): Promise<IndidAddress> {
    const address = await this.getAddress();
    
    // Parse the prefixed address to get the raw address and signature type
    const { signerType, address: rawAddress } = IndidAddress.parsePrefixedAddress(address);
    
    // Create and return the IndidAddress
    return new IndidAddress(rawAddress, signerType, this.signerKind);
  }

  /**
   * Gets the signer kind
   * @returns The signer kind (Owner or Guardian)
   */
  public getSignerKind(): SignerKind {
    return this.signerKind;
  }
}
