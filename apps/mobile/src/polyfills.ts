import '@web3auth/react-native-sdk/setup';
import 'react-native-get-random-values';
import 'fast-text-encoding';
import { Buffer } from 'buffer';

// Force document to be undefined so that third-party Web3 libraries use their safe Node/non-browser fallback paths
try {
  Object.defineProperty(global, 'document', {
    value: undefined,
    writable: true,
    configurable: true,
  });
} catch (e) {}

// Set up window.location and location mocks for Web3Auth
if (typeof (global as any).window === 'undefined') {
  (global as any).window = {};
}
if (typeof (global as any).window.location === 'undefined') {
  (global as any).window.location = {
    origin: 'http://localhost',
    href: 'http://localhost',
  };
}
if (typeof (global as any).location === 'undefined') {
  (global as any).location = (global as any).window.location;
}

// Set up global Buffer
if (typeof (global as any).Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

// Ensure process exists (some libraries look for it)
if (typeof (global as any).process === 'undefined') {
  (global as any).process = {};
}
if (typeof (global as any).process.version === 'undefined') {
  (global as any).process.version = '';
}
if (typeof (global as any).process.nextTick === 'undefined') {
  (global as any).process.nextTick = (callback: Function, ...args: any[]) => {
    setTimeout(() => callback(...args), 0);
  };
}
if (typeof (global as any).process.browser === 'undefined') {
  (global as any).process.browser = true;
}

// Define global Node module environment paths for browser-based dependency wrappers
if (typeof (global as any).__filename === 'undefined') {
  (global as any).__filename = '';
}
if (typeof (global as any).__dirname === 'undefined') {
  (global as any).__dirname = '';
}

// Polyfill pathToFileURL on the 'url' package
const urlModule = require('url');
if (typeof urlModule.pathToFileURL === 'undefined') {
  urlModule.pathToFileURL = (filepath: string) => {
    const resolved = filepath.replace(/\\/g, '/');
    const absolute = resolved.startsWith('/') ? resolved : '/' + resolved;
    return {
      href: 'file://' + absolute,
    };
  };
}

// Bypass React Native DevTools Network Inspector for Web3 requests (prevents "Could not load bundle" error on design-reverted HTTP 500 calls)
if (typeof (global as any).originalXMLHttpRequest !== 'undefined') {
  global.XMLHttpRequest = (global as any).originalXMLHttpRequest;
}
if (typeof (global as any).originalFetch !== 'undefined') {
  global.fetch = (global as any).originalFetch;
}
