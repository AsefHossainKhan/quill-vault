#!/usr/bin/env python3
"""
QuillVault Backend — Service Management Script

Usage:
    python manage.py start      Start API server + Celery worker (with health checks)
    python manage.py stop       Gracefully stop all services
    python manage.py restart    Stop then start all services
    python manage.py status     Show status of all services
    python manage.py check      Run health checks only (Redis, PostgreSQL, API)
"""

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

# ─── Configuration ──────────────────────────────────────────────────────
BACKEND_DIR = Path(__file__).parent
PID_DIR = BACKEND_DIR / ".pids"
LOG_DIR = BACKEND_DIR / "logs"
API_HOST = "0.0.0.0"
API_PORT = 8000
CELERY_CONCURRENCY = 1  # Heavy ML tasks — one at a time
CELERY_POOL = "solo"     # Required on Windows (no fork support)


# ─── Colors ─────────────────────────────────────────────────────────────
class C:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    CYAN = "\033[96m"
    BOLD = "\033[1m"
    DIM = "\033[2m"
    RESET = "\033[0m"


def _log(color: str, icon: str, msg: str):
    print(f"{color}{icon} {msg}{C.RESET}")


def _ok(msg: str):    _log(C.GREEN, "✅", msg)
def _fail(msg: str):  _log(C.RED, "❌", msg)
def _warn(msg: str):  _log(C.YELLOW, "⚠️ ", msg)
def _info(msg: str):  _log(C.CYAN, "ℹ️ ", msg)
def _header(msg: str): print(f"\n{C.BOLD}{C.CYAN}{'─' * 50}\n  {msg}\n{'─' * 50}{C.RESET}")


# ─── PID Management ─────────────────────────────────────────────────────
def _ensure_dirs():
    PID_DIR.mkdir(exist_ok=True)
    LOG_DIR.mkdir(exist_ok=True)


def _pid_file(name: str) -> Path:
    return PID_DIR / f"{name}.pid"


def _save_pid(name: str, pid: int):
    _pid_file(name).write_text(str(pid))


def _read_pid(name: str) -> int | None:
    pf = _pid_file(name)
    if not pf.exists():
        return None
    try:
        return int(pf.read_text().strip())
    except (ValueError, OSError):
        return None


def _remove_pid(name: str):
    pf = _pid_file(name)
    if pf.exists():
        pf.unlink()


def _is_running(pid: int) -> bool:
    """Check if a process with given PID is running."""
    if sys.platform == "win32":
        try:
            result = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
                capture_output=True, text=True, timeout=5,
            )
            return str(pid) in result.stdout
        except Exception:
            return False
    else:
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False


# ─── Health Checks ──────────────────────────────────────────────────────
def _check_redis() -> bool:
    """Check if Redis is accessible."""
    try:
        import redis
        r = redis.Redis(host="localhost", port=6379, db=0, socket_connect_timeout=3)
        return r.ping()
    except Exception:
        return False


def _check_postgres() -> bool:
    """Check if PostgreSQL is accessible and the database exists."""
    try:
        import asyncio
        from sqlalchemy.ext.asyncio import create_async_engine

        async def _test():
            from src.config import get_settings
            settings = get_settings()
            engine = create_async_engine(settings.DATABASE_URL, pool_size=1)
            async with engine.connect() as conn:
                from sqlalchemy import text
                result = await conn.execute(text("SELECT 1"))
                return result.scalar() == 1

        return asyncio.run(_test())
    except Exception:
        return False


def _check_api() -> bool:
    """Check if the API server is responding."""
    try:
        import urllib.request
        req = urllib.request.Request(f"http://127.0.0.1:{API_PORT}/health")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False


def _check_celery() -> bool:
    """Check if a Celery worker is connected to the broker."""
    try:
        import redis as redis_lib
        r = redis_lib.Redis(host="localhost", port=6379, db=0, socket_connect_timeout=3)
        # Check for active workers in Redis
        keys = r.keys("celery*")
        return len(keys) > 0
    except Exception:
        return False


# ─── Service Lifecycle ──────────────────────────────────────────────────
def _start_api() -> bool:
    """Start the FastAPI server."""
    _ensure_dirs()
    existing = _read_pid("api")
    if existing and _is_running(existing):
        _warn(f"API server already running (PID {existing})")
        return True

    _info("Starting FastAPI server...")
    log_file = open(LOG_DIR / "api.log", "w")
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "uvicorn", "src.main:app",
            "--host", API_HOST, "--port", str(API_PORT), "--reload",
        ],
        cwd=str(BACKEND_DIR),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    _save_pid("api", proc.pid)

    # Wait for API to be ready
    for i in range(30):
        time.sleep(1)
        if _check_api():
            _ok(f"API server running on http://localhost:{API_PORT} (PID {proc.pid})")
            return True
        if proc.poll() is not None:
            _fail("API server failed to start. Check logs/api.log")
            return False

    _fail("API server did not become ready within 30 seconds")
    return False


def _start_celery() -> bool:
    """Start the Celery worker."""
    _ensure_dirs()
    existing = _read_pid("celery")
    if existing and _is_running(existing):
        _warn(f"Celery worker already running (PID {existing})")
        return True

    _info("Starting Celery worker...")
    log_file = open(LOG_DIR / "celery.log", "w")
    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(
        [
            sys.executable, "-m", "celery",
            "-A", "src.celery_app", "worker",
            "--loglevel=info",
            "-E",  # Send task events for progress visibility
            f"--concurrency={CELERY_CONCURRENCY}",
            "-P", CELERY_POOL,
        ],
        cwd=str(BACKEND_DIR),
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=env,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
    )
    _save_pid("celery", proc.pid)

    # Wait a bit for worker to connect
    time.sleep(3)
    if proc.poll() is not None:
        _fail("Celery worker failed to start. Check logs/celery.log")
        return False

    _ok(f"Celery worker started (PID {proc.pid})")
    return True


def _stop_service(name: str) -> bool:
    """Stop a service by PID."""
    pid = _read_pid(name)
    if not pid:
        _info(f"{name}: not running (no PID file)")
        return True

    if not _is_running(pid):
        _info(f"{name}: not running (stale PID {pid})")
        _remove_pid(name)
        return True

    _info(f"Stopping {name} (PID {pid})...")
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)],
                           capture_output=True, timeout=10)
        else:
            os.kill(pid, signal.SIGTERM)
            time.sleep(2)
            if _is_running(pid):
                os.kill(pid, signal.SIGKILL)
        _ok(f"{name} stopped")
        _remove_pid(name)
        return True
    except Exception as e:
        _fail(f"Failed to stop {name}: {e}")
        return False


# ─── Commands ───────────────────────────────────────────────────────────
def cmd_check():
    """Run health checks on all dependencies."""
    _header("Health Checks")
    results = {}

    _info("Checking Redis...")
    results["Redis"] = _check_redis()

    _info("Checking PostgreSQL...")
    results["PostgreSQL"] = _check_postgres()

    _info("Checking API server...")
    results["API"] = _check_api()

    print()
    all_ok = True
    for name, ok in results.items():
        if ok:
            _ok(f"{name}: connected")
        else:
            _fail(f"{name}: NOT reachable")
            all_ok = False

    return all_ok


def cmd_start():
    """Start all services with health checks."""
    _header("Starting QuillVault Backend")

    # Pre-flight checks
    _info("Running pre-flight checks...")

    if not _check_redis():
        _fail("Redis is not running!")
        _info("Start Redis: docker run -d --name redis -p 6379:6379 redis:latest")
        return False
    _ok("Redis is running")

    if not _check_postgres():
        _fail("PostgreSQL is not reachable or database 'quillvault' doesn't exist!")
        _info("Ensure PostgreSQL is running and the quillvault database exists.")
        return False
    _ok("PostgreSQL is connected")

    print()

    # Start services
    api_ok = _start_api()
    celery_ok = _start_celery()

    print()
    _header("Service Summary")

    all_ok = api_ok and celery_ok
    if all_ok:
        _ok("All services started successfully!")
        _info(f"API docs: http://localhost:{API_PORT}/docs")
        _info(f"Logs: {LOG_DIR}")
        _info("Use 'python manage.py stop' to shut down")
    else:
        _fail("Some services failed to start. Check logs/")
        _info(f"API log:      {LOG_DIR / 'api.log'}")
        _info(f"Celery log:   {LOG_DIR / 'celery.log'}")

    return all_ok


def cmd_stop():
    """Stop all services."""
    _header("Stopping QuillVault Backend")
    _stop_service("celery")
    _stop_service("api")
    print()
    _ok("All services stopped")


def cmd_restart():
    """Restart all services."""
    cmd_stop()
    time.sleep(2)
    cmd_start()


def cmd_status():
    """Show status of all services."""
    _header("QuillVault Backend Status")

    services = {
        "Redis": _check_redis(),
        "PostgreSQL": _check_postgres(),
        "API Server": _check_api(),
    }

    # Check Celery via PID
    celery_pid = _read_pid("celery")
    if celery_pid and _is_running(celery_pid):
        services["Celery Worker"] = True
    else:
        services["Celery Worker"] = False

    for name, ok in services.items():
        if ok:
            _ok(f"{name}")
        else:
            _fail(f"{name}")

    return all(services.values())


# ─── Main ───────────────────────────────────────────────────────────────
COMMANDS = {
    "start": cmd_start,
    "stop": cmd_stop,
    "restart": cmd_restart,
    "status": cmd_status,
    "check": cmd_check,
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1]
    ok = COMMANDS[cmd]()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
