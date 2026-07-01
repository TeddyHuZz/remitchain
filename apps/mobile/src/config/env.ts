/**
 * Environment and Web3 configuration settings for RemitChain.
 * Replace placeholders with your actual ZeroDev/Biconomy dashboard credentials.
 */

// We target Polygon Amoy Testnet for development Micro-remittances
export const WEB3_CONFIG = {
  // Polygon Amoy Chain ID is 80002
  CHAIN_ID: 80002,
  
  // Default to a placeholder project ID. Users can paste their actual ZeroDev Project ID here.
  ZERODEV_PROJECT_ID: process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID || "00000000-0000-0000-0000-000000000000",
  
  // RPC configurations
  BUNDLER_URL: (projectId: string) => `https://rpc.zerodev.app/api/v2/bundler/${projectId}`,
  PAYMASTER_URL: (projectId: string) => `https://rpc.zerodev.app/api/v2/paymaster/${projectId}`,
  
  // Public Polygon Amoy RPC for read-only actions
  PUBLIC_RPC_URL: "https://rpc-amoy.polygon.technology",
  
  // Mock fallback flag: true if we use local/simulated wallet derivation when ZeroDev Project ID is default/missing
  USE_SIMULATION: true,
};
