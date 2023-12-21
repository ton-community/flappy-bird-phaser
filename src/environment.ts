type Environment = {
  ENDPOINT: string;
}

const developmentConfig: Environment = {
  ENDPOINT: 'http://localhost:3000',
};

const productionConfig: Environment = {
  ENDPOINT: 'https://flappy.krigga.dev',
}

export const environment: Environment =
  process.env.NODE_ENV === 'production'
    ? productionConfig
    : developmentConfig;
