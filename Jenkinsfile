pipeline {
  agent any

  environment {
    APP_NAME = "teacher-management"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
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

    /* ========= DEPLOY DEV ========= */
    stage('Deploy DEV') {
      when { branch 'develop' }
      environment {
        APP_PATH = "/var/www/dev/teacher-management"
        PM2_APP  = "teacher-management-dev"
      }
      steps {
        sh '''
          cd "$APP_PATH"
          npm ci --omit=dev
          pm2 reload "$PM2_APP" || pm2 start dist/main.js --name "$PM2_APP"
        '''
      }
    }

    /* ========= DEPLOY STAGING ========= */
    stage('Deploy STAGING') {
      when { branch 'staging' }
      environment {
        APP_PATH = "/var/www/staging/teacher-management"
        PM2_APP  = "teacher-management-staging"
      }
      steps {
        sh '''
          cd "$APP_PATH"
          npm ci --omit=dev
          pm2 reload "$PM2_APP" || pm2 start dist/main.js --name "$PM2_APP"
        '''
      }
    }

    /* ========= DEPLOY PROD ========= */
    stage('Deploy PROD') {
      when { branch 'production' }
      environment {
        APP_PATH = "/var/www/prod/teacher-management"
        PM2_APP  = "teacher-management-prod"
      }
      steps {
        sh '''
          cd "$APP_PATH"
          npm ci --omit=dev
          pm2 reload "$PM2_APP" || pm2 start dist/main.js --name "$PM2_APP"
        '''
      }
    }
  }

  post {
    success {
      echo "✅ ${env.BRANCH_NAME} deploy thành công"
    }
    failure {
      echo "❌ ${env.BRANCH_NAME} deploy thất bại"
    }
  }
}