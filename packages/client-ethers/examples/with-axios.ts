/**
 * Ethers Client - With Axios Example
 */

import { TOKENS } from "@armory-sh/base";
import { createX402Client } from "@armory-sh/client-ethers";
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { ethers } from "ethers";

const PRIVATE_KEY =
  process.env.PRIVATE_KEY ??
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const API_BASE_URL = "https://api.example.com";

async function main() {
  console.log("Ethers Client - With Axios Example");
  console.log("==================================\n");

  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log("Wallet address:", wallet.address);

  const client = createX402Client({
    signer: wallet,
    token: TOKENS.USDC_BASE,
    protocolVersion: "auto",
  });

  const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
  });

  axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => config,
  );

  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: number;
      };

      if (error.response?.status === 402 && !originalRequest._retry) {
        originalRequest._retry = 1;

        const paymentRequired =
          error.response.headers["payment-required"] ||
          error.response.headers["x-payment-required"];

        if (paymentRequired) {
          console.log("Payment required, signing...");

          const response = await client.fetch(originalRequest.url!, {
            method: originalRequest.method?.toUpperCase(),
            headers: originalRequest.headers as HeadersInit,
            body: originalRequest.data,
          });

          return await response.json();
        }
      }

      return Promise.reject(error);
    },
  );

  console.log("\nMaking GET request to:", API_BASE_URL);

  try {
    // Make request - payment is handled automatically via interceptor
    const response = await axiosInstance.get("/protected-endpoint");

    console.log("\nResponse status:", response.status);
    console.log("\nResponse data:", response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("\nAxios error:", error.message);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
      }
    } else {
      console.error("\nError:", error instanceof Error ? error.message : error);
    }
  }
}

// Run example
main().catch(console.error);
