import { ethers } from "ethers";
import { ICall } from "./types";
import { Logger } from "./utils";

/**
 * Defines the type of module being used, either for enterprise or individual users
 */
export type ModuleType = "enterprise" | "users";

/**
 * Defines the storage configuration for the module
 * - standard: Uses dedicated storage for each account
 * - shared: Uses shared storage across multiple accounts
 */
export type StorageType = "standard" | "shared";

/**
 * Version of the module implementation
 * Different versions may have different interface requirements and capabilities
 */
export type ModuleVersion = 1 | 2;

/**
 * Interface definition for v1 modules
 * Provides methods for multicall operations and ownership transfer with address parameters
 */
const V1_MODULE_INTERFACE = new ethers.Interface([
  "function multiCall(address account, tuple(address to, uint256 value, bytes data)[] calldata transactions) external",
  "function multiCallNoRevert(address account, tuple(address to, uint256 value, bytes data)[] calldata transactions) external",
  "function transferOwnership(address wallet, address newOwner) external",
  "function execute(address _wallet, bytes calldata _data, uint256 _nonce, uint256 _deadline, bytes calldata _signatures) external"
]);

/**
 * Interface definition for v2 modules
 * Similar to v1 but with enhanced ownership transfer that accepts bytes parameters
 * instead of just address, allowing for more complex ownership structures
 */
const V2_MODULE_INTERFACE = new ethers.Interface([
  "function multiCall(address account, tuple(address to, uint256 value, bytes data)[] calldata transactions) external",
  "function multiCallNoRevert(address account, tuple(address to, uint256 value, bytes data)[] calldata transactions) external",
  "function transferOwnership(address _wallet, bytes calldata _newOwner) external",
  "function execute(address _wallet, bytes calldata _data, uint256 _nonce, uint256 _deadline, bytes[] calldata _signatures) external"
]);

/**
 * IndidModule class
 * 
 * This class represents an Indid module and provides methods for generating calldata
 * for various module operations depending on the version of the module.
 */
export class IndidModule {
 
  public moduleType: ModuleType;
  public storageType: StorageType;
  public version: ModuleVersion;
  
  /**
   * Contract address of the module
   */
  public address: string;
  
  /**
   * Ethers interface for interacting with the module contract
   */
  private moduleInterface: ethers.Interface;

  /**
   * Creates a new IndidModule instance
   * @param moduleAddress The contract address of the module
   * @param moduleType The type of module (enterprise or users)
   * @param storageType The storage configuration (standard or shared)
   * @param version The version of the module implementation
   */
  constructor(
    moduleAddress: string,
    moduleType: ModuleType,
    storageType: StorageType,
    version: ModuleVersion
  ) {
    this.address = moduleAddress;
    this.moduleType = moduleType;
    this.storageType = storageType;
    this.version = version;
    
    // Set the correct interface based on version
    this.moduleInterface = version === 1 ? V1_MODULE_INTERFACE : V2_MODULE_INTERFACE;
  }

  public getCalldataExecute(
    accountAddress: string,
    data: string,
    nonce: string,
    deadline: number,
    signatures: string[]
  ): string {
    if (this.version === 1) {
      //TODO: check if this works for v1
      return this.getV1CalldataExecute(accountAddress, data, nonce, deadline, signatures[0]);
    } else if (this.version === 2) {
      return this.getV2CalldataExecute(accountAddress, data, nonce, deadline, signatures);
    }

    throw new Error(`Unsupported version: ${this.version}`);
  }

  private getV1CalldataExecute(
    accountAddress: string,
    data: string,
    nonce: string,
    deadline: number,
    signatures: string
  ): string {
    return this.moduleInterface.encodeFunctionData("execute", [
      accountAddress,
      data,
      nonce,
      deadline,
      signatures
    ]);
  }

  private getV2CalldataExecute(
    accountAddress: string,
    data: string,
    nonce: string,
    deadline: number,
    signatures: string[]
  ): string {
    return this.moduleInterface.encodeFunctionData("execute", [
      accountAddress,
      data,
      nonce,
      deadline,
      signatures
    ]);
  }

  /**
   * Generate multicall calldata for the module without using a provider
   * @param accountAddress The account address for the multicall
   * @param transactions Array of transactions to include in the multicall
   * @param doNotRevertOnTxFailure Whether to use multiCallNoRevert (true) or multiCall (false)
   * @returns The encoded calldata
   */
  public getCalldataMulticall(
    accountAddress: string,
    transactions: ICall[],
    doNotRevertOnTxFailure = false
  ): string {
    if (this.version === 1) {
      return this.getV1CalldataMulticall(accountAddress, transactions, doNotRevertOnTxFailure);
    } else if (this.version === 2) {
      return this.getV2CalldataMulticall(accountAddress, transactions, doNotRevertOnTxFailure);
    }

    throw new Error(`Unsupported version: ${this.version}`);
  }

  private getV1CalldataMulticall(
    accountAddress: string,
    transactions: ICall[],
    doNotRevertOnTxFailure: boolean
  ): string {
    const functionName = doNotRevertOnTxFailure ? "multiCallNoRevert" : "multiCall";

    return this.moduleInterface.encodeFunctionData(functionName, [
      accountAddress,
      transactions
    ]);
  }

  private getV2CalldataMulticall(
    accountAddress: string,
    transactions: ICall[],
    doNotRevertOnTxFailure: boolean
  ): string {
    const functionName = doNotRevertOnTxFailure ? "multiCallNoRevert" : "multiCall";

    return this.moduleInterface.encodeFunctionData(functionName, [
      accountAddress,
      transactions
    ]);
  }

  /**
   * Generate calldata for transferring ownership
   * @param accountAddress The account address for the transfer
   * @param newOwner The address to which ownership should be transferred
   * @returns The encoded calldata
   */
  public getCalldataTransferOwnership(
    accountAddress: string,
    newOwner: string
  ): string {
    if (this.version === 1) {
      return this.getV1CalldataTransferOwnership(accountAddress, newOwner);
    } else if (this.version === 2) {
      return this.getV2CalldataTransferOwnership(accountAddress, newOwner);
    }

    throw new Error(`Unsupported version: ${this.version}`);
  }

  private getV1CalldataTransferOwnership(
    accountAddress: string,
    newOwner: string
  ): string {
    return this.moduleInterface.encodeFunctionData("transferOwnership", [
      accountAddress,
      newOwner
    ]);
  }

  private getV2CalldataTransferOwnership(
    accountAddress: string,
    newOwner: string
  ): string {
    Logger.getInstance().debug(`getV2CalldataTransferOwnership: ${accountAddress} ${newOwner}`);
    // For v2, we're using the moduleInterface set in the constructor
    return this.moduleInterface.encodeFunctionData("transferOwnership", [
      accountAddress,
      newOwner
    ]);
  }
}
