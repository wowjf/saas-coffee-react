import os
import sys
import pexpect

HOST = os.environ.get("VDS_HOST", "127.0.0.1")
USER = os.environ.get("VDS_USER", "root")
PASS = os.environ.get("VDS_PASS", "")

cmd = sys.argv[1] if len(sys.argv) > 1 else "uname -a; uptime"

ssh_cmd = f"ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null {USER}@{HOST} '{cmd}'"
child = pexpect.spawn(ssh_cmd, timeout=300, encoding="utf-8")

output = []
while True:
    i = child.expect([r"password:", r"Password:", pexpect.EOF, pexpect.TIMEOUT])
    if i in (0, 1):
        child.sendline(PASS)
        output.append(child.read())
        break
    elif i == 2:
        output.append(child.before)
        break
    elif i == 3:
        print("TIMEOUT")
        break

print("".join(output))
