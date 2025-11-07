import { ethers, BigNumberish } from "ethers";
import { IndidModule } from "./module";
import { IndidSigner } from "./signer";
import { IndidAddress } from "./address";

/**
 * Version of the account implementation
 * Different versions have different interface requirements and capabilities
 */
export type AccountVersion = 1 | 2;

// Account interfaces
const V1_ACCOUNT_INTERFACE = new ethers.Interface([
  "function invokeModule(address _module, bytes calldata _data, uint256 _nonce, uint256 _deadline, bytes calldata _signatures) external returns (bool success)"
]);

const V2_ACCOUNT_INTERFACE = new ethers.Interface([
  "function invokeModule(address _module, bytes calldata _data, uint256 _nonce, uint256 _deadline, bytes[] calldata _signatures) external returns (bool success)"
]);

/**
 * Configuration options for creating an IndidAccount instance
 * @param version The version of the account implementation
 * @param signer The signer used for signing transactions
 * @param address The address of the account contract
 * @param module The module associated with this account
 * @param owners Optional array of owner addresses
 * @param guardians Optional array of guardian addresses
 * @param beaconId Optional beacon ID for shared storage accounts
 * @param factoryAddress Optional factory address
 */
export interface IndidAccountConfig {
  version: AccountVersion;
  signer: IndidSigner;
  address: string;
  module: IndidModule;
  owners?: IndidAddress[];
  guardians?: IndidAddress[];
  beaconId?: string;
  factoryAddress?: string;
}

/**
 * IndidAccount class
 * 
 * This class represents an Indid account and provides methods for interacting
 * with the account contract, such as checking its deployment status and
 * generating calldata for module invocation.
 */
export class IndidAccount {
  public version: AccountVersion;
  public signer: IndidSigner;
  public address: string;
  public owners: IndidAddress[];
  public guardians: IndidAddress[];
  public beaconId: string;
  public module: IndidModule; 
  public factoryAddress: string;
  private accountInterface: ethers.Interface;
  
  /**
   * Creates a new IndidAccount instance
   * @param config Configuration options for the account
   */
  constructor(config: IndidAccountConfig) {
    this.version = config.version;
    this.signer = config.signer;
    this.address = config.address;
    this.owners = config.owners || [];
    this.guardians = config.guardians || [];
    this.beaconId = config.beaconId || "";
    this.module = config.module;
    this.factoryAddress = config.factoryAddress || "";
    
    // Set the correct interface based on version
    this.accountInterface = config.version === 1 ? V1_ACCOUNT_INTERFACE : V2_ACCOUNT_INTERFACE;
  }

  /**
   * Check if the account is counterfactual
   * @param provider The provider to use to check the code
   * @returns True if the account is counterfactual, false otherwise
   */
  public async isCounterfactual(provider: ethers.Provider): Promise<boolean> {
    if (this.address === "") {
      return false;
    }
    const code = await provider.getCode(this.address);
    return code === "0x";
  }

  /**
   * Generate invokeModule calldata without using a provider
   * @param moduleAddress The address of the module to invoke
   * @param calldata The calldata to pass to the module
   * @param nonce Optional nonce (default: random BigInt)
   * @param deadlineSeconds Optional deadline in seconds (default: 1 hour)
   * @param signature Optional signature (default: "0x")
   * @returns The encoded calldata for invokeModule
   */
  public getInvokeModuleCalldata(
    moduleAddress: string,
    calldata: string,
    nonce?: BigNumberish,
    deadlineSeconds?: number,
    signature: string = "0x"
  ): string {
    // Generate current time and deadline
    const currentTime = Math.round(new Date().getTime() / 1000);
    const deadline = currentTime + (deadlineSeconds || 60 * 60); // Default 1 hour
    
    // Use provided nonce or generate random one using ethers
    const actualNonce = nonce !== undefined ? nonce : ethers.toBigInt(ethers.randomBytes(24));
    
    if (this.version === 1) {
      return this.getV1InvokeModuleCalldata(moduleAddress, calldata, actualNonce, deadline, signature);
    } else if (this.version === 2) {
      return this.getV2InvokeModuleCalldata(moduleAddress, calldata, actualNonce, deadline, signature);
    }
    
    throw new Error(`Unsupported account version: ${this.version}`);
  }

  private getV1InvokeModuleCalldata(
    moduleAddress: string,
    calldata: string,
    nonce: BigNumberish,
    deadline: number,
    signature: string
  ): string {
    return this.accountInterface.encodeFunctionData("invokeModule", [
      moduleAddress,
      calldata,
      nonce,
      deadline,
      signature
    ]);
  }

  private getV2InvokeModuleCalldata(
    moduleAddress: string,
    calldata: string,
    nonce: BigNumberish,
    deadline: number,
    signature: string
  ): string {
    // Convert signature to array for v2
    const signatures = signature === "0x" ? [] : [signature];
    
    return this.accountInterface.encodeFunctionData("invokeModule", [
      moduleAddress,
      calldata,
      nonce,
      deadline,
      signatures
    ]);
  }
} 