import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: 0,    // falha imediatamente em vez de enfileirar
  enableOfflineQueue: false,   // não enfileira comandos quando offline
  lazyConnect: true,
});

redis.on('error', () => {
  // Redis é opcional — silencia erros de conexão
});

export default redis;
