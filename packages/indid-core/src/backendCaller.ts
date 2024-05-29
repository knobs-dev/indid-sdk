import fetch from "node-fetch";
import { Response } from "node-fetch";
import {
  IInitCodeRequest,
  IUserOperation,
  ICreateAccountRequest,
  ICreateAccountResponse,
  IInitCodeResponse,
  IUserOpSponsorshipResponse,
  IOpStatusResponse,
  IRetrieveSdkDefaultsResponse,
  ISendUserOpResponse,
  IBSendUserOpRequest,
  IRecoverAccountRequest,
  IRecoverAccountResponse,
  IUserOperationReceipt,
  IGetTaskFromUserOpHashResponse,
  ISendDelegatedTransactionsRequest,
  ISendDelegatedTransactionsResponse,
} from "./types";
import { BigNumberish } from "ethers";
import { Logger } from "./utils";

export class BackendCaller {
  public backendUrl: string;
  public apiKey: string;
  public chainId: BigNumberish;

  public constructor(backendUrl: string, apiKey: string) {
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
    this.chainId = 1;
  }

  public async retrieveSdkDefaults(): Promise<IRetrieveSdkDefaultsResponse> {
    const url =
      `${this.backendUrl}/get-sdk-defaults?` +
      new URLSearchParams({ chainId: Number(this.chainId).toString() });
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        return {
          factoryAddress: "",
          _module: "",
          moduleType: "",
          _guardians: [],
          _guardiansHash: "",
          _guardianId: "",
          storageType: "",
          error: responseText,
        };
      }
      return (await response.json()) as IRetrieveSdkDefaultsResponse;
    } catch (error) {
      Logger.getInstance().error(error);
      return {
        factoryAddress: "",
        _module: "",
        moduleType: "",
        _guardians: [],
        _guardiansHash: "",
        _guardianId: "",
        storageType: "",
        error: `Fetch Error: ${error}`,
      };
    }

  
  }

  public async sendDelegatedTransactions(
    data: ISendDelegatedTransactionsRequest,
  ): Promise<ISendDelegatedTransactionsResponse> {
    const dataWithChainId = {
      ...data,
      chainId: this.chainId,
    };
    const url = `${this.backendUrl}/send-delegated-tx`;
    let config = {
      method: "post",
      body: JSON.stringify(dataWithChainId),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        return {
          taskId: "",
          error: response.status + responseText,
        };
      }
      return (await response.json()) as ISendDelegatedTransactionsResponse;

    } catch (error: any) {
      console.log(error);
      return {
        taskId: "",
        error: `Fetch Error: ${error}`,
      };
    }
  }

  public async sendUserOp(
    data: IBSendUserOpRequest,
  ): Promise<ISendUserOpResponse> {
    const dataWithChainId = {
      ...data,
      chainId: this.chainId,
    };
    Logger.getInstance().debug(`data sent via sendUserOp: ${JSON.stringify(dataWithChainId)}`);
    const url = `${this.backendUrl}/send-op`;
    let config = {
      method: "post",
      body: JSON.stringify(dataWithChainId),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        return {
          userOpHash: "",
          taskId: "",
          error: response.status + responseText,
        };
      }
      return (await response.json()) as ISendUserOpResponse;

    } catch (error: any) {
      Logger.getInstance().error(error);
      return {
        userOpHash: "",
        taskId: "",
        error: `Fetch Error: ${error}`,
      };
    }
  }

 
  public async signPaymasterOp(
    data: IUserOperation
  ): Promise<IUserOpSponsorshipResponse> {
    const dataWithChainId = {
      ...data,
      chainId: this.chainId,
    };

    const url = `${this.backendUrl}/sign-paymaster-op`;
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(dataWithChainId),
    };

    let response: Response | undefined;

    try {
      response = await fetch(url, config);
      if (response!.status === 403) {
        return { paymasterAndData: "", error: "Not Enough Balance" };
      }
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        Logger.getInstance().debug("response status: ", response.status);
        return {
          paymasterAndData: "",
          error: responseText,
        };
      }

    } catch (error) {
      Logger.getInstance().error("inside signPaymasterOp fetch error:", error);
      return { paymasterAndData: "", error: `Fetch Error: ${error}` };
    }
    
    return (await response!.json()) as IUserOpSponsorshipResponse;
  }

  public async getOpStatus(opHash: string): Promise<IOpStatusResponse | null> {
    const url =
      `${this.backendUrl}/op-status?` + new URLSearchParams({ opHash: opHash, chainId: Number(this.chainId).toString() });
      // `${this.backendUrl}/op-status?` + new URLSearchParams({ opHash: opHash});
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },

    };

    try {
      const response = await fetch(url, config);
      if (response.status === 214 || response.status === 504) {
        Logger.getInstance().debug("Waiting for user op receipt")
        return null;
      }
   
      else if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        Logger.getInstance().debug("backend caller response getopstatus status: ", response.status);
        Logger.getInstance().debug("backend caller response getopstatus text: ", responseText);
        return {
          receipt: {} as IUserOperationReceipt,
          error: responseText,
        };
      }
      else if (response.status === 200) {
        const jsonResponse = await response.json();
        if (jsonResponse === undefined) {
          return {
            receipt: {} as IUserOperationReceipt,
            error: "getOpStatus 200 but no json response",
          };
        }
        return { receipt: jsonResponse.receipt as IUserOperationReceipt, error: jsonResponse.reason };
          
      }
      else {
        return {
          receipt: {} as IUserOperationReceipt,
          error: "unknown error",
        };
      }
    } catch (error) {
      Logger.getInstance().error(error);
      return { receipt: {} as IUserOperationReceipt, error: `Fetch Error: ${error}` };
    }
  }
  public async getTaskStatus(taskId: string) {
    const url =
      `${this.backendUrl}/task-status?` +
      new URLSearchParams({ taskId: taskId });
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    try {
      const response = await fetch(url, config);
      if (response.status === 204) {
        return null;
      }
      return { status: response.status, data: await response.json() };
    } catch (error) {
      Logger.getInstance().error(error);
    }
  }

  public async getTaskFromUserOpHash(opHash: string) : Promise<IGetTaskFromUserOpHashResponse>{
    const url = `${this.backendUrl}/task-by-userop/${opHash}`;
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        Logger.getInstance().debug("response status: ", response.status);
        Logger.getInstance().debug("backend caller response text: ", responseText);
        return {
          taskId: "",
          error: responseText,
        };
      }
      const responseFetch = await response.json();
      return responseFetch as IGetTaskFromUserOpHashResponse;
    } catch (error) {
      Logger.getInstance().error(error);
      return { taskId: "", error: `Fetch Error: ${error}` };
    }
  }

  public async retrieveInitCode(
    params: IInitCodeRequest
  ): Promise<IInitCodeResponse> {
    const url =
      `${this.backendUrl}/initCode?` +
      new URLSearchParams({ ...(params as any), chainId: Number(this.chainId).toString() });
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        Logger.getInstance().debug("backend caller response text: ", responseText);
        return { initCode: "", error: responseText };
      }
      return (await response.json()) as IInitCodeResponse;
    } catch (error) {
      Logger.getInstance().error(error);
      return { initCode: "", error: `Fetch Error: ${error}` };
    }
  }

  public async backendCreateAccount(
    data: ICreateAccountRequest
  ): Promise<ICreateAccountResponse> {
    const dataWithChainId = {
      ...data,
      chainId: this.chainId,
    };
    const url = `${this.backendUrl}/create-account`;
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(dataWithChainId),
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        return { accountAddress: "", taskId: "", error: responseText };
      }
      return (await response.json()) as ICreateAccountResponse;
    } catch (error) {
      Logger.getInstance().error(error);
      return { accountAddress: "", taskId: "", error: `Fetch Error: ${error}` };
    }
    
  }

  public async backendRecoverAccount(
    data: IRecoverAccountRequest
  ): Promise<IRecoverAccountResponse> {
    const dataWithChainId = {
      ...data,
      chainId: this.chainId,
    };
    const url = `${this.backendUrl}/recovery-account`;
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(dataWithChainId),
    };

    try {
      const response = await fetch(url, config);
      if (response.status < 200 || response.status >= 300) {
        const responseText = await response.text();
        return { taskId: "", error: responseText };
      }
      return (await response.json()) as IRecoverAccountResponse;
    } catch (error) {
      Logger.getInstance().error(error);
      return { taskId: "", error: `Fetch Error: ${error}` };
    }
    
  }
}
