module.exports = {
  apps: [
    {
      name: "ir-os",
      script: "dist/api/index.js",
      cwd: "/opt/ir-os",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env_file: "/opt/ir-os/.env",
      env: {
        NODE_ENV: "production",
      },
      error_file: "/var/log/ir-os/error.log",
      out_file: "/var/log/ir-os/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      // Restart if the process crashes, with exponential backoff
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
