import os
import sys
import pexpect

HOST = os.environ.get("VDS_HOST", "127.0.0.1")
USER = os.environ.get("VDS_USER", "root")
PASS = os.environ.get("VDS_PASS", "")

def run_ssh(cmd, timeout=300):
    print(f"\n[SSH RUN] {cmd}")
    ssh_cmd = f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {USER}@{HOST} \"{cmd}\""
    child = pexpect.spawn(ssh_cmd, timeout=timeout, encoding="utf-8")
    
    while True:
        i = child.expect([r"password:", r"Password:", pexpect.EOF, pexpect.TIMEOUT])
        if i in (0, 1):
            child.sendline(PASS)
        elif i == 2:
            break
        elif i == 3:
            print("[ERROR] TIMEOUT")
            break
    print(child.before)
    return child.exitstatus

def run_rsync(local_path, remote_path):
    print(f"\n[RSYNC] {local_path} -> {USER}@{HOST}:{remote_path}")
    rsync_cmd = f"rsync -avz --delete --exclude 'node_modules' --exclude '.git' --exclude 'dist' {local_path} {USER}@{HOST}:{remote_path}"
    child = pexpect.spawn(rsync_cmd, timeout=600, encoding="utf-8")
    
    while True:
        i = child.expect([r"password:", r"Password:", pexpect.EOF, pexpect.TIMEOUT])
        if i in (0, 1):
            child.sendline(PASS)
        elif i == 2:
            break
        elif i == 3:
            print("[ERROR] RSYNC TIMEOUT")
            break
    print(child.before)
    return child.exitstatus

if __name__ == "__main__":
    print("=== 1. Syncing project files to /opt/bancho-cafe ===")
    run_rsync("./", "/opt/bancho-cafe/")

    print("=== 2. Generating SSL cert if needed and building Docker Compose ===")
    deploy_cmd = (
        "cd /opt/bancho-cafe && "
        "chmod +x ./nginx/generate-ssl.sh ./scripts/backup-db.sh && "
        "./nginx/generate-ssl.sh && "
        "docker compose down || true && "
        "docker compose build --no-cache && "
        "docker compose up -d && "
        "sleep 5 && "
        "docker compose ps"
    )
    run_ssh(deploy_cmd, timeout=900)
