/**
 * A compiler that can be instantiated with features and used inside
 * Plugin.registerCompiler
 * @param {Object} extraFeatures The same object that getDefaultOptions takes
 */
BabelCompiler = function BabelCompiler(extraFeatures) {
  Babel.validateExtraFeatures(extraFeatures);
  this.extraFeatures = extraFeatures;
};

var BCp = BabelCompiler.prototype;
var excludedFileExtensionPattern = /\.es5\.js$/i;

// hot
var reactTransform = Npm.require('babel-plugin-react-transform').default;

BCp.processFilesForTarget = function (inputFiles) {
  var self = this;

  // hot
  var partialBundle = [];

  inputFiles.forEach(function (inputFile) {
    var source = inputFile.getContentsAsString();
    var packageName = inputFile.getPackageName();
    var inputFilePath = inputFile.getPathInPackage();
    var outputFilePath = inputFilePath;
    var fileOptions = inputFile.getFileOptions();
    var toBeAdded = {
      sourcePath: inputFilePath,
      path: outputFilePath,
      data: source,
      hash: inputFile.getSourceHash(),
      sourceMap: null,
      bare: !! fileOptions.bare
    };

    // If you need to exclude a specific file within a package from Babel
    // compilation, pass the { transpile: false } options to api.addFiles
    // when you add that file.
    if (fileOptions.transpile !== false &&
        // If you need to exclude a specific file within an app from Babel
        // compilation, give it the following file extension: .es5.js
        ! excludedFileExtensionPattern.test(inputFilePath)) {

      var targetCouldBeInternetExplorer8 =
        inputFile.getArch() === "web.browser";

      self.extraFeatures = self.extraFeatures || {};
      if (! self.extraFeatures.hasOwnProperty("jscript")) {
        // Perform some additional transformations to improve
        // compatibility in older browsers (e.g. wrapping named function
        // expressions, per http://kiro.me/blog/nfe_dilemma.html).
        self.extraFeatures.jscript = targetCouldBeInternetExplorer8;
      }

      var babelOptions = Babel.getDefaultOptions(self.extraFeatures);

      // hot
      babelOptions.plugins.push([reactTransform, {
        transforms: [
          {
            transform: 'react-transform-hmr',
            imports: [ "react" ],
            locals: [ "module" ]
          }          
        ]
      }]);

      babelOptions.sourceMap = true;
      babelOptions.filename =
      babelOptions.sourceFileName = packageName
        ? "/packages/" + packageName + "/" + inputFilePath
        : "/" + inputFilePath;

      babelOptions.sourceMapTarget = babelOptions.filename + ".map";

      try {
        var result = Babel.compile(source, babelOptions);
      } catch (e) {
        if (e.loc) {
          inputFile.error({
            message: e.message,
            line: e.loc.line,
            column: e.loc.column,
          });

          return;
        }

        throw e;
      }

      toBeAdded.data = result.code;
      toBeAdded.hash = result.hash;
      toBeAdded.sourceMap = result.map;
    }

    // hot
    var path = packageName + '/' + inputFilePath;

    // inputFile.getArch() !== "web.browser"  but need to ignore test files?
    if (!hot.lastHash[path] || !inputFilePath.match(/^client/)) {

      hot.orig[path] = toBeAdded;

    } else {

      if (hot.lastHash[path] !== toBeAdded.hash) {

        if (0 /* TODO */) {

          // XXX check for new non-relative imports and force reload
          hot.orig[path] = toBeAdded;

        } else {

          partialBundle.push(toBeAdded);

        }

      }

    }

    // Always return the original code to prevent client refresh
    inputFile.addJavaScript(hot.orig[path]);

    hot.lastHash[path] = toBeAdded.hash;
    
  }); /* inputFiles.forEach */

  // hot
  if (partialBundle.length) hot.process(partialBundle);
};

BCp.setDiskCacheDirectory = function (cacheDir) {
  Babel.setCacheDir(cacheDir);
};