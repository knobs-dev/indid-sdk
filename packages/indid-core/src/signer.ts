import { BigNumberish, ethers } from "ethers";
import { ec as EC } from "elliptic";
import BN from "bn.js";

export enum SignerKind {
  Guardian,
  Owner
}

export enum SignatureType {
  Secp256k1,
  Secp256r1
}

//TODO: add a way to generat new random seed/key for secp256k1, secp256r1
//check previous createAccount implementation for reference


/**
 * IndidSigner is a wrapper class that can work with different types of signers
 * It supports both ethers.Wallet/JsonRpcSigner and EC.keypair signers.
 */
export class IndidSigner {
  private ethersSigner?: ethers.Wallet | ethers.JsonRpcSigner;
  private ecKeypair?: EC.KeyPair;
  private address?: string;
  private curveType?: 'secp256k1' | 'secp256r1';

  /**
   * Create a new IndidSigner from various input types
   * @param signer Either an ethers.Wallet, ethers.providers.JsonRpcSigner, an EC.KeyPair, or a private key string
   * @param curveType Required curve type when providing a private key string, must be 'secp256k1' or 'secp256r1'
   */
  constructor(
    signer: ethers.Wallet | ethers.JsonRpcSigner | EC.KeyPair | string,
    curveType?: 'secp256k1' | 'secp256r1'
  ) {
    // Case 1: String private key
    if (typeof signer === 'string') {
      // For string private keys, curve type must be explicitly specified
      if (!curveType) {
        throw new Error("curveType must be provided when using a private key string. Use 'secp256k1' or 'secp256r1'");
      }

      const privateKey = signer.startsWith('0x') ? signer : `0x${signer}`;
      this.curveType = curveType;

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
          this.address = this.formatFullPublicKeyWit0xPrefix(pubKey);
        } catch (error: any) {
          throw new Error(`Invalid secp256r1 private key: ${error.message || 'Unknown error'}`);
        }
      } else {
        throw new Error("Invalid curve type. Use 'secp256k1' or 'secp256r1'");
      }
    }
    // Case 2: Ethers wallet or JsonRpcSigner
    //TODO: write a better if condition
    else if ((signer as ethers.Wallet).privateKey !== undefined ||
      (signer as ethers.JsonRpcSigner).provider !== undefined) {
      this.ethersSigner = signer as ethers.Wallet | ethers.JsonRpcSigner;
      this.curveType = 'secp256k1';
    }
    // Case 3: EC KeyPair
    else {
      this.ecKeypair = signer as EC.KeyPair;
      this.curveType = 'secp256r1';

      // Compute the Ethereum address from the public key
      const pubKey = this.ecKeypair.getPublic();
      this.address = this.formatFullPublicKeyWit0xPrefix(pubKey);
    }
  }

  /**
   * Creates a signer from a secp256k1 (Ethereum) private key
   * @param privateKey The private key as a hex string
   * @returns A new IndidSigner instance
   */
  public static fromSecp256k1(privateKey: string): IndidSigner {
    return new IndidSigner(privateKey, 'secp256k1');
  }

  /**
   * Creates a signer from a secp256r1 (P-256) private key
   * @param privateKey The private key as a hex string
   * @returns A new IndidSigner instance
   */
  public static fromSecp256r1(privateKey: string): IndidSigner {
    return new IndidSigner(privateKey, 'secp256r1');
  }

  /**
   * Gets the address associated with this signer
   */
  public async getAddress(): Promise<string> {
    //TODO: check this code
    if (this.ethersSigner) {
      //this is done because the constructor cannot await promises
      return IndidSigner.createPrefixedAddress(SignatureType.Secp256k1, await this.ethersSigner.getAddress());
    } else if (this.address) {
      return IndidSigner.createPrefixedAddress(this.curveType === 'secp256k1' ? SignatureType.Secp256k1 : SignatureType.Secp256r1, this.address);
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
    //TODO: relayer domain and types haven't changed, we could consisider versioning here too to be future proof
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
   * Formats a public key with a 0x prefix
   * @param publicKey The public key to format
   * @returns The formatted public key
   */
  private formatFullPublicKeyWit0xPrefix(publicKey: any): string {
    const formatComponent = (component: any) =>
      component.toString(16).padStart(64, '0');

    const x = formatComponent(publicKey.getX());
    const y = formatComponent(publicKey.getY());

    return `0x${x}${y}`;
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
      signerHash = ethers.keccak256(ethers.getBytes(this.createPrefixedAddress(signatureType, signerAddress)));
    } else if (signatureType == SignatureType.Secp256r1) {
      signerHash = ethers.keccak256(ethers.getBytes(this.createPrefixedAddress(signatureType, signerAddress)));
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

  public static createPrefixedAddress(signerType: SignatureType, owner: string): string {

    let prefixedAddress: Uint8Array;
    let addressBytes: Uint8Array;
    if (signerType == SignatureType.Secp256k1) {
      prefixedAddress = new Uint8Array(21);
      prefixedAddress[0] = 0;
      // Ensure the owner is a valid address
      const cleanOwner = ethers.getAddress(owner);

      // Remove the '0x' prefix if present and get the address bytes
      addressBytes = ethers.getBytes(cleanOwner);
    } else if (signerType == SignatureType.Secp256r1) {
      prefixedAddress = new Uint8Array(65);
      prefixedAddress[0] = 1;
      const parsedAddress = owner.slice(2);
      if (parsedAddress.length !== 64 * 2) { //*2 because in hex each byte is 2 characters
        throw new Error("util:createPrefixedAddress: Invalid address length");
      }
      addressBytes = ethers.getBytes(owner);
    } else {
      throw new Error("util:createPrefixedAddress: Invalid signature type");
    }
    // Set the remaining 20 bytes to the address
    prefixedAddress.set(addressBytes, 1);

    return ethers.hexlify(prefixedAddress);
  }
}
