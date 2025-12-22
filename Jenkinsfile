pipeline {
  agent any

  environment {
    APP_PATH = "/var/www/teacher-api"
    PM2_APP = "teacher-api"
  }

  stages {

    stage('Checkout') {
      steps {
        git branch: 'main',
            url: 'https://github.com/your-org/your-repo.git'
      }
    }

    stage('Install deps') {
      steps {
        sh 'npm ci'
      }
    }

    stage('Build') {
      steps {
        sh 'npm run build'
      }
    }

    stage('Deploy') {
      steps {
        sh """
          cd $APP_PATH
          git pull
          npm ci
          npm run build
          sudo pm2 reload $PM2_APP || sudo pm2 start dist/main.js --name $PM2_APP
        """
      }
    }
  }

  post {
    success {
      echo '✅ Deploy thành công'
    }
    failure {
      echo '❌ Deploy thất bại'
    }
  }
}
