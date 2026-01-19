import { services } from "@repo/openldr-core";

const { command, dir } = services.processArguments(__dirname, process.argv);
switch (command) {
  case "setup":
    console.log(`Running setup - ${dir}`);
    break;
  case "reset":
    console.log(`Running reset - ${dir}`);
    break;
  case "stop":
    console.log(`Stopping services - ${dir}`);
    break;
  case "start":
    console.log(`Starting services - ${dir}`);
    break;
  default:
    throw new Error(`Unknown command: ${command} - ${dir}`);
}
