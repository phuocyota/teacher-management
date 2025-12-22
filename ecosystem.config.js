module.exports = {
  apps: [
    {
      name: 'teacher-management',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        UPLOAD_BASE_PATH: '/var/www/data/teacher-management/uploads',
      },
    },
  ],
};
