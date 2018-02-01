var path = require('path');
var webpack = require('webpack');
var ParallelUglifyPlugin = require('webpack-parallel-uglify-plugin');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
// var HtmlWebpackPlugin = require('html-webpack-plugin');
require('babel-polyfill');

var config = config || {};

config ={
    path:path.join(__dirname,"dist"),
    publicPath:"../web/src/dist/",
    libs:path.join(__dirname,'node_modules')
}

module.exports = {
  entry: {
    indexMin:['babel-polyfill','./app.js'],
    vendor: ["monkeyui"]
  },
  output: {
    filename: '[name].js',
    path: config.path,//文件输出路径
    publicPath: config.publicPath,//静态资源引用路径
    chunkFilename: '[name].[chunkhash:5].min.js'
  },
  externals : {
    'react': 'React',
    'react-dom': 'ReactDOM',
    "echarts": "echarts"
  },
  resolve: {
        extensions: ['.js','.jsx']
  },
  module: {
    rules: [
      { 
        test: /\.jsx?$/,
        use: [ 
                {
                    loader:'babel-loader',
                    options:{presets: ['es2015','react','stage-0']}
                } 
            ],
        exclude: /node_modules/
      },
      {
        test: /\.less$/,
        use:ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: ["css-loader","less-loader"]
            })
      },
      {
        test: /\.css$/,
        use:ExtractTextPlugin.extract({
                fallback: "style-loader",
                use: [{ loader:"css-loader",
                        options:{minimize:true}}]
            })
      },
      {
        test: /\.(png|jpg|gif)$/,
        exclude: /^node_modules$/,
        use:'url-loader?limit=12000&name=./Layout/page/images/[name].[ext]'
        //注意后面那个limit的参数，当你图片大小小于这个限制的时候，会自动启用base64编码图片
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin(path.join(__dirname,"../css/restructCSS/min.css")),
    new webpack.optimize.ModuleConcatenationPlugin(),
    new webpack.optimize.UglifyJsPlugin({
      output:{
        comments:false//remove comments
      },
      compress: {
        warnings: false,
        drop_console: true, //移除console.log
        pure_funcs: ['console.log']
      }

    }),
    new webpack.optimize.CommonsChunkPlugin({
      names:['vendor']//提取运行时代码，保持公共vender hash
    }),
    new webpack.DefinePlugin({
      'process.env': {
          NODE_ENV: JSON.stringify("development")
      },
    }),
    new webpack.NoEmitOnErrorsPlugin()

  ]
};
