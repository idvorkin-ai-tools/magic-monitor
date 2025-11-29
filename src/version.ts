// Version info - imports generated file or provides dev defaults
// The generated file is created by scripts/generate-version.sh during build
//
// For development: run `bash scripts/generate-version.sh` once to create the file
// For production: the build script runs it automatically

// Re-export from generated file (or use defaults if import fails during dev)
export {
	BUILD_TIMESTAMP,
	GIT_BRANCH,
	GIT_COMMIT_URL,
	GIT_CURRENT_URL,
	GIT_SHA,
	GIT_SHA_SHORT,
} from "./generated_version";
