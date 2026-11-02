import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { API_PREFIX } from './app.setup';
import { SURFACES, type Surface } from './common/http/surfaces';

const TITLES: Record<Surface, string> = {
  admin: 'SpareX Admin API',
  b2c: 'SpareX B2C API',
  b2b: 'SpareX B2B API',
};

const SCHEMA_REF = '#/components/schemas/';

/** Every `$ref` inside a value. */
function refsIn(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) refsIn(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') found.add(child);
      else refsIn(child, found);
    }
  }
  return found;
}

/** The schemas the paths use, directly or through other schemas, so one surface's types don't leak into another's. */
function usedSchemas(document: OpenAPIObject): NonNullable<OpenAPIObject['components']>['schemas'] {
  const all = document.components?.schemas ?? {};
  const used = new Set<string>();
  const pending = [...refsIn(document.paths)];
  while (pending.length > 0) {
    const name = pending.pop()?.replace(SCHEMA_REF, '');
    if (!name || used.has(name) || !(name in all)) continue;
    used.add(name);
    pending.push(...refsIn(all[name]));
  }
  return Object.fromEntries(Object.entries(all).filter(([name]) => used.has(name)));
}

/** One OpenAPI document per surface, each holding only that surface's paths and schemas. */
export function buildOpenApiDocuments(app: INestApplication): Record<Surface, OpenAPIObject> {
  const base = new DocumentBuilder().setVersion('1').addBearerAuth().build();
  const full = SwaggerModule.createDocument(app, base);
  const documents = {} as Record<Surface, OpenAPIObject>;
  for (const surface of SURFACES) {
    const prefix = `/${API_PREFIX}/${surface}`;
    const paths = Object.fromEntries(
      Object.entries(full.paths).filter(
        ([path]) => path === prefix || path.startsWith(`${prefix}/`),
      ),
    );
    const document: OpenAPIObject = {
      ...full,
      info: { ...full.info, title: TITLES[surface] },
      paths,
    };
    document.components = { ...full.components, schemas: usedSchemas(document) };
    documents[surface] = document;
  }
  return documents;
}

/** Serves the documents at /docs/admin, /docs/b2c and /docs/b2b. Never called in production. */
export function serveOpenApiDocuments(app: INestApplication): void {
  for (const [surface, document] of Object.entries(buildOpenApiDocuments(app))) {
    SwaggerModule.setup(`docs/${surface}`, app, document);
  }
}
