import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { IndidModule } from "./module";
import { IndidSigner } from "./signer";
export type AccountVersion = "v1" | "v2";

export interface IndidAccountConfig {
  version: AccountVersion;
  signer: IndidSigner;
  guardianSigner?: IndidSigner;
  address: string;
  module: IndidModule;
  owners?: string[];
  guardians?: string[];
  beaconId?: string;
  factoryAddress?: string;
}

export class IndidAccount {
  public version: AccountVersion;
  public signer: IndidSigner;
  // public guardianSigner?: IIndidSigner;
  public address: string;
  public owners: string[];
  public guardians: string[];
  public beaconId: string;
  public module: IndidModule; 
  public factoryAddress: string;
  
  constructor(config: IndidAccountConfig) {
    this.version = config.version;
    this.signer = config.signer;
    // this.guardianSigner = config.guardianSigner;
    this.address = config.address;
    this.owners = config.owners || [];
    this.guardians = config.guardians || [];
    this.beaconId = config.beaconId || "";
    this.module = config.module;
    this.factoryAddress = config.factoryAddress || "";
  }

  /**
   * Generate invokeModule calldata without using a provider
   * @param moduleAddress The address of the module to invoke
   * @param calldata The calldata to pass to the module
   * @param nonce Optional nonce (default: random 32 bytes)
   * @param deadlineSeconds Optional deadline in seconds (default: 1 hour)
   * @param signature Optional signature (default: "0x")
   * @returns The encoded calldata for invokeModule
   */
  public getInvokeModuleCalldata(
    moduleAddress: string,
    calldata: string,
    nonce?: string,
    deadlineSeconds?: number,
    signature: string = "0x"
  ): string {
    // Generate current time and deadline
    const currentTime = Math.round(new Date().getTime() / 1000);
    const deadline = currentTime + (deadlineSeconds || 60 * 60); // Default 1 hour
    
    // Use provided nonce or generate random one
    const actualNonce = nonce || ethers.hexlify(randomBytes(32));
    
    if (this.version === "v1") {
      return this.getV1InvokeModuleCalldata(moduleAddress, calldata, actualNonce, deadline, signature);
    } else if (this.version === "v2") {
      return this.getV2InvokeModuleCalldata(moduleAddress, calldata, actualNonce, deadline, signature);
    }
    
    throw new Error(`Unsupported account version: ${this.version}`);
  }

  private getV1InvokeModuleCalldata(
    moduleAddress: string,
    calldata: string,
    nonce: string,
    deadline: number,
    signature: string
  ): string {
    // Create interface for the account
    const accountInterface = new ethers.Interface([
      "function invokeModule(address module, bytes calldata moduleCalldata, bytes32 nonce, uint256 deadline, bytes calldata signature) external"
    ]);
    
    // Encode the function call
    return accountInterface.encodeFunctionData("invokeModule", [
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
    nonce: string,
    deadline: number,
    signature: string
  ): string {
    // Boilerplate for v2 implementation
    // This is just a placeholder - replace with actual implementation when v2 contracts are available
    
    // For now, we'll assume the same interface as v1
    const accountInterfaceV2 = new ethers.Interface([
      "function invokeModule(address module, bytes calldata moduleCalldata, bytes32 nonce, uint256 deadline, bytes calldata signature) external"
    ]);
    
    return accountInterfaceV2.encodeFunctionData("invokeModule", [
      moduleAddress,
      calldata,
      nonce,
      deadline,
      signature
    ]);
  }
} 