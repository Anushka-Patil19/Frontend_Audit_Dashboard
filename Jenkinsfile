// Frontend Audit Dashboard — tag-based release pipeline.
// Follows Jenkins_Git_Tag_Versioning_Procedure.pdf: every deployment is built
// from a Git release tag (vMAJOR.MINOR.PATCH), the tag and commit SHA are
// verified and logged, and release-info.json is archived with the build so the
// Audit Dashboard (CP32) can cross-verify Jenkins, the log and GitHub.
//
// Release flow:
//   git tag -a v1.0.0 -m "Release v1.0.0"
//   git push origin v1.0.0
//   Jenkins → Build with Parameters → GIT_TAG = v1.0.0

pipeline {
    agent { label 'built-in' }

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
    }

    parameters {
        string(
            name: 'GIT_TAG',
            defaultValue: 'v1.0.0',
            description: 'Git release tag to build and deploy (e.g. v1.0.0)'
        )
    }

    environment {
        REPO_URL = 'https://github.com/Anushka-Patil19/Frontend_Audit_Dashboard.git'

        FRONTEND_NAME = 'frontend-audit-dashboard'
        BACKEND_NAME  = 'frontend-audit-backend'

        FRONTEND_PORT = '8082'
        BACKEND_PORT  = '8081'

        BACKEND_DIR = 'backend'
    }

    stages {

        stage('Validate Tag Parameter') {
            steps {
                script {
                    if (!(params.GIT_TAG ==~ /^v\d+\.\d+\.\d+$/)) {
                        error("GIT_TAG '${params.GIT_TAG}' is not a semantic version tag (expected vMAJOR.MINOR.PATCH, e.g. v1.0.0).")
                    }
                }
            }
        }

        stage('Checkout') {
            steps {
                // Check out the release tag itself — never a branch.
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: "refs/tags/${params.GIT_TAG}"]],
                    userRemoteConfigs: [[
                        url: "${REPO_URL}",
                        refspec: '+refs/tags/*:refs/tags/*'
                    ]]
                ])
            }
        }

        stage('Capture Release Information') {
            steps {
                script {
                    env.GIT_COMMIT_SHA = sh(
                        script: 'git rev-parse HEAD',
                        returnStdout: true
                    ).trim()

                    env.RELEASE_TAG = sh(
                        script: 'git describe --tags --exact-match HEAD 2>/dev/null || echo NOT_TAGGED',
                        returnStdout: true
                    ).trim()

                    if (env.RELEASE_TAG == 'NOT_TAGGED') {
                        error('Build aborted: source is not at a Git-tagged commit.')
                    }

                    if (env.RELEASE_TAG != params.GIT_TAG) {
                        error("Selected tag ${params.GIT_TAG} does not match checked-out source tag ${env.RELEASE_TAG}.")
                    }
                }

                // CP32 reads these two lines from the console log.
                echo "Git Tag: ${env.RELEASE_TAG}"
                echo "Commit SHA: ${env.GIT_COMMIT_SHA}"
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

        stage('Generate Release Metadata') {
            steps {
                // Links the tagged source to this Jenkins build. Generated only
                // after the tag/SHA verification above has passed.
                writeFile file: 'release-info.json',
                    text: """{
  "git_tag": "${env.RELEASE_TAG}",
  "commit_sha": "${env.GIT_COMMIT_SHA}",
  "build_number": "${env.BUILD_NUMBER}",
  "job_name": "${env.JOB_NAME}",
  "build_url": "${env.BUILD_URL}"
}"""
                archiveArtifacts artifacts: 'release-info.json', fingerprint: true
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
            echo """
                Deployment pipeline completed successfully.

                Release:  ${env.RELEASE_TAG} (${env.GIT_COMMIT_SHA})
                Frontend: http://192.168.100.204:8082
                Backend:  http://192.168.100.204:8081/docs
            """
        }

        failure {
            echo 'Pipeline failed. Check the Jenkins console output and PM2 logs.'
        }

        always {
            echo 'Pipeline execution finished.'
        }
    }
}
