#!/usr/bin/env bash
set -euo pipefail

# Claude Code Skill Installation Script for openrouter-image
# This script installs and configures the package for use with Claude Code

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check dependencies
check_dependencies() {
  info "Checking dependencies..."

  if ! command -v node &> /dev/null; then
    error "Node.js is not installed. Please install Node.js >= 20"
    exit 1
  fi

  local node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$node_version" -lt 20 ]; then
    error "Node.js version $node_version is too old. Please install Node.js >= 20"
    exit 1
  fi

  success "Node.js $(node -v) found"
}

# Get package name (supports scoped packages)
get_package_name() {
  if [ -n "${1:-}" ]; then
    echo "$1"
  else
    echo "@mindbreaker81/openrouter-image"
  fi
}

# Install package
install_package() {
  local package_name=$(get_package_name "${1:-}")

  info "Installing $package_name globally..."

  if npm list -g "$package_name" &> /dev/null; then
    warn "$package_name is already installed globally"
    read -p "Reinstall? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      npm uninstall -g "$package_name"
    else
      info "Skipping installation"
      return 0
    fi
  fi

  if ! npm install -g "$package_name"; then
    error "Failed to install $package_name"
    exit 1
  fi

  success "$package_name installed successfully"
}

# Prompt for API key
prompt_api_key() {
  if [ -n "${OPENROUTER_API_KEY:-}" ]; then
    info "Using existing OPENROUTER_API_KEY from environment"
    return 0
  fi

  echo
  info "You need an OpenRouter API key to use this skill."
  info "Get one at: https://openrouter.ai/keys"
  echo
  read -p "Enter your OpenRouter API key (sk-or-v1-...): " api_key

  if [[ ! "$api_key" =~ ^sk-or-v1-[a-zA-Z0-9_-]+$ ]]; then
    error "Invalid API key format. Expected: sk-or-v1-..."
    exit 1
  fi

  export OPENROUTER_API_KEY="$api_key"
  success "API key accepted"
}

# Prompt for model selection
prompt_model() {
  echo
  info "Choose a default model for image generation:"
  echo "  1) google/gemini-2.5-flash-image (Fast, free tier available)"
  echo "  2) black-forest-labs/flux.2-klein-4b (High quality)"
  echo "  3) openai/gpt-5-image-mini (Good for edits)"
  echo "  4) Custom (enter manually)"
  echo
  read -p "Select [1-4]: " model_choice

  case $model_choice in
    1)
      export OPENROUTER_IMAGE_MODEL="google/gemini-2.5-flash-image"
      ;;
    2)
      export OPENROUTER_IMAGE_MODEL="black-forest-labs/flux.2-klein-4b"
      ;;
    3)
      export OPENROUTER_IMAGE_MODEL="openai/gpt-5-image-mini"
      ;;
    4)
      read -p "Enter model ID: " custom_model
      export OPENROUTER_IMAGE_MODEL="$custom_model"
      ;;
    *)
      export OPENROUTER_IMAGE_MODEL="google/gemini-2.5-flash-image"
      warn "Invalid choice, using default"
      ;;
  esac

  success "Using model: $OPENROUTER_IMAGE_MODEL"
}

# Find Claude Code config directory
find_claude_config_dir() {
  local config_dir=""
  local os=$(uname -s)

  case "$os" in
    Linux|Darwin)
      config_dir="$HOME/.claude"
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      config_dir="$USERPROFILE/.claude"
      ;;
    *)
      error "Unsupported operating system: $os"
      exit 1
      ;;
  esac

  echo "$config_dir"
}

# Configure Claude Code
configure_claude() {
  local package_name=$(get_package_name "${1:-}")
  local config_file="$2/config.json"
  local backup_file="$config_file.backup.$(date +%s)"

  info "Configuring Claude Code..."

  # Create config directory if it doesn't exist
  if [ ! -d "$2" ]; then
    mkdir -p "$2"
    info "Created config directory: $2"
  fi

  # Backup existing config
  if [ -f "$config_file" ]; then
    cp "$config_file" "$backup_file"
    info "Backed up existing config to: $backup_file"
  fi

  # Read existing config or create new object
  if [ -f "$config_file" ]; then
    config_content=$(cat "$config_file")
  else
    config_content="{}"
  fi

  # Add MCP server configuration using node
  local new_config=$(node -e "
    const fs = require('fs');
    const config = JSON.parse(process.argv[1]);
    const pkg = process.argv[2];
    const apiKey = process.argv[3];
    const model = process.argv[4];

    config.mcpServers = config.mcpServers || {};

    // Remove old configuration if exists
    delete config.mcpServers['openrouter-image'];

    // Add new configuration
    config.mcpServers['openrouter-image'] = {
      command: pkg,
      args: ['server', '--stdio'],
      env: {
        OPENROUTER_API_KEY: apiKey,
        OPENROUTER_IMAGE_MODEL: model
      }
    };

    console.log(JSON.stringify(config, null, 2));
  " "$config_content" "$package_name" "$OPENROUTER_API_KEY" "$OPENROUTER_IMAGE_MODEL")

  if [ -z "$new_config" ]; then
    error "Failed to generate configuration"
    exit 1
  fi

  echo "$new_config" > "$config_file"
  success "Configuration written to: $config_file"
}

# Verify installation
verify_installation() {
  local package_name=$(get_package_name "${1:-}")

  info "Verifying installation..."

  if ! command -v openrouter-image &> /dev/null; then
    error "CLI command not found. Installation may have failed."
    exit 1
  fi

  local version=$(openrouter-image --version 2>&1 || echo "unknown")
  success "CLI version: $version"

  info "Test run (this will call the OpenRouter API)..."
  read -p "Run test? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    info "Running: openrouter-image models"
    if openrouter-image models &> /dev/null; then
      success "Test passed"
    else
      warn "Test failed (may be due to invalid API key)"
    fi
  fi
}

# Print next steps
print_next_steps() {
  echo
  success "Installation complete!"
  echo
  info "Next steps:"
  echo "  1. Restart Claude Code completely"
  echo "  2. Try: 'Generate an image of a sunset'"
  echo "  3. Try: 'List available image models'"
  echo
  info "Configuration file: ~/.claude/config.json"
  info "Logs: Check Claude Code logs if tools don't appear"
  echo
  info "For help, see: CLAUDE_SKILL.md"
  echo
}

# Main
main() {
  echo
  echo "========================================"
  echo "  openrouter-image Installer"
  echo "  for Claude Code"
  echo "========================================"
  echo

  local package_name="${1:-}"
  local config_dir=$(find_claude_config_dir)

  check_dependencies
  install_package "$package_name"
  prompt_api_key
  prompt_model
  configure_claude "$package_name" "$config_dir"
  verify_installation "$package_name"
  print_next_steps
}

# Run
main "$@"
