import { ethers } from "ethers";
import { ec as EC } from "elliptic";

/**
 * Enum representing the type of signer
 */
export enum SignerKind {
  Guardian,
  Owner
}

/**
 * Enum representing the type of signature/address
 */
export enum SignatureType {
  Secp256k1,
  Secp256r1
}

/**
 * IndidAddress is a class that handles addresses for both secp256k1 and secp256r1 curves
 * It supports creating addresses from Ethereum addresses and secp256r1 public keys
 */
export class IndidAddress {
  private address: string;
  private signerType: SignatureType;
  private signerKind: SignerKind;
  private prefixedAddress: string;

  /**
   * Create a new IndidAddress
   * @param address The address or public key
   * @param signerType The type of signer (Secp256k1 or Secp256r1)
   * @param signerKind The kind of signer (Owner or Guardian)
   */
  constructor(
    address: string,
    signerType: SignatureType,
    signerKind: SignerKind = SignerKind.Owner
  ) {
    this.address = address;
    this.signerType = signerType;
    this.signerKind = signerKind;
    
    // Validate and create the prefixed address
    this.prefixedAddress = IndidAddress.createPrefixedAddress(signerType, address);
  }

  /**
   * Creates an address from a secp256k1 (Ethereum) address
   * @param address The Ethereum address
   * @param signerKind Optional signer kind (Owner by default)
   * @returns A new IndidAddress instance
   */
  public static fromSecp256k1(address: string, signerKind: SignerKind = SignerKind.Owner): IndidAddress {
    return new IndidAddress(address, SignatureType.Secp256k1, signerKind);
  }

  /**
   * Creates an address from a secp256r1 (P-256) public key
   * @param publicKey The public key as a hex string
   * @param signerKind Optional signer kind (Owner by default)
   * @returns A new IndidAddress instance
   */
  public static fromSecp256r1(publicKey: string, signerKind: SignerKind = SignerKind.Owner): IndidAddress {
    return new IndidAddress(publicKey, SignatureType.Secp256r1, signerKind);
  }

  /**
   * Creates an address from a public key point for secp256r1
   * @param publicKey The EC public key point
   * @param signerKind Optional signer kind (Owner by default)
   * @returns A new IndidAddress instance
   */
  public static fromSecp256r1PublicKey(publicKey: EC.KeyPair, signerKind: SignerKind = SignerKind.Owner): IndidAddress {
    const formattedPublicKey = IndidAddress.formatFullPublicKeyWith0xPrefix(publicKey.getPublic());
    return new IndidAddress(formattedPublicKey, SignatureType.Secp256r1, signerKind);
  }

  /**
   * Creates a random secp256k1 address
   * @param signerKind Optional signer kind (Owner by default)
   * @returns An object containing the IndidAddress instance and the private key
   */
  public static createRandomSecp256k1(signerKind: SignerKind = SignerKind.Owner): { address: IndidAddress, privateKey: string } {
    const wallet = ethers.Wallet.createRandom();
    return {
      address: IndidAddress.fromSecp256k1(wallet.address, signerKind),
      privateKey: wallet.privateKey
    };
  }

  /**
   * Creates a random secp256r1 address
   * @param signerKind Optional signer kind (Owner by default)
   * @returns An object containing the IndidAddress instance and the private key
   */
  public static createRandomSecp256r1(signerKind: SignerKind = SignerKind.Owner): { address: IndidAddress, privateKey: string } {
    const ecCurve = new EC('p256'); // p256 is the same as secp256r1
    const keyPair = ecCurve.genKeyPair();
    const publicKey = keyPair.getPublic();
    const formattedPublicKey = IndidAddress.formatFullPublicKeyWith0xPrefix(publicKey);
    const privateKey = `0x${keyPair.getPrivate('hex')}`;
    
    return {
      address: IndidAddress.fromSecp256r1(formattedPublicKey, signerKind),
      privateKey
    };
  }

  /**
   * Gets the raw address (without prefix)
   * @returns The raw address
   */
  public getAddress(): string {
    return this.address;
  }

  /**
   * Gets the prefixed address
   * @returns The prefixed address
   */
  public getPrefixedAddress(): string {
    return this.prefixedAddress;
  }

  /**
   * Gets the signer type
   * @returns The signer type
   */
  public getSignerType(): SignatureType {
    return this.signerType;
  }

  /**
   * Gets the signer kind
   * @returns The signer kind
   */
  public getSignerKind(): SignerKind {
    return this.signerKind;
  }

  /**
   * Checks if the address is a secp256k1 address
   * @returns True if the address is a secp256k1 address
   */
  public isSecp256k1(): boolean {
    return this.signerType === SignatureType.Secp256k1;
  }

  /**
   * Checks if the address is a secp256r1 address
   * @returns True if the address is a secp256r1 address
   */
  public isSecp256r1(): boolean {
    return this.signerType === SignatureType.Secp256r1;
  }

  /**
   * Checks if the address is an owner
   * @returns True if the address is an owner
   */
  public isOwner(): boolean {
    return this.signerKind === SignerKind.Owner;
  }

  /**
   * Checks if the address is a guardian
   * @returns True if the address is a guardian
   */
  public isGuardian(): boolean {
    return this.signerKind === SignerKind.Guardian;
  }

  /**
   * Creates a prefixed address depending on the signer type
   * @param signerType The type of signer (Secp256k1 or Secp256r1)
   * @param address The address or public key
   * @returns The prefixed address
   */
  public static createPrefixedAddress(signerType: SignatureType, address: string): string {
    let prefixedAddress: Uint8Array;
    let addressBytes: Uint8Array;
    
    if (signerType === SignatureType.Secp256k1) {
      prefixedAddress = new Uint8Array(21);
      prefixedAddress[0] = 0;
      // Ensure the address is a valid Ethereum address
      const cleanAddress = ethers.getAddress(address);
      
      // Get the address bytes
      addressBytes = ethers.getBytes(cleanAddress);
    } else if (signerType === SignatureType.Secp256r1) {
      prefixedAddress = new Uint8Array(65);
      prefixedAddress[0] = 1;
      
      // Validate the public key format
      const parsedAddress = address.startsWith('0x') ? address.slice(2) : address;
      if (parsedAddress.length !== 64 * 2) { // *2 because in hex each byte is 2 characters
        throw new Error("IndidAddress:createPrefixedAddress: Invalid public key length");
      }
      
      // Get the public key bytes
      addressBytes = ethers.getBytes(address.startsWith('0x') ? address : `0x${address}`);
    } else {
      throw new Error("IndidAddress:createPrefixedAddress: Invalid signature type");
    }
    
    // Set the address bytes after the prefix
    prefixedAddress.set(addressBytes, 1);
    
    return ethers.hexlify(prefixedAddress);
  }

  /**
   * Formats a public key with a 0x prefix
   * @param publicKey The public key to format
   * @returns The concatenated x and y components of the public key prefixed with 0x
   */
  public static formatFullPublicKeyWith0xPrefix(publicKey: any): string {
    const formatComponent = (component: any) =>
      component.toString(16).padStart(64, '0');

    const x = formatComponent(publicKey.getX());
    const y = formatComponent(publicKey.getY());

    return `0x${x}${y}`;
  }

  /**
   * Parses a prefixed address to extract the signer type and raw address
   * @param prefixedAddress The prefixed address
   * @returns An object containing the signer type and raw address
   */
  public static parsePrefixedAddress(prefixedAddress: string): { 
    signerType: SignatureType, 
    address: string 
  } {
    const bytes = ethers.getBytes(prefixedAddress);
    
    // Extract the prefix byte
    const prefix = bytes[0];
    
    if (prefix === 0) {
      // Secp256k1 address
      const addressBytes = bytes.slice(1);
      const address = ethers.getAddress(ethers.hexlify(addressBytes));
      
      return {
        signerType: SignatureType.Secp256k1,
        address
      };
    } else if (prefix === 1) {
      // Secp256r1 public key
      const publicKeyBytes = bytes.slice(1);
      const publicKey = ethers.hexlify(publicKeyBytes);
      
      return {
        signerType: SignatureType.Secp256r1,
        address: publicKey
      };
    } else {
      throw new Error("IndidAddress:parsePrefixedAddress: Invalid prefix");
    }
  }

  /**
   * Creates a new IndidAddress from a prefixed address
   * @param prefixedAddress The prefixed address (00 prefix for secp256k1, 01 for secp256r1)
   * @param signerKind Optional signer kind (Owner by default)
   * @returns A new IndidAddress instance
   */
  public static newFromPrefixedAddress(
    prefixedAddress: string, 
    signerKind: SignerKind = SignerKind.Owner
  ): IndidAddress {
    const { signerType, address } = IndidAddress.parsePrefixedAddress(prefixedAddress);
    
    return new IndidAddress(address, signerType, signerKind);
  }
}