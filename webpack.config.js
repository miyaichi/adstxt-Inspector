const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development',
  devtool: 'source-map',
  entry: {
    background: './src/background/background.ts',
    contentScript: './src/contentScript/contentScript.ts',
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
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'src/assets/icons/build', to: 'icons' },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './public/sidepanel.html',
      filename: 'sidepanel.html',
      chunks: ['sidepanel'],
    }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};