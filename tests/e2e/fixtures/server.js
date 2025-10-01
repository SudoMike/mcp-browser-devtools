import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export class TestServer {
    app;
    server = null;
    port = 3456;
    constructor() {
        this.app = express();
        // Serve static HTML files
        this.app.use(express.static(join(__dirname, "pages")));
        // Health check endpoint
        this.app.get("/health", (req, res) => {
            res.json({ ok: true });
        });
    }
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.port, () => {
                    console.log(`Test server running on http://localhost:${this.port}`);
                    resolve();
                });
                this.server.on("error", (err) => {
                    reject(err);
                });
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async stop() {
        return new Promise((resolve, reject) => {
            if (!this.server) {
                resolve();
                return;
            }
            this.server.close((err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.server = null;
                    resolve();
                }
            });
        });
    }
    getUrl(path) {
        return `http://localhost:${this.port}${path}`;
    }
}
//# sourceMappingURL=server.js.map