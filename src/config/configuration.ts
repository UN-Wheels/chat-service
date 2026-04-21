export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/uniwheels_chat',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_secret_change_me',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },

  // Fase 2: API Gateway para validación de rutas/bookings
  apiGateway: {
    url: process.env.API_GATEWAY_URL || '',
  },
});
