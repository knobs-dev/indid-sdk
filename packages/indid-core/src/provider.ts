import { ethers } from "ethers";

/**
 * Extended JSON-RPC provider that routes bundler-specific methods to a dedicated bundler RPC endpoint.
 * This provider acts as a proxy, sending standard Ethereum methods to the primary provider
 * while routing ERC-4337 bundler methods to a specialized bundler endpoint.
 */
export class BundlerJsonRpcProvider extends ethers.JsonRpcProvider {
  /**
   * Provider instance for the bundler RPC endpoint
   */
  private bundlerRpc?: ethers.JsonRpcProvider;

  /**
   * Set of method names that should be routed to the bundler RPC endpoint
   */
  private bundlerMethods = new Set([
    "eth_sendUserOperation",
    "eth_estimateUserOperationGas",
    "eth_getUserOperationByHash",
    "eth_getUserOperationReceipt",
    "eth_supportedEntryPoints",
  ]);

  /**
   * Sets the bundler RPC endpoint for ERC-4337 specific methods
   * @param bundlerRpcInfo URL of the bundler RPC endpoint
   * @returns The provider instance for method chaining
   */
  setBundlerRpc(bundlerRpcInfo?: string): BundlerJsonRpcProvider {
    if (bundlerRpcInfo) {
      this.bundlerRpc = new ethers.JsonRpcProvider(bundlerRpcInfo);
    }
    return this;
  }

  /**
   * Overrides the send method to route calls to the appropriate provider
   * @param method The JSON-RPC method name
   * @param params The parameters for the method
   * @returns Promise resolving to the method's result
   */
  send(method: string, params: any[]): Promise<any> {
    if (this.bundlerRpc && this.bundlerMethods.has(method)) {
      return this.bundlerRpc.send(method, params);
    }

    return super.send(method, params);
  }
}
