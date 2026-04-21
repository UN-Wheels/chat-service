import { Module } from '@nestjs/common';
import { ROUTE_VALIDATION } from './route-validation.interface';
import { NoopRouteValidation } from './noop-route-validation';

/**
 * Módulo de validación de rutas.
 *
 * Fase 1 (MVP): usa NoopRouteValidation (confía en el cliente autenticado).
 * Fase 2: intercambiar NoopRouteValidation por ApiGatewayRouteValidation
 *         y agregar HttpModule + ConfigModule como imports.
 */
@Module({
  providers: [
    {
      provide: ROUTE_VALIDATION,
      useClass: NoopRouteValidation,
    },
  ],
  exports: [ROUTE_VALIDATION],
})
export class RouteValidationModule {}
