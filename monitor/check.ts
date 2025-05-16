import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";
import { ping } from "./ping";
import { site } from "~encore/clients";
import { Site } from "../site/site";
import { CronJob } from "encore.dev/cron";

// Check checks a single site.
export const check = api(
    { expose: true, method: "POST", path: "/check/:siteID" },
    async (p: { siteID: number }): Promise<{ up: boolean }> => {
        const s = await site.get({ id: p.siteID });
        return doCheck(s);
    },
);

async function doCheck(site: Site): Promise<{ up: boolean }> {
    const { up } = await ping({ url: site.url });
    await MonitorDB.exec`
        INSERT INTO checks (site_id, up, checked_at)
        VALUES (${site.id}, ${up}, NOW())
    `;
    return { up };
}

// CheckAll checks all sites.
export const checkAll = api(
    { expose: true, method: "POST", path: "/check-all" },
    async (): Promise<void> => {
        const sites = await site.list();
        await Promise.all(sites.sites.map(doCheck));
    },
);

// Check all tracked sites every 1 hour.
const cronJob = new CronJob("check-all", {
    title: "Check all sites",
    every: "1h",
    endpoint: checkAll,
});

// Define a database named 'monitor', using the database migrations
// in the "./migrations" folder. Encore automatically provisions,
// migrates, and connects to the database.
export const MonitorDB = new SQLDatabase("monitor", {
    migrations: "./migrations",
});
