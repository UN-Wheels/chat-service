export interface JwtPayload {
  user_id?: string;
  sub?: string;      // loggueo_service emite "sub" (email) en lugar de "user_id"
  role?: 'user' | 'admin';
  iat?: number;
  exp?: number;
}
