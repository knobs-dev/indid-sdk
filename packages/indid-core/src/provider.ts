import { ethers } from "ethers";


export class BundlerJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  private bundlerRpc?: ethers.providers.JsonRpcProvider;
  private bundlerMethods = new Set([
    "eth_sendUserOperation",
    "eth_estimateUserOperationGas",
    "eth_getUserOperationByHash",
    "eth_getUserOperationReceipt",
    "eth_supportedEntryPoints",
  ]);

  setBundlerRpc(bundlerRpcInfo?: string): BundlerJsonRpcProvider {
    if (bundlerRpcInfo) {
      this.bundlerRpc = new ethers.providers.JsonRpcProvider(bundlerRpcInfo);
    }
    return this;
  }

  send(method: string, params: any[]): Promise<any> {
    if (this.bundlerRpc && this.bundlerMethods.has(method)) {
      return this.bundlerRpc.send(method, params);
    }

    return super.send(method, params);
  }
}
