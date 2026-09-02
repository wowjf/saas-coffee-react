import os
import subprocess
import pexpect

HOST = os.environ.get("VDS_HOST", "127.0.0.1")
USER = os.environ.get("VDS_USER", "root")
PASS = os.environ.get("VDS_PASS", "")

def run_ssh(cmd, timeout=900):
    print(f"\n[SSH EXEC] {cmd[:100]}...")
    ssh_cmd = f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {USER}@{HOST} \"{cmd}\""
    child = pexpect.spawn(ssh_cmd, timeout=timeout, encoding="utf-8")
    
    while True:
        i = child.expect([r"password:", r"Password:", pexpect.EOF, pexpect.TIMEOUT])
        if i in (0, 1):
            child.sendline(PASS)
        elif i == 2:
            break
        elif i == 3:
            print("[ERROR] SSH TIMEOUT")
            break
    print(child.before)
    return child.exitstatus

if __name__ == "__main__":
    print("=== 1. Creating lean deployment bundle tar.gz ===")
    exclude_flags = (
        "--exclude='./node_modules' "
        "--exclude='./.git' "
        "--exclude='./dist' "
        "--exclude='./.local-mongo' "
        "--exclude='./.agents' "
        "--exclude='./.runtime-logs' "
        "--exclude='./backups' "
        "--exclude='./uploads' "
    )
    os.system(f"tar {exclude_flags} -czf /tmp/bancho-deploy.tar.gz .")
    size_mb = os.path.getsize('/tmp/bancho-deploy.tar.gz') / (1024*1024)
    print(f"Bundle size: {size_mb:.2f} MB")

    print("=== 2. Streaming bundle to VDS /tmp ===")
    scp_cmd = f"scp -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null /tmp/bancho-deploy.tar.gz {USER}@{HOST}:/tmp/bancho-deploy.tar.gz"
    child = pexpect.spawn(scp_cmd, timeout=120, encoding="utf-8")
    while True:
        i = child.expect([r"password:", r"Password:", pexpect.EOF, pexpect.TIMEOUT])
        if i in (0, 1):
            child.sendline(PASS)
        elif i == 2:
            break
        elif i == 3:
            print("[ERROR] SCP TIMEOUT")
            break
    print(child.before)

    print("=== 3. Extracting and starting Docker Compose on VDS ===")
    deploy_cmd = (
        "mkdir -p /opt/bancho-cafe && "
        "tar -xzf /tmp/bancho-deploy.tar.gz -C /opt/bancho-cafe && "
        "rm -f /tmp/bancho-deploy.tar.gz && "
        "cd /opt/bancho-cafe && "
        "chmod +x ./nginx/generate-ssl.sh ./scripts/backup-db.sh && "
        "./nginx/generate-ssl.sh && "
        "docker compose down || true && "
        "docker compose up -d --build && "
        "sleep 8 && "
        "docker compose ps"
    )
    run_ssh(deploy_cmd, timeout=900)
