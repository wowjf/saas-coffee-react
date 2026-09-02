import { networkInterfaces } from "node:os";
import dotenv from "dotenv";

dotenv.config();

const port = Number(process.argv[2] ?? process.env.PORT ?? 3000);
const urls = new Set();
const virtualInterfacePattern = /docker|hyper-v|loopback|podman|vethernet|virtual|vmware|wsl/i;

for (const [name, network] of Object.entries(networkInterfaces())) {
  if (virtualInterfacePattern.test(name)) {
    continue;
  }

  for (const details of network ?? []) {
    if (details.family === "IPv4" && !details.internal) {
      urls.add(`http://${details.address}:${port}`);
    }
  }
}

if (urls.size === 0) {
  console.error(`No LAN IPv4 address found for port ${port}.`);
  process.exit(1);
}

console.log(`Open the app from another device with one of these URLs:`);
for (const url of urls) {
  console.log(url);
}
