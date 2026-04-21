import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({
    description: 'ID de la ruta publicada por el conductor',
    example: 'route_abc123',
  })
  @IsString()
  @IsNotEmpty({ message: 'El routeId es requerido' })
  routeId: string;

  @ApiProperty({
    description: 'user_id del conductor (dueño de la ruta)',
    example: 'driver_user_001',
  })
  @IsString()
  @IsNotEmpty({ message: 'El driverId es requerido' })
  driverId: string;

  @ApiProperty({
    description: 'user_id del pasajero interesado',
    example: 'passenger_user_002',
  })
  @IsString()
  @IsNotEmpty({ message: 'El passengerId es requerido' })
  passengerId: string;
}
