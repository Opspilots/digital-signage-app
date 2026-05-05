module.exports = {
  apps: [
    {
      name: 'digital-signage',
      script: 'dist/index.js',
      cwd: '/opt/mcp-vps/digital-signage/backend',
      env_file: '/opt/mcp-vps/digital-signage/.env',
      restart_delay: 3000,
      max_restarts: 10,
      watch: false,
    },
  ],
}
