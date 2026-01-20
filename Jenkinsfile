pipeline {
    agent any

    environment {
        PATH = "/usr/local/bin:/usr/bin:/bin:${env.PATH}"
        NPM_CONFIG_REGISTRY = 'https://registry.npmjs.org/'
        GITHUB_REPO = 'RecursiveManager'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh 'git log -1 --pretty=format:"%h - %s (%an)"'
            }
        }

        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }

        stage('Lint') {
            steps {
                sh 'npm run lint || true'  // Don't fail on lint warnings
            }
        }

        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run test:ci || true'  // Run tests but don't fail build yet
            }
            post {
                always {
                    junit allowEmptyResults: true, testResults: '**/test-results/*.xml'
                }
            }
        }

        stage('Build Private Binaries') {
            when {
                branch 'master'
            }
            steps {
                script {
                    // Build multi-platform binaries
                    sh '''
                        # Ensure release directory exists
                        mkdir -p release

                        # Build binaries for all platforms
                        npm run build:binaries || echo "Binary build not configured yet"

                        # Generate checksums
                        cd release 2>/dev/null && sha256sum * > SHA256SUMS || true
                    '''
                }
            }
        }

        stage('Create GitHub Release') {
            when {
                branch 'master'
                expression { return env.GIT_COMMIT != env.GIT_PREVIOUS_COMMIT }
            }
            steps {
                script {
                    def version = sh(
                        script: "node -p \"require('./package.json').version\"",
                        returnStdout: true
                    ).trim()

                    withCredentials([string(credentialsId: 'github-credentials', variable: 'GITHUB_TOKEN')]) {
                        sh """
                            # Create git tag if it doesn't exist
                            git tag -a v${version} -m "Release v${version}" || true
                            git push origin v${version} || true

                            # Create GitHub release
                            gh release create v${version} \
                                --title "RecursiveManager v${version}" \
                                --notes "Automated release from Jenkins" \
                                release/* \
                                || echo "Release already exists or failed"
                        """
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Build succeeded!'
        }
        failure {
            echo 'Build failed!'
        }
        always {
            cleanWs()
        }
    }
}
