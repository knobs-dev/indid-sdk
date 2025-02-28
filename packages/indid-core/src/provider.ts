import { ethers } from "ethers";


export class BundlerJsonRpcProvider extends ethers.JsonRpcProvider {
  private bundlerRpc?: ethers.JsonRpcProvider;
  private bundlerMethods = new Set([
    "eth_sendUserOperation",
    "eth_estimateUserOperationGas",
    "eth_getUserOperationByHash",
    "eth_getUserOperationReceipt",
    "eth_supportedEntryPoints",
  ]);

  setBundlerRpc(bundlerRpcInfo?: string): BundlerJsonRpcProvider {
    if (bundlerRpcInfo) {
      this.bundlerRpc = new ethers.JsonRpcProvider(bundlerRpcInfo);
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
