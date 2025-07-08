
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

if (process.env.NODE_ENV === 'development') {
  nextConfig.devServer = {
    allowedDevOrigins: ['*.cloudworkstations.dev'],
  };
}

export default nextConfig;
