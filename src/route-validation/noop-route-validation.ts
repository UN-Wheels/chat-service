import { Injectable, Logger } from '@nestjs/common';
import { IRouteValidation, RouteInfo } from './route-validation.interface';

/**
 * Implementación MVP (no-op) de validación de rutas.
 *
 * En la primera implementación sin API Gateway, confiamos en que los datos
 * enviados por el cliente autenticado (routeId, driverId) son correctos.
 * El JWT ya garantiza la identidad del usuario.
 *
 * Para fase 2: crear una clase `ApiGatewayRouteValidation` que implemente
 * `IRouteValidation` y haga una petición HTTP al API Gateway:
 *   GET {API_GATEWAY_URL}/routes/:routeId
 * Luego intercambiar el provider en `RouteValidationModule`.
 */
@Injectable()
export class NoopRouteValidation implements IRouteValidation {
  private readonly logger = new Logger(NoopRouteValidation.name);

  async validateRoute(routeId: string): Promise<RouteInfo | null> {
    this.logger.debug(
      `[MVP] Validacion no-op para routeId=${routeId}. ` +
        `En produccion, validar contra el API Gateway.`,
    );

    // Retornar información mínima — en MVP confiamos en el cliente
    return {
      routeId,
      driverId: '', // No disponible sin API Gateway
    };
  }
}
