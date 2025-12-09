import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";

type Bindings = {
	DB: D1Database;
  	API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", prettyJSON(), logger(), async (c, next) => {
  const auth = bearerAuth({ token: c.env.API_KEY });
  return auth(c, next);
});

app.post('/api/all', async (c) => {
  try {
    let { query, params } = await c.req.json();
    let stmt = c.env.DB.prepare(query);
    if (params) {
      const cleanParams = params.map((p:any) => {
		if (p === null || p === undefined) return null;

		if (typeof p === 'number') return p; // good
		if (typeof p === 'string') return p; // good
		if (typeof p === 'boolean') return p ? 1 : 0;

		// handle Number objects or boxed values
		if (p.valueOf) return p.valueOf();

		return p.toString();
	});

	stmt = stmt.bind(cleanParams);
    }

    const result = await stmt.run();
    return c.json(result);
  } catch (err) {
    return c.json({ error: `Failed to run query: ${err}` }, 500);
  }
});

/**
* Executes the `db.exec()` method.
* https://developers.cloudflare.com/d1/worker-api/d1-database/#exec
*/

app.post('/api/exec', async (c) => {
  try {
    let { query } = await c.req.json();
    let result = await c.env.DB.exec(query);
    return c.json(result);
  } catch (err) {
    return c.json({ error: `Failed to run query: ${err}` }, 500);
  }
});

/**
* Executes the `db.batch()` method.
* https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
*/

app.post('/api/batch', async (c) => {
  try {
    let { batch } = await c.req.json();
    let stmts = [];
    for (let query of batch) {
      let stmt = c.env.DB.prepare(query.query);
      if (query.params) {
        stmts.push(stmt.bind(query.params));
      } else {
        stmts.push(stmt);
      }
    }
    const results = await c.env.DB.batch(stmts);
    return c.json(results);
  } catch (err) {
    return c.json({ error: `Failed to run query: ${err}` }, 500);
  }
});

export default app;
/*
export default {
	async fetch(request, env, ctx): Promise<Response> {
		return new Response('Hello World!');
	},
} satisfies ExportedHandler<Env>;*/
