from handlers.base_handler import LanguageHandler, TestCase
from typing import List


class JavaHandler(LanguageHandler):
    """Handler for Java code execution."""

    def get_extension(self) -> str:
        return "java"

    def generate_full_code(self, user_code: str, test_cases: List[TestCase]) -> str:
        import re
        
        # Generate test logic dynamically
        test_logic = []
        for i, tc in enumerate(test_cases):
            # Support either nums/target or l1/l2 patterns (arrays)
            nums_match = re.search(r'nums\s*=\s*\[(.*?)\]', tc.input)
            target_match = re.search(r'target\s*=\s*(-?\d+)', tc.input)
            l1_match = re.search(r'l1\s*=\s*\[(.*?)\]', tc.input)
            l2_match = re.search(r'l2\s*=\s*\[(.*?)\]', tc.input)
            
            if nums_match and target_match:
                nums_val = nums_match.group(1) # e.g. "2,7,11,15"
                target_val = target_match.group(1) # e.g. "9"
                expected = tc.expected_output.replace('[', '').replace(']', '')
                
                test_logic.append(f"            // Test Case {i+1}")
                test_logic.append(f"            int[] nums{i} = {{{nums_val}}};")
                test_logic.append(f"            int target{i} = {target_val};")
                test_logic.append(f"            Object res{i} = method.invoke(sol, nums{i}, target{i});")
                test_logic.append(f"            ")
                test_logic.append(f"            Map<String, Object> r{i} = new HashMap<>();")
                test_logic.append(f"            r{i}.put(\"test_case_id\", \"{tc.id}\");")
                test_logic.append(f"            String actual{i} = Arrays.toString((int[])res{i});")
                test_logic.append(f"            String expected{i} = \"[{expected}]\";")
                test_logic.append(f"            boolean passed{i} = actual{i}.replace(\" \", \"\").equals(expected{i}.replace(\" \", \"\"));")
                test_logic.append(f"            r{i}.put(\"passed\", passed{i});")
                test_logic.append(f"            r{i}.put(\"actual_output\", actual{i});")
                test_logic.append(f"            r{i}.put(\"runtime_ms\", 0);")
                test_logic.append(f"            r{i}.put(\"is_hidden\", {'true' if tc.is_hidden else 'false'});")
                test_logic.append(f"            results.add(r{i});")
            elif l1_match and l2_match:
                l1_val = l1_match.group(1)
                l2_val = l2_match.group(1)
                expected = tc.expected_output.replace(' ', '')

                test_logic.append(f"            // Test Case {i+1}")
                test_logic.append(f"            int[] l1_{i} = {{{l1_val}}};")
                test_logic.append(f"            int[] l2_{i} = {{{l2_val}}};")
                test_logic.append(f"            Object res{i} = method.invoke(sol, l1_{i}, l2_{i});")
                test_logic.append(f"            ")
                test_logic.append(f"            Map<String, Object> r{i} = new HashMap<>();")
                test_logic.append(f"            r{i}.put(\"test_case_id\", \"{tc.id}\");")
                test_logic.append(f"            String actual{i} = Arrays.toString((int[])res{i});")
                test_logic.append(f"            String expected{i} = \"{expected}\";")
                test_logic.append(f"            boolean passed{i} = actual{i}.replace(\" \", \"\").equals(expected{i});")
                test_logic.append(f"            r{i}.put(\"passed\", passed{i});")
                test_logic.append(f"            r{i}.put(\"actual_output\", actual{i});")
                test_logic.append(f"            r{i}.put(\"runtime_ms\", 0);")
                test_logic.append(f"            r{i}.put(\"is_hidden\", {'true' if tc.is_hidden else 'false'});")
                test_logic.append(f"            results.add(r{i});")

        generated_tests = "\n".join(test_logic)

        return f'''
import java.util.*;
import java.util.regex.*;
import java.lang.reflect.*;

// User's solution class
{user_code}

public class Main {{
    public static void main(String[] args) {{
        Solution sol = new Solution();
        List<Map<String, Object>> results = new ArrayList<>();
        
        try {{
            // Reflect to find method
            Method method = null;
            for (Method m : Solution.class.getDeclaredMethods()) {{
                if (Modifier.isPublic(m.getModifiers())) {{ method = m; break; }}
            }}
            
            if (method == null) throw new RuntimeException("No public method found in Solution class");
            
{generated_tests}

        }} catch (Exception e) {{
            Map<String, Object> r1 = new HashMap<>();
            r1.put("test_case_id", "error");
            r1.put("passed", false);
            r1.put("error", e.toString());
            r1.put("is_hidden", false);
            results.add(r1);
        }}
        
        // Output results as JSON
        StringBuilder json = new StringBuilder("[");
        for (int i = 0; i < results.size(); i++) {{
            Map<String, Object> r = results.get(i);
            json.append("{{");
            json.append("\\"test_case_id\\":\\"").append(r.getOrDefault("test_case_id", "")).append("\\",");
            json.append("\\"passed\\":").append(r.get("passed")).append(",");
            if (r.containsKey("actual_output")) {{
                json.append("\\"actual_output\\":\\"").append(r.get("actual_output")).append("\\",");
            }}
            if (r.containsKey("error")) {{
                // Escape backslashes and quotes for JSON string context
                String err = r.get("error").toString()
                    .replace("\\\\", "\\\\\\\\")
                    .replace("\\\"", "\\\\\\\"");
                json.append("\\"error\\":\\"").append(err).append("\\",");
            }}
            json.append("\\"runtime_ms\\":0,");
            json.append("\\"is_hidden\\":").append(r.getOrDefault("is_hidden", false));
            json.append("}}");
            if (i < results.size() - 1) json.append(",");
        }}
        json.append("]");
        
        System.out.println("<<<RESULTS>>>");
        System.out.println(json.toString());
        System.out.println("<<<RESULTS>>>");
    }}
}}
'''

    def get_execution_command(self, filename: str) -> List[str]:
        """Return the command to compile and run Java code."""
        return ["bash", "-c", "cd /app && javac Main.java && java Main"]
