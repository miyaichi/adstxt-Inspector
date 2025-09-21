const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const fs = require('fs');

const isProduction = process.env.NODE_ENV === 'production';

const copyPatterns = [
  { from: '_locales', to: '_locales' },
  { from: 'src/assets/icons/build', to: 'icons' },
];

if (!isProduction) {
  copyPatterns.push({ from: 'src/config/dev.json', to: 'config/dev.json' });
}

module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'source-map',
  entry: {
    background: './src/background/background.ts',
    sidepanel: './src/sidepanel/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CopyPlugin({
      patterns: copyPatterns,
    }),
    new HtmlWebpackPlugin({
      template: './public/sidepanel.html',
      filename: 'sidepanel.html',
      chunks: ['sidepanel'],
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || (isProduction ? 'production' : 'development')),
      __DEV_BUILD__: JSON.stringify(!isProduction),
    }),
    // Generate manifest.json with environment-specific settings
    {
      apply: (compiler) => {
        compiler.hooks.emit.tapAsync('ManifestGenerator', (compilation, callback) => {
          const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf8'));

          // Add web_accessible_resources only in development
          if (!isProduction) {
            manifest.web_accessible_resources = [
              {
                resources: ['config/dev.json'],
                matches: ['<all_urls>']
              }
            ];
          }

          const manifestString = JSON.stringify(manifest, null, 2);
          compilation.assets['manifest.json'] = {
            source: () => manifestString,
            size: () => manifestString.length
          };

          callback();
        });
      }
    },
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};
