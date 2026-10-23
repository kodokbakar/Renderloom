import { createServer } from "./server";

const PORT = Number(process.env.PORT ?? 3000);
const server = createServer(PORT);
console.log(`Renderloom API listening on http://localhost:${server.port}`);
