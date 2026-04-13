from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel

class TestCase(BaseModel):
    id: str
    input: str
    expected_output: str
    is_hidden: bool = False

class LanguageHandler(ABC):
    @abstractmethod
    def generate_full_code(self, user_code: str, test_cases: List[TestCase]) -> str:
        """
        Wrap the user's solution code with a driver that executes the test cases
        and prints the results in a structured format (JSON).
        """
        pass

    @abstractmethod
    def get_execution_command(self, filename: str) -> List[str]:
        """
        Return the command to execute the file (e.g. ["python3", filename])
        """
        pass

    @abstractmethod
    def get_extension(self) -> str:
        """
        Return the file extension for this language (e.g. "py")
        """
        pass
