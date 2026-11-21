"""The .env file must load exactly as written in .env.example."""

import os
import shutil
import subprocess
import sys


def test_env_example_loads(tmp_path):
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    shutil.copy(os.path.join(root, ".env.example"), tmp_path / ".env")
    env = {k: v for k, v in os.environ.items() if k not in ("STORAGE_DIR", "DATABASE_URL", "EMAIL_PROVIDER", "JWT_SECRET")}
    env["PYTHONPATH"] = root
    code = "from app.config import settings; print(settings.dashboard_origins)"
    out = subprocess.run([sys.executable, "-c", code], cwd=tmp_path, env=env, capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    assert "http://localhost:3000" in out.stdout
