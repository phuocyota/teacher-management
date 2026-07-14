require('dotenv').config({ quiet: true });

module.exports = {
  apps: [
    {
      name: 'teacher-management',
      script: 'dist/main.js',

      exec_mode: 'cluster',
      instances: 4,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        PORT: Number(process.env.PORT || 3001),
        UPLOAD_BASE_PATH: '/var/www/data/teacher-management/uploads',
      },
    },
    {
      name: 'golden-bell-socket',
      script: 'dist/socket-main.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        SOCKET_PORT: Number(process.env.SOCKET_PORT || 3002),
      },
    },
  ],
};
