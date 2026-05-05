module.exports = {
  apps: [
    {
      name: 'televpn-v2',
      script: 'src/index.js',
      cwd: '/root/televpn/v2',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      time: true,
    },
  ],
};
