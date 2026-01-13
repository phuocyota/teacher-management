module.exports = {
  apps: [
    {
      name: 'teacher-management',
      script: 'dist/main.js',

      exec_mode: 'cluster',
      instances: 4,

      env: {
        NODE_ENV: 'production',
        UPLOAD_BASE_PATH: '/var/www/data/teacher-management/uploads',
      },
    },
  ],
};
