/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(ts|tsx)$/,
      exclude: /\/_assets\//,
    });
    return config;
  },
};

module.exports = nextConfig;
