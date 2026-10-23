import { IsIn } from 'class-validator';

export class MoveRouteStopDto {
  @IsIn(['UP', 'DOWN'])
  direction!: 'UP' | 'DOWN';
}
