/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.genspark.ai' },
      { protocol: 'https', hostname: 'i.ytimg.com' }
    ]
  },
  experimental: {
    serverActions: {
      // Sponsor logo uploads can be up to 4 MB. Default is 1 MB which crashes
      // multipart submissions before our validation runs.
      bodySizeLimit: '6mb'
    }
  }
};

export default nextConfig;
