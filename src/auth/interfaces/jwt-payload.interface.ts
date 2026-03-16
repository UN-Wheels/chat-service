export interface JwtPayload {
  user_id: string;
  role?: 'user' | 'admin';
  iat?: number;
  exp?: number;
}
