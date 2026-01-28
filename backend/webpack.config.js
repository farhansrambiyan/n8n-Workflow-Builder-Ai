
// webpack.config.js
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  entry: './public/firebaseauth.js',
  output: {
    path: path.resolve(__dirname, 'public/dist'),
    filename: 'bundle.js',
    clean: true,
    // Important for Chrome extensions
    library: {
      type: 'module'
    }
  },
  mode: 'production',
  // Avoid eval to comply with MV3 CSP (no 'unsafe-eval')
  devtool: false,
  
  // Chrome extension specific settings
  experiments: {
    outputModule: true
  },
  
  resolve: {
    extensions: ['.js', '.json']
  },
  
  // Prevent webpack from adding Node.js polyfills
  resolve: {
    extensions: ['.js', '.json'],
    fallback: {
      "path": false,
      "fs": false,
      "crypto": false,
      "stream": false,
      "buffer": false
    }
  },

  // Keep readable output without adding eval wrappers
  optimization: {
    minimize: false
  },

  target: 'web'
};
