#!/usr/bin/env bash

set -eou pipefail

JAVA_VERSION=25
NXF_URL="https://www.nextflow.io/releases/v25.10.2/nextflow-25.10.2-one.jar"

# Create bundle directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd "${SCRIPT_DIR}"
pushd ..

mkdir -p "bundle"
pushd "bundle"

# Download Nextflow
if [ ! -f "nextflow.jar" ]; then
    echo "Downloading Nextflow..."
    curl \
        -o nextflow.jar \
        -L "$NXF_URL"
    echo "Nextflow downloaded."
else
    echo "Nextflow jar already exists. Skipping download."
fi

# Prepare Java runtime
if [ ! -d "jre" ]; then
    echo "Preparing Java runtime..."

    # Determine Java dependencies
    echo "Determining Java dependencies..."
    MODULES=$(jdeps --multi-release $JAVA_VERSION -summary nextflow.jar \
      | awk '/->/ {print $NF}' \
      | grep -E '^(java\.|jdk\.)' \
      | sort -u \
      | paste -sd, -)
    echo "Required modules: $MODULES"

    # Create minimal Java runtime
    echo "Creating minimal Java runtime..."
    jlink \
      --add-modules "$MODULES" \
      --strip-debug \
      --compress zip-6 \
      --no-header-files \
      --no-man-pages \
      --output ./jre
    echo "Minimal Java runtime created."

    # Smoke test
    echo "Running smoke test..."
    jre/bin/java -jar nextflow.jar info
    echo "Smoke test completed successfully."

else
    echo "Java runtime already exists. Skipping preparation."
fi

echo "Bundle preparation completed."

# Return to original directory
popd
popd

