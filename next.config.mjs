/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.genspark.ai' },
      { protocol: 'https', hostname: 'i.ytimg.com' }
    ]
  }
};

export default nextConfig;
