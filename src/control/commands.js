import { listEvents } from "../db/queries/events.js";
import { listTargets } from "../db/queries/registry.js";

export async function handleCommand(message, parsed) {
  switch (parsed.cmd) {
    case "status":
      return handleStatus(message);
    default:
      await message.reply(
        `!{"ok":false,"cmd":"${parsed.cmd}","error":"unknown command"}`,
      );
  }
}

async function handleStatus(message) {
  const events = listEvents();
  const registry = listTargets("all");
  const mem = process.memoryUsage();

  const result = {
    uptimeSeconds: Math.floor(process.uptime()),
    events: events.length,
    registry: registry.length,
    memoryMb: Math.round(mem.heapUsed / 1024 / 1024),
  };

  await message.reply(
    `!${JSON.stringify({ ok: true, cmd: "status", result })}`,
  );
}
