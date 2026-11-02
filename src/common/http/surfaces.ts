import { applyDecorators, Controller, SetMetadata } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

export const SURFACES = ['admin', 'b2c', 'b2b'] as const;
export type Surface = (typeof SURFACES)[number];

export const SURFACE_KEY = 'sparex:surface';

type SurfaceControllerOptions = {
  /** Swagger tag; defaults to the path. */
  tag?: string;
};

function surfaceController(surface: Surface, path: string, options: SurfaceControllerOptions) {
  return applyDecorators(
    Controller(path ? `${surface}/${path}` : surface),
    SetMetadata(SURFACE_KEY, surface),
    ApiTags(options.tag ?? path),
    ApiBearerAuth(),
  );
}

/**
 * Every controller belongs to exactly one surface. The decorator sets the route prefix and the surface the global
 * auth guard checks the session against, so a token from one surface is rejected on another.
 */
export const AdminController = (path: string, options: SurfaceControllerOptions = {}) =>
  surfaceController('admin', path, options);

export const B2cController = (path: string, options: SurfaceControllerOptions = {}) =>
  surfaceController('b2c', path, options);

export const B2bController = (path: string, options: SurfaceControllerOptions = {}) =>
  surfaceController('b2b', path, options);
