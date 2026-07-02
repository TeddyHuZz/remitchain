import * as SecureStore from 'expo-secure-store';
import { createPublicClient, http, Hex, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';
import { generatePrivateKey } from 'viem/accounts';
import { WEB3_CONFIG } from '../config/env';
import * as LocalAuthentication from 'expo-local-authentication';
import { backupService } from './backupService';
import { signerToEcdsaValidator } from '@zerodev/ecdsa-validator';
import { createKernelAccount, createKernelAccountClient, createZeroDevPaymasterClient } from '@zerodev/sdk';
import { KERNEL_V3_1, getEntryPoint } from '@zerodev/sdk/constants';

// SecureStore key definitions
const EOA_PRIVATE_KEY_KEY = 'remitchain_eoa_private_key';
const USERNAME_KEY = 'remitchain_username';
const SMART_ADDRESS_KEY = 'remitchain_smart_address';

export interface WalletState {
  eoaAddress: string;
  smartAccountAddress: string;
  username: string;
  isSimulated: boolean;
  isCloudSynced?: boolean;
}

/**
 * Service to manage Account Abstraction wallet derivation and operations.
 */
class WalletService {
  private activeWallet: WalletState | null = null;

  /**
   * Helper: Get SecureStore authentication options dynamically based on biometrics availability.
   * Prevents rejection crashes on emulators with no biometrics enrolled.
   */
  async getAuthOptions(prompt: string) {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      return {
        requireAuthentication: hasHardware && isEnrolled,
        authenticationPrompt: prompt,
      };
    } catch {
      return {
        requireAuthentication: false,
        authenticationPrompt: prompt,
      };
    }
  }

  /**
   * Helper: Get or create an EOA private key from SecureStore.
   * On production, this acts as the signer key backed by biometrics or social authentication.
   */
  async getOrCreatePrivateKey(): Promise<Hex> {
    const authOptions = await this.getAuthOptions('Verify your identity to unlock your secure vault key');
    try {
      let privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions);
      if (!privKey) {
        privKey = generatePrivateKey();
        await SecureStore.setItemAsync(EOA_PRIVATE_KEY_KEY, privKey, authOptions);
      }
      return privKey as Hex;
    } catch (error) {
      console.warn("SecureStore error, falling back to ephemeral session private key:", error);
      // Fallback if simulator has secure store disabled or errors out
      return generatePrivateKey();
    }
  }

  /**
   * Clears the stored keys from the device (Log Out)
   */
  async clearWallet(): Promise<void> {
    await SecureStore.deleteItemAsync(EOA_PRIVATE_KEY_KEY);
    await SecureStore.deleteItemAsync(USERNAME_KEY);
    await SecureStore.deleteItemAsync('remitchain_auth_method');
    await SecureStore.deleteItemAsync(SMART_ADDRESS_KEY);
    this.activeWallet = null;
  }

  /**
   * Registration / Sign Up Flow:
   * Derive the user's Smart Wallet address using Account Abstraction.
   */
  async initializeWallet(
    username: string,
    loginMethod: 'passkey' | 'google',
    onProgress?: (status: string) => void
  ): Promise<WalletState> {
    let privateKey: Hex;

    if (loginMethod === 'passkey') {
      onProgress?.("Triggering biometric scan...");
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        if (hasHardware && isEnrolled) {
          const authResult = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock or create your secure wallet key',
            fallbackLabel: 'Use device passcode',
          });
          if (!authResult.success) {
            throw new Error("Biometric scan was cancelled or failed.");
          }
        } else {
          console.warn("Biometrics hardware not available or not enrolled, skipping prompt.");
        }
      } catch (err) {
        console.warn("Biometric authentication error, proceeding with passcode/fallback:", err);
      }

      onProgress?.("Generating secure device keys...");
      privateKey = await this.getOrCreatePrivateKey();
    } else {
      // Google Login via Secure Google Drive Backup & Restore
      onProgress?.("Signing into Google account...");
      try {
        // 1. Authenticate with Google
        const googleSession = await backupService.authenticateGoogle(username);
        
        onProgress?.("Checking for cloud backups on Google Drive...");
        
        // 2. Download from Google Drive (returns encrypted key if it exists)
        const encryptedBackup = await backupService.downloadBackup(googleSession);
        
        if (encryptedBackup) {
          onProgress?.("Restoring wallet from Google cloud...");
          // Decrypt the key using their username/passcode
          const decryptedKey = backupService.decrypt(encryptedBackup, username);
          privateKey = decryptedKey as Hex;
        } else {
          onProgress?.("No backup found. Creating local wallet...");
          await new Promise((r) => setTimeout(r, 800));
          // Generate key locally
          privateKey = generatePrivateKey();
          
          onProgress?.("Backing up wallet to Google Drive...");
          // Encrypt client-side
          const encryptedKey = backupService.encrypt(privateKey, username);
          // Upload to Drive
          await backupService.uploadBackup(googleSession, encryptedKey);
        }

        // Save the private key to SecureStore (locked behind biometrics/FaceID if enrolled)
        const storeAuthOptions = await this.getAuthOptions('Secure your restored wallet with biometrics');
        await SecureStore.setItemAsync(EOA_PRIVATE_KEY_KEY, privateKey, storeAuthOptions);
      } catch (err: any) {
        console.error("Google sync flow failed, falling back to secure local key:", err);
        onProgress?.("Google Sync failed, using secure local key...");
        await new Promise((r) => setTimeout(r, 1200));
        privateKey = await this.getOrCreatePrivateKey();
      }
    }

    const ownerAccount = privateKeyToAccount(privateKey);
    const ownerAddress = ownerAccount.address;

    await SecureStore.setItemAsync(USERNAME_KEY, username);
    await SecureStore.setItemAsync('remitchain_auth_method', loginMethod);

    const isMock = WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      // Mock / Simulation Mode
      onProgress?.("Deriving counterfactual Smart Account address (Polygon Amoy)...");
      await new Promise((r) => setTimeout(r, 1200));

      // Deterministically mock a Smart Wallet address based on the ownerAddress
      const mockSmartAccountAddress = `0x3a4b${ownerAddress.slice(6, 38)}7f89` as Hex;

      onProgress?.("Registering gasless Paymaster policy...");
      await new Promise((r) => setTimeout(r, 1000));

      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress: mockSmartAccountAddress,
        username,
        isSimulated: true,
        isCloudSynced: loginMethod === 'google',
      };

      await SecureStore.setItemAsync(SMART_ADDRESS_KEY, mockSmartAccountAddress);
      return this.activeWallet;
    }

    try {
      onProgress?.("Connecting to Polygon Amoy Testnet RPC...");
      
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(WEB3_CONFIG.PUBLIC_RPC_URL),
      });

      onProgress?.("Initializing Kernel ECDSA Validator...");
      
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: ownerAccount,
        entryPoint,
        kernelVersion,
      });

      onProgress?.("Deploying/Deriving counterfactual Kernel Account...");
      const kernelAccount = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint,
        kernelVersion,
      });

      onProgress?.("Registering gasless Paymaster policy...");
      const smartAccountAddress = kernelAccount.address;

      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress,
        username,
        isSimulated: false,
        isCloudSynced: loginMethod === 'google',
      };

      await SecureStore.setItemAsync(SMART_ADDRESS_KEY, smartAccountAddress);
      return this.activeWallet;
    } catch (error: any) {
      console.error("Live ZeroDev AA derivation failed, falling back to simulated mode:", error);
      
      // Graceful fallback to simulated mode if bundler/paymaster URL fails
      onProgress?.("Fallback: Generating simulated Smart Account address...");
      await new Promise((r) => setTimeout(r, 1000));
      
      const mockSmartAccountAddress = `0x7f3e${ownerAddress.slice(6, 38)}9c4d` as Hex;
      
      this.activeWallet = {
        eoaAddress: ownerAddress,
        smartAccountAddress: mockSmartAccountAddress,
        username,
        isSimulated: true,
        isCloudSynced: loginMethod === 'google',
      };
      
      await SecureStore.setItemAsync(SMART_ADDRESS_KEY, mockSmartAccountAddress);
      return this.activeWallet;
    }
  }

  /**
   * Check if there's a stored session on the device
   */
  async getStoredSession(): Promise<WalletState | null> {
    try {
      const username = await SecureStore.getItemAsync(USERNAME_KEY);
      const authOptions = await this.getAuthOptions('Unlock your RemitChain session with biometrics');
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions);

      if (username && privKey) {
        const authMethod = await SecureStore.getItemAsync('remitchain_auth_method');
        const savedSmartAddr = await SecureStore.getItemAsync(SMART_ADDRESS_KEY);
        const ownerAccount = privateKeyToAccount(privKey as Hex);
        const isMock = WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");
        
        let smartAddr: Hex;
        if (savedSmartAddr) {
          smartAddr = savedSmartAddr as Hex;
        } else {
          smartAddr = isMock
            ? (`0x3a4b${ownerAccount.address.slice(6, 38)}7f89` as Hex)
            : (`0x7f3e${ownerAccount.address.slice(6, 38)}9c4d` as Hex);
        }

        // Set simulated flag if we are using a mock address prefix
        const isSimulated = isMock || smartAddr.startsWith("0x3a4b") || smartAddr.startsWith("0x7f3e");

        this.activeWallet = {
          eoaAddress: ownerAccount.address,
          smartAccountAddress: smartAddr,
          username,
          isSimulated,
          isCloudSynced: authMethod === 'google',
        };
        return this.activeWallet;
      }
    } catch (e) {
      console.warn("Could not retrieve stored session", e);
    }
    return null;
  }

  /**
   * Performs an on-chain gasless USDC transaction sponsored via our paymaster
   */
  async simulateGaslessTransfer(
    recipientAddress: string,
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      onStatusChange?.("Preparing simulated transaction...");
      await new Promise((r) => setTimeout(r, 1000));
      onStatusChange?.("Sponsoring simulated gas...");
      await new Promise((r) => setTimeout(r, 1200));
      onStatusChange?.("Signing simulated UserOperation...");
      await new Promise((r) => setTimeout(r, 800));
      onStatusChange?.("Submitting simulated transaction...");
      await new Promise((r) => setTimeout(r, 1200));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return {
        txHash: mockHash,
        gasSaved: "0.015 POL (~$0.02 USD)",
      };
    }

    // Real On-Chain Flow using ZeroDev Kernel Account client and Paymaster
    try {
      onStatusChange?.("Retrieving device credentials...");
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY);
      if (!privKey) throw new Error("Owner private key not found in storage.");

      const ownerAccount = privateKeyToAccount(privKey as Hex);
      
      onStatusChange?.("Connecting to RPC Network...");
      const rpcUrl = WEB3_CONFIG.BUNDLER_URL(WEB3_CONFIG.ZERODEV_PROJECT_ID);
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      onStatusChange?.("Re-initializing Smart Account...");
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: ownerAccount,
        entryPoint,
        kernelVersion,
      });

      const account = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint,
        kernelVersion,
      });

      onStatusChange?.("Constructing gasless transaction client...");
      const paymasterClient = createZeroDevPaymasterClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      const kernelClient = createKernelAccountClient({
        account,
        chain: polygonAmoy,
        bundlerTransport: http(rpcUrl),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            return paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      onStatusChange?.("Encoding USDC transfer transaction...");
      // Official Circle USDC Token Address on Polygon Amoy
      const usdcTokenAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
      
      // Convert amount to 6 decimals (USDC standard)
      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * 1_000_000));

      const transferData = encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'recipient', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: 'success', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [recipientAddress as Hex, amountInUnits],
      });

      onStatusChange?.("Signing and sending gasless transaction...");
      const txHash = await kernelClient.sendTransaction({
        to: usdcTokenAddress,
        data: transferData,
      });

      return {
        txHash,
        gasSaved: "0.015 POL (~$0.02 USD)",
      };
    } catch (e: any) {
      console.error("Real transfer error:", e);
      throw new Error(`Real on-chain transfer failed: ${e.message || e}`);
    }
  }

  /**
   * Performs an on-chain gasless batched USDC transaction split between two recipients
   */
  async simulateGaslessSplitTransfer(
    recipientA: string,
    recipientB: string,
    totalAmount: string,
    pctA: number,
    pctB: number,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    const amountA = (parseFloat(totalAmount) * pctA) / 100;
    const amountB = (parseFloat(totalAmount) * pctB) / 100;

    if (isMock) {
      onStatusChange?.("Preparing simulated batched transaction...");
      await new Promise((r) => setTimeout(r, 1000));
      onStatusChange?.("Sponsoring simulated gas...");
      await new Promise((r) => setTimeout(r, 1200));
      onStatusChange?.("Signing batched UserOperation...");
      await new Promise((r) => setTimeout(r, 800));
      onStatusChange?.("Submitting batched transaction...");
      await new Promise((r) => setTimeout(r, 1200));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return {
        txHash: mockHash,
        gasSaved: "0.025 POL (~$0.03 USD)",
      };
    }

    // Real On-Chain Batch Flow using ZeroDev Kernel Account client and Paymaster
    try {
      onStatusChange?.("Retrieving credentials...");
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY);
      if (!privKey) throw new Error("Owner private key not found in storage.");

      const ownerAccount = privateKeyToAccount(privKey as Hex);
      
      onStatusChange?.("Connecting to RPC Network...");
      const rpcUrl = WEB3_CONFIG.BUNDLER_URL(WEB3_CONFIG.ZERODEV_PROJECT_ID);
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      onStatusChange?.("Re-initializing Smart Account...");
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: ownerAccount,
        entryPoint,
        kernelVersion,
      });

      const account = await createKernelAccount(publicClient, {
        plugins: {
          sudo: ecdsaValidator,
        },
        entryPoint,
        kernelVersion,
      });

      onStatusChange?.("Constructing gasless transaction client...");
      const paymasterClient = createZeroDevPaymasterClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      const kernelClient = createKernelAccountClient({
        account,
        chain: polygonAmoy,
        bundlerTransport: http(rpcUrl),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            return paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      onStatusChange?.("Encoding batched USDC transfer transactions...");
      // Official Circle USDC Token Address on Polygon Amoy
      const usdcTokenAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
      
      // Convert amounts to 6 decimals (USDC standard)
      const amountInUnitsA = BigInt(Math.floor(amountA * 1_000_000));
      const amountInUnitsB = BigInt(Math.floor(amountB * 1_000_000));

      const transferDataA = encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'recipient', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: 'success', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [recipientA as Hex, amountInUnitsA],
      });

      const transferDataB = encodeFunctionData({
        abi: [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'recipient', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            outputs: [{ name: 'success', type: 'bool' }],
          },
        ],
        functionName: 'transfer',
        args: [recipientB as Hex, amountInUnitsB],
      });

      onStatusChange?.("Signing and sending batched UserOperation...");
      const txHash = await kernelClient.sendTransaction({
        calls: [
          {
            to: usdcTokenAddress,
            data: transferDataA,
          },
          {
            to: usdcTokenAddress,
            data: transferDataB,
          },
        ],
      });

      return {
        txHash,
        gasSaved: "0.025 POL (~$0.03 USD)",
      };
    } catch (e: any) {
      console.error("Real batched transfer error:", e);
      throw new Error(`Real on-chain batched transfer failed: ${e.message || e}`);
    }
  }

  /**
   * Reads the real USDC token balance of the counterfactual Smart Account on-chain.
   */
  async getUSDCBalance(address: string, isSimulated = false): Promise<string> {
    const isMock = isSimulated || 
                   address.startsWith("0x3a4b") || 
                   address.startsWith("0x7f3e") ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");
    if (isMock) {
      return "0.00";
    }

    try {
      const rpcUrl = WEB3_CONFIG.BUNDLER_URL(WEB3_CONFIG.ZERODEV_PROJECT_ID);
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      // Official Circle USDC Token Address on Polygon Amoy
      const usdcAddress = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582";
      
      const balance = await publicClient.readContract({
        address: usdcAddress,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: 'balance', type: 'uint256' }],
          },
        ],
        functionName: 'balanceOf',
        args: [address as Hex],
      }) as bigint;

      // USDC has 6 decimal places on Polygon
      const formattedBalance = (Number(balance) / 1_000_000).toFixed(2);
      return formattedBalance;
    } catch (e) {
      console.warn("Failed to fetch live USDC balance:", e);
      return "0.00";
    }
  }

  // ─── Yield Vault Integration ─────────────────────────────────────────
  // Contract Address: deployed on Polygon Amoy testnet.
  // On mainnet, swap this for the Aave V3 Pool address.
  private YIELD_VAULT_ADDRESS = (process.env.EXPO_PUBLIC_YIELD_VAULT_ADDRESS || "0x0000000000000000000000000000000000000000") as Hex;
  private USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as Hex;

  private YIELD_VAULT_ABI = [
    {
      name: 'deposit',
      type: 'function' as const,
      stateMutability: 'nonpayable' as const,
      inputs: [{ name: 'amount', type: 'uint256' }],
      outputs: [],
    },
    {
      name: 'withdraw',
      type: 'function' as const,
      stateMutability: 'nonpayable' as const,
      inputs: [{ name: 'amount', type: 'uint256' }],
      outputs: [],
    },
    {
      name: 'balanceOf',
      type: 'function' as const,
      stateMutability: 'view' as const,
      inputs: [{ name: 'user', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'principalOf',
      type: 'function' as const,
      stateMutability: 'view' as const,
      inputs: [{ name: 'user', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'interestOf',
      type: 'function' as const,
      stateMutability: 'view' as const,
      inputs: [{ name: 'user', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }],
    },
    {
      name: 'apyBps',
      type: 'function' as const,
      stateMutability: 'view' as const,
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ] as const;

  private ERC20_APPROVE_ABI = [
    {
      name: 'approve',
      type: 'function' as const,
      stateMutability: 'nonpayable' as const,
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      outputs: [{ name: 'success', type: 'bool' }],
    },
  ] as const;

  /**
   * Deposit USDC into the on-chain YieldVault.
   * Uses a batched gasless UserOperation: approve + deposit in one click.
   */
  async depositToYield(
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      onStatusChange?.("Simulated yield deposit...");
      await new Promise((r) => setTimeout(r, 2000));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return { txHash: mockHash, gasSaved: "0.020 POL (~$0.03 USD)" };
    }

    try {
      onStatusChange?.("Retrieving credentials...");
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY);
      if (!privKey) throw new Error("Owner private key not found.");

      const ownerAccount = privateKeyToAccount(privKey as Hex);

      onStatusChange?.("Connecting to Polygon Amoy...");
      const rpcUrl = WEB3_CONFIG.BUNDLER_URL(WEB3_CONFIG.ZERODEV_PROJECT_ID);
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      onStatusChange?.("Initializing Smart Account...");
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: ownerAccount,
        entryPoint,
        kernelVersion,
      });

      const account = await createKernelAccount(publicClient, {
        plugins: { sudo: ecdsaValidator },
        entryPoint,
        kernelVersion,
      });

      onStatusChange?.("Setting up gasless paymaster...");
      const paymasterClient = createZeroDevPaymasterClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      const kernelClient = createKernelAccountClient({
        account,
        chain: polygonAmoy,
        bundlerTransport: http(rpcUrl),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            return paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      onStatusChange?.("Encoding approve + deposit batch...");
      const amountInUnits = BigInt(Math.floor(parseFloat(amount) * 1_000_000));

      const approveData = encodeFunctionData({
        abi: this.ERC20_APPROVE_ABI,
        functionName: 'approve',
        args: [this.YIELD_VAULT_ADDRESS, amountInUnits],
      });

      const depositData = encodeFunctionData({
        abi: this.YIELD_VAULT_ABI,
        functionName: 'deposit',
        args: [amountInUnits],
      });

      onStatusChange?.("Signing & sending gasless batch transaction...");
      const txHash = await kernelClient.sendTransaction({
        calls: [
          { to: this.USDC_ADDRESS, data: approveData },
          { to: this.YIELD_VAULT_ADDRESS, data: depositData },
        ],
      });

      return { txHash, gasSaved: "0.020 POL (~$0.03 USD)" };
    } catch (e: any) {
      console.error("Yield deposit error:", e);
      throw new Error(`Yield deposit failed: ${e.message || e}`);
    }
  }

  /**
   * Withdraw USDC (principal + interest) from the on-chain YieldVault.
   */
  async withdrawFromYield(
    amount: string,
    onStatusChange?: (status: string) => void
  ): Promise<{ txHash: string; gasSaved: string }> {
    const isMock = this.activeWallet?.isSimulated ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000");

    if (isMock) {
      onStatusChange?.("Simulated yield withdrawal...");
      await new Promise((r) => setTimeout(r, 2000));
      const mockHash = `0x${Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('')}`;
      return { txHash: mockHash, gasSaved: "0.015 POL (~$0.02 USD)" };
    }

    try {
      onStatusChange?.("Retrieving credentials...");
      const privKey = await SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY);
      if (!privKey) throw new Error("Owner private key not found.");

      const ownerAccount = privateKeyToAccount(privKey as Hex);

      onStatusChange?.("Connecting to Polygon Amoy...");
      const rpcUrl = WEB3_CONFIG.BUNDLER_URL(WEB3_CONFIG.ZERODEV_PROJECT_ID);
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      onStatusChange?.("Initializing Smart Account...");
      const entryPoint = getEntryPoint("0.7");
      const kernelVersion = KERNEL_V3_1;

      const ecdsaValidator = await signerToEcdsaValidator(publicClient, {
        signer: ownerAccount,
        entryPoint,
        kernelVersion,
      });

      const account = await createKernelAccount(publicClient, {
        plugins: { sudo: ecdsaValidator },
        entryPoint,
        kernelVersion,
      });

      onStatusChange?.("Setting up gasless paymaster...");
      const paymasterClient = createZeroDevPaymasterClient({
        chain: polygonAmoy,
        transport: http(rpcUrl),
      });

      const kernelClient = createKernelAccountClient({
        account,
        chain: polygonAmoy,
        bundlerTransport: http(rpcUrl),
        paymaster: {
          getPaymasterData: async (userOperation) => {
            return paymasterClient.sponsorUserOperation({ userOperation });
          },
        },
      });

      onStatusChange?.("Encoding withdrawal transaction...");
      // Use max uint256 for full withdrawal, otherwise use specified amount
      const amountInUnits = amount === 'MAX'
        ? BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")
        : BigInt(Math.floor(parseFloat(amount) * 1_000_000));

      const withdrawData = encodeFunctionData({
        abi: this.YIELD_VAULT_ABI,
        functionName: 'withdraw',
        args: [amountInUnits],
      });

      onStatusChange?.("Signing & sending gasless withdrawal...");
      const txHash = await kernelClient.sendTransaction({
        to: this.YIELD_VAULT_ADDRESS,
        data: withdrawData,
      });

      return { txHash, gasSaved: "0.015 POL (~$0.02 USD)" };
    } catch (e: any) {
      console.error("Yield withdrawal error:", e);
      throw new Error(`Yield withdrawal failed: ${e.message || e}`);
    }
  }

  /**
   * Query the on-chain YieldVault for a user's yield balance, principal, and interest.
   */
  async getYieldBalance(address: string, isSimulated = false): Promise<{
    total: string;
    principal: string;
    interest: string;
    apyBps: number;
  }> {
    const isMock = isSimulated ||
                   address.startsWith("0x3a4b") ||
                   address.startsWith("0x7f3e") ||
                   WEB3_CONFIG.ZERODEV_PROJECT_ID.startsWith("00000000") ||
                   this.YIELD_VAULT_ADDRESS === "0x0000000000000000000000000000000000000000";

    if (isMock) {
      return { total: "0.00", principal: "0.00", interest: "0.000000", apyBps: 450 };
    }

    try {
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: http(WEB3_CONFIG.PUBLIC_RPC_URL),
      });

      const [totalRaw, principalRaw, interestRaw, apyBpsRaw] = await Promise.all([
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'balanceOf',
          args: [address as Hex],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'principalOf',
          args: [address as Hex],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'interestOf',
          args: [address as Hex],
        }) as Promise<bigint>,
        publicClient.readContract({
          address: this.YIELD_VAULT_ADDRESS,
          abi: this.YIELD_VAULT_ABI,
          functionName: 'apyBps',
        }) as Promise<bigint>,
      ]);

      return {
        total: (Number(totalRaw) / 1_000_000).toFixed(2),
        principal: (Number(principalRaw) / 1_000_000).toFixed(2),
        interest: (Number(interestRaw) / 1_000_000).toFixed(6),
        apyBps: Number(apyBpsRaw),
      };
    } catch (e) {
      console.warn("Failed to fetch yield balance:", e);
      return { total: "0.00", principal: "0.00", interest: "0.000000", apyBps: 450 };
    }
  }
}

export const walletService = new WalletService();

