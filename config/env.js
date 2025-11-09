import {config} from 'dotenv'

// Set NODE_ENV first if not already set
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

config({path: `.env.${process.env.NODE_ENV}.local`});

export const {PORT, NODE_ENV, DB_URI, JWT_SECRET, JWT_EXPIRES_IN} = process.env;