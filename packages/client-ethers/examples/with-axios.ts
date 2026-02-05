/**
 * Ethers Client - With Axios Example
 *
 * This example demonstrates using the ethers client with axios
 * for X-402 payments. Shows how axios interceptors handle
 * automatic payment retries.
 *
 * Run with:
 * ```bash
 * bun run examples/with-axios.ts
 * ```
 */

import { createX402Client } from "@armory-sh/client-ethers";
import { ethers } from "ethers";
import axios, { type AxiosInstance, type InternalAxiosRequestConfig, type AxiosResponse } from "axios";
import { registerToken } from "@armory-sh/base";

// Configuration
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001";
const API_BASE_URL = "https://api.example.com";

// Register a custom token (recommended approach)
const USDC_BASE = registerToken({
  symbol: "USDC",
  name: "USD Coin",
  version: "2",
  contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  chainId: 8453,
  decimals: 6,
});

async function main() {
  console.log("Ethers Client - With Axios Example");
  console.log("==================================\n");

  // Create signer from private key
  const wallet = new ethers.Wallet(PRIVATE_KEY);
  console.log("Wallet address:", wallet.address);

  // Create X-402 client with token object (recommended approach)
  const client = createX402Client({
    signer: wallet,
    token: USDC_BASE, // Pre-configured token object
    protocolVersion: "auto",
  });

  // Alternatively, use individual fields (legacy approach):
  // const client = createX402Client({
  //   signer: wallet,
  //   domainName: "USD Coin",
  //   domainVersion: "2",
  //   protocolVersion: "auto",
  // });

  // Create axios instance with X-402 interceptor
  const axiosInstance: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
  });

  // Add request interceptor
  axiosInstance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Client will handle payment signing automatically
      return config;
    }
  );

  // Add response interceptor for 402 handling
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: number };

      // If 402 and not retried yet
      if (error.response?.status === 402 && !originalRequest._retry) {
        originalRequest._retry = 1;

        // Extract payment requirements from response
        const paymentRequired = error.response.headers["payment-required"] ||
                               error.response.headers["x-payment-required"];

        if (paymentRequired) {
          console.log("Payment required, signing...");

          // Client will handle the payment signing
          const response = await client.fetch(originalRequest.url!, {
            method: originalRequest.method?.toUpperCase(),
            headers: originalRequest.headers as HeadersInit,
            body: originalRequest.data,
          });

          return await response.json();
        }
      }

      return Promise.reject(error);
    }
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
