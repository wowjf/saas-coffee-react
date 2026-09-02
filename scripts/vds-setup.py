import os
import sys
import pexpect

HOST = os.environ.get("VDS_HOST", "127.0.0.1")
USER = os.environ.get("VDS_USER", "root")
PASS = os.environ.get("VDS_PASS", "")

def run_ssh(cmd, timeout=600):
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

if __name__ == "__main__":
    setup_cmds = (
        "export DEBIAN_FRONTEND=noninteractive && "
        "apt-get update && "
        "apt-get install -y docker.io docker-compose-v2 git curl openssl rsync && "
        "systemctl enable --now docker && "
        "docker --version && "
        "docker compose version && "
        "mkdir -p /opt/bancho-cafe/nginx/ssl/live /opt/bancho-cafe/nginx/conf.d"
    )
    run_ssh(setup_cmds, timeout=600)
