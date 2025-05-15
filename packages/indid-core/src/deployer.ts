import { ethers } from "ethers";

/**
 * Interface definition for the Deployer contract
 */
const DEPLOYER_INTERFACE = new ethers.Interface([
  "function deployUsingCreate2(bytes32 salt, bytes bytecode) external returns (address)",
  "function calculateExpectedDeployAddress(bytes32 salt, bytes bytecode) external view returns (address)"
]);

/**
 * Map of chain IDs to deployer addresses
 */
const DEPLOYER_ADDRESSES: { [chainId: number]: string } = {
  137: "0x...", // Polygon
  80002: "0x...", // Amoy
  //TODO Add other chains as needed
};

/**
 * IndidDeployer class
 * 
 * This class provides methods for generating calldata for deployment operations
 * and calculating expected deployment addresses using Create2
 */
export class IndidDeployer {
  /**
   * Contract address of the deployer
   */
  public address: string;
  
  /**
   * Ethers interface for interacting with the deployer contract
   */
  private deployerInterface: ethers.Interface;

  /**
   * Creates a new IndidDeployer instance
   * @param chainId The chain ID where the deployer is located
   * @throws Error if the chain ID is not supported
   */
  constructor(chainId: number) {
    const deployerAddress = DEPLOYER_ADDRESSES[chainId];
    if (!deployerAddress) {
      throw new Error(`Unsupported chain ID for deployer utility functions: ${chainId}`);
    }

    this.address = deployerAddress;
    this.deployerInterface = DEPLOYER_INTERFACE;
  }

  /**
   * Generate deployment transaction calldata
   * @param salt The salt for Create2 deployment
   * @param bytecode The contract bytecode to deploy
   * @returns The encoded calldata for deployment
   */
  public getDeployTxCalldata(
    salt: string | ethers.BytesLike,
    bytecode: string | ethers.BytesLike
  ): string {
    return this.deployerInterface.encodeFunctionData("deployUsingCreate2", [
      salt,
      bytecode
    ]);
  }

  /**
   * Calculate the expected deployment address
   * @param salt The salt for Create2 deployment
   * @param bytecode The contract bytecode to deploy
   * @returns The encoded calldata for address calculation
   */
  public calculateExpectedDeployAddress(
    salt: string | ethers.BytesLike,
    bytecode: string | ethers.BytesLike
  ): string {
    return this.deployerInterface.encodeFunctionData("calculateExpectedDeployAddress", [
      salt,
      bytecode
    ]);
  }
} 