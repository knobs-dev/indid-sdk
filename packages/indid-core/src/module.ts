import { ethers } from "ethers";
import { ICall } from "./types"; // Assuming this exists
import {
  ModuleMinimalABIV1
} from "./types";

export type ModuleType = "enterprise" | "users";
export type StorageType = "standard" | "shared"; // Not used in v1
export type ModuleVersion = "v1" | "v2";

export class IndidModule {
  public moduleType: ModuleType;
  public storageType: StorageType;
  public version: ModuleVersion;
  public address: string;
  //   private moduleInterface: ethers.Interface;

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
    //TODO: move the module interface creation here
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
    if (this.version === "v1") {
      return this.getV1CalldataMulticall(accountAddress, transactions, doNotRevertOnTxFailure);
    } else if (this.version === "v2") {
      return this.getV2CalldataMulticall(accountAddress, transactions, doNotRevertOnTxFailure);
    }

    throw new Error(`Unsupported version: ${this.version}`);
  }

  private getV1CalldataMulticall(
    accountAddress: string,
    transactions: ICall[],
    doNotRevertOnTxFailure: boolean
  ): string {
    const moduleInterface = new ethers.Interface(ModuleMinimalABIV1);

    const functionName = doNotRevertOnTxFailure ? "multiCallNoRevert" : "multiCall";

    return moduleInterface.encodeFunctionData(functionName, [
      accountAddress,
      transactions
    ]);
  }

  private getV2CalldataMulticall(
    accountAddress: string,
    transactions: ICall[],
    doNotRevertOnTxFailure: boolean
  ): string {
    // Boilerplate for v2 implementation
    // In v2, neither module type nor storage type matters

    // This is just a placeholder - you'll need to replace with actual implementation
    // when v2 contracts are available
    const v2ModuleInterface = new ethers.Interface([
      "function multiCall(address account, tuple(address to, uint256 value, bytes data)[] calldata transactions) external",
      "function multiCallNoRevert(address account, tuple(address to, uint256 value, bytes data)[] calldata transactions) external"
    ]);

    const functionName = doNotRevertOnTxFailure ? "multiCallNoRevert" : "multiCall";

    return v2ModuleInterface.encodeFunctionData(functionName, [
      accountAddress,
      transactions
    ]);
  }


  public getCalldataTransferOwnership(
    accountAddress: string,
    newOwner: string
  ): string {
    //TODO: implement
    return "";
  }
}
