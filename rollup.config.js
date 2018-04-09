import babili from 'rollup-plugin-babili'

export default {
  entry: 'index.js',
  dest: 'build/crosslink.min.js',
  format: 'umd',
  moduleName: 'crosslink',
  plugins: [
    babili( {
      comments: false,
      banner: "// crosslink.js Copyright 2015-2018 Robert Monfera",
      sourceMap: false
    } )
  ]
}
