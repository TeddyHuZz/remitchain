import 'react-native-get-random-values';
import 'fast-text-encoding';
import { Buffer } from 'buffer';

// Set up global Buffer
if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

// Ensure process.version exists (some libraries look for it)
if (typeof process === 'undefined') {
  (global as any).process = {};
}
if (typeof process.version === 'undefined') {
  (global as any).process.version = '';
}
if (typeof process.nextTick === 'undefined') {
  (global as any).process.nextTick = (callback: Function, ...args: any[]) => {
    setTimeout(() => callback(...args), 0);
  };
}
