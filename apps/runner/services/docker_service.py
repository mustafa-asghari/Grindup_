import docker
import os
import shutil
import tempfile
import time
from typing import List, Tuple, Optional

class DockerService:
    def __init__(self):
        self.client = docker.from_env()

    def _create_execution_temp_dir(self) -> Tuple[str, str]:
        """
        Return the runner-visible temp dir and the host-visible Docker bind path.
        """
        execution_workdir = os.environ.get("RUNNER_EXECUTION_WORKDIR")
        execution_host_dir = os.environ.get("RUNNER_EXECUTION_HOST_DIR")

        if not execution_workdir and not execution_host_dir:
            temp_dir = tempfile.mkdtemp(prefix="grindup_run_")
            return temp_dir, temp_dir

        temp_base_dir = execution_workdir or execution_host_dir
        os.makedirs(temp_base_dir, exist_ok=True)
        temp_dir = tempfile.mkdtemp(prefix="grindup_run_", dir=temp_base_dir)

        if execution_host_dir:
            relative_temp_dir = os.path.relpath(temp_dir, temp_base_dir)
            mount_source = os.path.join(execution_host_dir, relative_temp_dir)
        else:
            mount_source = temp_dir

        return temp_dir, mount_source

    def run_code(
        self,
        image: str,
        command: List[str],
        files: dict[str, str], # filename -> content
        time_limit_ms: int = 2000,
        memory_limit_mb: int = 256
    ) -> Tuple[str, str, int]: # stdout, stderr, execution_time_ms
        """
        Runs code in a temporary container.
        """
        # Create a temporary execution directory, optionally under a
        # runner/host shared workdir for compose-based sibling containers.
        temp_dir, mount_source = self._create_execution_temp_dir()
        
        try:
            # Write files to the temp directory
            for filename, content in files.items():
                file_path = os.path.join(temp_dir, filename)
                with open(file_path, "w") as f:
                    f.write(content)
            
            # Ensure permissions so container user can read/exec
            # This is a broad permission for development; refine for prod
            os.chmod(temp_dir, 0o777)
            for root, dirs, files_iter in os.walk(temp_dir):
                for d in dirs:
                    os.chmod(os.path.join(root, d), 0o777)
                for f in files_iter:
                    os.chmod(os.path.join(root, f), 0o777)

            start_time = time.time()
            
            container = None
            try:
                container = self.client.containers.run(
                    image=image,
                    command=command,
                    volumes={mount_source: {'bind': '/app', 'mode': 'rw'}},
                    working_dir='/app',
                    network_disabled=True,
                    mem_limit=f"{memory_limit_mb}m",
                    # cap_drop=['ALL'], # Strict capability dropping
                    user='coder', # Match Dockerfile
                    detach=True,
                    # pids_limit=50, # implementation depends on docker version
                )

                # Wait for result with timeout logic
                # Docker SDK wait() doesn't have a simple timeout for running, 
                # so we might need a manual loop or container.wait(timeout=...) constraint
                # container.wait() accepts timeout only in some versions/APIs.
                # Let's use a Python loop for granular control.
                
                elapsed = 0
                step = 0.1
                timeout_s = time_limit_ms / 1000.0
                
                while container.status in ['created', 'running', 'restarting']:
                    if elapsed > timeout_s:
                        container.kill()
                        return "", f"Time Limit Exceeded ({time_limit_ms}ms)", time_limit_ms
                    
                    time.sleep(step)
                    elapsed += step
                    container.reload()
                
                exec_time_ms = int((time.time() - start_time) * 1000)
                
                stdout = container.logs(stdout=True, stderr=False).decode('utf-8')
                stderr = container.logs(stdout=False, stderr=True).decode('utf-8')
                
                return stdout, stderr, exec_time_ms

            except docker.errors.ContainerError as e:
                return "", str(e), 0
            except Exception as e:
                # Attempt to kill if verify fails
                return "", f"System Error: {str(e)}", 0
            finally:
                if container is not None:
                    try:
                        container.remove(force=True)
                    except Exception:
                        pass

        finally:
            # Cleanup temp resources
            try:
                shutil.rmtree(temp_dir)
            except Exception:
                pass
