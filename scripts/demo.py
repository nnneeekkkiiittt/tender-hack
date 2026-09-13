"""Fresh-clone demo launcher. Requires Python 3.10+ and Docker Compose v2."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tarfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def fetch(asset, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if digest(destination) == asset['sha256']:
            print(f'Verified cached {destination.name}', flush=True)
            return
        raise RuntimeError(f'Checksum mismatch: {destination}; move it aside before retrying')
    partial = destination.with_suffix(destination.suffix + '.partial')
    if partial.exists() and digest(partial) == asset['sha256']:
        partial.replace(destination)
        return
    for attempt in range(3):
        try:
            size = partial.stat().st_size if partial.exists() else 0
            request = urllib.request.Request(asset['url'], headers={'Range': f'bytes={size}-'} if size else {})
            print(f'Downloading {destination.name} ({asset["size"] / 1e6:.1f} MB)', flush=True)
            with urllib.request.urlopen(request, timeout=60) as response:
                with partial.open('ab' if size and response.status == 206 else 'wb') as stream:
                    shutil.copyfileobj(response, stream, 1024 * 1024)
            if digest(partial) != asset['sha256']:
                raise RuntimeError(f'Download checksum mismatch: {partial}; move it aside before retrying')
            partial.replace(destination)
            return
        except (OSError, urllib.error.URLError):
            if attempt == 2:
                raise
            time.sleep(2)


def knowledge(state, lock):
    archive = ROOT / 'assets' / lock['knowledge']['file']
    if digest(archive) != lock['knowledge']['sha256']:
        raise RuntimeError('Committed knowledge bundle checksum mismatch')
    target = state / 'knowledge'
    marker = target / '.bundle.sha256'
    expected = lock['knowledge']['sha256']
    if marker.exists() and marker.read_text().strip() == expected:
        return
    if target.exists() and any(target.iterdir()):
        raise RuntimeError(f'{target} already contains another bundle; use a fresh --state-dir')
    target.mkdir(parents=True, exist_ok=True)
    # Only ordinary files/directories inside the target; never extract links.
    with tarfile.open(archive, 'r:gz') as bundle:
        for member in bundle.getmembers():
            output = target / member.name
            if not output.resolve().is_relative_to(target.resolve()):
                raise RuntimeError('Unsafe archive path')
            if member.isdir():
                output.mkdir(parents=True, exist_ok=True)
            elif member.isfile():
                output.parent.mkdir(parents=True, exist_ok=True)
                with bundle.extractfile(member) as source, output.open('wb') as dest:
                    shutil.copyfileobj(source, dest)
            else:
                raise RuntimeError('Unexpected archive entry')
    marker.write_text(expected + '\n')


def configuration(args, state):
    target = state / 'config.env'
    if not target.exists():
        values = {
            'COMPOSE_PROJECT_NAME': args.project,
            'POSTGRES_PASSWORD': secrets.token_hex(24),
            'BOOTSTRAP_ADMIN_USERNAME': 'administrator',
            'BOOTSTRAP_ADMIN_PASSWORD': secrets.token_urlsafe(24),
            'AI_API_KEY': secrets.token_hex(24),
            'DEMO_ACCOUNTS': 'true', 'DEMO_SEED': 'true', 'COOKIE_SECURE': 'false',
            'AI_TIMEOUT': '420', 'MODEL_NAME': 'qwen2.5-7b-instruct',
            'VLLM_BASE_URL': 'http://llm:8002/v1',
            'WEB_PORT': str(args.port), 'API_PORT': str(args.api_port), 'DB_PORT': str(args.db_port),
            'ALLOWED_ORIGINS': f'http://localhost:{args.port},http://127.0.0.1:{args.port}',
            'MANUALS_PATH': str(state / 'knowledge'),
            'E5_MODEL_PATH': str(state / 'models/e5'),
            'QWEN_MODEL_PATH': str(state / 'models/qwen/Qwen2.5-7B-Instruct-Q4_K_M.gguf'),
        }
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(''.join(f'{key}={value}\n' for key, value in values.items()))
    values = dict(line.split('=', 1) for line in target.read_text().splitlines() if line and not line.startswith('#'))
    # Reuse stored credentials/ports; never silently reset an existing installation.
    values.update(COMPOSE_PROFILES='' if args.mock else 'ml', AI_MODE='mock' if args.mock else 'http',
                  AI_URL='' if args.mock else 'http://ml:8001/ask')
    values['MODERATION_MODEL_PATH'] = str(state / 'models/moderation')
    values['WEB_BIND'] = '127.0.0.1'
    target.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
    target.chmod(0o600)
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mock', action='store_true', help='Mock answering AI; real CPU moderation remains enabled')
    parser.add_argument('--state-dir', type=Path, default=ROOT / '.demo')
    parser.add_argument('--project', default='tender-demo')
    parser.add_argument('--port', type=int, default=8080)
    parser.add_argument('--api-port', type=int, default=8000)
    parser.add_argument('--db-port', type=int, default=5433)
    parser.add_argument('--model-cache', type=Path, help='Optional e5/ and qwen/ cache; copied and checksum-verified')
    args = parser.parse_args()
    state = args.state_dir.expanduser().resolve()
    state.mkdir(parents=True, exist_ok=True)
    values = configuration(args, state)
    env = dict(os.environ, **values)
    # Explicit file/env/project keep the demo separate from developer and server settings.
    compose = ['docker', 'compose', '--env-file', str(state / 'config.env'),
               '--project-name', values['COMPOSE_PROJECT_NAME'], '-f', str(ROOT / 'docker-compose.yml')]

    def run(*command):
        subprocess.run(compose + list(command), cwd=ROOT, env=env, check=True)

    run('version')
    lock = json.loads((ROOT / 'assets/moderation.lock.json').read_text())
    for asset in lock['models']:
        fetch(asset, state / 'models/moderation' / asset['path'])
    if not args.mock:
        lock = json.loads((ROOT / 'assets/models.lock.json').read_text())
        knowledge(state, lock)
        for asset in lock['models']:
            destination = state / 'models' / asset['path']
            if args.model_cache and not destination.exists():
                source = args.model_cache / asset['path']
                if source.is_file():
                    if digest(source) != asset['sha256']:
                        raise RuntimeError(f'Wrong cached model: {source}')
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(source, destination)
            fetch(asset, destination)
        run('up', '-d', '--build', 'qdrant', 'tei', 'llm', 'ml')
        run('exec', '-T', 'ml', '.venv/bin/python', 'import_index.py')
        # Readiness is checked after import because an empty vector collection is not ready.
        check = "import urllib.request; urllib.request.urlopen('http://localhost:8001/health/ready', timeout=10)"
        for attempt in range(60):
            ready = subprocess.run(compose + ['exec', '-T', 'ml', '.venv/bin/python', '-c', check],
                                   cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if ready.returncode == 0:
                break
            time.sleep(5)
        else:
            raise RuntimeError('ML readiness failed; inspect docker compose logs (no mock fallback)')
    run('up', '-d', '--build', '--wait', '--wait-timeout', '180', 'postgres', 'liquibase', 'backend', 'frontend')
    url = f'http://localhost:{values["WEB_PORT"]}'
    with urllib.request.urlopen(url, timeout=10) as response:
        if response.status != 200:
            raise RuntimeError('Frontend is not ready')
    print(f'\nReady: {url}\nAI: {values["AI_MODE"]}\nUse Демо → Admin / L1 / L2 / L3 / Consumer.\n'
          f'Private credentials: {state / "config.env"}\n'
          'Demo accounts allow admin access. Loopback only by default; use synthetic data.', flush=True)


if __name__ == '__main__':
    main()
