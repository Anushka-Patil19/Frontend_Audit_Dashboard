
pipeline {
    agent { label 'built-in' }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    environment {
        FRONTEND_NAME = 'frontend-audit-dashboard'
        BACKEND_NAME  = 'frontend-audit-backend'

        FRONTEND_PORT = '8082'
        BACKEND_PORT  = '8081'

        BACKEND_DIR = 'backend'
    }

    stages {

        stage('Checkout') {
            steps {
                git branch: 'main',
                    url: 'https://github.com/Anushka-Patil19/Frontend_Audit_Dashboard.git'
            }
        }

        stage('Verify Environment') {
            steps {
                sh '''
                    set -eu

                    echo "Workspace: $WORKSPACE"
                    echo "Node.js:"
                    node --version

                    echo "npm:"
                    npm --version

                    echo "Python:"
                    python3 --version

                    echo "PM2:"
                    pm2 --version

                    test -d backend
                    test -f package.json
                    test -f package-lock.json
                    test -f backend/requirements.txt
                    test -f backend/app/main.py
                '''
            }
        }

        stage('Inject Environment Files') {
            steps {
                withCredentials([
                    file(
                        credentialsId: 'frontend-audit-backend-env',
                        variable: 'BACKEND_ENV_FILE'
                    ),
                    file(
                        credentialsId: 'frontend-audit-frontend-env',
                        variable: 'FRONTEND_ENV_FILE'
                    )
                ]) {
                    sh '''
                        set +x
                        set -eu

                        test -d backend

                        install -m 600 \
                            "$BACKEND_ENV_FILE" \
                            "$WORKSPACE/backend/.env"

                        install -m 600 \
                            "$FRONTEND_ENV_FILE" \
                            "$WORKSPACE/.env"

                        echo "Both environment files injected."
                    '''
                }
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                sh 'npm ci'
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                sh '''
                    set -eu

                    if [ ! -x backend/venv/bin/python ]; then
                        python3 -m venv backend/venv
                    fi

                    backend/venv/bin/python -m pip install \
                        -r backend/requirements.txt
                '''
            }
        }

        stage('Build Frontend') {
            steps {
                sh '''
                    set -eu

                    NITRO_PRESET=node-server npm run build
                '''
            }
        }

        stage('Validate Build') {
            steps {
                sh '''
                    set -eu

                    test -f .output/server/index.mjs
                    test -d .output/public

                    backend/venv/bin/python -c \
                        "import uvicorn; import fastapi"

                    echo "Frontend build and backend dependencies validated."
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    set -eu

                    export NITRO_HOST=0.0.0.0
                    export NITRO_PORT="$FRONTEND_PORT"

                    if pm2 describe "$FRONTEND_NAME" >/dev/null 2>&1; then
                        pm2 restart "$FRONTEND_NAME" --update-env
                    else
                        pm2 start .output/server/index.mjs \
                            --name "$FRONTEND_NAME" \
                            --cwd "$WORKSPACE"
                    fi

                    echo "Frontend deployment command completed."
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    set -eu

                    if pm2 describe "$BACKEND_NAME" >/dev/null 2>&1; then
                        pm2 delete "$BACKEND_NAME"
                    fi

                    pm2 start "$WORKSPACE/backend/venv/bin/python" \
                        --name "$BACKEND_NAME" \
                        --interpreter none \
                        --cwd "$WORKSPACE/backend" \
                        -- -m uvicorn app.main:app \
                            --host 0.0.0.0 \
                            --port "$BACKEND_PORT"

                    echo "Backend deployment command completed."
                '''
            }
        }

        stage('Verify Deployment') {
            steps {
                sh '''
                    set -eu

                    echo "Waiting for frontend..."

                    FRONTEND_OK=0
                    for attempt in $(seq 1 20); do
                        if curl --fail --silent \
                            "http://127.0.0.1:${FRONTEND_PORT}/" \
                            -o /dev/null; then
                            FRONTEND_OK=1
                            break
                        fi
                        sleep 2
                    done

                    if [ "$FRONTEND_OK" -ne 1 ]; then
                        echo "Frontend health check failed."
                        pm2 logs "$FRONTEND_NAME" \
                            --lines 50 --nostream || true
                        exit 1
                    fi

                    echo "Frontend is responding."

                    echo "Waiting for backend..."

                    BACKEND_OK=0
                    for attempt in $(seq 1 20); do
                        if curl --fail --silent \
                            "http://127.0.0.1:${BACKEND_PORT}/docs" \
                            -o /dev/null; then
                            BACKEND_OK=1
                            break
                        fi
                        sleep 2
                    done

                    if [ "$BACKEND_OK" -ne 1 ]; then
                        echo "Backend health check failed."
                        pm2 logs "$BACKEND_NAME" \
                            --lines 50 --nostream || true
                        exit 1
                    fi

                    echo "Backend is responding."
                '''
            }
        }

        stage('Save PM2 Process List') {
            steps {
                sh 'pm2 save'
            }
        }
    }

    post {
        success {
            echo '''
                Deployment pipeline completed successfully.

                Frontend: http://192.168.100.204:8082
                Backend:  http://192.168.100.204:8081/docs
            '''
        }

        failure {
            echo 'Pipeline failed. Check the Jenkins console output and PM2 logs.'
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}
