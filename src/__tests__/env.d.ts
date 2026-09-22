declare module 'assert' {
  interface Assert {
    (value: unknown, message?: string | Error): asserts value;
    equal(actual: unknown, expected: unknown, message?: string | Error): void;
    ok(value: unknown, message?: string | Error): void;
  }
  const assert: Assert;
  export const strict: Assert;
}
declare const process: { exit(code?: number): never; env: Record<string, string | undefined> };
declare const console: { log(...args: unknown[]): void };
declare function structuredClone<T>(value: T): T;
