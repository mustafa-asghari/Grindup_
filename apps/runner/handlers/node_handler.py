import json
from typing import List
from .base_handler import LanguageHandler, TestCase

# Use placeholder tokens to avoid str.format collisions with JS braces.
DRIVER_TEMPLATE = """
const { performance } = require('perf_hooks');

// User code wrapper
try {
    __USER_CODE__
} catch (e) {
    console.error("Syntax Error or Load Error:", e);
    process.exit(1);
}

async function runTests() {
    const results = [];
    const testCases = __TEST_CASES__;

    // Auto-detect function
    let funcToCall = null;
    if (typeof solution === 'function') funcToCall = solution;
    if (!funcToCall && typeof global.solution === 'function') funcToCall = global.solution;

    if (!funcToCall) {
        console.log(JSON.stringify({ error: "No solution function found. Please name your function 'solution'." }));
        return;
    }

    for (const tc of testCases) {
        try {
            const inputs = {};
            const parts = tc.input.split(';');
            for (const part of parts) {
                if (!part.trim()) continue;
                const [key, valStr] = part.split('=');
                if (key && valStr) {
                    const varName = key.trim();
                    let jsValStr = valStr.trim()
                        .replace(/True/g, 'true')
                        .replace(/False/g, 'false')
                        .replace(/None/g, 'null');
                    inputs[varName] = JSON.parse(jsValStr);
                }
            }

            const fnStr = funcToCall.toString();
            const argsMatch = fnStr.match(/\(([^)]*)\)/);
            const argNames = argsMatch ? argsMatch[1].split(',').map(s => s.trim()) : [];
            const args = argNames.map(name => inputs[name]);

            const start = performance.now();
            const result = funcToCall(...args);
            const end = performance.now();

            const actualOutput = JSON.stringify(result);
            let expectedStr = tc.expected_output
                .replace(/True/g, 'true')
                .replace(/False/g, 'false')
                .replace(/None/g, 'null');
            const expected = JSON.stringify(JSON.parse(expectedStr));

            results.push({
                test_case_id: tc.id,
                passed: actualOutput === expected,
                actual_output: actualOutput,
                runtime_ms: Math.round(end - start),
                is_hidden: tc.is_hidden
            });
        } catch (e) {
            results.push({
                test_case_id: tc.id,
                passed: false,
                actual_output: null,
                error: e.toString(),
                is_hidden: tc.is_hidden
            });
        }
    }

    console.log("<<<RESULTS>>>");
    console.log(JSON.stringify(results));
    console.log("<<<RESULTS>>>");
}

runTests();
"""

class NodeHandler(LanguageHandler):
    def generate_full_code(self, user_code: str, test_cases: List[TestCase]) -> str:
        tc_dicts = [tc.model_dump() for tc in test_cases]
        return (
            DRIVER_TEMPLATE
            .replace("__USER_CODE__", user_code)
            .replace("__TEST_CASES__", json.dumps(tc_dicts))
        )

    def get_execution_command(self, filename: str) -> List[str]:
        return ["node", filename]

    def get_extension(self) -> str:
        return "js"
