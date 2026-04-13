from handlers.base_handler import LanguageHandler, TestCase
from typing import List


class CppHandler(LanguageHandler):
    """Handler for C++ code execution."""

    def get_extension(self) -> str:
        return "cpp"

    def generate_full_code(self, user_code: str, test_cases: List[TestCase]) -> str:
        import re

        # Find function name in user code
        func_name = "twoSum" # default
        has_solution_class = "class Solution" in user_code
        # Regex to find a likely function definition: return_type func_name ( args )
        # We ignore 'class Solution' and constructors
        match = re.search(r'(?:vector<int>|int|void)\s+(\w+)\s*\(', user_code)
        if match and match.group(1) != "Solution":
            func_name = match.group(1)

        # Generate test logic
        test_logic = []
        for i, tc in enumerate(test_cases):
            nums_match = re.search(r'nums\s*=\s*\[(.*?)\]', tc.input)
            target_match = re.search(r'target\s*=\s*(-?\d+)', tc.input)
            l1_match = re.search(r'l1\s*=\s*\[(.*?)\]', tc.input)
            l2_match = re.search(r'l2\s*=\s*\[(.*?)\]', tc.input)
            
            if nums_match and target_match:
                 nums_val = nums_match.group(1)
                 target_val = target_match.group(1)
                 expected = tc.expected_output.replace('[', '{').replace(']', '}') # C++ vector format for printing verification?
                 # Actually expectation string "expected_val" for comparison.
                 # User expectation is `[0,1]`. C++ output `[0,1]`.
                 # We can just compare strings.
                 
                 test_logic.append(f"    try {{")
                 test_logic.append(f"        // Test Case {i+1}")
                 test_logic.append(f"        vector<int> nums{i} = {{{nums_val}}};")
                 test_logic.append(f"        int target{i} = {target_val};")
                 call_prefix = "sol." if has_solution_class else ""
                 test_logic.append(f"        vector<int> result{i} = {call_prefix}{func_name}(nums{i}, target{i});")
                 test_logic.append(f"        string actual{i} = vectorToString(result{i});")
                 test_logic.append(f"        string expected{i} = \"{tc.expected_output.replace(' ', '')}\";") # Use original string [0,1]
                 # Remove spaces for comparison?
                 test_logic.append(f"        bool passed{i} = actual{i} == expected{i};") # vectorToString might add spaces?
                 # vectorToString implementation:
                 # ss << "["; ... ss << v[i]; if i>0 ss << ","; ... ss << "]";
                 # So Output: [0,1] (no spaces).
                 # Expected: [0,1].
                 # Should match.
                 
                 test_logic.append(f"        cout << \"{{\\\"test_case_id\\\":\\\"{tc.id}\\\",\\\"passed\\\":\" << (passed{i} ? \"true\" : \"false\") << \",\\\"actual_output\\\":\\\"\" << actual{i} << \"\\\",\\\"runtime_ms\\\":0,\\\"is_hidden\\\":{'true' if tc.is_hidden else 'false'}}}\";")
                 test_logic.append(f"    }} catch (exception& e) {{")
                 test_logic.append(f"        cout << \"{{\\\"test_case_id\\\":\\\"{tc.id}\\\",\\\"passed\\\":false,\\\"error\\\":\\\"\" << e.what() << \"\\\",\\\"is_hidden\\\":{'true' if tc.is_hidden else 'false'}}}\";")
                 test_logic.append(f"    }}")
                 if i < len(test_cases) - 1:
                     test_logic.append(f"    cout << \",\";")
            elif l1_match and l2_match:
                 l1_val = l1_match.group(1)
                 l2_val = l2_match.group(1)
                 test_logic.append(f"    try {{")
                 test_logic.append(f"        // Test Case {i+1}")
                 test_logic.append(f"        vector<int> l1_{i} = {{{l1_val}}};")
                 test_logic.append(f"        vector<int> l2_{i} = {{{l2_val}}};")
                 call_prefix = "sol." if has_solution_class else ""
                 test_logic.append(f"        vector<int> result{i} = {call_prefix}{func_name}(l1_{i}, l2_{i});")
                 test_logic.append(f"        string actual{i} = vectorToString(result{i});")
                 test_logic.append(f"        string expected{i} = \"{tc.expected_output.replace(' ', '')}\";")
                 test_logic.append(f"        bool passed{i} = actual{i} == expected{i};")
                 test_logic.append(f"        cout << \"{{\\\"test_case_id\\\":\\\"{tc.id}\\\",\\\"passed\\\":\" << (passed{i} ? \"true\" : \"false\") << \",\\\"actual_output\\\":\\\"\" << actual{i} << \"\\\",\\\"runtime_ms\\\":0,\\\"is_hidden\\\":{'true' if tc.is_hidden else 'false'}}}\";")
                 test_logic.append(f"    }} catch (exception& e) {{")
                 test_logic.append(f"        cout << \"{{\\\"test_case_id\\\":\\\"{tc.id}\\\",\\\"passed\\\":false,\\\"error\\\":\\\"\" << e.what() << \"\\\",\\\"is_hidden\\\":{'true' if tc.is_hidden else 'false'}}}\";")
                 test_logic.append(f"    }}")
                 if i < len(test_cases) - 1:
                     test_logic.append(f"    cout << \",\";")

        generated_tests = "\n".join(test_logic)

        # Build main with or without Solution instance
        sol_decl = "Solution sol;" if has_solution_class else ""

        return f'''
#include <iostream>
#include <vector>
#include <unordered_map>
#include <string>
#include <sstream>

using namespace std;

// User's solution class
{user_code}

// Helper to print vector
template<typename T>
string vectorToString(const vector<T>& v) {{
    stringstream ss;
    ss << "[";
    for (size_t i = 0; i < v.size(); i++) {{
        if (i > 0) ss << ",";
        ss << v[i];
    }}
    ss << "]";
    return ss.str();
}}

int main() {{
    {sol_decl}
    
    cout << "<<<RESULTS>>>" << endl;
    cout << "[";
    
{generated_tests}
    
    cout << "]" << endl;
    cout << "<<<RESULTS>>>" << endl;
    
    return 0;
}}
'''

    def get_execution_command(self, filename: str) -> List[str]:
        """Return the command to compile and run C++ code."""
        return ["bash", "-c", "cd /app && g++ -o solution main.cpp && ./solution"]
