import ivm from 'isolated-vm';

interface TestResult {
  passed: boolean;
  input: string;
  expected: number;
  actual: any;
  error?: string;
}

interface GradeResult {
  success: boolean;
  message: string;
  details?: TestResult[];
}

const TEST_CASES = [
  { arr: [1, 2, 3, 4, 5], target: 5, expected: 4 },
  { arr: [1, 2, 3, 4, 5], target: 1, expected: 0 },
  { arr: [1, 2, 3, 4, 5, 6, 7], target: 7, expected: 6 },
  { arr: [1, 2, 3, 4, 5, 6, 7], target: 9, expected: -1 },
  { arr: [], target: 5, expected: -1 }
];

export async function validateBinarySearch(userCode: string): Promise<GradeResult> {
  const isolate = new ivm.Isolate({ memoryLimit: 16 });
  
  try {
    const context = await isolate.createContext();
    
    // Removed the recursive global reference setter that caused the dereference exception

    // Secure execution wrapper harness template string safely configured
    const harnessScript = 
      "function runUserCode(arr, target) {\n" +
      "  try {\n" +
      "    const searchFn = new Function('arr', 'target', " + JSON.stringify(userCode) + ");\n" +
      "    return searchFn(arr, target);\n" +
      "  } catch(e) {\n" +
      "    return 'ERROR: ' + e.message;\n" +
      "  }\n" +
      "}";

    const scriptInstance = await isolate.compileScript(harnessScript);
    await scriptInstance.run(context);

    const details: TestResult[] = [];
    let allPassed = true;

    for (const test of TEST_CASES) {
      const executionLine = "runUserCode(" + JSON.stringify(test.arr) + ", " + test.target + ");";
      
      const resultPromise = context.eval(executionLine, { timeout: 1500 });
      const actual = await resultPromise;

      if (typeof actual === 'string' && actual.startsWith('ERROR:')) {
        allPassed = false;
        details.push({
          passed: false,
          input: "arr: [" + test.arr.join(', ') + "], target: " + test.target,
          expected: test.expected,
          actual: null,
          error: actual
        });
      } else if (Number(actual) !== test.expected) {
        allPassed = false;
        details.push({
          passed: false,
          input: "arr: [" + test.arr.join(', ') + "], target: " + test.target,
          expected: test.expected,
          actual: actual
        });
      } else {
        details.push({
          passed: true,
          input: "arr: [" + test.arr.join(', ') + "], target: " + test.target,
          expected: test.expected,
          actual: actual
        });
      }
    }

    if (allPassed) {
      return { success: true, message: 'All test conditions satisfied.', details };
    } else {
      return { success: false, message: 'Algorithmic logic failure or compilation exception.', details };
    }

  } catch (err: any) {
    return { 
      success: false, 
      message: err.message === 'Script execution timed out.' 
        ? 'Security Termination: Infinite loop timeout reached.' 
        : "Compilation Exception: " + err.message
    };
  } finally {
    isolate.dispose();
  }
}
