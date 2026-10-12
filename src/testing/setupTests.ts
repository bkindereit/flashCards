import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Web Worker if needed
class MockWorker {
  url: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  constructor(stringUrl: string | URL) {
    this.url = stringUrl.toString();
  }
  postMessage() {}
  terminate() {}
}

// Ensure global mocks
Object.defineProperty(window, 'Worker', {
  value: MockWorker,
  writable: true
});

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
