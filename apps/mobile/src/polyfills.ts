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

// Set up window.location and location mocks for Web3Auth and Expo bundle loader
if (typeof (global as any).window === 'undefined') {
  (global as any).window = {};
}

const locationMock = {
  origin: 'http://localhost',
  href: 'http://localhost',
};

try {
  Object.defineProperty(global, 'location', {
    value: locationMock,
    writable: true,
    configurable: true,
  });
} catch (e) {
  try {
    (global as any).location = locationMock;
  } catch (err) {}
}

try {
  if (!(global as any).location) {
    (global as any).location = locationMock;
  } else {
    (global as any).location.origin = 'http://localhost';
    (global as any).location.href = 'http://localhost';
  }
} catch (e) {}

try {
  if (typeof (global as any).window !== 'undefined') {
    Object.defineProperty((global as any).window, 'location', {
      value: locationMock,
      writable: true,
      configurable: true,
    });
  }
} catch (e) {}

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

urlModule.pathToFileURL = (filepath: string) => {
  if (typeof filepath !== 'string') {
    return {
      href: '',
    };
  }
  const resolved = filepath.replace(/\\/g, '/');
  const absolute = resolved.startsWith('/') ? resolved : '/' + resolved;
  return {
    href: 'file://' + absolute,
  };
};

// Bypass React Native DevTools Network Inspector for Web3 requests (prevents "Could not load bundle" error on design-reverted HTTP 500 calls)
if (typeof (global as any).originalXMLHttpRequest !== 'undefined') {
  global.XMLHttpRequest = (global as any).originalXMLHttpRequest;
}
if (typeof (global as any).originalFetch !== 'undefined') {
  global.fetch = (global as any).originalFetch;
}

// Polyfill Linking.removeEventListener for React Native 0.65+ / 0.80+ compatibility with Web3Auth
import { Linking, NativeModules, TurboModuleRegistry } from 'react-native';
try {
  if (typeof (Linking as any).removeEventListener === 'undefined') {
    Object.defineProperty(Linking, 'removeEventListener', {
      value: (type: string, handler: any) => {
        // Silent bypass
      },
      writable: true,
      configurable: true,
    });
  }
} catch (e) {
  console.warn("Failed to polyfill Linking.removeEventListener:", e);
}

// Polyfill NativeSourceCode and TurboModuleRegistry to prevent Expo's async-require from crashing when getDevServer().url returns undefined in Bridgeless mode.
try {
  const SourceCode = NativeModules.SourceCode || {};
  if (!SourceCode.scriptURL) {
    SourceCode.scriptURL = 'http://10.0.2.2:8081/index.bundle?platform=android&dev=true';
  }
  Object.defineProperty(NativeModules, 'SourceCode', {
    value: SourceCode,
    writable: true,
    configurable: true,
  });
} catch (e) {
  // Silent fallback
}

try {
  if (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function') {
    const originalGet = TurboModuleRegistry.get;
    (TurboModuleRegistry as any).get = (name: string): any => {
      if (name === 'SourceCode') {
        return {
          getConstants: () => ({
            scriptURL: 'http://10.0.2.2:8081/index.bundle?platform=android&dev=true',
          }),
        };
      }
      return originalGet(name);
    };
  }
} catch (e) {
  console.warn('[Polyfill] Failed to patch TurboModuleRegistry:', e);
}
