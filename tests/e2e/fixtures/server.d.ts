export declare class TestServer {
    private app;
    private server;
    port: number;
    constructor();
    start(): Promise<void>;
    stop(): Promise<void>;
    getUrl(path: string): string;
}
//# sourceMappingURL=server.d.ts.map