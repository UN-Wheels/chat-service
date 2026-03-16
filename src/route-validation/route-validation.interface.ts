/**
 * Interfaz para validación de rutas.
 * En fase 1 (MVP), la implementación es no-op (confía en el cliente autenticado).
 * En fase 2, se intercambia por la implementación que consulta el API Gateway via HTTP.
 */
export interface RouteInfo {
  routeId: string;
  driverId: string;
  origin?: string;
  destination?: string;
}

export interface IRouteValidation {
  /**
   * Valida que una ruta exista y retorna su información.
   * Retorna null si la ruta no existe.
   */
  validateRoute(routeId: string): Promise<RouteInfo | null>;
}

/** Token de inyección para DI de NestJS */
export const ROUTE_VALIDATION = Symbol('ROUTE_VALIDATION');
