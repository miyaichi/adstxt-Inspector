const path = require('path');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

const copyPatterns = [
  { from: 'manifest.json', to: '.' },
  { from: '_locales', to: '_locales' },
  { from: 'src/assets/icons/build', to: 'icons' },
];

if (!isProduction) {
  copyPatterns.push({ from: 'src/config/dev.ts', to: 'config/dev.ts' });
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
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};
