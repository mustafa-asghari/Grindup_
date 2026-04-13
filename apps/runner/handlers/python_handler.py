import json
from typing import List
from .base_handler import LanguageHandler, TestCase

DRIVER_TEMPLATE = """
import sys
import json
import inspect
import traceback

# User code
{user_code}

def run_tests():
    results = []
    
    # Identify the solution function
    # We assume 'solution' or 'Solution' class with 'solution' method
    func_to_call = None
    if 'solution' in globals():
        func_to_call = globals()['solution']
    elif 'Solution' in globals():
        sol_instance = globals()['Solution']()
        # Find the first public method that isn't __init__
        methods = [m for m in dir(sol_instance) if not m.startswith('_')]
        if len(methods) > 0:
            func_to_call = getattr(sol_instance, methods[0])
            
    if not func_to_call:
        print(json.dumps({{"error": "No solution function found"}}))
        return

    test_cases = json.loads('{test_cases_json}')
    
    for tc in test_cases:
        try:
            # Create a local scope for input execution
            input_scope = {{}}
            exec(tc['input'], {{}}, input_scope)
            
            # Inspect function signature to find which args to pass
            sig = inspect.signature(func_to_call)
            args = []
            for param_name in sig.parameters:
                if param_name in input_scope:
                    args.append(input_scope[param_name])
                else:
                    # Fallback or error?
                    pass
            
            # Run the function
            ret = func_to_call(*args)
            
            # Helper to normalize output for comparison (e.g. lists to sorted lists if order doesn't match)
            # For now, simplistic string conversion
            ret_str = json.dumps(ret).replace(" ", "")
            expected_normalized = tc['expected_output'].replace(" ", "")
            
            # Basic comparison logic
            # Note: This is fragile for complex types, but serves MVP
            passed = str(ret_str) == str(expected_normalized)
            
            results.append({{
                "test_case_id": tc['id'],
                "passed": passed,
                "actual_output": str(ret),
                "runtime_ms": 0, # Placeholder, handled by runner service timing
                "is_hidden": tc['is_hidden']
            }})
            
        except Exception as e:
            results.append({{
                "test_case_id": tc['id'],
                "passed": False,
                "actual_output": None,
                "error": traceback.format_exc(),
                "is_hidden": tc['is_hidden']
            }})

    print("<<<RESULTS>>>")
    print(json.dumps(results))
    print("<<<RESULTS>>>")

if __name__ == "__main__":
    run_tests()
"""

class PythonHandler(LanguageHandler):
    def generate_full_code(self, user_code: str, test_cases: List[TestCase]) -> str:
        # Convert Pydantic models to dicts for JSON serialization
        test_cases_dicts = [tc.model_dump() for tc in test_cases]
        
        # Escape single quotes because we wrap this in single quotes in the template
        json_str = json.dumps(test_cases_dicts).replace("'", "\\'")
        
        return DRIVER_TEMPLATE.format(
            user_code=user_code,
            test_cases_json=json_str
        )

    def get_execution_command(self, filename: str) -> List[str]:
        return ["python3", filename]

    def get_extension(self) -> str:
        return "py"
